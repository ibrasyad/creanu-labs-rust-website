---
name: manage-personas-config
description: >-
  Guides adding or editing customer personas and YAML simulation configs in
  config/, then regenerating bundled web defaults and verifying presets. Use when
  modifying config/*.yaml, config/personas/*.yaml, or src/presets/index.ts. Do
  NOT use for UI layout, Rust math changes, or About copy edits.
---

# Manage Personas & YAML Configs

## Scope & Guardrails

- **Active persona loader rule**: Individual `.yaml` files in `config/personas/` are loaded alphabetically; files starting with `_` (such as `_template.yaml`), `archived/`, and `config/personas.yaml` are ignored by loaders.
- **No duplicate keys**: `js-yaml` (web) and `serde_yaml` (Rust) either fail or silently shadow duplicate YAML keys. Validate uniqueness across every file.
- **Strict key names**: Use `personas`, `persona_profiles`, and `persona` (never `tiers` or `tier_profiles`).

## Workflow: Add or Edit a Persona

1. **Copy or edit YAML**:
   - To add a persona, copy `config/personas/_template.yaml` to `config/personas/<snake_case_name>.yaml` and rename the root key to `<snake_case_name>`.
   - Need exact field definitions or allowed enum values (`conservative`, `balanced`, `aggressive`)? Read [references/persona-schema.md](references/persona-schema.md).
2. **Check cross-config dependencies**:
   - Every key referenced in `category_weight` or `quantity_bias` must exist in `config/catalog.yaml`.
   - `profile` must match a key under `growth.base.persona_profiles` in `config/growth.yaml`.
   - Event overrides in `config/event.yaml` use `personas.<persona_name>`.
3. **Check Web Studio presets**:
   - Inspect `web/src/presets/index.ts` if a new persona should appear in scenario presets (presets clone and mutate `DEFAULT_CONFIG_YAML` via `cfg.personas`).
4. **Regenerate the web default bundle (MANDATORY)**:
   - `web/src/engine/defaultConfig.ts` is generated—never edit it by hand. Run:
   ```bash
   node web/scripts/bundleConfig.cjs
   ```
   - Note: the bundler intentionally clamps the web default `date` window to 90 days (`2026-01-01` to `2026-03-31`) for fast browser baseline runs.

## Verification

Run these commands from the repository root before finishing:

```bash
node web/scripts/bundleConfig.cjs
bun web/scripts/verifySimulator.ts
npm --prefix web run lint
npm --prefix web run build
```

If `config/` keys changed structure (not just values), also trigger `sync-sim-engines` to keep Rust `serde` structs (`engine/src/config.rs`), TypeScript UI controls (`web/src/components/ConfigEditor.tsx`), and Python (`archive/sim/config.py`) aligned.
