import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { claimProblems } from './claim-guard.mjs';

const NOW = new Date('2026-11-20T12:00:00Z');
const page = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
const inject = (html, snippet, where = '</body>') => html.replace(where, `${snippet}${where}`);
const check = (html, file = 'index.html', now = NOW) => claimProblems(html, { file, now });

test('every published page passes as committed', () => {
  for (const f of ['index.html', 'es/index.html', 'estimate/index.html', 'es/estimado/index.html', 'services/concrete/index.html',
    'es/servicios/concreto/index.html', 'privacy.html', 'terms.html', 'sms-opt-in.html', 'es/sms-opt-in/index.html']) {
    assert.deepEqual(check(page(f), f), [], f);
  }
});

// Review r1 + r2 evasions (REVIEW-50-license-sol62*.md). Every one must be caught.
const EN = page('index.html'), ES = page('es/index.html');
const evasions = [
  ['other license number', EN, '<p>SC Licensed General Contractor · Water &amp; Sewer Lines (WL2) · Lic. CLG.1280859</p>'],
  ['Georgia/residential suffix', EN, '<p>SC Licensed General Contractor · Water &amp; Sewer Lines (WL2) · Lic. CLG.128085 for residential construction throughout Georgia.</p>'],
  ['tag inside "General" (ES)', ES, '<p>Somos Contratista <b>General</b></p>'],
  ['ES line with <strong>', ES, '<p>Contratista <strong>General</strong> con Licencia de SC · Líneas de Agua y Alcantarillado (WL2) · Lic. CLG.128085</p>'],
  ['numeric entity', EN, '<p>Fully insur&#101;d.</p>'],
  ['numeric entity, no semicolon', EN, '<p>Fully insur&#101d.</p>'],
  ['&Tab; entity', EN, '<p>General&Tab;Contractor.</p>'],
  ['exact element inside a claim sentence', EN, '<div>For residential construction throughout Georgia, our credentials are:<p class="small footer-license">SC Licensed General Contractor · Water &amp; Sewer Lines (WL2) · Lic. CLG.128085</p></div>'],
  ['second exact footer element in body', EN, '<p class="small footer-license">SC Licensed General Contractor · Water &amp; Sewer Lines (WL2) · Lic. CLG.128085</p>'],
  ['allowed line then "and insured"', EN, '<p>and insured</p>'],
  ['second credential with Georgia', EN, '<script type="application/ld+json">{"@type": "EducationalOccupationalCredential", "name": "SC Licensed General Contractor · Water & Sewer Lines (WL2) · Lic. CLG.128085", "areaServed": "Georgia", "description": "For residential construction throughout Georgia."}</script>'],
  ['GeneralContractor @type', EN, '<script type="application/ld+json">{"@type": "GeneralContractor", "name": "FPC"}</script>'],
  ['claim in aria-label', EN, '<a href="/" aria-label="Licensed and bonded contractor">x</a>'],
  ['claim in meta description', EN, '<meta name="description" content="Licensed general contractor">', '</head>'],
];
for (const [name, base, snippet, where] of evasions) {
  test(`caught: ${name}`, () => assert.notDeepEqual(check(inject(base, snippet, where)), [], name));
}

test('caught: marketing claims on legal pages (only the 4 exact Terms passages are exempt)', () => {
  assert.notDeepEqual(check(inject(page('terms.html'), '<p>We offer a lifetime warranty, with 15+ years and 500+ completed projects.</p>'), 'terms.html'), []);
  assert.notDeepEqual(check(inject(page('es/sms-opt-in/index.html'), '<p>Garantía de por vida y 15+ años.</p>'), 'es/sms-opt-in/index.html'), []);
  // An exempt passage with a claim appended is no longer exact, so it fails.
  const t = page('terms.html').replace('Nothing in this section changes the warranties in your written agreement with us.', 'Nothing in this section changes the warranties in your written agreement with us. Lifetime warranty.');
  assert.notDeepEqual(check(t, 'terms.html'), []);
});

test('caught: altered or missing footer line on a hand-written page', () => {
  assert.notDeepEqual(check(page('privacy.html').replace('CLG.128085', 'CLG.128086'), 'privacy.html'), []);
  assert.notDeepEqual(check(page('privacy.html').replace(/<p class="small footer-license">[^<]*<\/p>/, ''), 'privacy.html'), []);
});

test('after expiry any remaining license line or credential fails', () => {
  const after = new Date('2028-11-01T12:00:00Z');
  for (const f of ['index.html', 'privacy.html', 'es/sms-opt-in/index.html']) assert.notDeepEqual(check(page(f), f, after), [], f);
});

test('caught: the only license line moved out of <footer>', () => {
  const m = EN.match(/<p class="small footer-license">[^<]*<\/p>/)[0];
  const moved = EN.replace(m, '').replace('<main', `${m}<main`);
  assert.notDeepEqual(check(moved), []);
});

test('caught: a second business node repeating the approved credential', () => {
  const ld = EN.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const graph = JSON.parse(ld);
  const biz = (graph['@graph'] || [graph]).find((n) => n.hasCredential);
  assert.ok(biz, 'fixture has the approved credential');
  const extra = `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@id': biz['@id'], '@type': biz['@type'], hasCredential: biz.hasCredential })}</script>`;
  assert.notDeepEqual(check(inject(EN, extra)), []);
});

// Review round 3 (REVIEW-51-sol62.md) evasions.
const r3 = [
  ['comment splitting a word', '<p>Fully ins<!--ignored-->ured.</p>'],
  ['noscript fallback', '<noscript><p>Fully ins<b>ured</b>.</p></noscript>'],
  ['output element', '<output><span>General </span><span>Contractor</span></output>'],
  ['img alt split', '<p><img alt="General "><img alt="Contractor"></p>'],
  ['zero-width joiner', '<p>Li&#8205;censed for residential construction throughout Georgia.</p>'],
  ['Cyrillic i homoglyph', '<p>Lіcensed for residential construction.</p>'],
  ['soft hyphen', '<p>Fully insur&shy;ed.</p>'],
  ['declarative shadow root', '<div><template shadowrootmode="open"><pre>Lifetime warranty.</pre></template></div>'],
  ['"license" noun claim', '<p>Our license covers grading, residential building and construction in Georgia.</p>'],
  ['input value warranty', '<input aria-label="Offer" value="Lifetime warranty.">'],
  ['abbr title warranty', '<abbr title="Lifetime warranty.">LW</abbr>'],
  ['svg desc warranty', '<svg role="img" aria-label="Offer"><desc>Lifetime warranty.</desc><rect width="20" height="20"/></svg>'],
];
for (const [name, snippet] of r3) test(`caught (r3): ${name}`, () => assert.notDeepEqual(check(inject(EN, snippet)), [], name));

test('caught (r3): CSS generated content', () => {
  assert.notDeepEqual(check(inject(inject(EN, '<style>#rc::before { content: "Fully insured."; }</style>', '</head>'), '<output id="rc"></output>')), []);
});
test('caught (r3): og:description warranty', () => {
  assert.notDeepEqual(check(inject(EN, '<meta property="og:description" content="Lifetime warranty.">', '</head>')), []);
});
test('caught (r3): Terms exempt paragraph with a warranty title attribute', () => {
  const t = page('terms.html').replace('<p>We provide land clearing', '<p title="Lifetime warranty.">We provide land clearing');
  assert.notDeepEqual(check(t, 'terms.html'), []);
});
test('caught (r3): the only footer line wrapped in <template>', () => {
  const m = EN.match(/<p class="small footer-license">[^<]*<\/p>/)[0];
  assert.notDeepEqual(check(EN.replace(m, `<template>${m}</template>`)), []);
});
test('caught (r3): business node loses its credential', () => {
  const ld = EN.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1];
  const g = JSON.parse(ld); const biz = g['@graph'].find((n) => n.hasCredential); const cred = biz.hasCredential; delete biz.hasCredential;
  assert.notDeepEqual(check(EN.replace(ld, JSON.stringify(g))), [], 'deleted');
  biz.subjectOf = { '@type': 'CreativeWork', '@id': biz['@id'], hasCredential: cred };
  assert.notDeepEqual(check(EN.replace(ld, JSON.stringify(g))), [], 'moved to subjectOf');
});
test('caught (r3): expanded-IRI hasCredential after expiry', () => {
  const after = new Date('2028-11-01T00:00:00Z');
  const snippet = '<script type="application/ld+json">{"@context":"https://schema.org","@id":"https://fpcconstructions.com/#business","https://schema.org/hasCredential":{"@type":"Certification","identifier":"CLG.128085"}}</script>';
  assert.notDeepEqual(check(inject(EN, snippet), 'index.html', after), []);
  assert.notDeepEqual(check(inject(EN, snippet)), [], 'also while active');
});

// Review round 4 (REVIEW-51-sol62-r2.md) evasions.
import { cssProblems } from './claim-guard.mjs';
test('caught (r4): footer line hidden by a hidden wrapper or inline style', () => {
  const P = page('privacy.html'); const m = P.match(/<p class="small footer-license">[^<]*<\/p>/)[0];
  assert.notDeepEqual(check(P.replace(m, `<div hidden>${m}</div>`), 'privacy.html'), []);
  assert.notDeepEqual(check(P.replace(m, `<div style="display:none">${m}</div>`), 'privacy.html'), []);
});
test('caught (r4): linked CSS generated content', () => {
  assert.notDeepEqual(cssProblems('.site-footer::before { content: "Fully insured."; }'), []);
  for (const f of ['assets/site/site.css', 'assets/site/legal.css']) assert.deepEqual(cssProblems(page(f)), [], f);
});
test('caught (r4): attr()-backed data attribute text', () => {
  assert.notDeepEqual(check(inject(page('privacy.html'), '<style>#rb::before { content: attr(data-label); }</style><span id="rb" data-label="Fully insured."></span>'), 'privacy.html'), []);
});
test('caught (r4): business JSON-LD moved into an inert <template>', () => {
  const ldTag = EN.match(/<script type="application\/ld\+json">[\s\S]*?<\/script>/)[0];
  assert.notDeepEqual(check(EN.replace(ldTag, `<template>${ldTag}</template>`)), []);
});
test('caught (r4): modified Terms paragraph keeps no exemption', () => {
  const t = page('terms.html').replace('<p>We provide land clearing', '<p>Our promise for every project. We provide land clearing');
  assert.notDeepEqual(check(t, 'terms.html'), []);
  const copied = inject(page('terms.html'), '<div><p>Lifetime warranty on all work.</p></div>');
  assert.notDeepEqual(check(copied, 'terms.html'), []);
});
test('caught (r4): surety bond wording', () => {
  assert.notDeepEqual(check(inject(page('privacy.html'), '<p>We hold a surety bond on every project.</p>'), 'privacy.html'), []);
});

// r5: the vocabulary is the closed, operator-owned list in claim-vocabulary.mjs (Chair 2026-11-20).
test('caught (r5): Spanish insurance wording and "GC"', () => {
  assert.notDeepEqual(check(inject(page('es/sms-opt-in/index.html'), '<p>Contamos con seguro de responsabilidad civil.</p>'), 'es/sms-opt-in/index.html'), []);
  assert.notDeepEqual(check(inject(page('es/sms-opt-in/index.html'), '<p>Tenemos seguro.</p>'), 'es/sms-opt-in/index.html'), []);
  assert.notDeepEqual(check(inject(page('privacy.html'), '<p>FPC is your local GC.</p>'), 'privacy.html'), []);
});
test('caught (r5): prose counts of years and projects, English and Spanish', () => {
  for (const s of ['We have more than 15 years of experience.', 'We have completed over 500 projects.',
    'Más de 15 años de experiencia.', 'Cientos de proyectos terminados.', 'Decades of experience in the CSRA.']) {
    assert.notDeepEqual(check(inject(page('privacy.html'), `<p>${s}</p>`), 'privacy.html'), [], s);
  }
});
test('not a claim (r5): ages and the live pages\' "seguro" (secure, Seguro Social, copia de seguridad)', () => {
  for (const s of ['Not directed to children under 13 years of age.', 'No dirigido a menores de 13 años.', 'Ningún método es completamente seguro.', 'Un número de Seguro Social.']) {
    assert.deepEqual(check(inject(page('privacy.html'), `<p>${s}</p>`), 'privacy.html'), [], s);
  }
});

// Coverage: every page the sitemap publishes must be in the guards' inventory (review of site #53 found the holiday
// pages outside it). One list feeds the claim guard, the release-policy scan and the rendered license check.
import { publicPages } from './claim-guard.mjs';
import { services } from './services.mjs';
import { releaseProblems } from './release-policy.mjs';
test('every sitemap page is in publicPages()', () => {
  const pages = new Set(publicPages(services));
  const locs = [...page('sitemap.xml').matchAll(/<loc>https:\/\/fpcconstructions\.com\/(.*?)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length >= 16, `sitemap too short to trust (${locs.length})`);
  const file = (u) => (u === '' || u.endsWith('/') ? u + 'index.html' : (pages.has(u + '.html') ? u + '.html' : u));
  const missing = locs.map(file).filter((f) => !pages.has(f));
  assert.deepEqual(missing, [], `published but unguarded: ${missing.join(', ')}`);
});
test('holiday pages: clean as shipped, and a planted claim or placeholder fails in each', () => {
  for (const file of ['holidays/index.html', 'es/fiestas/index.html']) {
    const html = page(file);
    assert.deepEqual(claimProblems(html, { file }), [], `${file} as shipped`);
    assert.deepEqual(releaseProblems(html), [], `${file} release policy as shipped`);
    const planted = html.replace('</main>', '<p>We are fully insured.</p></main>');
    assert.ok(claimProblems(planted, { file }).length > 0, `${file}: planted insurance claim must fail`);
    assert.ok(releaseProblems(html.replace('</main>', '<p>Placeholder: photo</p></main>')).length > 0, `${file}: planted placeholder must fail`);
  }
});
// Whole tree (#53 review, cycle 2): every HTML file GitHub Pages would serve is guarded, even one missing from the
// sitemap. Named allowlist: the Google Search Console verification file (one line, no visible page).
import { execFileSync } from 'node:child_process';
const NOT_A_PAGE = ['google6af8ccc14927c3cc.html'];
export function unguardedHtml(tracked, pages = publicPages(services)) {
  return tracked.filter((f) => f.endsWith('.html') && !/^(tools|node_modules|\.github)\//.test(f) && !NOT_A_PAGE.includes(f) && !pages.includes(f));
}
test('every served HTML file in the tree is in publicPages() or the named allowlist', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: new URL('../../', import.meta.url), encoding: 'utf8' }).split('\n');
  assert.ok(tracked.filter((f) => f.endsWith('.html')).length >= 16, 'git ls-files returned too few pages to trust');
  assert.deepEqual(unguardedHtml(tracked), []);
  assert.deepEqual(unguardedHtml(['new-page/index.html', 'tools/x.html', 'google6af8ccc14927c3cc.html']), ['new-page/index.html'], 'control: an unlisted page is caught');
});

import { socialProblems } from './claim-guard.mjs';
const BIZ = (sameAs, q = '"') => `<script type=${q}application/ld+json${q}>${JSON.stringify({ '@graph': [{ '@type': ['LocalBusiness'], sameAs }] })}</script>`;
const GOOD = ['https://www.youtube.com/@FPCbuilds', 'https://www.tiktok.com/@fpc.construction4'];
test('social guard: every shipped page is clean', () => {
  for (const f of ['index.html', 'es/index.html', 'services/concrete/index.html', 'privacy.html']) assert.deepEqual(socialProblems(page(f)), [], f);
  assert.deepEqual(socialProblems(BIZ(GOOD)), [], 'order does not matter');
});
test('social guard: Meta links fail however they are written (#54 review)', () => {
  for (const h of ['<a href="https://www.facebook.com/x">x</a>', '<a href="https://www.facebook&#46;com/x">x</a>', "<a href='https://FACEBOOK.com/x'>x</a>", '<a href="https://fb.me/x">x</a>', '<p>facebook.com/fpc</p>'])
    assert.ok(socialProblems(h).length > 0, h);
  assert.deepEqual(socialProblems('<p>Our concrete form.me is fine</p>'), [], 'no false match inside other words');
  // Cycle 3: plain promotional copy and a Messenger link.
  assert.ok(socialProblems('<p>Follow FPC Construction on Facebook.</p>').length > 0, 'plain Facebook copy');
  assert.ok(socialProblems('<a href="https://www.messenger.com/t/1">Message us</a>').length > 0, 'Messenger link');
});
test('social guard: sameAs is exactly TikTok + YouTube, entry by entry, whatever the quoting (#54 review)', () => {
  assert.ok(socialProblems(BIZ([...GOOD, 'https://www.instagram.com/fpc2488'])).length > 0, 'extra Instagram');
  assert.ok(socialProblems(BIZ([...GOOD, 'https://www.instagram.com/fpc2488'], "'")).length > 0, 'single-quoted script type');
  assert.ok(socialProblems(BIZ([[...GOOD].sort().join(' ')])).length > 0, 'two URLs in one entry (sorted, so a joined-string compare would pass it)');
  assert.ok(socialProblems(BIZ([GOOD[0]])).length > 0, 'missing one');
  assert.ok(socialProblems(BIZ(undefined)).length > 0, 'missing sameAs');
  // Cycle 3: a top-level JSON-LD array of nodes.
  const arr = (sameAs) => `<script type="application/ld+json">${JSON.stringify([{ '@context': 'https://schema.org', '@type': 'WebPage' }, { '@context': 'https://schema.org', '@type': ['LocalBusiness'], sameAs }])}</script>`;
  assert.deepEqual(socialProblems(arr(GOOD)), [], 'array form, correct list');
  assert.ok(socialProblems(arr([...GOOD, 'https://www.instagram.com/fpc2488'])).length > 0, 'array form, extra Instagram');
  // Cycle 4: the business embedded in Service.provider, a business subtype, and a stray sameAs on any node.
  const ld = (obj) => `<script type="application/ld+json">${JSON.stringify(obj)}</script>`;
  const svc = (sameAs) => ld({ '@graph': [{ '@type': 'Service', provider: { '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'], '@id': 'https://fpcconstructions.com/#business', sameAs } }] });
  assert.deepEqual(socialProblems(svc(GOOD)), [], 'embedded provider, correct list');
  assert.ok(socialProblems(svc([...GOOD, 'https://example.com/x'])).length > 0, 'embedded provider, extra URL');
  assert.ok(socialProblems(ld({ '@type': 'HomeAndConstructionBusiness', sameAs: [...GOOD, 'https://www.instagram.com/fpc2488'] })).length > 0, 'business subtype only');
  assert.ok(socialProblems(ld({ '@type': 'Person', sameAs: ['https://www.facebook.com/x'] })).length > 0, 'stray sameAs on another node');
  assert.deepEqual(socialProblems(ld({ '@type': 'WebPage', about: { '@id': 'https://fpcconstructions.com/#business' } })), [], 'a bare @id reference is not a node');
  // Cycle 5: full-IRI and compact Schema.org terms are the same terms.
  assert.ok(socialProblems(ld({ '@type': 'LocalBusiness', sameAs: GOOD, 'http://schema.org/sameAs': ['https://www.instagram.com/fpc2488'] })).length > 0, 'full-IRI sameAs beside the short one');
  assert.ok(socialProblems(ld({ '@type': 'LocalBusiness', 'schema:sameAs': [...GOOD, 'https://example.com/x'] })).length > 0, 'compact sameAs');
  assert.ok(socialProblems(ld({ '@type': 'WebPage', publisher: { '@type': 'http://schema.org/Organization', name: 'FPC Construction' } })).length > 0, 'full-IRI Organization without the list');
  assert.deepEqual(socialProblems(ld({ '@type': 'https://schema.org/LocalBusiness', 'https://schema.org/sameAs': GOOD })), [], 'full-IRI business with the right list passes');
});
