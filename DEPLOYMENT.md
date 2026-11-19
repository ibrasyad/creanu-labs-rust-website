# Deployment Guide: Creanu Labs on Cloudflare Workers

Creanu Labs runs 100% client-side in the browser (React + Web Worker engine). Cloudflare Workers serves the static site cleanly across Cloudflare's global edge network at **zero server compute cost**.

---

## 1. Deploy via Cloudflare Dashboard (Workers Builds — Git Integration)

Follow these exact steps inside **dash.cloudflare.com** to connect GitHub directly so every push to `main` builds and deploys automatically:

1. Open [dash.cloudflare.com](https://dash.cloudflare.com) and go to **Compute (Workers)** &rarr; **Workers & Pages**.
2. Click **Create** (or **Create application**) &rarr; **Import a repository** (Connect to GitHub) and select your repository (`ibrasyad/creanu-labs-rust-website`).
3. Enter these exact **Build configuration** fields:
   - **Project / Worker name**: `creanu-labs-simulator`
     > **Important:** This name **must** match `"name"` inside `web/wrangler.jsonc`, otherwise `wrangler deploy` will fail with a name mismatch error.
   - **Root directory** (under Build paths): `web` *(uses `web/package-lock.json` for `npm clean-install`)*
   - **Build command**: `npm run build:cf`
   - **Deploy command**: `npx wrangler deploy`
4. Click **Save and Deploy**.
5. *(Recommended)* After the first deploy finishes, open your Worker &rarr; **Settings** &rarr; **Builds** &rarr; **Build watch paths** and add:
   - `web/**`
   - `config/**`
   - `engine/**`
   This ensures edits to YAML presets (`config/`) or Rust (`engine/`) also trigger a rebuild.
6. *(Optional Custom Domain)* Open your Worker &rarr; **Settings** &rarr; **Domains & Routes** &rarr; **Add** &rarr; **Custom domain** if you want to serve it on your own domain instead of `creanu-labs-simulator.<your-subdomain>.workers.dev`.

### What Happens Inside `npm run build:cf`?
1. Syncs `config/*.yaml` into `web/src/engine/defaultConfig.ts`.
2. Checks if `cargo` and `wasm-pack` are installed in the build container:
   - If present, prints `[engine: wasm]`, runs `cargo test`, and compiles `engine/` into `web/src/wasm-pkg/`.
   - If absent (typical on Cloudflare's standard Node.js Workers Builds container), prints `[engine: typescript-fallback]` and bundles the TypeScript Web Worker simulator with zero errors.
3. Runs `tsc && vite build` to output static assets to `web/dist/`.

> **Tip — Avoiding Duplicate Deploys:** If you connect GitHub in the Cloudflare Dashboard (**Workers Builds**), every push to `main` will trigger Cloudflare directly. Notice this repo also includes `.github/workflows/deploy-cloudflare.yml` (which installs Rust + `wasm-pack` on GitHub runners). Choose **one** active auto-deploy path:
> - Use **Workers Builds** for zero-secret dashboard simplicity (TypeScript engine on edge unless Rust is in the build image).
> - Or keep **GitHub Actions** active for automatic Rust/WebAssembly compilation and pause automatic branch builds inside Cloudflare Dashboard.

---

## 2. Automated Rust/Wasm + Edge Deploy via GitHub Actions

If you want GitHub runners to run `cargo test` and compile `engine/` to WebAssembly on every push to `main` before deploying to Cloudflare:

1. In Cloudflare Dashboard &rarr; **My Profile** &rarr; **API Tokens** &rarr; **Create Token**, use the **Edit Cloudflare Workers** template.
2. Copy your **Account ID** from the right sidebar of **Workers & Pages**.
3. In your GitHub repository, open **Settings** &rarr; **Secrets and variables** &rarr; **Actions** and add:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. Pushes to `main` touching `web/**`, `engine/**`, or `config/**` will automatically run `.github/workflows/deploy-cloudflare.yml`.

---

## 3. Manual CLI Deploy via Wrangler

From your local machine:

```bash
cd web
npx wrangler login
npm run build:cf
npx wrangler deploy
```

---

## 4. Configuration Reference (`web/wrangler.jsonc`)

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "creanu-labs-simulator",
  "compatibility_date": "2024-11-01",
  "observability": {
    "enabled": true
  },
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
```

- `"not_found_handling": "single-page-application"` guarantees shared scenario URLs (`?preset=...&patch=...`) resolve cleanly to `index.html` instead of returning a 404.
- Do not add `"assets.binding"` unless you also define a `"main"` Worker script that consumes that binding.

