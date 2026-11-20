# Archived Python Simulation Pipeline

This directory contains the original Python batch simulation pipeline (`generate.py`, `bigquery.py`, `sim/`, `pyproject.toml`, and historical `output/` snapshots), archived after moving primary simulation and interactive delivery to `engine/` (Rust/Wasm) and `web/` (GroceryLab).

## Shared Configuration

`sim/config.py` resolves `BASE_DIR` to the repository root (`..`), so the pipeline continues to read the shared YAML configuration in `../config/`.

## Running Locally (Optional)

```bash
pip install -e archive/
python archive/generate.py --start-date 2026-01-01 --end-date 2026-01-07
```
