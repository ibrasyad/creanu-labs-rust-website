pub mod basket;
pub mod config;
pub mod funnel;
pub mod models;
pub mod simulation;
pub mod user;
pub mod utils;

use serde::Serialize;
use wasm_bindgen::prelude::*;

use crate::config::FullSimulationConfig;
use crate::models::SimulationOutput;

fn to_js_plain<T: Serialize>(value: &T) -> Result<JsValue, JsValue> {
    let serializer = serde_wasm_bindgen::Serializer::new().serialize_maps_as_objects(true);
    value
        .serialize(&serializer)
        .map_err(|e| JsValue::from_str(&e.to_string()))
}

/// Validate a configuration string (either YAML or JSON).
/// Returns parsed config summary or an error string.
#[wasm_bindgen]
pub fn validate_config_wasm(config_str: &str) -> Result<JsValue, JsValue> {
    let config = parse_config(config_str).map_err(|e| JsValue::from_str(&e))?;
    to_js_plain(&config)
}

/// Helper to parse config from either YAML or JSON
fn parse_config(raw: &str) -> Result<FullSimulationConfig, String> {
    let trimmed = raw.trim();
    if trimmed.starts_with('{') {
        FullSimulationConfig::from_json(trimmed).map_err(|e| format!("JSON parse error: {}", e))
    } else {
        FullSimulationConfig::from_yaml(trimmed).map_err(|e| format!("YAML parse error: {}", e))
    }
}

/// Execute simulation directly inside the browser using WebAssembly.
/// Emits progress via progress_js(day, total_days, date_str).
#[wasm_bindgen]
pub fn run_simulation_wasm(
    config_str: &str,
    start_date: Option<String>,
    end_date: Option<String>,
    seed: Option<f64>,
    progress_js: Option<js_sys::Function>,
) -> Result<JsValue, JsValue> {
    let config = parse_config(config_str).map_err(|e| JsValue::from_str(&e))?;

    let seed_u64 = seed.map(|s| s as u64);

    let callback = progress_js.map(|cb| {
        let cb_box: simulation::ProgressCallback = Box::new(move |day, total, date| {
            let this = JsValue::NULL;
            let arg_day = JsValue::from_f64(day as f64);
            let arg_total = JsValue::from_f64(total as f64);
            let arg_date = JsValue::from_str(date);
            let _ = cb.call3(&this, &arg_day, &arg_total, &arg_date);
        });
        cb_box
    });

    let output: SimulationOutput = simulation::run_simulation(
        &config,
        start_date.as_deref(),
        end_date.as_deref(),
        seed_u64,
        callback.as_ref(),
    )
    .map_err(|e| JsValue::from_str(&e))?;

    to_js_plain(&output)
}

fn escape_csv_cell(raw: &str) -> String {
    let trimmed_start = raw.trim_start();
    let safe = if trimmed_start.starts_with('=')
        || trimmed_start.starts_with('+')
        || trimmed_start.starts_with('-')
        || trimmed_start.starts_with('@')
    {
        format!("'{}", raw)
    } else {
        raw.to_string()
    };
    format!("\"{}\"", safe.replace('"', "\"\""))
}

pub fn format_table_csv(
    dataset_name: &str,
    output: &SimulationOutput,
    include_persona: bool,
) -> Result<String, String> {
    let mut csv = String::new();

    match dataset_name {
        "users" => {
            if include_persona {
                csv.push_str("persona,user_id,city,gender,acquisition_channel,registered_date,last_active_date\n");
                for u in &output.users {
                    csv.push_str(&format!(
                        "{},{},{},{},{},{},{}\n",
                        escape_csv_cell(&u.persona),
                        escape_csv_cell(&u.user_id),
                        escape_csv_cell(&u.city),
                        escape_csv_cell(&u.gender),
                        escape_csv_cell(&u.acquisition_channel),
                        escape_csv_cell(&u.registered_date),
                        escape_csv_cell(&u.last_active_date)
                    ));
                }
            } else {
                csv.push_str("user_id,city,gender,acquisition_channel,registered_date,last_active_date\n");
                for u in &output.users {
                    csv.push_str(&format!(
                        "{},{},{},{},{},{}\n",
                        escape_csv_cell(&u.user_id),
                        escape_csv_cell(&u.city),
                        escape_csv_cell(&u.gender),
                        escape_csv_cell(&u.acquisition_channel),
                        escape_csv_cell(&u.registered_date),
                        escape_csv_cell(&u.last_active_date)
                    ));
                }
            }
        }
        "transactions" => {
            if include_persona {
                csv.push_str("session_id,user_id,trx_id,date,persona,total_price\n");
                for t in &output.transactions {
                    csv.push_str(&format!(
                        "{},{},{},{},{},{:.2}\n",
                        escape_csv_cell(&t.session_id),
                        escape_csv_cell(&t.user_id),
                        escape_csv_cell(&t.trx_id),
                        escape_csv_cell(&t.date),
                        escape_csv_cell(&t.persona),
                        t.total_price
                    ));
                }
            } else {
                csv.push_str("session_id,user_id,trx_id,date,total_price\n");
                for t in &output.transactions {
                    csv.push_str(&format!(
                        "{},{},{},{},{:.2}\n",
                        escape_csv_cell(&t.session_id),
                        escape_csv_cell(&t.user_id),
                        escape_csv_cell(&t.trx_id),
                        escape_csv_cell(&t.date),
                        t.total_price
                    ));
                }
            }
        }
        "transaction_items" => {
            if include_persona {
                csv.push_str("trx_id,user_id,persona,date,product,quantity,unit_price,total_price\n");
                for it in &output.transaction_items {
                    csv.push_str(&format!(
                        "{},{},{},{},{},{},{:.2},{:.2}\n",
                        escape_csv_cell(&it.trx_id),
                        escape_csv_cell(&it.user_id),
                        escape_csv_cell(&it.persona),
                        escape_csv_cell(&it.date),
                        escape_csv_cell(&it.product),
                        it.quantity,
                        it.unit_price,
                        it.total_price
                    ));
                }
            } else {
                csv.push_str("trx_id,user_id,date,product,quantity,unit_price,total_price\n");
                for it in &output.transaction_items {
                    csv.push_str(&format!(
                        "{},{},{},{},{},{:.2},{:.2}\n",
                        escape_csv_cell(&it.trx_id),
                        escape_csv_cell(&it.user_id),
                        escape_csv_cell(&it.date),
                        escape_csv_cell(&it.product),
                        it.quantity,
                        it.unit_price,
                        it.total_price
                    ));
                }
            }
        }
        "funnel" => {
            if include_persona {
                csv.push_str("session_id,persona,user_id,activity,activity_datetime\n");
                for f in &output.funnel {
                    csv.push_str(&format!(
                        "{},{},{},{},{}\n",
                        escape_csv_cell(&f.session_id),
                        escape_csv_cell(&f.persona),
                        escape_csv_cell(&f.user_id),
                        escape_csv_cell(&f.activity),
                        escape_csv_cell(&f.activity_datetime)
                    ));
                }
            } else {
                csv.push_str("session_id,user_id,activity,activity_datetime\n");
                for f in &output.funnel {
                    csv.push_str(&format!(
                        "{},{},{},{}\n",
                        escape_csv_cell(&f.session_id),
                        escape_csv_cell(&f.user_id),
                        escape_csv_cell(&f.activity),
                        escape_csv_cell(&f.activity_datetime)
                    ));
                }
            }
        }
        "catalog" => {
            csv.push_str("category,subcategory,product,base_price\n");
            for c in &output.catalog {
                csv.push_str(&format!(
                    "{},{},{},{:.2}\n",
                    escape_csv_cell(&c.category),
                    escape_csv_cell(&c.subcategory),
                    escape_csv_cell(&c.product),
                    c.base_price
                ));
            }
        }
        _ => return Err(format!("Unknown dataset: {}", dataset_name)),
    }

    Ok(csv)
}

/// Convert specific dataset in memory to CSV string format.
/// Omits the internal `persona` column by default unless `include_persona` is `Some(true)`.
#[wasm_bindgen]
pub fn export_table_csv(
    dataset_name: &str,
    output_js: JsValue,
    include_persona: Option<bool>,
) -> Result<String, JsValue> {
    let output: SimulationOutput = serde_wasm_bindgen::from_value(output_js)
        .map_err(|e| JsValue::from_str(&format!("Invalid simulation output: {}", e)))?;
    format_table_csv(dataset_name, &output, include_persona.unwrap_or(false))
        .map_err(|e| JsValue::from_str(&e))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        CatalogItemRecord, FunnelEventRecord, SimulationSummary, TransactionItemRecord,
        TransactionRecord, UserRecord,
    };
    use std::collections::HashMap;

    fn sample_output() -> SimulationOutput {
        SimulationOutput {
            users: vec![UserRecord {
                persona: "family_shoppers".to_string(),
                user_id: "usr-000001".to_string(),
                city: "Jakarta".to_string(),
                gender: "female".to_string(),
                acquisition_channel: "organic".to_string(),
                registered_date: "2026-01-01".to_string(),
                last_active_date: "2026-01-02".to_string(),
            }],
            funnel: vec![FunnelEventRecord {
                session_id: "ses-1".to_string(),
                persona: "family_shoppers".to_string(),
                user_id: "usr-000001".to_string(),
                activity: "paid".to_string(),
                activity_datetime: "2026-01-02 10:00:00".to_string(),
            }],
            transactions: vec![TransactionRecord {
                session_id: "ses-1".to_string(),
                user_id: "usr-000001".to_string(),
                trx_id: "trx-ses-1".to_string(),
                date: "2026-01-02 10:00:00".to_string(),
                persona: "family_shoppers".to_string(),
                total_price: 15000.0,
            }],
            transaction_items: vec![TransactionItemRecord {
                trx_id: "trx-ses-1".to_string(),
                user_id: "usr-000001".to_string(),
                persona: "family_shoppers".to_string(),
                date: "2026-01-02 10:00:00".to_string(),
                product: "spinach".to_string(),
                quantity: 2,
                unit_price: 7500.0,
                total_price: 15000.0,
            }],
            catalog: vec![CatalogItemRecord {
                category: "vegetables".to_string(),
                subcategory: "leafy_greens".to_string(),
                product: "spinach".to_string(),
                base_price: 7500.0,
            }],
            summary: SimulationSummary {
                total_users: 1,
                total_sessions: 1,
                total_transactions: 1,
                total_revenue: 15000.0,
                total_items_sold: 2,
                average_order_value: 15000.0,
                overall_conversion_rate: 1.0,
                daily_metrics: vec![],
                funnel_breakdown: HashMap::new(),
                category_revenue: HashMap::new(),
                top_products: vec![],
            },
        }
    }

    #[test]
    fn csv_escaping_neutralizes_formulas_and_quotes() {
        assert_eq!(escape_csv_cell("=SUM(A1)"), "\"'=SUM(A1)\"");
        assert_eq!(escape_csv_cell("+1+1"), "\"'+1+1\"");
        assert_eq!(escape_csv_cell("-cmd"), "\"'-cmd\"");
        assert_eq!(escape_csv_cell("@SUM"), "\"'@SUM\"");
        assert_eq!(escape_csv_cell("Fresh \"Organic\" Spinach"), "\"Fresh \"\"Organic\"\" Spinach\"");
        assert_eq!(escape_csv_cell("spinach"), "\"spinach\"");
    }

    #[test]
    fn csv_export_respects_persona_visibility_and_headers() {
        let out = sample_output();

        let users_hidden = format_table_csv("users", &out, false).unwrap();
        assert!(users_hidden.starts_with("user_id,city,gender,acquisition_channel,registered_date,last_active_date\n"));
        assert!(!users_hidden.contains("family_shoppers"));

        let users_shown = format_table_csv("users", &out, true).unwrap();
        assert!(users_shown.starts_with("persona,user_id,city,gender,acquisition_channel,registered_date,last_active_date\n"));
        assert!(users_shown.contains("\"family_shoppers\""));

        let trx_hidden = format_table_csv("transactions", &out, false).unwrap();
        assert!(trx_hidden.starts_with("session_id,user_id,trx_id,date,total_price\n"));

        let items_shown = format_table_csv("transaction_items", &out, true).unwrap();
        assert!(items_shown.starts_with("trx_id,user_id,persona,date,product,quantity,unit_price,total_price\n"));

        let funnel_hidden = format_table_csv("funnel", &out, false).unwrap();
        assert!(funnel_hidden.starts_with("session_id,user_id,activity,activity_datetime\n"));

        let catalog_csv = format_table_csv("catalog", &out, false).unwrap();
        assert!(catalog_csv.starts_with("category,subcategory,product,base_price\n"));
    }
}
