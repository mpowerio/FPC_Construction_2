# FPC Construction LLC website

fpcconstructions.com: static HTML on GitHub Pages, deployed from `main` (no deploy-time build).
November 2026 redesign draft: graphite, FPC gold and orange, built on the October Bench Cut generator. Every page has an English URL and a Spanish twin. Operator approval is required before release.

| Page | English | Spanish | Source |
|---|---|---|---|
| Home | `/` (`index.html`) | `/es/` | built by `tools/site` |
| Free estimate | `/estimate/` | `/es/estimado/` | built by `tools/site` |
| Septic | `/services/septic-systems/` | `/es/servicios/sistemas-septicos/` | built by `tools/site` |
| Drainage | `/services/drainage-site-work/` | `/es/servicios/drenaje-terreno/` | built by `tools/site` |
| Concrete | `/services/concrete/` | `/es/servicios/concreto/` | built by `tools/site` |
| Privacy, Terms, SMS terms | `/privacy`, `/terms`, `/sms-opt-in` | bilingual pages | hand-written; edit only with A2P review |

## Editing the built pages

Never edit `index.html`, `es/`, `estimate/` or `sitemap.xml` by hand. They are generated.

```sh
node tools/site/build.mjs          # regenerate pages + sitemap.xml
node tools/site/build.mjs --check  # fails if committed output is stale
node tools/site/serve.mjs 8080     # preview with GitHub Pages-style routing + gzip
```

- `tools/site/services.mjs`: original EN/ES service-page copy and routes; Fil reviews scope before release.
- `tools/site/social.mjs`: one `TIKTOK_PROFILE_URL` setting, empty until verified. Empty hides every TikTok link and schema entry. The WhatsApp URL setting also stays empty until the operator confirms the number; unconfirmed links are omitted. No social embeds load.
- `tools/site/strings.mjs`: every visible string, English and Spanish (build fails if a key is missing in either).
- `tools/site/src/`: `base.css` (tokens, one type scale, one spacing rhythm), page CSS, page templates, shared partials.
- `assets/site/core.js`: language toggle (remembers the choice), call bar, reveal, lazy Fil widget, PayPal message loader.
- `assets/site/estimate.js`: the estimate form. Posts to the CRM lead route; only `success: true` plus a `booking_id` counts as received.
- `tools/site/images.mjs`: regenerates `assets/img/` (graded AVIF + WebP photos, logo, favicons, OG image) with ImageMagick.
- Cloudflare Web Analytics: set `CF_WEB_ANALYTICS_TOKEN` in `tools/site/build.mjs` and rebuild (off until a token exists).

## Form checks

See `tools/contact-form/README.md`. The browser suite runs against the built estimate pages with every request
intercepted; it never sends a lead to the CRM.

The home page's short project picker uses GET only and sends no personal information. It opens the existing receipt-checked estimate form with a project type selected. The full form and its CRM endpoint are preserved. Approved public images are reused; private Drive candidates are not published. Separate city pages and review counts wait for grounded local proof.

```sh
node tools/site/redesign.browser.mjs
# Optional: FPC_EVIDENCE_DIR=/absolute/output/path (default /tmp/fpc-redesign-evidence)
```

This check uses only local fixtures and blocks external requests. It checks the ten generated pages at 1440/820/390, touch targets, no overflow, language twins, schema, local links, starter handoff, no-JS access, reduced motion and hidden TikTok. The existing 51-case estimate suite supplies receipt, failure, timeout, retry, language-draft and negative-control checks. Screenshots are local evidence; independent review and live field performance remain separate.

---

Built by mpowerio.ai

## Google review gates and approved tree-work testimonial

`tools/site/reviews.mjs` has the single `GOOGLE_REVIEW_URL` setting, empty until the operator verifies the correct listing. It supplies the same EN/ES action link everywhere. `GOOGLE_REVIEWS.verified` is false and no rating, quotes or review section render until an approved, attributed snapshot is entered. A confirmed URL alone can enable the ask without inventing a rating. Snapshot date is displayed; this is not a live feed. Do not combine listings or rewrite/translate review words. Keep original author, stars, displayed date, source URL and excerpt labeling. No API, scraping, credentials or background refresh is used. Do not store API responses in git.

`tools/site/media.mjs` now contains the operator-approved tree-work feature: responsive still, three clean silent clips and his exact English testimonial, attributed to Michael Parker with 5/5 and the message date 2026-11-10. It is labeled a customer testimonial in both interface languages, never an unconfirmed Google review. The operator-approved location reads exactly “North Augusta, Foxchase subdivision”; no street or house number is included. Setting `approvedForPublic: false` omits the entire feature. Source footage stays in the private vault; committed derivatives have no audio, GPS, original filenames or identifying metadata. Clips use controls, no autoplay and `preload="none"`. New Filemon shots follow the existing Drive/CRM Inbox flow, outside this code scope.

The agency-credit footer remains unchanged pending the operator's decision. Existing form runtime, relay, Fil copy and legal pages are unchanged.

```sh
node --test tools/site/content.test.mjs
```

The responsive check also renders six explicitly synthetic populated layouts in intercepted local responses. Synthetic Google review fixtures never enter the generated pages. The approved real tree-work feature and testimonial are checked separately. Review-link ownership, real content authenticity and public-use consent remain human checks, not URL-validation claims.
