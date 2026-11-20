---
kicker:
  - "GroceryLab"
  - "Synthetic Grocery Analytics"
  - "Zero Server Compute"
title: "Realistic retail data for learning analytics, without flat random numbers."
lead: "GroceryLab is a configurable synthetic grocery and produce simulator. Instead of generating uniform noise, it models how different shopper personas visit, drop off through a checkout funnel, respect pantry cooldowns, and build seasonal baskets. There are so many options for randomly generated data, but I hope this will make learning data analytics a bit more interesting."
ctaPrimary: "Configure a Scenario"
ctaSecondary: "Inspect Analytics Dashboard"
---

## Why I Made This

Learning SQL, BI dashboards, or data engineering usually hits the same wall: sample datasets are either too static to explore edge cases or filled with purely random numbers that have no behavioral signal.

I wanted a transparent, YAML-driven generator where anyone can tweak customer habits, seasonal peaks, and global behavior rates, then download clean relational tables at zero hosting or compute cost.

## What It Does

- Models distinct customer segments, such as: families, health-conscious buyers, students, professionals, and cafe owners.
- Simulates daily acquisition, visit decay, weekday and monthly traffic curves, and multi-stage funnel drop-off.
- Compares any preset or custom YAML directly against a horizon-matched baseline and packages clean CSV + YAML ZIP downloads.

## AI Acknowledgment

GroceryLab began as a pure Python batch pipeline outputting CSV and Parquet files for BI and BigQuery experiments. In this web studio, simulations run inside a non-blocking Web Worker configured to load the compiled Rust/WebAssembly engine with automatic TypeScript fallback when Wasm artifacts are absent. 

I want to bring this as a tool for everyone to use easily, but since I don't have the technical capabilities I instead use AI (Google AI Studio to be specific) in helping me to build this. **The UI, the view, the icon, pretty much everything except the engine logic and original config are built using AI** according to my directions.

## Great Ways to Practice With the Output

- Build cohort retention & repeat-purchase curves from `registered_date` and `transaction.csv`.
- Measure funnel stage drop-off and time-to-checkout across customer personas in `funnel.csv`.
- Run market-basket affinity or RFM segmentation on `transaction_item.csv`.
- Load all five CSVs into DuckDB, PostgreSQL, BigQuery, or dbt as a realistic portfolio warehouse.
