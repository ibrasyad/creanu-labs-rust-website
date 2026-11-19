# Rust Simulation Engine Guide (`engine/AGENTS.md`)

Applies to the `lettuce-melon-engine` Rust crate in `engine/`.

## 1. Architecture & Python/TS Parity

- Module layout mirrors the Python simulation (`sim/`) and TypeScript simulator (`web/src/engine/simulator.ts`):
  - `config.rs` — `serde` structs (`FullSimulationConfig`) parsing YAML or JSON configs.
  - `models.rs` — Output schemas (`UserRecord`, `FunnelEventRecord`, `TransactionRecord`, `TransactionItemRecord`, `CatalogItemRecord`, `DailyMetric`, `SimulationSummary`, `SimulationOutput`).
  - `user.rs`, `funnel.rs`, `basket.rs`, `simulation.rs`, `utils.rs` — Core simulation stages and deterministic seeded RNG (`rand_chacha`, `sha2`).
  - `lib.rs` — `wasm-bindgen` entry points (`validate_config_wasm`, `run_simulation_wasm`, `export_table_csv`).

## 2. Engineering Rules (Medium Guardrails)

- **Fault-Tolerant Config Parsing**: Because users edit raw YAML in the web UI, `config.rs` structs should use `#[serde(default)]` and clear error messages (`Result<_, String>`) rather than panicking on omitted optional keys.
- **Schema & Export Stability**: Keep `models.rs` field names and `lib.rs` CSV headers (`export_table_csv`) synchronized with `web/src/types/simulation.ts` and `generate.py`.
- **Deterministic Reproducibility**: Preserve per-date seeded RNG derivation (`seed_for_date` via SHA-256). Do not claim exact cross-language RNG parity with Python `random` or JS `mulberry32` unless tested.
- **Accessible Explanations**: In chat summaries or docs, explain Rust concepts (ownership, borrowing, `serde`, `wasm-bindgen`) in beginner-friendly language. Keep inline code comments focused on *why* rather than restating syntax.

## 3. Pre-Finish Checklist (`engine/`)

1. Run `cargo test --manifest-path engine/Cargo.toml` (add focused `#[test]` unit tests when adding new parsing defaults or math helpers).
2. Run `cargo check --manifest-path engine/Cargo.toml` to verify zero warnings/errors.
3. If `lib.rs` Wasm exports or `Cargo.toml` features changed, note whether `wasm32-unknown-unknown` / `wasm-pack` compilation was verified or unavailable in the current environment.
