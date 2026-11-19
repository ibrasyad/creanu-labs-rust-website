# YAML Configuration Guide (`config/AGENTS.md`)

Applies to all YAML files in `config/` and `config/tiers/`.

## 1. Structure & Domain Rules

- **Core Files**: `simulation.yaml`, `date.yaml`, `catalog.yaml`, `funnel.yaml`, `growth.yaml`, `event.yaml`.
- **Customer Tiers (`config/tiers/`)**:
  - Active tiers live as individual `.yaml` files (`family_shoppers.yaml`, `health_conscious.yaml`, `students.yaml`, `young_professionals.yaml`, `small_business_owners.yaml`, `random.yaml`).
  - Files prefixed with `_` (such as `_template.yaml`) and `archived/` are ignored by both Python/Rust loaders and `web/scripts/bundleConfig.cjs`.
  - `tiers.yaml` is kept for reference only.
- **Catalog Domain**: `catalog.yaml` models fresh groceries, produce, and supermarket goods with `base_price` in Indonesian Rupiah (IDR) and per-subcategory `cooldown` rules.

## 2. Cross-Layer Synchronization

- **Avoid Duplicate Keys**: YAML parsers (`js-yaml` in `web/`, `serde_yaml` in Rust) can reject or silently shadow duplicate keys. Keep keys unique across every section.
- **Schema Evolution**: If you add, rename, or remove a YAML key, verify all three consumers:
  1. Python loader (`sim/config.py`)
  2. Rust structs (`engine/src/config.rs`)
  3. Web simulator, visual controls, and presets (`web/src/engine/simulator.ts`, `web/src/components/ConfigEditor.tsx`, `web/src/presets/index.ts`)
- **Web Default Bundle**: `web/src/engine/defaultConfig.ts` is generated from `config/*.yaml` by `web/scripts/bundleConfig.cjs`. Note that the bundler overrides the web UI's default date window to 90 days (`2026-01-01` to `2026-03-31`) for baseline statistics while preserving all other config values.

## 3. Pre-Finish Checklist (`config/`)

1. Validate YAML syntax (no duplicate keys, valid indentation and numeric ranges).
2. Re-generate the web bundle: `node web/scripts/bundleConfig.cjs` (or `node scripts/bundleConfig.cjs` from `web/`).
3. Run `npm run lint` and `npm run build` in `web/` to ensure TypeScript types and presets still compile cleanly.
