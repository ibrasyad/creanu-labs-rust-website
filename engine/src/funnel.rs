use chrono::{Duration, NaiveDate, NaiveDateTime, NaiveTime};
use rand::Rng;
use rand_distr::{Distribution, Normal};
use std::collections::HashMap;

use crate::config::{DurationConfig, FullSimulationConfig, PersonaConfig};
use crate::models::FunnelEventRecord;
use crate::utils::{apply_noise, get_day_of_week, get_month_name, weighted_choice};

/// Calculate engagement decay multiplier based on days since last active visit
pub fn get_visit_decay_multiplier(days_since_active: i64, rules: &[crate::config::VisitDecayRule]) -> f64 {
    if rules.is_empty() {
        return 1.0;
    }
    let mut multiplier = rules[0].multiplier;
    for rule in rules {
        if days_since_active >= rule.days {
            multiplier = rule.multiplier;
        } else {
            break;
        }
    }
    multiplier
}

/// Determine if a user visits on the given date (landing_page event)
pub fn rolls_landing_page<R: Rng>(
    config: &FullSimulationConfig,
    persona_cfg: &PersonaConfig,
    current_date: NaiveDate,
    decay: f64,
    visit_multiplier: f64,
    rng: &mut R,
) -> bool {
    let weekday = get_day_of_week(current_date);
    let month = get_month_name(current_date);

    let default_visit_chance = config.simulation.visit_chance.get(&weekday).copied().unwrap_or(0.05);
    let mut chance = persona_cfg.visit_chance.get(&weekday).copied().unwrap_or(default_visit_chance);

    let month_mult = persona_cfg.monthly_visit_chance_multiplier.get(&month).copied().unwrap_or(1.0);
    chance *= month_mult;
    chance *= visit_multiplier;

    // Apply funnel noise if configured (persona override -> global funnel fallback)
    let noise_cfg = persona_cfg.funnel_noise.as_ref().or(config.funnel.funnel_noise.as_ref());
    chance = apply_noise(chance, noise_cfg, rng);
    chance *= decay;

    if decay <= 0.0 {
        chance = chance.max(config.simulation.reactivation_probability);
    }

    let draw: f64 = rng.gen();
    draw < chance.clamp(0.0, 1.0)
}

/// Generate timestamp for landing page based on persona peak hours (falling back to funnel defaults)
pub fn generate_landing_timestamp<R: Rng>(
    config: &FullSimulationConfig,
    current_date: NaiveDate,
    persona_cfg: &PersonaConfig,
    rng: &mut R,
) -> NaiveDateTime {
    let peaks = if !persona_cfg.visit_hour_peak.is_empty() {
        &persona_cfg.visit_hour_peak
    } else {
        &config.funnel.visit_hour_peak
    };

    let hour = if !peaks.is_empty() {
        let peak_weights: HashMap<String, f64> = peaks
            .iter()
            .map(|(k, v)| (k.clone(), v.weight))
            .collect();

        if let Some(peak_key) = weighted_choice(&peak_weights, rng) {
            let peak = &peaks[peak_key];
            let normal = Normal::new(peak.hour.avg, 2.0).unwrap_or_else(|_| Normal::new(19.0, 2.0).unwrap());
            let raw_hour = normal.sample(rng).round() as i64;
            let lo = peak.hour.min.min(peak.hour.max) as i64;
            let hi = peak.hour.min.max(peak.hour.max) as i64;
            raw_hour.clamp(lo, hi).clamp(0, 23) as u32
        } else {
            rng.gen_range(9..22)
        }
    } else {
        rng.gen_range(9..22)
    };

    let minute = rng.gen_range(0..60);
    let second = rng.gen_range(0..60);
    let time = NaiveTime::from_hms_opt(hour.min(23), minute, second).unwrap();
    NaiveDateTime::new(current_date, time)
}

/// Generate random duration for a funnel step
pub fn sample_duration<R: Rng>(duration_cfg: &DurationConfig, rng: &mut R) -> Duration {
    let raw_min = duration_cfg.min_duration as f64;
    let raw_max = duration_cfg.max_duration as f64;
    let lo = raw_min.min(raw_max);
    let hi = raw_min.max(raw_max);
    let avg = (duration_cfg.avg_duration as f64).clamp(lo, hi);
    let std_dev = ((hi - lo) / 6.0).max(0.01);

    let normal = Normal::new(avg, std_dev).unwrap_or_else(|_| Normal::new(avg, 1.0).unwrap());
    let raw = normal.sample(rng);
    let secs = raw.clamp(lo, hi).round() as i64;
    Duration::seconds(secs.max(1))
}

/// Simulate the full customer funnel journey from landing_page to paid
pub fn simulate_user_journey<R: Rng>(
    config: &FullSimulationConfig,
    persona_name: &str,
    persona_cfg: &PersonaConfig,
    user_id: &str,
    session_id: &str,
    current_date: NaiveDate,
    step_conversion_multipliers: &[f64; 4],
    rng: &mut R,
) -> (Vec<FunnelEventRecord>, bool, Option<String>) {
    let mut events = Vec::new();
    let start_dt = generate_landing_timestamp(config, current_date, persona_cfg, rng);
    let mut current_dt = start_dt;

    // 1. landing_page
    events.push(FunnelEventRecord {
        session_id: session_id.to_string(),
        persona: persona_name.to_string(),
        user_id: user_id.to_string(),
        activity: "landing_page".to_string(),
        activity_datetime: current_dt.format("%Y-%m-%d %H:%M:%S").to_string(),
    });

    let stages = ["product_view", "add_to_cart", "checkout", "paid"];
    let mut reached_paid = false;
    let mut paid_datetime = None;
    let noise_cfg = persona_cfg.funnel_noise.as_ref().or(config.funnel.funnel_noise.as_ref());

    for (idx, &stage) in stages.iter().enumerate() {
        // Look up conversion rate: persona override -> funnel default
        let (base_rate, duration_cfg) = match stage {
            "product_view" => (
                persona_cfg.landing_page.as_ref().map(|s| s.conversion_rate).unwrap_or(config.funnel.landing_page.conversion_rate),
                persona_cfg.landing_page.as_ref().and_then(|s| s.duration.as_ref()).or(config.funnel.landing_page.duration.as_ref()),
            ),
            "add_to_cart" => (
                persona_cfg.product_view.as_ref().map(|s| s.conversion_rate).unwrap_or(config.funnel.product_view.conversion_rate),
                persona_cfg.product_view.as_ref().and_then(|s| s.duration.as_ref()).or(config.funnel.product_view.duration.as_ref()),
            ),
            "checkout" => (
                persona_cfg.add_to_cart.as_ref().map(|s| s.conversion_rate).unwrap_or(config.funnel.add_to_cart.conversion_rate),
                persona_cfg.add_to_cart.as_ref().and_then(|s| s.duration.as_ref()).or(config.funnel.add_to_cart.duration.as_ref()),
            ),
            "paid" => (
                persona_cfg.checkout.as_ref().map(|s| s.conversion_rate).unwrap_or(config.funnel.checkout.conversion_rate),
                persona_cfg.checkout.as_ref().and_then(|s| s.duration.as_ref()).or(config.funnel.checkout.duration.as_ref()),
            ),
            _ => (0.0, None),
        };

        let scaled_rate = base_rate * step_conversion_multipliers[idx];
        let rate = apply_noise(scaled_rate, noise_cfg, rng).clamp(0.0, 1.0);
        let roll: f64 = rng.gen();

        if roll < rate {
            let default_dur = DurationConfig { min_duration: 5, max_duration: 60, avg_duration: 15 };
            let dur = sample_duration(duration_cfg.unwrap_or(&default_dur), rng);
            current_dt = current_dt + dur;

            let dt_str = current_dt.format("%Y-%m-%d %H:%M:%S").to_string();
            events.push(FunnelEventRecord {
                session_id: session_id.to_string(),
                persona: persona_name.to_string(),
                user_id: user_id.to_string(),
                activity: stage.to_string(),
                activity_datetime: dt_str.clone(),
            });

            if stage == "paid" {
                reached_paid = true;
                paid_datetime = Some(dt_str);
            }
        } else {
            // Dropped off at this funnel stage
            break;
        }
    }

    (events, reached_paid, paid_datetime)
}
