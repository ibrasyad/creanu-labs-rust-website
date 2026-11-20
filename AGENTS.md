# Project Instructions (`AGENTS.md`)

These instructions govern AI coding assistants and contributors working across the Creanu Labs (`lettuce-melon`) repository. Read this root constitution first, then read the scoped `AGENTS.md` inside whichever sub-directory you are modifying.

---

## 1. Project Context & Architecture Map

Creanu Labs generates synthetic grocery and retail analytics datasets using YAML-driven customer behavior, funnel conversion, and basket models.

| Layer | Directory | Active Implementation Today | Target Roadmap (`PROJECT_MASTER_PLAN.md`) |
| :--- | :--- | :--- | :--- |
| **Web Studio** | `web/` | React 18, TypeScript, Vite 6, Tailwind CSS v3, Recharts, JSZip, custom line-numbered YAML editor, **pure-TS simulator** (`web/src/engine/simulator.ts`) | Swap TS simulator for Rust/Wasm inside a Web Worker; deploy static assets to Cloudflare Workers (+ optional D1 community configs) |
| **Rust Engine** | `engine/` | Modular Rust crate (`lettuce-melon-engine`) with `serde` YAML parsing & `wasm-bindgen` exports | Primary browser compute engine compiled to Wasm |
| **Python Pipeline (Archived)** | `archive/sim/`, `archive/generate.py`, `archive/bigquery.py` | Archived batch CLI generating idempotent daily Parquet/CSV snapshots and BigQuery uploads | Historical batch reference reading shared `../config/` YAML |
| **Configuration** | `config/` | Modular YAML files (`catalog`, `date`, `event`, `funnel`, `growth`, `simulation`, `personas/*.yaml`) | Single source of truth bundled into `web/` defaults via `web/scripts/bundleConfig.cjs` |

> **Reality-Check Rule:** Do not assume features described in `PROJECT_MASTER_PLAN.md` (such as live Wasm execution in `web/`, Monaco Editor mounting, or React 19) are already wired. Always verify actual imports and `package.json` / `Cargo.toml` before making changes.

---

## 2. Governance Model: Medium Guardrails

Rules in this repo fall into two levels:

### Hard Contracts (Do Not Break Without Explicit Request)
1. **Shared Data Schemas**: The five core output datasets (`users`, `funnel`, `transactions`, `transaction_items`, `catalog`) and their column names are user-facing contracts across Python (`archive/generate.py`), Rust (`engine/src/models.rs`), and TypeScript (`web/src/types/simulation.ts`, `web/src/components/ExportModal.tsx`). When changing a schema field, update all directly dependent parsers, types, and exports.
2. **Deterministic Seeding & Idempotency**: Preserve seeded reproducibility (`random_seed`, per-date `seed_for_date`) and idempotent daily runs (`_simulation_runs.parquet`). Never claim Python, Rust, and TypeScript produce identical RNG sequences unless explicitly implemented and tested.
3. **Output Directory Safety**: Never overwrite, regenerate, or delete tracked files in `archive/output/` during routine code tasks or validation. Note that `initial_run()` in `archive/generate.py` intentionally replaces `archive/output/`.
4. **Security & Browser Safety**: Never commit credentials, private data, or machine-specific paths. Avoid blocking browser popups (`window.alert`, `window.open`) in new web UI flows.

### Default Principles (Agent Discretion Allowed)
- **Minimal, Focused Changes**: Follow surrounding patterns and avoid adding dependencies or abstractions unless they solve a demonstrated need.
- **Swiss Design & Grocery Domain**: Keep the web app's Swiss Light/Dark token system (`web/src/types/theme.ts`), IDR currency formatting (`id-ID`), and realistic grocery/produce presets.
- **Documented Discretion**: If departing from a default preference (for example, refactoring a brittle component, removing unused legacy dependencies like `@monaco-editor/react`, or improving UX ergonomics) produces a cleaner, safer result, you may do so—state clearly what you changed and why.
- **Beginner-Friendly Explanations**: When explaining Rust or systems concepts in responses, keep explanations accessible without cluttering code with comments that merely restate syntax.

---

## 3. Scoped Sub-Folder Guides

Load the relevant sub-folder guide before editing files in that area:

- **`web/AGENTS.md`** — React 18/Vite conventions, Swiss theme tokens, TS simulator vs. Wasm roadmap, CSV export rules, and lint/build checks.
- **`engine/AGENTS.md`** — Rust module structure mirroring `sim/`, `serde` fault-tolerant defaults, `wasm-bindgen` boundaries, and `cargo` checks.
- **`archive/sim/AGENTS.md`** — Archived Python simulation pipeline, idempotency, Parquet/CSV generation, and safe non-destructive testing.
- **`config/AGENTS.md`** — YAML config schema parity, grocery catalog/persona rules, and mandatory `bundleConfig.cjs` synchronization.

---

## 4. Pre-Finish Verification Matrix

Run the smallest relevant check for every area you modify, and report exact commands run plus any environment limitations:

| Modified Area | Required Verification |
| :--- | :--- |
| `config/*.yaml` or `config/personas/*.yaml` | Validate YAML (no duplicate keys) → run `node web/scripts/bundleConfig.cjs` → run `web/` lint & build |
| `web/` | Run `npm run lint` (`tsc --noEmit`) and `npm run build` (via root workspace or `cd web`) |
| `engine/` | Run `cargo test --manifest-path engine/Cargo.toml` (and `cargo check` if dependencies/bindings changed) |
| `archive/sim/`, `archive/generate.py`, `archive/bigquery.py` | Run `python3 -m py_compile` or temp-dir smoke checks; **never** run `initial_run()` against `archive/output/` |

