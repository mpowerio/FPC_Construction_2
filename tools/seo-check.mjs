// Local SEO checks for the built pages. Run from the repository root: node tools/seo-check.mjs
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const ORIGIN = 'https://fpcconstructions.com';
const PAGES = [
  { file: 'index.html', url: '/', twin: '/es/', lang: 'en', home: true },
  { file: 'es/index.html', url: '/es/', twin: '/', lang: 'es', home: true },
  { file: 'estimate/index.html', url: '/estimate/', twin: '/es/estimado/', lang: 'en' },
  { file: 'es/estimado/index.html', url: '/es/estimado/', twin: '/estimate/', lang: 'es' },
];
const SLOGAN = 'No job too small, no dream too big — FPC Construction for all your needs.';
const failures = [];
const fail = (page, message) => failures.push(`${page.file}: ${message}`);
const decode = (s) => s.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

for (const page of PAGES) {
  const html = fs.readFileSync(path.join(root, page.file), 'utf8');
  const meta = (name) => (html.match(new RegExp(`<meta name="${name}" content="([^"]*)">`)) || [])[1] || '';

  if (!html.startsWith(`<!DOCTYPE html>\n<html lang="${page.lang}">`)) fail(page, `html lang must be ${page.lang}`);
  const canonical = (html.match(/<link rel="canonical" href="([^"]+)">/) || [])[1];
  if (canonical !== ORIGIN + page.url) fail(page, `canonical is ${canonical}, expected ${ORIGIN + page.url}`);
  const enUrl = page.lang === 'en' ? page.url : page.twin, esUrl = page.lang === 'es' ? page.url : page.twin;
  for (const [hl, url] of [['en-US', enUrl], ['es-US', esUrl], ['x-default', enUrl]]) {
    if (!html.includes(`<link rel="alternate" hreflang="${hl}" href="${ORIGIN}${url}">`)) fail(page, `missing hreflang ${hl} -> ${url}`);
  }

  const description = meta('description');
  if (!description.includes('North Augusta')) fail(page, 'meta description should name North Augusta');
  if (description.length < 110 || description.length > 200) fail(page, `meta description length ${description.length} (want 110-200)`);

  if (/GeneralContractor|general contractor|contratista general/i.test(html)) fail(page, 'must not describe FPC as a general contractor');
  if (/licensed|insured|warrant|15\+|500\+/i.test(decode(html))) fail(page, 'unverified claim (licensed/insured/warranty/years/projects) found');

  const graphs = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].flatMap((m) => {
    try { const j = JSON.parse(m[1]); return j['@graph'] || [j]; } catch (e) { fail(page, `JSON-LD does not parse: ${e.message}`); return []; }
  });
  const types = (n) => [].concat(n['@type']);
  const webpage = graphs.find((n) => types(n).includes('WebPage'));
  if (!webpage || webpage.inLanguage !== (page.lang === 'es' ? 'es-US' : 'en-US')) fail(page, 'WebPage JSON-LD missing or wrong inLanguage');

  // Analytics stays OFF until privacy.html discloses it (the policy currently says there is none).
  if (/cloudflareinsights|data-cf-beacon/.test(html) && !/Cloudflare Web Analytics/i.test(fs.readFileSync(path.join(root, 'privacy.html'), 'utf8'))) {
    fail(page, 'analytics beacon present but privacy.html does not disclose Cloudflare Web Analytics');
  }
  // PayPal renders its Pay Later message in English only, so Spanish pages must not carry it.
  if (page.lang === 'es' && /data-pp-message/.test(html)) fail(page, 'Spanish page carries the English-only PayPal message');
  if (page.home) {
    // Every fragment the old home page published (its nav, footer and section ids) must still
    // resolve, so existing links and bookmarks land on a section instead of the top of the page.
    for (const id of ['main', 'home', 'about', 'services', 'projects', 'testimonials', 'featured', 'faq', 'contact']) {
      const n = (html.match(new RegExp(` id="${id}"`, 'g')) || []).length;
      if (n !== 1) fail(page, `legacy fragment #${id} must exist exactly once (found ${n})`);
    }
    // No testimonials are shown, so #testimonials must land on real job photos, never on the reviews block.
    const work = (html.match(/<section class="work" id="work"[\s\S]*?<\/section>/) || [''])[0];
    if (!work.includes(' id="testimonials"')) fail(page, '#testimonials must point into the Recent work section');
    const business = graphs.find((n) => types(n).includes('LocalBusiness'));
    if (!business) { fail(page, 'LocalBusiness JSON-LD missing'); continue; }
    if (!types(business).includes('HomeAndConstructionBusiness')) fail(page, 'LocalBusiness should also be HomeAndConstructionBusiness');
    if (business.slogan !== SLOGAN) fail(page, 'JSON-LD slogan must be the locked slogan, verbatim');
    if (business.telephone !== '+1-803-884-9305') fail(page, 'telephone must be +1-803-884-9305');
    for (const profile of ['https://www.facebook.com/p/FPC-Construction-LLC-100066373038903/', 'https://www.instagram.com/fpcconstructions']) {
      if (!(business.sameAs || []).includes(profile)) fail(page, `sameAs missing ${profile}`);
    }
    const h1 = decode((html.match(/<h1[^>]*lang="en"[^>]*>([\s\S]*?)<\/h1>/) || [])[1] || '');
    if (h1 !== SLOGAN) fail(page, `H1 must be the locked slogan in English (lang="en"); found "${h1}"`);

    const faq = graphs.find((n) => types(n).includes('FAQPage'));
    const visible = [...html.matchAll(/<summary>([\s\S]*?)<span class="faq__nub"/g)].map((m) => decode(m[1]));
    if (!faq) fail(page, 'FAQPage JSON-LD missing');
    else {
      const structured = faq.mainEntity.map((q) => q.name);
      const onlyLd = structured.filter((q) => !visible.includes(q)), onlyPage = visible.filter((q) => !structured.includes(q));
      if (onlyLd.length) fail(page, `FAQ JSON-LD questions not visible: ${onlyLd.join(' | ')}`);
      if (onlyPage.length) fail(page, `visible FAQ questions missing from JSON-LD: ${onlyPage.join(' | ')}`);
    }
  }
}

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const locs = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
for (const p of PAGES) if (!locs.includes(ORIGIN + p.url)) failures.push(`sitemap.xml: missing ${ORIGIN + p.url}`);
if (locs.some((u) => u.includes('#'))) failures.push('sitemap.xml: lists fragment URLs');

if (failures.length) {
  console.error('SEO check failed:');
  failures.forEach((m) => console.error(`- ${m}`));
  process.exit(1);
}
console.log(`SEO check passed (${PAGES.length} pages + sitemap).`);
