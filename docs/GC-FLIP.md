# GC flip: turning on the general-contractor pages

The general-contractor (GC) part of fpcconstructions.com is fully built but switched off. While it is off, no public page says "general contractor", "licensed" or "insured", and the release checks (`tools/seo-check.mjs`, `tools/site/release-policy.mjs`) reject any page that does. This document is the switch. Work through it in order on license day. It is one small PR.

Operator ruling, 2026-11-13: "no pending just build it like a GC site and then we'll promote general contracting when it's available, but they need all the tools all the abilities. They're going to be the premier general contractor in the area."

## What is already built (off)
| Page | English | Spanish |
|---|---|---|
| Commercial & public works (GC landing: delivery methods, sectors, process, past performance) | `/commercial-public-works/` | `/es/obras-comerciales-publicas/` |
| Capability statement (license, bonding, insurance, registrations, safety, competencies; prints to PDF) | `/capabilities/` | `/es/capacidades/` |
| Subcontractors and suppliers (bid-list signup by email) | `/subcontractors/` | `/es/subcontratistas/` |

Source: `tools/site/gc.mjs` (records, copy, renderers), `tools/site/src/gc.html` (template), section 19 of `tools/site/src/site.css`.

To see the pages before license day, build a preview outside the repo. In preview, missing records show a red MISSING tag:
```sh
node tools/site/build.mjs --gc-preview /tmp/fpc-gc-preview && cp -r assets /tmp/fpc-gc-preview/
```

## Before you flip: documents in hand
Every value comes from a document FPC holds. Nothing is typed from memory.
1. **The issued SC license certificate** (SC LLR Contractor's Licensing Board). Gives `license.number`, `license.classifications` exactly as printed, `license.group`, and `license.expires`. Check the number on the LLR license lookup before entering it.
2. **The surety's bond-capacity letter.** Gives `bonding.single`, `bonding.aggregate` and `bonding.surety`. A job-specific bond is not a capacity figure.
3. **The current certificate of insurance.** Gives `insurance.gl` and `insurance.wc` (required), plus `insurance.auto` and `insurance.umbrella` if FPC carries them.
4. **The SAM.gov registration.** Gives `ids.uei`, `ids.cage` if assigned, and `ids.naics` as registered.
5. **Optional:** EMR from the carrier's letter (`safety.emr`), and OSHA cards held (`safety.osha`). A line left empty is not shown.
6. **Delivery methods.** Filemon confirms each one he will offer. Set any he will not offer to `false` in `GC.delivery`.
7. **Projects.** Only real FPC jobs, each with the owner's OK to be named. Each entry needs title, owner, FPC's role, scope and year. The section stays hidden while the list is empty.

## The flip, step by step
1. Branch from `main`: `feat/site-gc-live`.
2. In `tools/site/gc.mjs`, fill `GC.license`, `GC.bonding`, `GC.insurance`, `GC.ids`, and optionally `GC.safety`, `GC.delivery` and `GC.projects`. Set `GC.enabled = true`. The build refuses to run if a required record is missing or the license has expired.
3. **Release checks.** Make each change in its own commit, each with its negative test:
   - `tools/seo-check.mjs`: the line that fails any page containing `general contractor`, `contratista general` or `GeneralContractor` becomes "allowed only when `GC.enabled` and the license number appears on the same page". Do the same for the `licensed`/`insured` check. Add the three GC pages to its page list.
   - `tools/site/release-controls.mjs`: add the three GC pages to the scratch fixture list.
   - `tools/site/gc.test.mjs`: invert the "GC stays off" and "no GC page is published" tests into "GC is on" and "all three pages are published and in the sitemap".
4. **Structured data.** In `tools/site/build.mjs` `business()`, change the comment and `@type` to `['LocalBusiness', 'HomeAndConstructionBusiness', 'GeneralContractor']`, and add the license as `hasCredential`.
5. **Home page qualifications panel.** Today it shows true, non-credential facts only: main services, service area, site visit, languages. The operator said "no pending", so no credential slot is shown before the license. At flip, in `src/home.html` and the `quals.*` keys in `strings.mjs` (V3_HOME):
   - Add a license row with the license number and classification, plus bonding and insurance rows, from `GC` in `gc.mjs`. Never use a "pending" slot.
   - Point the panel's button to `/capabilities/`.
   - **Guard change, same PR:** `pendingProblems()` in `gc.test.mjs` fails on credential nouns (license, bond, insurance and their Spanish forms) inside the qualifications section. That rule is right before license day and wrong after it. At flip, change it to allow those nouns only when `GC.enabled` is true and the license number from `GC.license.number` appears in that section. Add a negative test: credential nouns with no license number on the page must still fail. The pending-wording rule (`pending`/`pendiente`) never changes.
   - Optional, operator's call: the hero eyebrow and title can name general contracting.
6. **Navigation.** This switches automatically when `GC.enabled` is true: "Commercial & public works" in the header and the home lane go to the GC landing page, and the footer gains Capabilities and Subcontractors.
7. **Spanish.** Every key in `GC_PENDING_ES_KEYS` (gc.mjs) and `PENDING_ES_KEYS` (strings.mjs) gets a native-speaker read before release.
8. Run `node tools/site/build.mjs`, `--check`, every `node --test tools/site/*.test.mjs`, `release-controls.mjs` and `seo-check.mjs`. Render EN and ES at 1440 and 390.
9. One PR, assigned to parkerman5000, with an independent review. Release on the operator's yes, then read back all three live pages in EN and ES.

## After flip
- Put the license number and expiry on the CRM's company record, so estimates and SOWs can print it.
- Add a reminder 60 days before `license.expires`. An expired license must come off the site the same day: set `enabled` to false, or renew and update.
