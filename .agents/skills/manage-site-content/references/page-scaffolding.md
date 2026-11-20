# New Markdown-Backed Page Scaffolding Guide

Follow this pattern to add a new navigation page (e.g., `guide` or `sql`) mirroring `AboutPage`:

1. **Author the Markdown source** at `web/src/content/<page>.md`:
   ```markdown
   ---
   title: "Page Title"
   lead: "Short introductory paragraph supporting **inline** markdown."
   ---

   ## First Section

   Section prose...
   ```

2. **Create a typed loader** at `web/src/content/<page>Content.ts`:
   - Import raw file with Vite `?raw` (`import pageMdRaw from './<page>.md?raw';`).
   - Parse using `parseMarkdownWithFrontmatter<YourFrontmatterType>(pageMdRaw)` from `web/src/utils/markdownContent.ts`.

3. **Add nav label to `web/src/content/site.yaml` & `web/src/content/siteContent.ts`**:
   - Add `<page>: "Label"` under `nav:` in `site.yaml` and `SiteContent['nav']` in `siteContent.ts`.

4. **Create the view component** `web/src/components/<Page>Page.tsx`:
   - Accept `{ theme: ThemeConfig; onNavigateTab: ... }`.
   - Render sections using `<MarkdownRenderer content={sec.body} theme={theme} />` inside `${theme.borderClass} ${theme.cardClass}` containers.

5. **Wire tab state into `App.tsx` and `Header.tsx`**:
   - Extend the `activeTab` union type (`'studio' | 'dashboard' | 'yaml' | 'about' | '<page>'`) in both `web/src/App.tsx` and `web/src/components/Header.tsx`.
   - Add the `<button>` in `Header.tsx` `<nav>` using `SITE_CONTENT.nav.<page>`.
   - Render `<PageComponent theme={theme} onNavigateTab={setActiveTab} />` when `activeTab === '<page>'` in `App.tsx`.
