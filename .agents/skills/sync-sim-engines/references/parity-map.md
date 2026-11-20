# Cross-Layer Engine Parity & Symbol Map

Use this pre-computed dependency map to jump straight to the right files without broad `grep` scans.

## 1. Module Parity Matrix

| Responsibility | Rust (`engine/src/`) | TypeScript (`web/src/`) | Archived Python (`archive/`) |
| :--- | :--- | :--- | :--- |
| **Config Parsing** | `config.rs` (`FullSimulationConfig`, `PersonaConfig`) | `engine/simulator.ts`, `engine/defaultConfig.ts` *(generated)* | `sim/config.py` |
| **Output Models** | `models.rs` (`UserRecord`, `SimulationOutput`, etc.) | `types/simulation.ts` | `generate.py` (`USER_COLUMNS`, etc.) |
| **RNG & Seeding** | `utils.rs` (`seed_for_date`, `apply_noise`, `controlled_random`) | `engine/simulator.ts` (`seedForDate`, `mulberry32`) | `sim/utils.py` |
| **User Cohort & Acquisition** | `user.rs` (`generate_base_users`, `roll_new_users_for_persona`) | `engine/simulator.ts` | `sim/generate_user.py` |
| **Visit & Funnel Stages** | `funnel.rs` (`generate_visit`, `generate_funnel`, `generate_duration`) | `engine/simulator.ts` | `sim/generate_funnel.py` |
| **Basket & Cooldowns** | `basket.rs` (`generate_basket`, `PurchaseHistory`) | `engine/simulator.ts` | `sim/generate_basket.py` |
| **Growth & Event Multipliers** | `simulation.rs` | `engine/simulator.ts` | `sim/growth.py`, `sim/event.py` |
| **Web Worker & Wasm Bridge** | `lib.rs` (`run_simulation_wasm`, `export_table_csv`) | `engine/simulation.worker.ts`, `engine/engineClient.ts` | — |
| **CSV / ZIP Export** | `lib.rs` (`export_table_csv`) | `components/ExportModal.tsx`, `utils/csv.ts` | `generate.py` (`_export_csv`), `bigquery.py` |

## 2. Exported Table Schemas (`persona` optional in CSV)

- **users**: `persona` *(optional)*, `user_id`, `city`, `gender`, `acquisition_channel`, `registered_date`, `last_active_date`
- **funnel**: `session_id`, `persona` *(optional)*, `user_id`, `activity`, `activity_datetime`
- **transactions**: `session_id`, `user_id`, `trx_id`, `date`, `persona` *(optional)*, `total_price`
- **transaction_items**: `trx_id`, `user_id`, `persona` *(optional)*, `date`, `product`, `quantity`, `unit_price`, `total_price`
- **catalog**: `category`, `subcategory`, `product`, `base_price`

## 3. Scan Exclusions (Never Index or Read Raw)

Skip `node_modules/`, `web/dist/`, `engine/target/`, `web/src/wasm-pkg/`, and `archive/output/` (tracked historical Parquet/CSV snapshots).
