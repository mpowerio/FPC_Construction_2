// The general-contractor pages are built ahead of license day and must not leak before it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GC, GC_PAGES, missingRecords, assertReadyToPublish, renderGcPage } from './gc.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const h = { t: (k) => k, nub: () => '', tnub: () => '', label: (n, x) => x, pic: () => '<img alt="">', estimateUrl: '/estimate/', url: (k) => GC_PAGES[k].en };

test('GC stays off until license day', () => {
  assert.equal(GC.enabled, false);
});
test('no GC page exists in the published tree while GC is off', () => {
  for (const url of Object.values(GC_PAGES).flatMap((u) => Object.values(u))) {
    assert.ok(!existsSync(join(root, url.slice(1), 'index.html')), `${url} must not be published before license day`);
  }
  const sitemap = readFileSync(join(root, 'sitemap.xml'), 'utf8');
  for (const url of Object.values(GC_PAGES).flatMap((u) => Object.values(u))) assert.ok(!sitemap.includes(url), `sitemap lists ${url}`);
});
test('enabling GC with any required record missing refuses to build', () => {
  const gc = structuredClone(GC); gc.enabled = true;
  assert.throws(() => assertReadyToPublish(gc), /records are missing/);
  assert.ok(missingRecords(gc).includes('license.number'));
});
test('a fully recorded, unexpired license passes; an expired one fails', () => {
  const gc = structuredClone(GC); gc.enabled = true;
  Object.assign(gc.license, { number: 'TEST-0000', classifications: ['TEST'], group: 'TEST', expires: '2999-01-01' });
  Object.assign(gc.bonding, { single: 'TEST', aggregate: 'TEST', surety: 'TEST' });
  Object.assign(gc.insurance, { gl: 'TEST', wc: 'TEST' });
  Object.assign(gc.ids, { uei: 'TEST', naics: ['000000'] });
  assert.doesNotThrow(() => assertReadyToPublish(gc));
  gc.license.expires = '2000-01-01';
  assert.throws(() => assertReadyToPublish(gc), /expired/);
});
test('a published render never prints a placeholder for a missing record', () => {
  assert.throws(() => renderGcPage('capabilities', 'en', h, { preview: false }), /missing/);
  assert.match(renderGcPage('capabilities', 'en', h, { preview: true }), /MISSING/);
});
test('no projects are invented: past performance is omitted while the list is empty', () => {
  assert.equal(GC.projects.length, 0);
  assert.doesNotMatch(renderGcPage('commercial', 'en', h, { preview: true }), /Recent projects/);
});

// Operator, 2026-11-13: "no pending". Public pages carry no pending-credential wording or slots.
import { services } from './services.mjs';
const publicPages = ['index.html', 'es/index.html', 'estimate/index.html', 'es/estimado/index.html',
  ...services.flatMap((s) => Object.values(s.url).map((u) => u.slice(1) + 'index.html'))];
export function pendingProblems(html) {
  const body = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const text = (h) => h.replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ');
  const found = [];
  // Any pending wording, in either language, anywhere in the visible page.
  if (/\bpending\b|pendiente/i.test(text(body))) found.push('pending wording');
  if (/class="[^"]*\b(slot--pending|medal--pending|lane__pending)\b/.test(body)) found.push('pending credential slot');
  if (/data-release-pending\b/.test(body)) found.push('release-pending marker');
  // No credential nouns in the qualifications section before license day (docs/GC-FLIP.md step 5).
  const quals = body.match(/<section\b[^>]*aria-labelledby="quals-h"[\s\S]*?<\/section>/);
  if (quals && /\b(licen[cs](?:e|ed|es|ing)|licencias?|bond(?:s|ed|ing)?|fianzas?|afianzad[oa]s?|insur(?:ance|ed)|seguros?|asegurad[oa]s?)\b/i.test(text(quals[0]))) found.push('credential noun in the qualifications section');
  return found;
}
for (const file of publicPages) test(`${file}: no pending wording or credential-pending slot`, () => {
  assert.deepEqual(pendingProblems(readFileSync(join(root, file), 'utf8')), []);
});
test('the pending guard catches each planted form', () => {
  for (const planted of ['<p>License records: Pending verification</p>', '<p>Pendiente de verificación</p>', '<div class="slot slot--pending">x</div>', '<h1 data-release-pending>x</h1>',
    '<p>License verification pending</p>', '<span>Pending</span>', '<p>Licencia pendiente</p>']) {
    assert.ok(pendingProblems(`<main>${planted}</main>`).length, planted);
  }
  // A bare credential label inside the qualifications panel, with no pending word at all.
  const quals = (label) => `<main><section class="section" aria-labelledby="quals-h"><h2 id="quals-h">For buyers</h2><dl><div><dt>${label}</dt><dd>On file</dd></div></dl></section></main>`;
  for (const label of ['License, bond and insurance records', 'Licencia, fianza y seguro', 'Insurance', 'Bonding']) assert.ok(pendingProblems(quals(label)).length, label);
  assert.deepEqual(pendingProblems(quals('Service area')), [], 'true non-credential facts pass');
  assert.deepEqual(pendingProblems('<style>.slot--pending{}</style><main>Ready</main>'), []);
});
