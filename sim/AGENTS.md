# Python Simulation Pipeline Guide (`sim/AGENTS.md`)

Applies to `generate.py`, `bigquery.py`, and all modules in `sim/`.

## 1. Core Design & Contracts

- **Entry Points**:
  - `generate.py` — `initial_run()` initializes base Parquet artifacts; `main()` performs idempotent daily simulation runs (`_simulation_runs.parquet` tracks completed dates) and updates `output/csv-file/`.
  - `bigquery.py` — Exports generated datasets to BigQuery.
- **Schema Contracts**: Preserve the exact column lists defined in `generate.py`:
  - `USER_COLUMNS`: `["tier", "user_id", "city", "gender", "acquisition_channel", "registered_date", "last_active_date"]`
  - `FUNNEL_COLUMNS`: `["session_id", "tier", "user_id", "activity", "activity_datetime"]`
  - `TRX_COLUMNS`: `["session_id", "user_id", "trx_id", "date", "tier", "total_price"]`
  - `ITEM_COLUMNS`: `["trx_id", "user_id", "tier", "date", "product", "quantity", "unit_price", "total_price"]`
  - `MANIFEST_COLUMNS`: `["simulation_date", "seed"]`
- **Deterministic Daily Seeds**: Keep `seed_for_date(base_seed, current_date)` and `set_random_seed(day_seed)` intact so backfills and daily incremental runs agree.

## 2. Safety Rules

- **Protect `output/`**: Never run `initial_run()` or `main()` against the repository's `output/` directory as a validation step—`initial_run()` intentionally replaces simulation output files.
- **Minimal Dependencies**: Stick to existing libraries (`pandas`, `scipy`, `pyarrow`, `pyyaml`, `google-cloud-bigquery` where used).
- **Clear Failures**: Raise explicit errors on missing initialization or invalid config values (e.g., `controlled_random` bounds) instead of silent fallbacks.

## 3. Packaging & Planned Archival

- `pyproject.toml` at the repository root declares Python dependencies for `pip install -e .` in CI workflows.
- **Planned Archival**: Once the Rust/WebAssembly browser simulator (`engine/` + `web/`) is verified end-to-end, `generate.py`, `bigquery.py`, `sim/`, and scheduled Parquet workflows are slated for archival (keeping the original Python copy in git history/upstream repo).

## 4. Pre-Finish Checklist (`sim/` & Root Python Scripts)

1. Inspect callers across `generate.py`, `bigquery.py`, and `sim/*.py` before changing function signatures or config lookups.
2. Run syntax/import validation (e.g., `python3 -m py_compile generate.py bigquery.py sim/*.py`).
3. If behavioral verification is needed, run against an isolated temporary directory (`tempfile`)—never overwrite `output/`.
