import React, { useState } from 'react';
import {
  ArrowRight,
  Database,
  Layers,
  GitBranch,
  BarChart3,
  Sliders,
  Compass,
  CheckCircle2,
  BookOpen,
  Footprints,
} from 'lucide-react';
import { ThemeConfig } from '../types/theme';

interface AboutPageProps {
  theme: ThemeConfig;
  onNavigateTab: (tab: 'studio' | 'dashboard' | 'yaml' | 'about') => void;
}

type SchemaTableKey = 'users' | 'funnel' | 'transactions' | 'transaction_items' | 'catalog';

interface SchemaTableSpec {
  filename: string;
  grain: string;
  description: string;
  columns: { name: string; type: string; note: string }[];
}

const SCHEMA_TABLES: Record<SchemaTableKey, SchemaTableSpec> = {
  users: {
    filename: 'user.csv',
    grain: '1 row per simulated customer',
    description: 'Customer directory with segment tier, city, acquisition channel, and activity lifecycle dates.',
    columns: [
      { name: 'user_id', type: 'string', note: 'Primary customer key (e.g. usr-000001)' },
      { name: 'tier', type: 'string', note: 'Customer persona (family_shoppers, students, etc.)' },
      { name: 'city', type: 'string', note: 'Weighted city distribution (Greater Jakarta)' },
      { name: 'gender', type: 'string', note: 'Tier-weighted demographic attribute' },
      { name: 'acquisition_channel', type: 'string', note: 'organic or paid channel' },
      { name: 'registered_date', type: 'YYYY-MM-DD', note: 'Initial cohort acquisition date' },
      { name: 'last_active_date', type: 'YYYY-MM-DD', note: 'Most recent landing_page visit date' },
    ],
  },
  funnel: {
    filename: 'funnel.csv',
    grain: '1 row per funnel stage event',
    description: 'Timestamped customer journey log tracking drop-off and stage durations from visit to payment.',
    columns: [
      { name: 'session_id', type: 'string', note: 'Unique session identifier' },
      { name: 'user_id', type: 'string', note: 'Foreign key to user.csv' },
      { name: 'tier', type: 'string', note: 'Customer segment for cohort slicing' },
      { name: 'activity', type: 'enum', note: 'landing_page, product_view, add_to_cart, checkout, paid' },
      { name: 'activity_datetime', type: 'YYYY-MM-DD HH:MM:SS', note: 'Timestamp computed via bounded stage duration' },
    ],
  },
  transactions: {
    filename: 'transaction.csv',
    grain: '1 row per completed order',
    description: 'Order-level purchase headers linked to paid funnel sessions and summed basket totals.',
    columns: [
      { name: 'trx_id', type: 'string', note: 'Order key derived from session (trx-<session_id>)' },
      { name: 'session_id', type: 'string', note: 'Foreign key to funnel.csv' },
      { name: 'user_id', type: 'string', note: 'Foreign key to user.csv' },
      { name: 'date', type: 'YYYY-MM-DD HH:MM:SS', note: 'Checkout payment completion timestamp' },
      { name: 'tier', type: 'string', note: 'Customer segment at purchase time' },
      { name: 'total_price', type: 'number (IDR)', note: 'Sum of line-item totals in Indonesian Rupiah' },
    ],
  },
  transaction_items: {
    filename: 'transaction_item.csv',
    grain: '1 row per product line item inside an order',
    description: 'Detailed basket composition shaped by category affinity, subcategory cooldowns, and price noise.',
    columns: [
      { name: 'trx_id', type: 'string', note: 'Foreign key to transaction.csv' },
      { name: 'user_id', type: 'string', note: 'Foreign key to user.csv' },
      { name: 'tier', type: 'string', note: 'Customer segment' },
      { name: 'date', type: 'YYYY-MM-DD HH:MM:SS', note: 'Order timestamp' },
      { name: 'product', type: 'string', note: 'Product SKU name matching catalog.csv' },
      { name: 'quantity', type: 'integer', note: 'Poisson-sampled units with category bias' },
      { name: 'unit_price', type: 'number (IDR)', note: 'Lognormal price variation around base_price' },
      { name: 'total_price', type: 'number (IDR)', note: 'quantity × unit_price' },
    ],
  },
  catalog: {
    filename: 'catalog.csv',
    grain: '1 row per grocery product',
    description: 'Master product taxonomy covering fresh produce and supermarket essentials priced in IDR.',
    columns: [
      { name: 'category', type: 'string', note: 'Top-level department (vegetables, fruits, dairy, etc.)' },
      { name: 'subcategory', type: 'string', note: 'Subcategory group governing cooldowns & duplicates' },
      { name: 'product', type: 'string', note: 'Unique product identifier' },
      { name: 'base_price', type: 'number (IDR)', note: 'Reference unit price in Indonesian Rupiah' },
    ],
  },
};

type LeverKey =
  | 'visit_decay'
  | 'cooldown'
  | 'base_lambda'
  | 'subcategory_allow_duplicates'
  | 'funnel_noise'
  | 'seed_for_date'
  | 'tier_visibility'
  | 'global_fallbacks';

interface LeverGlossaryItem {
  key: LeverKey;
  label: string;
  yamlPath: string;
  summary: string;
  mechanism: string;
  outputImpact: string;
}

const SIMULATION_LEVERS: LeverGlossaryItem[] = [
  {
    key: 'visit_decay',
    label: 'visit_decay',
    yamlPath: 'funnel.visit_decay[]',
    summary: 'Recency multiplier controlling how returning shoppers cool off or re-engage after their last visit.',
    mechanism: 'Each day, the engine computes days_since_last_visit = current_date - last_active_date and multiplies the weekday visit_chance by the matching threshold rule.',
    outputImpact: 'Drives realistic cohort retention curves and churn tail in funnel.csv and user.csv.',
  },
  {
    key: 'cooldown',
    label: 'cooldown',
    yamlPath: 'catalog.<category>.<subcategory>.cooldown',
    summary: 'Minimum restock gap (in days) before the same buyer buys from that subcategory again.',
    mechanism: 'Before picking basket items, the simulator checks the user’s prior transaction_items timestamps and masks out subcategories still inside their cooldown window.',
    outputImpact: 'Prevents unrealistic back-to-back daily bulk restocks for staples like rice or cooking oil.',
  },
  {
    key: 'base_lambda',
    label: 'base_lambda',
    yamlPath: 'tiers.<tier>.quantity_model.base_lambda',
    summary: 'Poisson intensity parameter governing how many units of each chosen product enter a basket.',
    mechanism: 'Multiplied by tier quantity_bias[category] and seasonal/event factors to draw Poisson unit counts (>= 1 per line item).',
    outputImpact: 'Shapes quantity and total_price distributions in transaction_item.csv.',
  },
  {
    key: 'subcategory_allow_duplicates',
    label: 'subcategory_allow_duplicates',
    yamlPath: 'simulation.subcategory_allow_duplicates / tiers.<tier>.subcategory_allow_duplicates',
    summary: 'Determines whether a single order can pick multiple distinct SKUs from the same subcategory.',
    mechanism: 'When false (default for single households), once apples are chosen, other fruit SKUs in that subcategory are excluded from the rest of that basket.',
    outputImpact: 'Controls basket breadth vs. category concentration in market-basket analysis.',
  },
  {
    key: 'funnel_noise',
    label: 'funnel_noise',
    yamlPath: 'funnel.funnel_noise / tiers.<tier>.funnel_noise',
    summary: 'Daily stochastic variance applied on top of deterministic stage conversion rates.',
    mechanism: 'Applies bounded mean-one multiplicative noise (e.g., Poisson/lognormal dispersion) to step survival rolls so daily conversion fluctuates naturally.',
    outputImpact: 'Creates realistic day-to-day funnel conversion swings in funnel.csv.',
  },
  {
    key: 'seed_for_date',
    label: 'seed_for_date',
    yamlPath: 'simulation.random_seed',
    summary: 'SHA-256 deterministic per-day seed derivation combining base random_seed and YYYY-MM-DD.',
    mechanism: 'Each simulated date hashes (base_seed, current_date) independently, ensuring adding or extending horizon dates keeps earlier dates reproducible.',
    outputImpact: 'Guarantees baseline vs. scenario comparisons stay apples-to-apples over matched date windows.',
  },
  {
    key: 'tier_visibility',
    label: 'tier (Export Hidden)',
    yamlPath: 'Export Settings -> Include config tier column',
    summary: 'Internal persona label hidden in CSV downloads by default so clustering exercises stay honest.',
    mechanism: 'Algorithms like K-Means or GMM should infer customer segments from RFM spend, order frequency, and basket mix rather than leaking config tier names. Enable the toggle anytime for debugging.',
    outputImpact: 'Affects user.csv, funnel.csv, transaction.csv, and transaction_item.csv columns.',
  },
  {
    key: 'global_fallbacks',
    label: 'global fallbacks vs. tier overrides',
    yamlPath: 'funnel.* / simulation.basket / simulation.quantity_model',
    summary: 'Global funnel conversion rates, basket min/max bounds, weekday visit_chance, and base_lambda act strictly as fallbacks when a tier omits them.',
    mechanism: 'All six built-in customer tiers define their own conversion_rate, basket, visit_chance, and quantity_model values, so editing those global defaults only affects newly created or custom tiers that leave them unset.',
    outputImpact: 'To shift all existing tiers simultaneously, use growth multipliers (growth.base.overall), events, price_variation, or edit each tier directly.',
  },
];

const TRACE_ORDER_STEPS = [
  {
    step: '01',
    title: 'Daily Seed & Cohort Arrival',
    code: 'seed_for_date(20260101, "2026-02-14") -> usr-000142',
    detail: 'Date seed initializes RNG. Buyer usr-000142 (registered 2026-01-12 under family_shoppers) enters the daily active eligibility pool.',
  },
  {
    step: '02',
    title: 'Visit Chance × Recency Decay',
    code: 'p_visit = saturday (0.20) × decay(6d = 1.0) -> landing_page @ 10:14:22',
    detail: 'Saturday schedule and a 6-day recency window roll a store visit. Morning peak-hour weight places landing_page at 10:14:22.',
  },
  {
    step: '03',
    title: '5-Stage Funnel Durations',
    code: 'landing_page -> product_view (+4m) -> add_to_cart (+2m) -> checkout (+5m) -> paid @ 10:25:51',
    detail: 'Beta-bounded stage durations advance the session clock across five rows in funnel.csv with session_id = ses-20260214-0041.',
  },
  {
    step: '04',
    title: 'Cooldown Filter & Basket Draw',
    code: 'grains (cooldown 14d: skipped) | vegetables + dairy picked',
    detail: 'Rice bought 5 days earlier is masked by cooldown. Weighted selection draws Tomatoes (×2) and Fresh Milk (×1) with lognormal price variation.',
  },
  {
    step: '05',
    title: 'Relational Rows Emitted',
    code: 'trx-ses-20260214-0041 -> IDR 58,400 across 2 items',
    detail: 'One header row writes to transaction.csv, two line items write to transaction_item.csv, and usr-000142 last_active_date updates to 2026-02-14.',
  },
];

export const AboutPage: React.FC<AboutPageProps> = ({ theme, onNavigateTab }) => {
  const [selectedTable, setSelectedTable] = useState<SchemaTableKey>('transactions');
  const [selectedLever, setSelectedLever] = useState<LeverKey>('visit_decay');
  const [selectedTraceStep, setSelectedTraceStep] = useState<number>(0);

  const activeSchema = SCHEMA_TABLES[selectedTable];
  const activeLever = SIMULATION_LEVERS.find((l) => l.key === selectedLever) || SIMULATION_LEVERS[0];
  const activeTrace = TRACE_ORDER_STEPS[selectedTraceStep] || TRACE_ORDER_STEPS[0];

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Hero / Story Introduction */}
      <section className={`p-6 md:p-8 border ${theme.borderClass} ${theme.cardClass} space-y-5`}>
        <div className={`text-xs font-mono ${theme.mutedClass} flex flex-wrap items-center gap-2`}>
          <span>Creanu Labs</span>
          <span aria-hidden="true">&middot;</span>
          <span>Synthetic Grocery Analytics</span>
          <span aria-hidden="true">&middot;</span>
          <span>Zero Server Compute</span>
        </div>

        <div className="space-y-3 max-w-3xl">
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
            Realistic retail data for learning analytics, without flat random numbers.
          </h1>
          <p className={`text-sm leading-relaxed ${theme.mutedClass}`}>
            Creanu Labs (originally built as <span className="font-mono font-medium">lettuce-melon</span>) is a configurable
            synthetic grocery and produce simulator. Instead of generating uniform noise, it models how different
            shopper personas visit, drop off through a checkout funnel, respect pantry cooldowns, and build seasonal baskets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            onClick={() => onNavigateTab('studio')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold transition ${theme.accentClass}`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Configure a Scenario</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onNavigateTab('dashboard')}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-xs font-semibold border transition ${theme.buttonClass}`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Inspect Analytics Dashboard</span>
          </button>
        </div>
      </section>

      {/* Why I Made This + What It Solves */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-3`}>
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider">Why I Made This</h2>
          </div>
          <p className={`text-xs leading-relaxed ${theme.mutedClass}`}>
            Learning SQL, BI dashboards, or data engineering usually hits the same wall: sample datasets are either too
            static to explore edge cases or filled with purely random numbers that have no behavioral signal.
          </p>
          <p className={`text-xs leading-relaxed ${theme.mutedClass}`}>
            I wanted a transparent, YAML-driven generator where anyone can tweak customer habits, seasonal peaks,
            and funnel conversion rates, then download clean relational tables at zero hosting or compute cost.
          </p>
        </div>

        <div className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-3`}>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider">What It Does</h2>
          </div>
          <ul className={`space-y-2 text-xs ${theme.mutedClass}`}>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Models distinct customer segments—families, health-conscious buyers, students, professionals, and cafe owners.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Simulates daily acquisition, visit decay, weekday/monthly traffic curves, and multi-stage funnel drop-off.</span>
            </li>
            <li className="flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 mt-0.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Compares any preset or custom YAML directly against a horizon-matched baseline and exports a complete CSV + YAML ZIP.</span>
            </li>
          </ul>
        </div>
      </section>

      {/* How the Simulation Pipeline Works */}
      <section className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-5`}>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider">How Each Simulated Day Works</h2>
          <p className={`text-xs mt-0.5 ${theme.mutedClass}`}>
            Deterministic per-date seeding ensures runs stay reproducible while reflecting realistic behavioral variance.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 pt-1">
          <div className={`border-t pt-3 ${theme.borderClass} space-y-1.5`}>
            <div className="text-xs font-mono font-bold opacity-60">01. Population & Growth</div>
            <div className="text-xs font-semibold">Seeded Cohort Arrivals</div>
            <p className={`text-xs leading-relaxed ${theme.mutedClass}`}>
              Starts from tier base users and rolls daily new signups weighted by weekday, season, growth year, and marketing events.
            </p>
          </div>

          <div className={`border-t pt-3 ${theme.borderClass} space-y-1.5`}>
            <div className="text-xs font-mono font-bold opacity-60">02. Visit & Decay</div>
            <div className="text-xs font-semibold">Recency & Reactivation</div>
            <p className={`text-xs leading-relaxed ${theme.mutedClass}`}>
              Each user’s visit likelihood scales by days since last activity, weekday schedule, and peak shopping hours.
            </p>
          </div>

          <div className={`border-t pt-3 ${theme.borderClass} space-y-1.5`}>
            <div className="text-xs font-mono font-bold opacity-60">03. Funnel Journey</div>
            <div className="text-xs font-semibold">5-Stage Conversion</div>
            <p className={`text-xs leading-relaxed ${theme.mutedClass}`}>
              Visitors progress from landing page to product view, add to cart, checkout, and paid—recording bounded stage durations.
            </p>
          </div>

          <div className={`border-t pt-3 ${theme.borderClass} space-y-1.5`}>
            <div className="text-xs font-mono font-bold opacity-60">04. Basket & Cooldowns</div>
            <div className="text-xs font-semibold">Grocery Affinity & Pricing</div>
            <p className={`text-xs leading-relaxed ${theme.mutedClass}`}>
              Paid orders draw items using category weights, repeat-purchase cooldown windows, duplicate rules, and IDR price noise.
            </p>
          </div>
        </div>
      </section>

      {/* Interactive Data Dictionary (5 Exported Tables) */}
      <section className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Output Dataset Explorer</h2>
              <p className={`text-xs ${theme.mutedClass}`}>
                Inspect the five relational CSV tables packaged in every ZIP download.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg border border-inherit bg-black/5 dark:bg-white/5">
            {(Object.keys(SCHEMA_TABLES) as SchemaTableKey[]).map((key) => (
              <button
                key={key}
                onClick={() => setSelectedTable(key)}
                className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium transition ${
                  selectedTable === key ? theme.accentClass : 'opacity-70 hover:opacity-100'
                }`}
              >
                {SCHEMA_TABLES[key].filename}
              </button>
            ))}
          </div>
        </div>

        <div className={`pt-3 border-t ${theme.borderClass} space-y-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-semibold">{activeSchema.description}</span>
            <span className={`font-mono text-[11px] ${theme.mutedClass}`}>Grain: {activeSchema.grain}</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className={`border-b ${theme.borderClass} opacity-60 font-mono`}>
                  <th className="py-2 px-3 font-semibold">Column</th>
                  <th className="py-2 px-3 font-semibold">Type</th>
                  <th className="py-2 px-3 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-inherit/40">
                {activeSchema.columns.map((col) => (
                  <tr key={col.name} className="hover:bg-black/5 dark:hover:bg-white/5">
                    <td className="py-2 px-3 font-mono font-semibold">{col.name}</td>
                    <td className={`py-2 px-3 font-mono ${theme.mutedClass}`}>{col.type}</td>
                    <td className={`py-2 px-3 ${theme.mutedClass}`}>{col.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Interactive Simulation Lever Glossary */}
      <section className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-4`}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider">Interactive Simulation Lever Glossary</h2>
              <p className={`text-xs ${theme.mutedClass}`}>
                Select any YAML knob to inspect its exact simulation math and which exported tables it shifts.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {SIMULATION_LEVERS.map((lever) => (
            <button
              key={lever.key}
              onClick={() => setSelectedLever(lever.key)}
              className={`px-2.5 py-1.5 rounded border text-[11px] font-mono font-medium transition ${
                selectedLever === lever.key
                  ? theme.accentClass
                  : `${theme.borderClass} opacity-75 hover:opacity-100`
              }`}
            >
              {lever.label}
            </button>
          ))}
        </div>

        <div className={`p-4 border ${theme.borderClass} bg-black/5 dark:bg-white/5 space-y-2.5 text-xs`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono font-bold text-sm">{activeLever.label}</span>
            <span className={`font-mono text-[11px] ${theme.mutedClass}`}>YAML: {activeLever.yamlPath}</span>
          </div>
          <p className="font-medium">{activeLever.summary}</p>
          <div className={`grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t ${theme.borderClass}`}>
            <div>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${theme.mutedClass}`}>How It Runs</div>
              <p className={`mt-1 leading-relaxed ${theme.mutedClass}`}>{activeLever.mechanism}</p>
            </div>
            <div>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${theme.mutedClass}`}>Dataset Impact</div>
              <p className={`mt-1 leading-relaxed ${theme.mutedClass}`}>{activeLever.outputImpact}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Trace One Simulated Order Walkthrough */}
      <section className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-4`}>
        <div className="flex items-center gap-2">
          <Footprints className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <div>
            <h2 className="text-sm font-bold uppercase tracking-wider">Trace One Simulated Order</h2>
            <p className={`text-xs ${theme.mutedClass}`}>
              Step through how a single seeded visitor turns into linked rows across funnel, transaction, and item tables.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {TRACE_ORDER_STEPS.map((item, idx) => (
            <button
              key={item.step}
              onClick={() => setSelectedTraceStep(idx)}
              className={`p-2.5 rounded border text-left transition ${
                selectedTraceStep === idx
                  ? theme.accentClass
                  : `${theme.borderClass} opacity-75 hover:opacity-100`
              }`}
            >
              <div className="text-[10px] font-mono opacity-75">STEP {item.step}</div>
              <div className="text-xs font-semibold truncate">{item.title}</div>
            </button>
          ))}
        </div>

        <div className={`p-4 border ${theme.borderClass} bg-black/5 dark:bg-white/5 space-y-2 text-xs`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold">
              Step {activeTrace.step}: {activeTrace.title}
            </span>
          </div>
          <div className={`p-2.5 rounded border ${theme.borderClass} font-mono text-[11px] overflow-x-auto`}>
            {activeTrace.code}
          </div>
          <p className={`leading-relaxed ${theme.mutedClass}`}>{activeTrace.detail}</p>
        </div>
      </section>

      {/* Architecture Evolution & Analytics Use Cases */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-3`}>
          <div className="flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <h2 className="text-sm font-bold uppercase tracking-wider">Architecture Evolution</h2>
          </div>
          <p className={`text-xs leading-relaxed ${theme.mutedClass}`}>
            Creanu Labs began as a local Python batch pipeline outputting Parquet files for BI and BigQuery experiments.
            In this web studio, simulations run inside a non-blocking Web Worker configured to load the compiled Rust/WebAssembly engine with automatic TypeScript fallback when Wasm artifacts are absent.
          </p>
        </div>

        <div className={`p-6 border ${theme.borderClass} ${theme.cardClass} space-y-3`}>
          <h2 className="text-sm font-bold uppercase tracking-wider">Great Ways to Practice With the Output</h2>
          <ul className={`space-y-1.5 text-xs ${theme.mutedClass}`}>
            <li>&bull; Build cohort retention &amp; repeat-purchase curves from <span className="font-mono">registered_date</span> and <span className="font-mono">transaction.csv</span>.</li>
            <li>&bull; Measure funnel stage drop-off and time-to-checkout across customer tiers in <span className="font-mono">funnel.csv</span>.</li>
            <li>&bull; Run market-basket affinity or RFM segmentation on <span className="font-mono">transaction_item.csv</span>.</li>
            <li>&bull; Load all five CSVs into DuckDB, PostgreSQL, BigQuery, or dbt as a realistic portfolio warehouse.</li>
          </ul>
        </div>
      </section>
    </div>
  );
};
