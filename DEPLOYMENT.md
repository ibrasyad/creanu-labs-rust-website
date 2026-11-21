# Deployment Guide: GroceryLab on Cloudflare Workers (`sim.ibnulab.com`)

**GroceryLab** runs 100% client-side in the browser (React + Web Worker engine). Cloudflare Workers serves the static site cleanly across Cloudflare's global edge network at **zero server compute cost**.

---

## 1. Deploy via Cloudflare Dashboard (Workers Builds — Git Integration)

Follow these exact steps inside **dash.cloudflare.com** to connect GitHub directly so every push to `main` builds and deploys automatically:

1. Open [dash.cloudflare.com](https://dash.cloudflare.com) and go to **Compute (Workers)** &rarr; **Workers & Pages**.
2. Click **Create** (or **Create application**) &rarr; **Import a repository** (Connect to GitHub) and select your repository.
3. Enter these exact **Build configuration** fields:
   - **Project / Worker name**: `grocerylab-simulator` *(matches `"name"` in `web/wrangler.jsonc`)*
   - **Root directory** (under Build paths): `web` *(uses `web/package-lock.json` for `npm clean-install`)*
   - **Build command**: `npm run build:cf`
   - **Deploy command**: `npx wrangler deploy`
4. Click **Save and Deploy**.
5. *(Recommended)* After the first deploy finishes, open your Worker &rarr; **Settings** &rarr; **Builds** &rarr; **Build watch paths** and add:
   - `web/**`
   - `config/**`
   - `engine/**`

---

## 2. Custom Subdomain (`sim.ibnulab.com`) & SSL/TLS Hardening

Because `ibnulab.com` is already on Cloudflare, attach `sim.ibnulab.com` directly through Custom Domains so Cloudflare automatically manages DNS, edge certificates, and routing:

1. Open your Worker in **Workers & Pages** &rarr; **Settings** &rarr; **Domains & Routes**.
2. Click **Add** &rarr; **Custom domain**, enter `sim.ibnulab.com`, and save. Cloudflare automatically creates the proxied DNS record and issues an Edge SSL certificate.
3. Open your `ibnulab.com` zone in Cloudflare Dashboard &rarr; **SSL/TLS** and verify:
   - **Overview &rarr; Encryption mode**: `Full (strict)`
   - **Edge Certificates &rarr; Always Use HTTPS**: `On`
   - **Edge Certificates &rarr; Minimum TLS Version**: `TLS 1.2` (or `TLS 1.3`)
   - **Edge Certificates &rarr; TLS 1.3**: `Enabled`
   - **Edge Certificates &rarr; Automatic HTTPS Rewrites**: `On`
   - *(Note on HSTS)*: `web/public/_headers` already sends `Strict-Transport-Security: max-age=31536000` scoped to `sim.ibnulab.com`—avoid enabling Cloudflare's zone-wide HSTS `includeSubDomains` or `preload` unless every subdomain on `ibnulab.com` enforces HTTPS permanently.
4. *(Recommended for clean SEO)* Under **Workers & Pages &rarr; Settings &rarr; Domains & Routes**, you can disable the `*.workers.dev` preview subdomain once `sim.ibnulab.com` is verified so search engines only index `https://sim.ibnulab.com/`.

---

## 3. Edge Security Headers & Embedding Policy (`web/public/_headers`)

`npm run build:cf` copies `web/public/_headers` into `web/dist/_headers`, which Cloudflare Workers Static Assets enforces at the edge:

- **Iframe & Clickjacking Protection**:
  - `Content-Security-Policy` sets `frame-ancestors 'self' https://ibnulab.com https://*.ibnulab.com;` alongside `X-Frame-Options: SAMEORIGIN` and `Cross-Origin-Resource-Policy: same-site`.
  - Third-party websites are blocked from framing GroceryLab, while your portfolio (`https://ibnulab.com`) and sibling subdomains (such as `siyuan.ibnulab.com`) can embed it safely.
- **Strict Script & Worker CSP**:
  - Allows only `'self'`, `'wasm-unsafe-eval'` (required by Rust/WebAssembly), and `blob:` Web Workers/CSV ZIP exports (`worker-src 'self' blob:`, `connect-src 'self' blob:`), while blocking objects (`object-src 'none'`) and base-URI hijacking (`base-uri 'self'`).
- **Cache Split**:
  - Hashed bundles under `/assets/*` are cached for 1 year (`immutable`), while `index.html`, SPA fallback routes, `robots.txt`, `sitemap.xml`, and `/.well-known/security.txt` use revalidation so deploys propagate immediately.

Verify headers after deploying:
```bash
curl -sI https://sim.ibnulab.com/
```

---

## 4. Automated Rust/Wasm + Edge Deploy via GitHub Actions

If you want GitHub runners to run `cargo test` and compile `engine/` to WebAssembly on every push to `main` before deploying to Cloudflare:

1. In Cloudflare Dashboard &rarr; **My Profile** &rarr; **API Tokens** &rarr; **Create Token**, use the **Edit Cloudflare Workers** template.
2. Copy your **Account ID** from the right sidebar of **Workers & Pages**.
3. In your GitHub repository, open **Settings** &rarr; **Secrets and variables** &rarr; **Actions** and add:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`
4. Pushes to `main` touching `web/**`, `engine/**`, or `config/**` will automatically run `.github/workflows/deploy-cloudflare.yml`.

> **Tip — Avoiding Duplicate Deploys:** Choose either **Workers Builds** (Cloudflare Dashboard Git integration) or **GitHub Actions** as your active auto-deploy path—pause the other if you don't want two builds per push.

---

## 5. Astro-Style Content Editing (`web/src/content/`)

Human-readable copy is decoupled from `.tsx` templates:
- **`web/src/content/site.yaml`**: Brand name, domain, nav/footer strings, data dictionary schema descriptions, glossary cards, and trace order walkthrough.
- **`web/src/content/about.md`**: Astro-style Markdown with YAML frontmatter rendered safely in React without `dangerouslySetInnerHTML`. Any extra `## Section` added to `about.md` renders automatically on the **About** tab.

---

## 6. Configuration Reference (`web/wrangler.jsonc`)

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "grocerylab-simulator",
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

---

## 7. `v1.0.0` Production Sign-Off Checklist (`sim.ibnulab.com`)

Before announcing or tagging `v1.0.0`, confirm each operational item on the live Cloudflare deployment:

1. **Worker & Custom Domain Cutover**:
   - Confirm the `grocerylab-simulator` Worker is deployed and bound to `https://sim.ibnulab.com/` (and remove/retire any temporary `creanu-labs-simulator` `*.workers.dev` preview if no longer needed).
   - Disable the `*.workers.dev` subdomain on the production Worker once `sim.ibnulab.com` is live so search engines index only the canonical domain.
2. **CI/CD & Secrets**:
   - Confirm `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set in GitHub Actions Secrets and `.github/workflows/deploy-cloudflare.yml` passes all Rust tests, Wasm compilation, cross-engine parity (`verifyParity.ts --require-wasm`), and strict TypeScript checks.
   - Ensure only one auto-deploy path (GitHub Actions OR Cloudflare Workers Builds) triggers per push to `main`.
3. **Edge Security & Headers Verification**:
   - Run `curl -sI https://sim.ibnulab.com/` and verify `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Content-Security-Policy` (`'wasm-unsafe-eval'`, `blob:`, `frame-ancestors`), and `immutable` caching on `/assets/*`.
4. **Live Browser & Dataset Sanity**:
   - Open `https://sim.ibnulab.com/` in a fresh browser window, inspect the Dashboard runtime badge to confirm **Rust/Wasm** executed (not TypeScript fallback), toggle Light/Dark mode and refresh to confirm persistence, copy a Share URL and reload it, and download a ZIP export to verify all 5 CSVs + `README_SQL_STARTER.md` load cleanly in DuckDB or PostgreSQL.

