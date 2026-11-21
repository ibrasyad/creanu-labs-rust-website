import assert from 'node:assert/strict';
import * as yaml from 'js-yaml';
import { DEFAULT_CONFIG_YAML } from '../src/engine/defaultConfig';
import { runSimulationClient } from '../src/engine/simulator';
import { PRESET_SCENARIOS } from '../src/presets';
import { diffYamlConfigs } from '../src/utils/yamlDiff';
import { buildShareUrl, hydrateScenarioFromUrl } from '../src/utils/shareUrl';
import { buildCsvTable, escapeCsvCell } from '../src/utils/csv';
import { validateSimulationConfig } from '../src/utils/configValidation';

// 1. Seed determinism test on shortened 7-day baseline
const baseCfg = yaml.load(DEFAULT_CONFIG_YAML) as any;
baseCfg.date.start_date = '2026-01-01';
baseCfg.date.end_date = '2026-01-07';
const shortYaml = yaml.dump(baseCfg);

const runA = runSimulationClient(shortYaml);
const runB = runSimulationClient(shortYaml);
assert.equal(runA.summary.daily_metrics.length, 7, 'Expected 7 daily metric rows');
assert.equal(runA.summary.total_revenue, runB.summary.total_revenue, 'Same seed must produce identical revenue');
assert.equal(runA.summary.total_transactions, runB.summary.total_transactions, 'Same seed must produce identical order count');
assert.ok(Object.keys(runA.summary.category_revenue).length > 0, 'Expected non-empty category revenue');

// 2. Verify all 6 presets (baseline + 5 scenarios including cafe_restock) parse and simulate cleanly over a 5-day window
assert.equal(PRESET_SCENARIOS.length, 6, 'Expected baseline + 5 preset scenarios including cafe_restock');
assert.ok(PRESET_SCENARIOS.some((p) => p.id === 'cafe_restock'), 'Expected cafe_restock preset');
for (const preset of PRESET_SCENARIOS) {
  const preCheck = validateSimulationConfig(preset.configYaml);
  assert.ok(preCheck.valid, `Preset ${preset.id} failed config validation: ${preCheck.errors.join(', ')}`);
  const parsed = yaml.load(preset.configYaml) as any;
  parsed.date.start_date = '2026-02-01';
  parsed.date.end_date = '2026-02-05';
  const res = runSimulationClient(yaml.dump(parsed));
  assert.equal(res.summary.daily_metrics.length, 5, `Preset ${preset.id} failed 5-day horizon check`);
  assert.ok(res.users.length > 0, `Preset ${preset.id} produced zero users`);
}

// 3. Verify YAML diffing accurately captures parameter overrides
const modifiedCfg = yaml.load(DEFAULT_CONFIG_YAML) as any;
modifiedCfg.simulation.random_seed = 999999;
modifiedCfg.personas.family_shoppers.base_user = 42;
const diffResult = diffYamlConfigs(DEFAULT_CONFIG_YAML, yaml.dump(modifiedCfg));
assert.equal(diffResult.parseError, null);
const diffPaths = diffResult.entries.map((e) => e.path);
assert.ok(diffPaths.includes('simulation.random_seed'), 'Expected simulation.random_seed in diff');
assert.ok(diffPaths.includes('personas.family_shoppers.base_user'), 'Expected personas.family_shoppers.base_user in diff');

// 4. Verify share URL encoding and round-trip hydration
const shareUrl = buildShareUrl('cafe_restock', yaml.dump(modifiedCfg), 'https://sim.ibnulab.com/');
const parsedUrl = new URL(shareUrl);
const hydrated = hydrateScenarioFromUrl(parsedUrl.search);
assert.equal(hydrated.presetId, 'cafe_restock');
assert.equal(hydrated.error, null);
const hydratedParsed = yaml.load(hydrated.configYaml) as any;
assert.equal(hydratedParsed.simulation.random_seed, 999999);
assert.equal(hydratedParsed.personas.family_shoppers.base_user, 42);

// 5. Verify custom persona demographics, permanent ongoing campaigns, and exact date campaigns
const customCfg = yaml.load(DEFAULT_CONFIG_YAML) as any;
customCfg.date.start_date = '2026-01-01';
customCfg.date.end_date = '2026-01-03';
customCfg.personas = {
  vip_cafe: {
    profile: 'balanced',
    base_user: 15,
    daily_retry: 1,
    daily_new_user_chance: 0,
    daily_new_user_chance_weekend: 0,
    city: { bandung_exclusive: 100 },
    gender: { non_binary: 100 },
    acquisition_channel: { partner_referral: 100 },
    visit_chance: { monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1, sunday: 1 },
    monthly_visit_chance_multiplier: { january: 1.0 },
    category_weight: { beverages: 1.0 },
  },
};
customCfg.event = {
  permanent_test: {
    name: 'Permanent',
    year: 1,
    start_month: 1,
    end_month: null,
    overall: { visit: 1.0 },
  },
  date_window_test: {
    name: 'Exact Window',
    start_date: '2026-01-02',
    end_date: '2026-01-03',
    overall: { visit: 1.0 },
  },
};
const customOut = runSimulationClient(yaml.dump(customCfg));
assert.equal(customOut.users.length, 15);
assert.ok(customOut.users.every((u) => u.city === 'bandung_exclusive' && u.gender === 'non_binary' && u.acquisition_channel === 'partner_referral'));

// 6. Verify horizon prefix determinism (extending end_date preserves earlier daily metrics identically)
const prefixCfg = yaml.load(DEFAULT_CONFIG_YAML) as any;
prefixCfg.date.start_date = '2026-01-01';
prefixCfg.date.end_date = '2026-01-03';
const shortPrefixOut = runSimulationClient(yaml.dump(prefixCfg));
prefixCfg.date.end_date = '2026-01-06';
const extendedOut = runSimulationClient(yaml.dump(prefixCfg));
assert.deepEqual(
  extendedOut.summary.daily_metrics.slice(0, 3),
  shortPrefixOut.summary.daily_metrics,
  'Extending end_date must keep earlier daily metrics identical'
);

// 7. Verify unsorted visit_decay rules and empty category_weight fallback
const fallbackCfg = yaml.load(DEFAULT_CONFIG_YAML) as any;
fallbackCfg.date.start_date = '2026-01-01';
fallbackCfg.date.end_date = '2026-01-02';
fallbackCfg.simulation.visit_decay = [
  { days: 30, multiplier: 0.2 },
  { days: 0, multiplier: 1.0 },
  { days: 7, multiplier: 0.6 },
];
fallbackCfg.personas = {
  no_cat_prefs: {
    base_user: 5,
    daily_new_user_chance: 0,
    visit_chance: { monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1, sunday: 1 },
    landing_page: { conversion_rate: 1.0 },
    product_view: { conversion_rate: 1.0 },
    add_to_cart: { conversion_rate: 1.0 },
    checkout: { conversion_rate: 1.0 },
  },
};
const fallbackOut = runSimulationClient(yaml.dump(fallbackCfg));
assert.ok(fallbackOut.transactions.length > 0, 'Empty category_weight should fall back to all catalog categories');

// 8. Verify CSV escaping, formula injection neutralization, and persona column privacy defaults
assert.equal(escapeCsvCell('=SUM(A1)'), '"\'=SUM(A1)"');
assert.equal(escapeCsvCell(' +1+1'), '" +1+1"'.replace('" +1+1"', '"\' +1+1"'));
assert.equal(escapeCsvCell('-cmd'), '"\'-cmd"');
assert.equal(escapeCsvCell('@SUM'), '"\'@SUM"');
assert.equal(escapeCsvCell('Fresh "Organic" Kale'), '"Fresh ""Organic"" Kale"');

const usersCsvHidden = buildCsvTable('users', runA, false);
assert.ok(usersCsvHidden.startsWith('user_id,city,gender,acquisition_channel,registered_date,last_active_date\n'));
assert.ok(!usersCsvHidden.includes('family_shoppers'), 'Default CSV export must omit internal persona labels');

const usersCsvShown = buildCsvTable('users', runA, true);
assert.ok(usersCsvShown.startsWith('persona,user_id,city,gender,acquisition_channel,registered_date,last_active_date\n'));
assert.ok(usersCsvShown.includes('"family_shoppers"'));

const trxCsvHidden = buildCsvTable('transactions', runA, false);
assert.ok(trxCsvHidden.startsWith('session_id,user_id,trx_id,date,total_price\n'));

const itemsCsvShown = buildCsvTable('transaction_items', runA, true);
assert.ok(itemsCsvShown.startsWith('trx_id,user_id,persona,date,product,quantity,unit_price,total_price\n'));

const funnelCsvHidden = buildCsvTable('funnel', runA, false);
assert.ok(funnelCsvHidden.startsWith('session_id,user_id,activity,activity_datetime\n'));

const catalogCsv = buildCsvTable('catalog', runA, false);
assert.ok(catalogCsv.startsWith('category,subcategory,product,base_price\n'));

// 9. Verify pre-run config validation guard catches broken inputs
assert.equal(validateSimulationConfig('').valid, false);
assert.equal(validateSimulationConfig('foo: [unclosed').valid, false);

const invertedDates = yaml.load(DEFAULT_CONFIG_YAML) as any;
invertedDates.date.start_date = '2026-04-01';
invertedDates.date.end_date = '2026-03-01';
assert.equal(validateSimulationConfig(yaml.dump(invertedDates)).valid, false);

const noPersonas = yaml.load(DEFAULT_CONFIG_YAML) as any;
noPersonas.personas = {};
assert.equal(validateSimulationConfig(yaml.dump(noPersonas)).valid, false);

const emptyCatalog = yaml.load(DEFAULT_CONFIG_YAML) as any;
emptyCatalog.catalog = {};
assert.equal(validateSimulationConfig(yaml.dump(emptyCatalog)).valid, false);

console.log('ALL WEB SIMULATOR, CSV, VALIDATION & UTILITY CHECKS PASSED');
