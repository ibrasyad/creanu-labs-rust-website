# YAML Configuration Guide (`config/AGENTS.md`)

Applies to all YAML files in `config/` and `config/personas/`.

## 1. Config Invariants

- **Canonical Files**: `simulation.yaml`, `date.yaml`, `catalog.yaml` (IDR `base_price`, `cooldown`), `funnel.yaml`, `growth.yaml` (`persona_profiles`), `event.yaml` (`personas`), and `personas/*.yaml`.
- **Persona Loader Rules**: Files starting with `_` (such as `_template.yaml`), `archived/`, and reference `personas.yaml` are ignored by loaders and `web/scripts/bundleConfig.cjs`.
- **No Duplicate Keys**: YAML parsers (`js-yaml` / `serde_yaml`) fail or silently shadow duplicate keys.

## 2. Related Skills

- Adding/editing personas, regenerating `defaultConfig.ts`, and verifying presets → `.agents/skills/manage-personas-config/SKILL.md`
- Adding new YAML schema keys across Rust & TypeScript → `.agents/skills/sync-sim-engines/SKILL.md`
