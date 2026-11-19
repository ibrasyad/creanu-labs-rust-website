use chrono::{Datelike, Duration, NaiveDate};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use std::collections::HashMap;

use crate::basket::{generate_basket, PurchaseHistory};
use crate::config::{ConversionMultiplier, FullSimulationConfig, GrowthMultipliers};
use crate::funnel::{get_visit_decay_multiplier, rolls_landing_page, simulate_user_journey};
use crate::models::{
    CatalogItemRecord, DailyMetric, FunnelEventRecord, SimulationOutput, SimulationSummary,
    TransactionItemRecord, TransactionRecord, UserRecord,
};
use crate::user::{generate_base_users, generate_user_record, roll_new_users_for_tier};
use crate::utils::{apply_noise, get_day_of_week, get_month_name, seed_for_date};

pub type ProgressCallback = Box<dyn Fn(usize, usize, &str)>;

fn get_simulation_year(current: NaiveDate, start: NaiveDate) -> u32 {
    let mut year = current.year() - start.year() + 1;
    if current.month() < start.month()
        || (current.month() == start.month() && current.day() < start.day())
    {
        year -= 1;
    }
    year.max(1) as u32
}

fn metric_from_growth(gm: &GrowthMultipliers, metric: &str, step: Option<&str>) -> f64 {
    match metric {
        "new_user" => gm.new_user,
        "visit" => gm.visit,
        "conversion" => match &gm.conversion {
            ConversionMultiplier::Scalar(v) => *v,
            ConversionMultiplier::PerStep(map) => {
                step.and_then(|s| map.get(s).copied()).unwrap_or(1.0)
            }
        },
        _ => 1.0,
    }
}

fn get_growth_multiplier(
    config: &FullSimulationConfig,
    sim_year: u32,
    profile: &str,
    metric: &str,
    step: Option<&str>,
) -> f64 {
    let Some(growth) = config.growth.as_ref() else {
        return 1.0;
    };

    let mut mult = 1.0;
    if let Some(base) = growth.base.as_ref() {
        if let Some(overall) = base.overall.as_ref() {
            mult *= metric_from_growth(overall, metric, step);
        }
        if let Some(profile_gm) = base.tier_profiles.get(profile) {
            mult *= metric_from_growth(profile_gm, metric, step);
        }
    }

    if let Some(yearly_map) = growth.yearly.as_ref() {
        let year_key = format!("year_{}", sim_year);
        let entry_opt = yearly_map
            .get(&year_key)
            .or_else(|| yearly_map.get("year_8_plus"));
        if let Some(entry) = entry_opt {
            if let Some(overall) = entry.overall.as_ref() {
                mult *= metric_from_growth(overall, metric, step);
            }
            if let Some(profile_gm) = entry.profile_multipliers.get(profile) {
                mult *= metric_from_growth(profile_gm, metric, step);
            }
        }
    }

    mult
}

fn is_campaign_active(campaign: &crate::config::CampaignConfig, sim_year: u32, month: u32, date_str: &str) -> bool {
    if campaign.start_date.is_some() || campaign.end_date.is_some() {
        if let Some(ref sd) = campaign.start_date {
            if !sd.is_empty() && date_str < sd.as_str() {
                return false;
            }
        }
        if let Some(ref ed) = campaign.end_date {
            if !ed.is_empty() && date_str > ed.as_str() {
                return false;
            }
        }
        return true;
    }

    let start_m = campaign.start_month.unwrap_or(1);
    match campaign.end_month {
        None => sim_year > campaign.year || (sim_year == campaign.year && month >= start_m),
        Some(end_m) => sim_year == campaign.year && month >= start_m && month <= end_m,
    }
}

fn get_event_multiplier(
    config: &FullSimulationConfig,
    sim_year: u32,
    month: u32,
    date_str: &str,
    tier_name: &str,
    profile: &str,
    metric: &str,
    step: Option<&str>,
) -> f64 {
    let Some(events) = config.event.as_ref() else {
        return 1.0;
    };

    let mut keys: Vec<&String> = events.keys().collect();
    keys.sort();

    let mut mult = 1.0;
    for key in keys {
        let campaign = &events[key];
        if !is_campaign_active(campaign, sim_year, month, date_str) {
            continue;
        }

        let target = campaign
            .tiers
            .as_ref()
            .and_then(|t| t.get(tier_name))
            .or_else(|| campaign.profiles.as_ref().and_then(|p| p.get(profile)))
            .or(campaign.overall.as_ref());

        if let Some(gm) = target {
            mult *= metric_from_growth(gm, metric, step);
        }
    }

    mult
}

/// Extract catalog flat records for export
pub fn export_catalog_records(config: &FullSimulationConfig) -> Vec<CatalogItemRecord> {
    let mut records = Vec::new();
    for (cat_name, subcats) in &config.catalog {
        for (subcat_name, subcat) in subcats {
            for (prod_name, prod) in &subcat.product {
                records.push(CatalogItemRecord {
                    category: cat_name.clone(),
                    subcategory: subcat_name.clone(),
                    product: prod_name.clone(),
                    base_price: prod.base_price,
                });
            }
        }
    }
    records
}

/// Execute the entire simulation across the date range
pub fn run_simulation(
    config: &FullSimulationConfig,
    override_start: Option<&str>,
    override_end: Option<&str>,
    override_seed: Option<u64>,
    progress_callback: Option<&ProgressCallback>,
) -> Result<SimulationOutput, String> {
    let start_str = override_start.unwrap_or(&config.date.start_date);
    let end_str = override_end.unwrap_or(&config.date.end_date);
    let base_seed = override_seed.unwrap_or(config.simulation.random_seed);

    let start_date = NaiveDate::parse_from_str(start_str, "%Y-%m-%d")
        .map_err(|e| format!("Invalid start date '{}': {}", start_str, e))?;
    let end_date = NaiveDate::parse_from_str(end_str, "%Y-%m-%d")
        .map_err(|e| format!("Invalid end date '{}': {}", end_str, e))?;

    if end_date < start_date {
        return Err("End date must be on or after start date".to_string());
    }

    let total_days = (end_date - start_date).num_days() as usize + 1;

    // Build product -> category lookup so category_revenue tracks real grocery categories
    let mut product_category_map: HashMap<String, String> = HashMap::new();
    for (cat_name, subcats) in &config.catalog {
        for subcat in subcats.values() {
            for prod_name in subcat.product.keys() {
                product_category_map.insert(prod_name.clone(), cat_name.clone());
            }
        }
    }

    // 1. Initialize base users
    let mut init_rng = ChaCha8Rng::seed_from_u64(base_seed);
    let mut users: Vec<UserRecord> = generate_base_users(config, start_str, &mut init_rng);
    let mut purchase_history: PurchaseHistory = HashMap::new();

    let mut all_funnel: Vec<FunnelEventRecord> = Vec::new();
    let mut all_transactions: Vec<TransactionRecord> = Vec::new();
    let mut all_items: Vec<TransactionItemRecord> = Vec::new();
    let mut daily_metrics: Vec<DailyMetric> = Vec::new();

    let mut user_counter = users.len() + 1;
    let mut current_date = start_date;
    let mut day_index = 0;

    let mut total_revenue = 0.0;
    let mut total_items_sold: u64 = 0;
    let mut category_revenue: HashMap<String, f64> = HashMap::new();
    let mut product_units: HashMap<String, (u64, f64)> = HashMap::new();
    let mut funnel_step_counts: HashMap<String, usize> = HashMap::new();

    let mut tier_names: Vec<String> = config.tiers.keys().cloned().collect();
    tier_names.sort();

    // 2. Iterate day by day
    while current_date <= end_date {
        let date_str = current_date.format("%Y-%m-%d").to_string();
        let day_seed = seed_for_date(base_seed, &date_str);
        let mut rng = ChaCha8Rng::seed_from_u64(day_seed);
        let sim_year = get_simulation_year(current_date, start_date);
        let current_month_num = current_date.month();
        let current_month_name = get_month_name(current_date);

        let monthly_rate = config
            .date
            .transaction_volume
            .monthly_rate
            .get(&current_month_name)
            .copied()
            .unwrap_or(1.0);
        let monthly_volume_mult = apply_noise(
            monthly_rate,
            config.date.transaction_volume.monthly_rate_noise.as_ref(),
            &mut rng,
        );

        // A. Acquire new users for today (deterministic sorted tier order)
        let mut daily_new_users = 0;
        for tier_name in &tier_names {
            let tier_cfg = &config.tiers[tier_name];
            let new_user_mult = get_growth_multiplier(config, sim_year, &tier_cfg.profile, "new_user", None)
                * get_event_multiplier(
                    config,
                    sim_year,
                    current_month_num,
                    &date_str,
                    tier_name,
                    &tier_cfg.profile,
                    "new_user",
                    None,
                );
            let new_count = roll_new_users_for_tier(tier_cfg, current_date, new_user_mult, &mut rng);
            for _ in 0..new_count {
                let new_user = generate_user_record(tier_name, tier_cfg, user_counter, &date_str, &mut rng);
                users.push(new_user);
                user_counter += 1;
                daily_new_users += 1;
            }
        }

        // B. Simulate user visits & funnel
        let mut active_today_users = Vec::new();
        let mut session_counter = 1;
        let date_prefix = current_date.format("%Y%m%d").to_string();

        let mut day_transactions = 0;
        let mut day_revenue = 0.0;
        let mut day_items = 0u32;
        let mut day_visitors = 0usize;

        // Iterate through all current users
        for user_idx in 0..users.len() {
            let user = &users[user_idx];
            let tier_cfg = match config.tiers.get(&user.tier) {
                Some(cfg) => cfg,
                None => continue,
            };

            // Calculate recency decay
            let last_active = NaiveDate::parse_from_str(&user.last_active_date, "%Y-%m-%d")
                .unwrap_or(current_date);
            let days_elapsed = (current_date - last_active).num_days();
            let decay = get_visit_decay_multiplier(days_elapsed, &config.simulation.visit_decay);

            let visit_mult = monthly_volume_mult
                * get_growth_multiplier(config, sim_year, &tier_cfg.profile, "visit", None)
                * get_event_multiplier(
                    config,
                    sim_year,
                    current_month_num,
                    &date_str,
                    &user.tier,
                    &tier_cfg.profile,
                    "visit",
                    None,
                );

            if rolls_landing_page(config, tier_cfg, current_date, decay, visit_mult, &mut rng) {
                let session_id = format!("{}-{:08}", date_prefix, session_counter);
                session_counter += 1;
                day_visitors += 1;
                active_today_users.push(user_idx);

                let conv_growth = get_growth_multiplier(config, sim_year, &tier_cfg.profile, "conversion", None);
                let step_conv_mults = [
                    conv_growth
                        * get_event_multiplier(
                            config,
                            sim_year,
                            current_month_num,
                            &date_str,
                            &user.tier,
                            &tier_cfg.profile,
                            "conversion",
                            Some("landing_page"),
                        ),
                    conv_growth
                        * get_event_multiplier(
                            config,
                            sim_year,
                            current_month_num,
                            &date_str,
                            &user.tier,
                            &tier_cfg.profile,
                            "conversion",
                            Some("product_view"),
                        ),
                    conv_growth
                        * get_event_multiplier(
                            config,
                            sim_year,
                            current_month_num,
                            &date_str,
                            &user.tier,
                            &tier_cfg.profile,
                            "conversion",
                            Some("add_to_cart"),
                        ),
                    conv_growth
                        * get_event_multiplier(
                            config,
                            sim_year,
                            current_month_num,
                            &date_str,
                            &user.tier,
                            &tier_cfg.profile,
                            "conversion",
                            Some("checkout"),
                        ),
                ];

                let (journey_events, paid, paid_dt) = simulate_user_journey(
                    config,
                    &user.tier,
                    tier_cfg,
                    &user.user_id,
                    &session_id,
                    current_date,
                    &step_conv_mults,
                    &mut rng,
                );

                for ev in &journey_events {
                    *funnel_step_counts.entry(ev.activity.clone()).or_insert(0) += 1;
                }
                all_funnel.extend(journey_events);

                // If transaction paid: generate basket
                if paid {
                    if let Some(ref paid_time_str) = paid_dt {
                        let trx_id = format!("trx-{}", session_id);
                        let basket = generate_basket(
                            config,
                            &user.tier,
                            tier_cfg,
                            &user.user_id,
                            current_date,
                            paid_time_str,
                            &trx_id,
                            &mut purchase_history,
                            &mut rng,
                        );

                        if !basket.empty_or_zero() {
                            let trx_total: f64 = basket.iter().map(|it| it.total_price).sum();
                            let items_count: u32 = basket.iter().map(|it| it.quantity).sum();

                            day_transactions += 1;
                            day_revenue += trx_total;
                            day_items += items_count;

                            for item in &basket {
                                // Track product stats
                                let entry = product_units.entry(item.product.clone()).or_insert((0, 0.0));
                                entry.0 += item.quantity as u64;
                                entry.1 += item.total_price;

                                // Track category stats using catalog category
                                if let Some(cat_name) = product_category_map.get(&item.product) {
                                    *category_revenue.entry(cat_name.clone()).or_insert(0.0) += item.total_price;
                                }
                            }

                            all_transactions.push(TransactionRecord {
                                session_id: session_id.clone(),
                                user_id: user.user_id.clone(),
                                trx_id,
                                date: paid_time_str.clone(),
                                tier: user.tier.clone(),
                                total_price: trx_total,
                            });

                            all_items.extend(basket);
                        }
                    }
                }
            }
        }

        // C. Update last_active_date for all active visitors
        for idx in active_today_users {
            users[idx].last_active_date = date_str.clone();
        }

        total_revenue += day_revenue;
        total_items_sold += day_items as u64;

        let day_conversion = if day_visitors > 0 {
            (day_transactions as f64) / (day_visitors as f64)
        } else {
            0.0
        };

        daily_metrics.push(DailyMetric {
            date: date_str.clone(),
            weekday: get_day_of_week(current_date),
            active_visitors: day_visitors,
            transactions: day_transactions,
            gross_revenue: day_revenue,
            items_sold: day_items,
            conversion_rate: day_conversion,
            new_users_acquired: daily_new_users,
        });

        day_index += 1;
        if let Some(cb) = progress_callback {
            cb(day_index, total_days, &date_str);
        }

        current_date = current_date + Duration::days(1);
    }

    // 3. Compile top products
    let mut top_products: Vec<(String, u64, f64)> = product_units
        .into_iter()
        .map(|(prod, (qty, rev))| (prod, qty, rev))
        .collect();
    top_products.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap_or(std::cmp::Ordering::Equal));
    top_products.truncate(10);

    let total_transactions = all_transactions.len();
    let average_order_value = if total_transactions > 0 {
        total_revenue / (total_transactions as f64)
    } else {
        0.0
    };

    let total_sessions = *funnel_step_counts.get("landing_page").unwrap_or(&0);
    let overall_conversion_rate = if total_sessions > 0 {
        (total_transactions as f64) / (total_sessions as f64)
    } else {
        0.0
    };

    let summary = SimulationSummary {
        total_users: users.len(),
        new_users: users.len().saturating_sub(config.tiers.values().map(|t| t.base_user).sum()),
        total_sessions,
        total_transactions,
        total_items_sold,
        total_revenue,
        average_order_value,
        overall_conversion_rate,
        daily_metrics,
        funnel_breakdown: funnel_step_counts,
        category_revenue,
        top_products,
    };

    Ok(SimulationOutput {
        users,
        funnel: all_funnel,
        transactions: all_transactions,
        transaction_items: all_items,
        catalog: export_catalog_records(config),
        summary,
    })
}

trait EmptyOrZero {
    fn empty_or_zero(&self) -> bool;
}

impl EmptyOrZero for Vec<TransactionItemRecord> {
    fn empty_or_zero(&self) -> bool {
        self.is_empty() || self.iter().all(|it| it.quantity == 0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn simulation_is_deterministic_and_tracks_category_revenue() {
        let yaml = r#"
simulation:
  random_seed: 20260101
date:
  start_date: "2026-01-01"
  end_date: "2026-01-05"
  transaction_volume: {}
catalog:
  vegetables:
    leafy_greens:
      cooldown: 0
      product:
        spinach:
          base_price: 4000
funnel:
  landing_page:
    conversion_rate: 1.0
  product_view:
    conversion_rate: 1.0
  add_to_cart:
    conversion_rate: 1.0
  checkout:
    conversion_rate: 1.0
  paid:
    conversion_rate: 1.0
tiers:
  family_shoppers:
    base_user: 10
    visit_chance:
      monday: 1.0
      tuesday: 1.0
      wednesday: 1.0
      thursday: 1.0
      friday: 1.0
      saturday: 1.0
      sunday: 1.0
    category_weight:
      vegetables: 1.0
"#;
        let cfg = FullSimulationConfig::from_yaml(yaml).unwrap();
        let out1 = run_simulation(&cfg, None, None, None, None).unwrap();
        let out2 = run_simulation(&cfg, None, None, None, None).unwrap();
        assert_eq!(out1.summary.daily_metrics.len(), 5);
        assert_eq!(out1.transactions.len(), out2.transactions.len());
        assert!((out1.summary.total_revenue - out2.summary.total_revenue).abs() < 1e-6);
        assert!(out1.summary.category_revenue.contains_key("vegetables"));
        assert!(!out1.summary.category_revenue.contains_key("family_shoppers"));
    }

    #[test]
    fn multi_tier_growth_and_event_runs_deterministically() {
        let yaml = r#"
simulation:
  random_seed: 99
date:
  start_date: "2026-01-01"
  end_date: "2026-01-04"
  transaction_volume:
    monthly_rate:
      january: 1.0
catalog:
  vegetables:
    leafy_greens:
      cooldown: 0
      product:
        spinach:
          base_price: 4000
        kale:
          base_price: 5000
funnel:
  landing_page:
    conversion_rate: 0.8
  product_view:
    conversion_rate: 0.8
  add_to_cart:
    conversion_rate: 0.8
  checkout:
    conversion_rate: 0.9
growth:
  base:
    overall:
      new_user: 1.0
      visit: 1.0
  yearly:
    year_1:
      overall:
        visit: 1.1
event:
  promo:
    name: "Jan Promo"
    year: 1
    start_month: 1
    end_month: 1
    profiles:
      conservative:
        conversion:
          landing_page: 1.2
tiers:
  family_shoppers:
    profile: balanced
    base_user: 5
    visit_chance:
      monday: 0.9
      tuesday: 0.9
      wednesday: 0.9
      thursday: 0.9
      friday: 0.9
      saturday: 0.9
      sunday: 0.9
    category_weight:
      vegetables: 1.0
  students:
    profile: conservative
    base_user: 5
    visit_chance:
      monday: 0.9
      tuesday: 0.9
      wednesday: 0.9
      thursday: 0.9
      friday: 0.9
      saturday: 0.9
      sunday: 0.9
    category_weight:
      vegetables: 1.0
"#;
        let cfg = FullSimulationConfig::from_yaml(yaml).unwrap();
        let out1 = run_simulation(&cfg, None, None, None, None).unwrap();
        let out2 = run_simulation(&cfg, None, None, None, None).unwrap();
        assert_eq!(out1.users.len(), out2.users.len());
        assert_eq!(out1.transactions.len(), out2.transactions.len());
        assert_eq!(out1.transactions.len() > 0, true);
    }

    #[test]
    fn ongoing_and_date_range_campaigns_apply_correctly() {
        let yaml = r#"
simulation:
  random_seed: 1
date:
  start_date: "2026-01-01"
  end_date: "2026-01-02"
  transaction_volume: {}
catalog:
  vegetables:
    leafy_greens:
      product:
        spinach: { base_price: 4000 }
funnel: {}
event:
  permanent_lift:
    name: "Permanent"
    year: 1
    start_month: 5
    end_month: null
    overall:
      visit: 1.5
  exact_dates:
    name: "Exact"
    start_date: "2027-02-01"
    end_date: "2027-02-10"
    overall:
      visit: 2.0
tiers:
  family:
    base_user: 1
    category_weight:
      vegetables: 1.0
"#;
        let cfg = FullSimulationConfig::from_yaml(yaml).unwrap();
        let events = cfg.event.as_ref().unwrap();
        assert!(!is_campaign_active(&events["permanent_lift"], 1, 4, "2026-04-15"));
        assert!(is_campaign_active(&events["permanent_lift"], 1, 5, "2026-05-01"));
        assert!(is_campaign_active(&events["permanent_lift"], 2, 1, "2027-01-15"));
        assert!(!is_campaign_active(&events["exact_dates"], 2, 1, "2027-01-31"));
        assert!(is_campaign_active(&events["exact_dates"], 2, 2, "2027-02-05"));
    }
}

