# Customization Guide

This guide explains how to customize **GroceryLab** for your specific needs. The system is designed to be highly configurable through YAML files, so you can adapt scenarios directly in the Web Studio, Raw YAML editor, or canonical `config/` files without touching engine code.

## Quick Overview

All canonical defaults live in the `config/` directory. When modifying files in `config/`, run `node web/scripts/bundleConfig.cjs` to regenerate the web bundle defaults:

- `catalog.yaml` - Your product list, IDR pricing, weights, and subcategory cooldowns
- `date.yaml` - Simulation date bounds and monthly/weekday volume patterns
- `personas/*.yaml` - Customer persona definitions and shopping behavior patterns
- `simulation.yaml` - Global fallback defaults, recency `visit_decay`, and duplicate rules
- `growth.yaml` - Yearly and profile-based growth multipliers
- `event.yaml` - Promotional campaigns and date/month overrides
- `funnel.yaml` - Global fallback stage conversion rates, durations, and peak visit hours

## Product Catalog Customization

### Adding New Products

Edit `config/catalog.yaml` to define your product hierarchy:

```yaml
catalog:
  your_category:
    your_subcategory:
      cooldown: 1  # Days before same subcategory repeats in basket
      product:
        your_product: { base_price: 10000 }
```

**Structure**: `category → subcategory → product → base_price`

### Pricing Strategy

- `base_price` is in your currency unit (I use Indonesian Rupiah)
- Prices get randomized during simulation based on `simulation.yaml` settings
- Consider your market's price ranges when setting base values

### Category Organization

Group related products logically:
- Keep similar items in the same subcategory
- Use meaningful category names that reflect your business
- Set `cooldown` to prevent unrealistic basket composition

## Customer Segment Customization

### Creating New Customer Personas

Create a new file in `config/personas/` named after your persona:

```yaml
your_segment_name:
  profile: moderate  # aggressive, moderate, conservative
  description: "Brief description of this customer type"
  
  # Visit patterns
  visit_chance:
    monday: 0.05
    tuesday: 0.04
    # ... continue for all days
  
  # Shopping preferences
  category_weight:
    vegetables: 1.2  # Higher = more likely to buy
    fruits: 0.8      # Lower = less likely
```

### Key Customer Settings

**Visit Patterns:**
- `visit_chance`: Daily probability of visiting
- `monthly_visit_chance_multiplier`: Seasonal adjustments

**Shopping Behavior:**
- `basket.min_items/max_items`: How much they buy per visit
- `category_weight`: Product category preferences
- `quantity_model.base_lambda`: Average units per item

**Demographics:**
- `city`: Geographic distribution
- `gender`: Gender balance
- `acquisition_channel`: How they find you

### Understanding Profiles

This is mostly used in `config/growth.yaml` to determine user growth patterns. I might move this to its own file in the future, but it's fine for now.
- `aggressive`: High frequency, high volume shoppers
- `moderate`: Average shopping patterns
- `conservative`: Low frequency, careful buyers

## Time and Volume Customization

### Simulation Period

Edit `config/date.yaml` to set your time range:

```yaml
date:
  start_date: "2023-01-01"
  end_date:   "2025-12-31"
```

### Transaction Volume Patterns

**Monthly Patterns:**
```yaml
monthly_rate:
  january: 0.8   # 80% of baseline
  december: 1.4  # 140% of baseline (holiday peak)
```

**Daily Patterns:**
```yaml
weekday_base:
  monday: 45     # 45 baseline transactions on Monday
  saturday: 90   # 90 on Saturday (weekend peak)
```

### Adding Realistic Variation

Use noise settings to avoid perfectly predictable patterns:

```yaml
monthly_rate_noise:
  distribution: poisson
  multiplier: 1.25  # 25% variation
```

## Advanced Customization

### User Growth Patterns

Edit `config/growth.yaml` to control how your customer base evolves:

- `monthly_new_user_multiplier`: Seasonal acquisition patterns
- `base_new_user_daily`: Baseline new users per day
- `retry_patterns`: How many times users try before converting

### Funnel Analytics

Customize `config/funnel.yaml` for customer journey tracking:

- Conversion rates between funnel stages
- Time spent at each stage
- Drop-off patterns

### Global Defaults

`config/simulation.yaml` contains system-wide defaults that apply unless overridden in specific persona configs.

## Testing Your Customizations

### Start Small

1. Change one thing at a time
2. Run a short simulation (few days) to test
3. Check output in `output/` directory
4. Adjust based on results

### Validation Tips

- Check if transaction volumes match your expectations
- Verify category distributions make sense
- Ensure customer segments behave distinctly
- Look for unrealistic patterns in output

### Common Issues

**Too Many Transactions:**
- Lower `weekday_base` values in `date.yaml`
- Reduce `visit_chance` in persona configs
- Increase `visit_decay` multipliers in `config/simulation.yaml` to reduce the number of old customers

**Unrealistic Baskets:**
- Adjust `category_weight` values
- Modify `basket.min_items/max_items`
- Check `cooldown` settings in catalog

**Wrong Customer Mix:**
- Adjust `base_user` values in persona configs
- Modify `daily_new_user_chance` settings

## Getting Help

If you run into issues:

1. Check the YAML syntax - indentation matters
2. Verify all required fields are present
3. Look at existing persona configs for examples
4. Test with minimal changes first

The system is designed to be forgiving, but YAML syntax errors will prevent it from running. Use a YAML validator if you're unsure about your syntax.

Remember: The goal is realistic data for testing, not perfect reproduction of real behavior. Start simple and iterate based on your testing needs.
