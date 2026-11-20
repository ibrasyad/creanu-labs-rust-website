# Web Platform Guide (`web/AGENTS.md`)

Applies to the React + TypeScript + Vite web application inside `web/`.

## 1. Stack & Execution Model

- **Active Stack**: React 19 (`^19.3.1`), TypeScript 7 (`strict: true`, `noUnusedLocals`, `noUnusedParameters`), Vite 8, Tailwind CSS v4 (`@tailwindcss/vite`), Recharts v3, `js-yaml` v5, `jszip`, `lucide-react`.
- **Execution**: Web Worker (`src/engine/simulation.worker.ts` + `src/engine/engineClient.ts`) loads CI-compiled Rust/Wasm (`src/wasm-pkg/`, built in `.github/workflows/deploy-cloudflare.yml`) when available and automatically falls back to `src/engine/simulator.ts`.

## 2. UI, Content & Export Invariants

- **Swiss Light & Dark Theme**: Centralize styling tokens in `SWISS_THEMES` (`src/types/theme.ts`); every component must support `'light'` and `'dark'` modes.
- **Decoupled Content & CSP**: Store UI copy in `src/content/site.yaml` and narrative prose in `src/content/about.md`. Render Markdown strictly via `MarkdownRenderer.tsx` (never `dangerouslySetInnerHTML`).
- **Generated Config & CSV Privacy**: `src/engine/defaultConfig.ts` is generated from `config/*.yaml` (do not hand-edit). Exported CSVs omit `persona` by default unless toggled in `ExportModal.tsx`, and route values through `escapeCsvCell`.

## 3. Related Skills

- Content/pages & theme edits → `.agents/skills/manage-site-content/SKILL.md`
- Simulator/export parity → `.agents/skills/sync-sim-engines/SKILL.md`
- Lint, build & Cloudflare verification → `.agents/skills/verify-and-deploy/SKILL.md`
