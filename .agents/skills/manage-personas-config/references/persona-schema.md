# Persona YAML Schema Reference

Use `config/personas/_template.yaml` as the starting file when creating a new file in `config/personas/<name>.yaml`.

## Required & Optional Sections

| Key | Required | Allowed Values / Rules |
| :--- | :--- | :--- |
| `<persona_name>` | Yes | Top-level YAML key (`snake_case`). Must be unique across all `config/personas/*.yaml`. |
| `profile` | Yes | `conservative` \| `balanced` \| `aggressive` (drives `config/growth.yaml` `persona_profiles` and `config/event.yaml` `profiles`). |
| `priority` | No | `low` \| `medium` \| `high`. |
| `description` | No | Plain-text description displayed in Config Studio. |
| `base_user` | Yes | Non-negative integer initial cohort size on `start_date`. |
| `daily_retry` | No | Positive integer daily acquisition attempts (defaults to `1`). |
| `daily_new_user_chance` | Yes | Weekday arrival rate per retry (`0.0` to `1.0`). |
| `daily_new_user_chance_weekend` | No | Weekend arrival rate per retry (`0.0` to `1.0`). |
| `monthly_new_user_multiplier` | No | Map of lowercase month names (`january`..`december`) -> multiplier `>= 0`. |
| `daily_new_user_noise` / `monthly_new_user_noise` | No | `{ distribution: poisson \| lognormal \| normal \| uniform, multiplier: number >= 1.0 }`. |
| `visit_chance` | Yes | Weekday map (`monday`..`sunday`) with values in `0.0..=1.0`. |
| `monthly_visit_chance_multiplier` | No | Month map (`january`..`december`) -> multiplier `>= 0`. |
| `visit_hour_peak` | No | Named peaks (`first`, `second`, ...) with `{ weight, hour: { min, max, avg } }` (`0..=23`). |
| `landing_page`, `product_view`, `add_to_cart`, `checkout`, `paid` | No | Optional stage overrides: `{ conversion_rate: 0..1, duration: { min_duration, avg_duration, max_duration } }`. Falls back to `config/funnel.yaml`. |
| `funnel_noise` | No | Same `{ distribution, multiplier }` noise object as above. |
| `basket` | No | `{ min_items, max_items }` (`1 <= min_items <= max_items`). Falls back to `config/simulation.yaml`. |
| `category_weight` | Yes | Map of `config/catalog.yaml` categories -> non-negative weight. |
| `subcategory_weight` | No | Optional nested map `category -> subcategory -> weight`. |
| `subcategory_allow_duplicates` | No | Optional map `subcategory -> boolean`. |
| `quantity_model` | No | `{ base_lambda: number > 0 }`. |
| `quantity_bias` | No | Map of `config/catalog.yaml` categories -> multiplier `>= 0`. |
| `city`, `gender`, `acquisition_channel` | No | Weighted demographic maps (if omitted, engine/UI defaults apply). |
| `transaction_weight` | No | Weekday relative weight map. |
