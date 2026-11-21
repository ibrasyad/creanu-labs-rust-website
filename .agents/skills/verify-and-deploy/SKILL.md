---
name: verify-and-deploy
description: >-
  Runs GroceryLab build, simulator, lint, and Cloudflare Workers readiness
  checks (including CSP/iframe headers and optional Rust/Python validation). Use
  before finishing any code change or preparing a deploy to sim.ibnulab.com.
  Do NOT use for pure conceptual Q&A with no file modifications.
---

# Verify & Deploy GroceryLab

Run only the checks relevant to the layers you modified—avoid unnecessary full builds when verifying isolated docs or Python scripts.

## 1. Standard Web & Config Pipeline

Run from the repository root:

```bash
# 1. Re-bundle YAML defaults (required if config/ changed)
node web/scripts/bundleConfig.cjs

# 2. Run simulator, CSV, validation, share-URL, YAML diff, and parity checks
bun web/scripts/verifySimulator.ts
bun web/scripts/verifyParity.ts

# 3. Run strict TypeScript check and production Cloudflare build
npm --prefix web run lint
npm --prefix web run build:cf
```

`build:cf` automatically runs `bundleConfig.cjs`, compiles `engine/` to `web/src/wasm-pkg` when `cargo` + `wasm-pack` exist (or falls back cleanly to the TypeScript worker), builds `web/dist/`, and copies `web/public/_headers`.

## 2. Edge Security & Subdomain Checks (`sim.ibnulab.com`)

Before deploying changes touching `web/public/_headers`, `web/index.html`, or `web/wrangler.jsonc`:
- Confirm `Content-Security-Policy` retains `'wasm-unsafe-eval'` in `script-src`, `blob:` in `worker-src` and `connect-src`, and `frame-ancestors 'self' https://ibnulab.com https://*.ibnulab.com`.
- Keep `"name": "grocerylab-simulator"` in `web/wrangler.jsonc` unchanged unless intentionally provisioning a new Cloudflare Worker.

## 3. Engine & Archived Python Checks

- **Rust (`engine/`)**: Run `cargo test --manifest-path engine/Cargo.toml` and `cargo check --manifest-path engine/Cargo.toml` if `cargo` is installed locally; otherwise report that CI (`.github/workflows/deploy-cloudflare.yml`) builds and tests Rust/Wasm on push to `main`.
- **Archived Python (`archive/`)**: Run syntax validation only (`python3 -m py_compile archive/generate.py archive/bigquery.py archive/sim/*.py` and remove any `__pycache__`). **Never** execute `initial_run()` against `archive/output/`.
