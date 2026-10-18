# FPC Construction LLC website

fpcconstructions.com: static HTML on GitHub Pages, deployed from `main` (no deploy-time build).
Design direction A, "Bench Cut" (approved 2026-10-18). Every page has an English URL and a Spanish twin.

| Page | English | Spanish | Source |
|---|---|---|---|
| Home | `/` (`index.html`) | `/es/` | built by `tools/site` |
| Free estimate | `/estimate/` | `/es/estimado/` | built by `tools/site` |
| Privacy, Terms, SMS terms | `/privacy`, `/terms`, `/sms-opt-in` | bilingual pages | hand-written; edit only with A2P review |

## Editing the built pages

Never edit `index.html`, `es/`, `estimate/` or `sitemap.xml` by hand. They are generated.

```sh
node tools/site/build.mjs          # regenerate pages + sitemap.xml
node tools/site/build.mjs --check  # fails if committed output is stale
node tools/site/serve.mjs 8080     # preview with GitHub Pages-style routing + gzip
```

- `tools/site/strings.mjs`: every visible string, English and Spanish (build fails if a key is missing in either).
- `tools/site/src/`: `base.css` (tokens, one type scale, one spacing rhythm), page CSS, page templates, shared partials.
- `assets/site/core.js`: language toggle (remembers the choice), call bar, reveal, lazy Fil widget, PayPal message loader.
- `assets/site/estimate.js`: the estimate form. Posts to the CRM lead route; only `success: true` plus a `booking_id` counts as received.
- `tools/site/images.mjs`: regenerates `assets/img/` (graded AVIF + WebP photos, logo, favicons, OG image) with ImageMagick.
- Cloudflare Web Analytics: set `CF_WEB_ANALYTICS_TOKEN` in `tools/site/build.mjs` and rebuild (off until a token exists).

## Form checks

See `tools/contact-form/README.md`. The browser suite runs against the built estimate pages with every request
intercepted; it never sends a lead to the CRM.

---

Built by mpowerio.ai
