# Python Simulation Pipeline Guide (`archive/sim/AGENTS.md`)

Applies to `archive/generate.py`, `archive/bigquery.py`, and `archive/sim/`.

## 1. Contracts & Safety Rules

- **Schema Parity**: Keep `USER_COLUMNS`, `FUNNEL_COLUMNS`, `TRX_COLUMNS`, `ITEM_COLUMNS`, and `MANIFEST_COLUMNS` in `archive/generate.py` aligned with `engine/src/models.rs` and `web/src/types/simulation.ts`.
- **Protect `archive/output/`**: Never run `initial_run()` or `main()` against `archive/output/` during routine edits or validation—test only against `tempfile` directories.
- **Shared Config Root**: `archive/sim/config.py` resolves `BASE_DIR` to the repo root (`../config/`) to share canonical YAML configs.

## 2. Related Skills

- Syntax/build verification steps → `.agents/skills/verify-and-deploy/SKILL.md`
- Cross-language schema sync → `.agents/skills/sync-sim-engines/SKILL.md`
