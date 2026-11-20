# Rust Simulation Engine Guide (`engine/AGENTS.md`)

Applies to the `lettuce-melon-engine` Rust crate in `engine/`.

## 1. Crate Contracts & Guardrails

- **Fault-Tolerant Parsing**: Users hand-edit YAML in the web UI; use `#[serde(default)]` in `config.rs` and return `Result<_, String>` instead of panicking on omitted optional keys.
- **Schema & Export Stability**: Keep `models.rs` and `lib.rs` CSV headers (`export_table_csv`) synchronized with `web/src/types/simulation.ts`.
- **Deterministic Seeding**: Preserve SHA-256 `seed_for_date` per-date seeding (`rand_chacha`); never claim identical draws with Python `random` or JS `mulberry32` unless tested.
- **Beginner-Friendly Tone**: Explain Rust ownership/borrowing/`serde` concepts plainly in responses without cluttering code comments.

## 2. Related Skills

- Module map & TS/Rust parity workflow → `.agents/skills/sync-sim-engines/SKILL.md`
- Local `cargo test` vs. CI `wasm-pack` checks → `.agents/skills/verify-and-deploy/SKILL.md`
