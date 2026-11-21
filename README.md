# GroceryLab (`v1.0.0`)

**GroceryLab** is a browser-native synthetic grocery and retail analytics simulator. Instead of emitting uniform random noise, it models distinct customer personas, weekly and seasonal demand curves, 5-stage checkout funnels, subcategory restock cooldowns, and lognormal IDR pricing inside a non-blocking Web Worker.

---

## Key Capabilities

- **Visual Config Studio & Raw YAML Editor**: Tune population baselines, persona shopping habits, seasonal multipliers, marketing events, and catalog cooldowns in structured panels or raw YAML.
- **6 Built-In Grocery Scenarios**: Includes the 90-day steady-state baseline alongside *Weekend Family Supermarket Rush*, *Healthy Living & Organic Wave*, *Student & Young Professional Quick-Bites*, *Cafe & Restaurant Daily Restock*, and *Holiday Harvest Surge*.
- **Analytics & Baseline Diff Dashboard**: Compare simulated GMV, orders, AOV, conversion rate, category mix, and top SKUs against a horizon-matched baseline with Daily, Weekly, Monthly, and Yearly aggregations.
- **SQL-Ready ZIP Export**: Download complete, non-truncated CSVs (`user.csv`, `funnel.csv`, `transaction.csv`, `transaction_item.csv`, `catalog.csv`), the active `simulation_config.yaml`, and `README_SQL_STARTER.md` (with `persona` hidden by default for unbiased clustering).
- **Zero Server Compute Cost**: Runs 100% client-side in a Web Worker using CI-compiled Rust/WebAssembly (`engine/`) with automatic TypeScript simulator fallback (`web/src/engine/simulator.ts`), hosted on Cloudflare Workers Static Assets.

---

## Architecture Overview

| Layer | Directory | Role |
| :--- | :--- | :--- |
| **Web Studio** | `web/` | React 19, TypeScript 7 (`strict`), Vite 8, Tailwind CSS v4 (Swiss Light/Dark), Recharts v3, JSZip |
| **Rust / Wasm Engine** | `engine/` | `lettuce-melon-engine` crate (`serde_yaml`, `rand_chacha`, `sha2`, `wasm-bindgen`) |
| **Canonical Config** | `config/` | Source YAML files (`catalog`, `date`, `event`, `funnel`, `growth`, `simulation`, `personas/*.yaml`) bundled into `web/src/engine/defaultConfig.ts` |
| **Python CLI (Archived)** | `archive/` | Historical Parquet/BigQuery batch generator preserved for reference |

---

## Local Development & Verification

```bash
# Install web dependencies
npm --prefix web install

# Bundle canonical YAML defaults into web/src/engine/defaultConfig.ts
node web/scripts/bundleConfig.cjs

# Run simulator determinism, CSV export, validation, and cross-engine parity checks
bun web/scripts/verifySimulator.ts
bun web/scripts/verifyParity.ts

# Strict TypeScript lint & development server (port 3000)
npm --prefix web run lint
npm --prefix web run dev

# Production Cloudflare Workers asset build
npm --prefix web run build:cf

# Rust engine unit tests (when cargo is installed)
cargo test --manifest-path engine/Cargo.toml
```

---

## Further Reading

- [`CHANGELOG.md`](./CHANGELOG.md) — Release notes for `v1.0.0` GA and prior milestones.
- [`CUSTOMIZATION.md`](./CUSTOMIZATION.md) — Guide to editing YAML catalogs, personas, growth curves, and campaigns.
- [`DEPLOYMENT.md`](./DEPLOYMENT.md) — Cloudflare Workers (`sim.ibnulab.com`), CSP headers, GitHub Actions CI/CD, and `v1.0.0` sign-off checklist.
- [`PROJECT_MASTER_PLAN.md`](./PROJECT_MASTER_PLAN.md) — Milestone tracker (`v1.0.0` GA, with Cloudflare D1 community catalog planned for `v1.1.0`).
- [`RUST_FOR_PYTHONISTAS.md`](./RUST_FOR_PYTHONISTAS.md) — Side-by-side guide mapping the archived Python engine concepts to Rust.