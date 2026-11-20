---
name: manage-site-content
description: >-
  Guides editing decoupled site copy (web/src/content/site.yaml and about.md)
  or adding new Astro-style Markdown pages/tabs in GroceryLab without breaking
  CSP rules or Swiss Light/Dark themes. Use when editing copy, glossary terms,
  or adding navigation views. Do NOT use for simulator math or YAML engine config.
---

# Manage Site Copy & Markdown Pages

## Content Architecture (Astro-Style Separation)

GroceryLab keeps human-readable copy separate from `.tsx` templates:
- **Structured UI & Schema Metadata** (`web/src/content/site.yaml` + `web/src/content/siteContent.ts`): brand name, domain (`sim.ibnulab.com`), nav/footer strings, data dictionary tables, simulation lever glossary, and trace walkthrough steps.
- **Narrative Prose** (`web/src/content/about.md` + `web/src/content/aboutContent.ts`): YAML frontmatter + Markdown sections split cleanly by `## Heading` and rendered by `MarkdownRenderer.tsx`.

## Security & Theme Guardrails

- **CSP safety**: Never use `dangerouslySetInnerHTML` or inject raw HTML. All prose renders through `web/src/components/MarkdownRenderer.tsx` (a pure-React parser supporting `#`/`##`/`###`, `-`/`*` lists, `---`, fenced ```` ``` ```` code blocks, `` `code` ``, `**bold**`, `*italic*`, and safe `https:`/`http:`/`mailto:`/`/`/`#` links).
- **Swiss Light & Dark mode**: Never hardcode light-only or dark-only surface colors. Pass `theme` (`SWISS_THEMES` from `web/src/types/theme.ts`) and use `theme.cardClass`, `theme.borderClass`, `theme.mutedClass`, `theme.accentClass`, and `theme.buttonClass`.

## Workflows

### A. Edit Existing Copy or Add an About Section
1. Edit structured labels, table columns, or glossary entries in `web/src/content/site.yaml`. If adding a new YAML key, update the `SiteContent` TypeScript interface in `web/src/content/siteContent.ts`.
2. Edit narrative prose in `web/src/content/about.md`. Adding any new `## Section Title` automatically renders an extra card at the bottom of `AboutPage.tsx` without touching TSX!
3. Keep `web/index.html` (`<title>`, meta description, OpenGraph tags) synced with `metadata.json` if brand metadata changes.

### B. Add a Whole New Page / Tab
Read [references/page-scaffolding.md](references/page-scaffolding.md) for the exact step-by-step wiring (`*.md` + loader + `App.tsx` + `Header.tsx` + `site.yaml`).

## Verification

```bash
npm --prefix web run lint
npm --prefix web run build
```

Verify both **Light** and **Dark** themes render cleanly with zero TypeScript unused-import errors.
