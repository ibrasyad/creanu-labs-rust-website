import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as yaml from 'js-yaml';
import { DEFAULT_CONFIG_YAML } from '../src/engine/defaultConfig';
import { runSimulationClient } from '../src/engine/simulator';
import { PRESET_SCENARIOS } from '../src/presets';
import { SimulationOutput } from '../src/types/simulation';
import { buildCsvTable } from '../src/utils/csv';

const requireWasm = process.argv.includes('--require-wasm');
const wasmDir = path.resolve(import.meta.dirname, '../src/wasm-pkg');
const wasmJsPath = path.join(wasmDir, 'lettuce_melon_engine.js');
const wasmBinPath = path.join(wasmDir, 'lettuce_melon_engine_bg.wasm');

if (!fs.existsSync(wasmJsPath) || !fs.existsSync(wasmBinPath)) {
  if (requireWasm) {
    console.error('[verifyParity] ERROR: Wasm artifacts missing in web/src/wasm-pkg while --require-wasm is set.');
    process.exit(1);
  }
  console.log('[verifyParity] Skipping Rust/Wasm cross-engine parity check (web/src/wasm-pkg not compiled in this environment).');
  process.exit(0);
}

const wasmMod = await import(pathToFileURL(wasmJsPath).href);
const wasmBytes = fs.readFileSync(wasmBinPath);
await wasmMod.default(wasmBytes);

function normalizeMap(obj: unknown): Record<string, any> {
  if (obj instanceof Map) {
    return Object.fromEntries(obj.entries());
  }
  return (obj && typeof obj === 'object' ? obj : {}) as Record<string, any>;
}

function normalizeWasmOutput(raw: any): SimulationOutput {
  return {
    users: raw.users || [],
    funnel: raw.funnel || [],
    transactions: raw.transactions || [],
    transaction_items: raw.transaction_items || [],
    catalog: raw.catalog || [],
    summary: {
      ...raw.summary,
      funnel_breakdown: normalizeMap(raw.summary?.funnel_breakdown),
      category_revenue: normalizeMap(raw.summary?.category_revenue),
      daily_metrics: raw.summary?.daily_metrics || [],
      top_products: raw.summary?.top_products || [],
    },
  };
}

function assertOutputContracts(label: string, tsOut: SimulationOutput, wasmOut: SimulationOutput, expectedDays: number) {
  assert.equal(wasmOut.summary.daily_metrics.length, expectedDays, `${label}: Wasm daily_metrics length mismatch`);
  assert.equal(tsOut.summary.daily_metrics.length, expectedDays, `${label}: TS daily_metrics length mismatch`);

  // Exact calendar date + weekday alignment
  assert.deepEqual(
    wasmOut.summary.daily_metrics.map((d) => ({ date: d.date, weekday: d.weekday })),
    tsOut.summary.daily_metrics.map((d) => ({ date: d.date, weekday: d.weekday })),
    `${label}: Date/weekday series mismatch between Wasm and TS`
  );

  // Identical catalog extraction
  assert.equal(wasmOut.catalog.length, tsOut.catalog.length, `${label}: Catalog length mismatch`);
  assert.deepEqual(
    wasmOut.catalog.map((c) => c.product).sort(),
    tsOut.catalog.map((c) => c.product).sort(),
    `${label}: Catalog product list mismatch`
  );

  // Valid financial & funnel invariants on both engines
  for (const [engineName, out] of [
    ['wasm', wasmOut],
    ['typescript', tsOut],
  ] as const) {
    assert.ok(out.users.length > 0, `${label} (${engineName}): expected users > 0`);
    assert.ok(out.funnel.length > 0, `${label} (${engineName}): expected funnel events > 0`);
    assert.ok(
      out.summary.overall_conversion_rate >= 0 && out.summary.overall_conversion_rate <= 1,
      `${label} (${engineName}): conversion rate out of [0,1]`
    );

    if (out.transactions.length > 0) {
      assert.ok(out.summary.total_revenue > 0, `${label} (${engineName}): expected positive revenue`);
      const sampleTrx = out.transactions[0];
      assert.ok('session_id' in sampleTrx && 'user_id' in sampleTrx && 'trx_id' in sampleTrx && 'total_price' in sampleTrx);
    }
  }
}

// 1. Check all 6 built-in scenarios over a 7-day window in both engines
for (const preset of PRESET_SCENARIOS) {
  const cfg = yaml.load(preset.configYaml) as any;
  cfg.date.start_date = '2026-02-01';
  cfg.date.end_date = '2026-02-07';
  const scenarioYaml = yaml.dump(cfg);

  const tsOut = runSimulationClient(scenarioYaml);
  const wasmOutA = normalizeWasmOutput(wasmMod.run_simulation_wasm(scenarioYaml, null, null, null, null));
  const wasmOutB = normalizeWasmOutput(wasmMod.run_simulation_wasm(scenarioYaml, null, null, null, null));

  // Rust determinism check
  assert.equal(wasmOutA.summary.total_revenue, wasmOutB.summary.total_revenue, `${preset.id}: Wasm non-deterministic revenue`);
  assert.equal(wasmOutA.transactions.length, wasmOutB.transactions.length, `${preset.id}: Wasm non-deterministic order count`);

  // Cross-engine structural & invariant parity
  assertOutputContracts(preset.id, tsOut, wasmOutA, 7);
}

// 2. Check custom edge-case parity (unsorted visit_decay + empty category_weight + exact date campaign)
const edgeCfg = yaml.load(DEFAULT_CONFIG_YAML) as any;
edgeCfg.date.start_date = '2026-01-01';
edgeCfg.date.end_date = '2026-01-05';
edgeCfg.simulation.visit_decay = [
  { days: 30, multiplier: 0.2 },
  { days: 0, multiplier: 1.0 },
  { days: 7, multiplier: 0.6 },
];
edgeCfg.personas = {
  edge_persona: {
    base_user: 10,
    daily_new_user_chance: 0,
    daily_new_user_chance_weekend: 0,
    visit_chance: { monday: 1, tuesday: 1, wednesday: 1, thursday: 1, friday: 1, saturday: 1, sunday: 1 },
    landing_page: { conversion_rate: 1.0 },
    product_view: { conversion_rate: 1.0 },
    add_to_cart: { conversion_rate: 1.0 },
    checkout: { conversion_rate: 1.0 },
  },
};
const edgeYaml = yaml.dump(edgeCfg);
const tsEdge = runSimulationClient(edgeYaml);
const wasmEdge = normalizeWasmOutput(wasmMod.run_simulation_wasm(edgeYaml, null, null, null, null));
assert.equal(wasmEdge.users.length, 10);
assert.equal(tsEdge.users.length, 10);
assertOutputContracts('edge_case', tsEdge, wasmEdge, 5);

// 3. Check Wasm export_table_csv header parity with TypeScript buildCsvTable
const wasmRawSample = wasmMod.run_simulation_wasm(edgeYaml, null, null, null, null);
for (const table of ['users', 'transactions', 'transaction_items', 'funnel', 'catalog'] as const) {
  for (const includePersona of [false, true]) {
    const wasmCsv: string = wasmMod.export_table_csv(table, wasmRawSample, includePersona);
    const tsCsv = buildCsvTable(table, wasmEdge, includePersona);
    const wasmHeader = wasmCsv.split('\n')[0];
    const tsHeader = tsCsv.split('\n')[0];
    assert.equal(wasmHeader, tsHeader, `CSV header mismatch for ${table} (includePersona=${includePersona})`);
  }
}

console.log('CROSS-ENGINE PARITY CHECKS PASSED (Rust/Wasm <-> TypeScript)');
