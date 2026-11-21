# Changelog

All notable changes to **GroceryLab** are documented in this file.

## [1.0.0] - 2026-11-21

### Added
- **Cross-Engine Parity Verification (`web/scripts/verifyParity.ts`)**: Automated test suite verifying Rust/Wasm (`run_simulation_wasm`, `export_table_csv`) and TypeScript (`runSimulationClient`, `buildCsvTable`) share identical 5-table output contracts, date/weekday horizons, catalog schemas, edge-case fallbacks, and CSV headers.
- **Pre-Run Config Validation (`web/src/utils/configValidation.ts`)**: Validates YAML syntax, calendar date ordering (`start_date <= end_date`), horizon safety bounds, non-empty personas, and catalog SKUs before dispatching worker runs—and surfaces live validation status inside the Raw YAML editor.
- **Top-Level Error Boundary (`web/src/components/ErrorBoundary.tsx`)**: Swiss Light/Dark recovery UI preventing unexpected chart or rendering exceptions from blanking the workspace.
- **Pull Request CI Verification Gate**: Updated `.github/workflows/deploy-cloudflare.yml` to run Cargo unit tests, Wasm compilation, cross-engine parity (`--require-wasm`), strict TypeScript checks, and production bundling on Pull Requests to `main`.
- **Production Sign-Off Checklist**: Added end-to-end `sim.ibnulab.com` verification steps in `DEPLOYMENT.md`.

### Changed
- **Unified Brand & `1.0.0` SemVer**: Standardized **GroceryLab** naming across `metadata.json`, `package.json`, `web/package.json`, `web/wrangler.jsonc` (`grocerylab-simulator`), `engine/Cargo.toml`, `web/src/content/site.yaml`, and project documentation.
- **Theme Persistence & Accessibility**: Persisted Swiss Light/Dark preference in `localStorage` (respecting `prefers-color-scheme` on first visit), added `Escape`/backdrop dismissal and `role="dialog"` semantics to `ExportModal`, and added `role="tablist"`/`aria-selected` + `focus-visible` outlines to header navigation tabs.
- **CSV Test Coverage**: Consolidated 5-table CSV serialization in `web/src/utils/csv.ts` and `engine/src/lib.rs` (`format_table_csv`) with unit tests verifying formula-injection neutralization and default `persona` column omission.

---

## [0.9.0-beta] - 2026-11-20

### Added
- Astro-style decoupled content architecture (`web/src/content/site.yaml`, `web/src/content/about.md`) with pure-React CSP-safe Markdown rendering.
- Swiss Light/Dark dual themes (`SWISS_THEMES`), 6 built-in grocery scenarios, 90-day horizon-matched Baseline Diff dashboard, and SQL-ready ZIP export with `README_SQL_STARTER.md`.
- Rust/Wasm engine (`engine/`) synchronized with TypeScript Web Worker fallback, deterministic per-date seeding, `visit_decay`, `funnel_noise`, and Cloudflare Workers static-asset edge CSP headers.
