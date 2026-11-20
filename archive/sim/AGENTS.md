# Python Simulation Pipeline Guide (`archive/sim/AGENTS.md`)

Applies to `archive/generate.py`, `archive/bigquery.py`, and all modules in `archive/sim/`.

## 1. Core Design & Contracts

- **Entry Points**:
  - `archive/generate.py` — `initial_run()` initializes base Parquet artifacts; `main()` performs idempotent daily simulation runs (`_simulation_runs.parquet` tracks completed dates) and updates `archive/output/csv-file/`.
  - `archive/bigquery.py` — Exports generated datasets to BigQuery.
- **Schema Contracts**: Preserve the exact column lists defined in `archive/generate.py`:
  - `USER_COLUMNS`: `["persona", "user_id", "city", "gender", "acquisition_channel", "registered_date", "last_active_date"]`
  - `FUNNEL_COLUMNS`: `["session_id", "persona", "user_id", "activity", "activity_datetime"]`
  - `TRX_COLUMNS`: `["session_id", "user_id", "trx_id", "date", "persona", "total_price"]`
  - `ITEM_COLUMNS`: `["trx_id", "user_id", "persona", "date", "product", "quantity", "unit_price", "total_price"]`
  - `MANIFEST_COLUMNS`: `["simulation_date", "seed"]`
- **Deterministic Daily Seeds**: Keep `seed_for_date(base_seed, current_date)` and `set_random_seed(day_seed)` intact so backfills and daily incremental runs agree.

## 2. Safety Rules

- **Protect `archive/output/`**: Never run `initial_run()` or `main()` against `archive/output/` as a validation step—`initial_run()` intentionally replaces simulation output files.
- **Minimal Dependencies**: Stick to existing libraries (`pandas`, `scipy`, `pyarrow`, `pyyaml`, `google-cloud-bigquery` where used).
- **Clear Failures**: Raise explicit errors on missing initialization or invalid config values (e.g., `controlled_random` bounds) instead of silent fallbacks.

## 3. Packaging & Archival Status

- `archive/pyproject.toml` declares Python dependencies for optional `pip install -e archive/` usage.
- `archive/sim/config.py` resolves `BASE_DIR` to the repository root (`../config/`) so the archived Python pipeline continues to share the canonical YAML configuration.

## 4. Pre-Finish Checklist (`archive/sim/` & Archived Python Scripts)

1. Inspect callers across `archive/generate.py`, `archive/bigquery.py`, and `archive/sim/*.py` before changing function signatures or config lookups.
2. Run syntax/import validation (e.g., `python3 -m py_compile archive/generate.py archive/bigquery.py archive/sim/*.py`).
3. If behavioral verification is needed, run against an isolated temporary directory (`tempfile`)—never overwrite `archive/output/`.
