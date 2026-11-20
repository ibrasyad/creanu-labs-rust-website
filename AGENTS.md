# Project Instructions (`AGENTS.md`)

Global governance for AI assistants and contributors working on **GroceryLab** (`sim.ibnulab.com`, repo `lettuce-melon`). Keep instructions lean: universal rules live here; repeatable workflows live in **`.agents/skills/`** and load on demand.

---

## 1. Architecture Map

| Layer | Directory | Active Implementation |
| :--- | :--- | :--- |
| **Web Studio** | `web/` | React 19, TypeScript 7 (`strict`), Vite 8, Tailwind CSS v4, Recharts v3, JSZip, Astro-style `src/content/`, Web Worker simulator (`src/engine/simulator.ts` + CI-compiled Wasm) |
| **Rust Engine** | `engine/` | `lettuce-melon-engine` crate with `serde` YAML parsing & `wasm-bindgen` exports |
| **Configuration** | `config/` | Canonical YAML (`catalog`, `date`, `event`, `funnel`, `growth`, `simulation`, `personas/*.yaml`) bundled into `web/src/engine/defaultConfig.ts` |
| **Python (Archived)** | `archive/` | Archived batch Parquet/CSV CLI (`generate.py`, `bigquery.py`, `sim/`) reading `../config/` |

> **Reality-Check Rule:** Verify actual imports and `package.json` / `Cargo.toml` before assuming roadmap items in `PROJECT_MASTER_PLAN.md` are active.

---

## 2. Hard Contracts & Safety Guardrails

1. **Shared Data Schemas**: The 5 core tables (`users`, `funnel`, `transactions`, `transaction_items`, `catalog`) and their columns (including optional `persona`) are contracts across Rust (`engine/src/models.rs`), TypeScript (`web/src/types/simulation.ts`, `ExportModal.tsx`), and Python (`archive/generate.py`).
2. **Deterministic Seeding**: Preserve `random_seed` and per-date SHA-256 `seed_for_date`. Never claim Python, Rust, and TypeScript emit identical RNG draws unless explicitly tested.
3. **Output & Scan Boundaries**: **Never** overwrite or delete `archive/output/`. **Skip scanning** heavy generated/data directories (`node_modules/`, `web/dist/`, `engine/target/`, `web/src/wasm-pkg/`, `archive/output/`).
4. **Browser & Repo Security**: Never commit secrets or machine paths; never use `window.alert`, `window.confirm`, or `window.open` in web UI flows.
5. **Swiss Design & Domain Grounding**: Keep `SWISS_THEMES` (`web/src/types/theme.ts`) Light/Dark parity, IDR (`id-ID`) formatting, and realistic grocery/produce presets.

---

## 3. On-Demand Skills (`.agents/skills/`)

Load the relevant `SKILL.md` only when your task matches its scope:

- **`manage-personas-config`** — Adding/editing customer personas or YAML configs and regenerating `defaultConfig.ts`.
- **`manage-site-content`** — Editing decoupled `site.yaml` / `about.md` copy or scaffolding new Markdown pages safely under CSP.
- **`sync-sim-engines`** — Synchronizing simulation math, `serde` defaults, output structs, and CSV exports between TypeScript and Rust (includes pre-computed symbol parity map).
- **`verify-and-deploy`** — Running config bundling, simulator tests, strict TypeScript lint, Cloudflare `build:cf`, CSP checks, and Rust/Python validations.

Scoped constraints per subsystem remain in `web/AGENTS.md`, `engine/AGENTS.md`, `config/AGENTS.md`, and `archive/sim/AGENTS.md`.

