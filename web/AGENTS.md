# Web Platform Guide (`web/AGENTS.md`)

Applies to the React + TypeScript + Vite web application inside `web/`.

## 1. Tech Stack (Active vs. Master Plan)

- **Active Stack**:
  - **UI**: React 19 (`^19.3.1`), TypeScript 7 (`strict: true`, `noUnusedLocals`, `noUnusedParameters`), Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`).
  - **Libraries**: `recharts` v3 (charts), `js-yaml` v5 (YAML parsing/dumping), `jszip` (in-browser `.zip` export), `lucide-react` (icons), `clsx` + `tailwind-merge`.
  - **Simulation Execution**: Asynchronous Web Worker (`src/engine/simulation.worker.ts` + `src/engine/engineClient.ts`) that loads the compiled Rust/Wasm bundle (`src/wasm-pkg/` built in CI) when available and automatically falls back to the TypeScript client engine (`src/engine/simulator.ts`), with instant worker termination for Cancel.
  - **YAML Editor**: `RawYamlEditor.tsx` uses a custom full-length line-numbered `<textarea>` with synced scroll and inline reset confirmation. Legacy unused `@monaco-editor/react` was removed.
- **Target Master Plan Trajectory**:
  - CI (`.github/workflows/deploy-cloudflare.yml`) compiles `engine/` via `wasm-pack` into `web/src/wasm-pkg` before deploying static assets to Cloudflare Workers (`wrangler.jsonc`).
  - Keep `SimulationOutput` and `SimulationSummary` in `src/types/simulation.ts` structurally compatible with `engine/src/models.rs` and plain JS object `HashMap` serialization in `engine/src/lib.rs`.

## 2. Design & UX Principles (Medium Guardrails)

- **Swiss Light & Dark Theme**: All surfaces, borders, text, buttons, inputs, and chart colors are centralized in `SWISS_THEMES` (`src/types/theme.ts`). Pass `theme` props to components and support both `'light'` and `'dark'` modes cleanly.
- **Information Architecture**: Preserve the studio navigation (`Config Studio`, `Analytics Dashboard`, `Raw YAML`, `About`), sticky header preset selector, URL scenario sharing (`src/utils/shareUrl.ts`), run trigger, and export modal.
- **Domain Grounding**: Format revenue/AOV in Indonesian Rupiah (`id-ID`, IDR) and keep presets aligned with the grocery/produce catalog and customer personas (`src/presets/index.ts`, including *Cafe & Restaurant Daily Restock*).
- **Analytics Baseline Diff**: `App.tsx` computes and caches a matched-length baseline using `DEFAULT_CONFIG_YAML` over the active run's exact `start_date`..`end_date` window (90 days on initial load) so `SummaryDashboard.tsx` compares KPIs, funnel stages, revenue trend overlays, period variances, category diffs, and YAML parameter overrides (`src/utils/yamlDiff.ts`).
- **Browser Ergonomics**: Never use blocking `window.alert`, `window.confirm`, or `window.open`; prefer inline banners and inline two-step controls.

## 3. Config & Export Contracts

- **Generated Default Config**: `src/engine/defaultConfig.ts` is **generated** from `config/*.yaml` via `web/scripts/bundleConfig.cjs`. When modifying defaults in `config/`, re-run the bundler rather than manually patching `defaultConfig.ts`.
- **CSV Export Parity**: `ExportModal.tsx` exports `user.csv`, `transaction.csv`, `transaction_item.csv`, `funnel.csv`, `catalog.csv`, `simulation_config.yaml`, and `README_SQL_STARTER.md` (inside the ZIP bundle). The internal `persona` column is hidden by default to mirror `archive/generate.py` and keep ML clustering datasets honest, with an opt-in toggle for learning/debugging. Always route cell values through `escapeCsvCell` (`src/utils/csv.ts`).

## 4. Pre-Finish Checklist (`web/`)

1. If any YAML in `config/` changed, run `node scripts/bundleConfig.cjs` from `web/`.
2. Run TypeScript check: `npm run lint` (`tsc --noEmit`).
3. Run production build: `npm run build` (`tsc && vite build`).
4. Run simulator sanity checks (all presets, seed determinism, horizon bounds, YAML diff) if simulator/config utilities changed.
5. Confirm changes work in both Light and Dark themes without unused TypeScript locals/imports.
