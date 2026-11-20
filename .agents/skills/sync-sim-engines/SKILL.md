---
name: sync-sim-engines
description: >-
  Guides keeping the TypeScript Web Worker simulator, Rust/Wasm engine, and
  dataset schemas/exports synchronized. Use when changing simulation math,
  config structs, output table columns, or CSV exports. Do NOT use for pure
  YAML value tweaks or UI-only styling edits.
---

# Sync TypeScript & Rust Simulation Engines

## Core Parity Contracts

1. **Identical Output Schemas**: All 5 datasets (`users`, `funnel`, `transactions`, `transaction_items`, `catalog`) and their column names are shared contracts across Rust (`engine/src/models.rs`, `lib.rs`), TypeScript (`web/src/types/simulation.ts`, `ExportModal.tsx`), and archived Python (`archive/generate.py`).
2. **Fault-Tolerant Rust Parsing**: Web users hand-edit YAML. Keep `#[serde(default)]` on optional Rust config fields in `engine/src/config.rs` and return `Result<_, String>` instead of panicking.
3. **Deterministic Per-Date Seeding**: Both engines derive daily seeds via `seed_for_date(base_seed, date_str)` (SHA-256). Note: Rust uses `rand_chacha` while TypeScript uses `mulberry32`, so do **not** claim identical cross-language RNG draws unless explicitly implemented and tested.
4. **CSV Privacy Default**: Exported CSVs omit the internal `persona` column by default (mirroring `archive/generate.py`) with an opt-in toggle in `ExportModal.tsx`. Route every CSV value through `escapeCsvCell`.

## Zero-Grep Architecture Map

Read [references/parity-map.md](references/parity-map.md) before scanning files—it maps every simulation module, output struct, and export header across Rust, TypeScript, and archived Python in one lookup.

## Sync Checklist

1. Update Rust structs/logic in `engine/src/` (and add/update `#[test]` unit tests).
2. Mirror exact schema/logic changes in `web/src/types/simulation.ts`, `web/src/engine/simulator.ts`, and (if exported) `web/src/components/ExportModal.tsx`.
3. Update `web/src/content/site.yaml` (`schemaTables`) if exported table columns change.
4. Check `archive/sim/` and `archive/generate.py` if core schema column lists changed.

## Verification

```bash
bun web/scripts/verifySimulator.ts
npm --prefix web run lint
npm --prefix web run build
```

If `cargo` is installed locally, also run `cargo test --manifest-path engine/Cargo.toml` and `cargo check --manifest-path engine/Cargo.toml`. Otherwise, explicitly note that Rust/Wasm compilation runs in GitHub Actions (`.github/workflows/deploy-cloudflare.yml`).
