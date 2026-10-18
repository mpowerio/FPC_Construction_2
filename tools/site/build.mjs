// Builds the "Bench Cut" pages as plain committed HTML (GitHub Pages serves them as-is).
//
//   node tools/site/build.mjs           write index.html, es/index.html, estimate/index.html,
//                                       es/estimado/index.html and sitemap.xml
//   node tools/site/build.mjs --check   fail if any committed output differs from a fresh build
//
// No dependencies. Fails loudly on: an unknown {{token}}, a string key present in one
// language but not the other, a missing image file, or a leftover {{...}} in the output.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as S from './strings.mjs';

// ---------- Configuration ----------
const ORIGIN = 'https://fpcconstructions.com';
// CRM public lead route. CORS on the CRM allows only fpcconstructions.com and www.
const LEAD_ENDPOINT = 'https://crm.fpcconstructions.com/api/public/webhook/lead-intake';
// Cloudflare Web Analytics token. EMPTY = PLACEHOLDER: no token exists yet, so the beacon
// is emitted commented out. Paste the site token from the Cloudflare dashboard and rebuild.
const CF_WEB_ANALYTICS_TOKEN = '';
// Sitemap lastmod for the pages built here (kept fixed so --check is deterministic).
const LASTMOD = '2026-10-18';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const src = (f) => readFileSync(join(here, 'src', f), 'utf8');
const CHECK = process.argv.includes('--check');

// ---------- Strings: both languages must carry the same keys ----------
for (const [name, dict] of Object.entries({ common: S.common, home: S.home, estimate: S.estimate })) {
  const en = Object.keys(dict.en).sort(), es = Object.keys(dict.es).sort();
  assert.deepEqual(es, en, `strings.${name}: EN and ES keys differ`);
}

// ---------- Partials ----------
const partialsSrc = src('partials.html');
const partial = (name) => {
  const m = partialsSrc.match(new RegExp(`<!--@${name}-->([\\s\\S]*?)<!--@end-->`));
  if (!m) throw new Error(`missing partial ${name}`);
  return m[1].trim();
};

// ---------- Images ----------
const PIC = {
  hero: { id: 'gallery-19', alt: 'hero.alt', sizes: '(min-width: 1280px) 480px, (min-width: 900px) 38vw, 100vw', eager: true },
  // defer: these sit inside Chrome's native lazy-load distance on phones, so `loading=lazy`
  // still fetched ~210 KB during the hero load. core.js loads them 600px before they scroll in.
  septic: { id: 'gallery-12', alt: 'core.s.alt', sizes: '(min-width: 1280px) 672px, (min-width: 900px) 52vw, calc(100vw - 40px)', defer: true },
  drainage: { id: 'gallery-9', alt: 'core.d.alt', sizes: '(min-width: 1280px) 480px, (min-width: 900px) 38vw, calc(100vw - 40px)', defer: true },
  w1: { id: 'gallery-3', alt: 'w1.alt', sizes: '(min-width: 1280px) 784px, (min-width: 900px) 62vw, 82vw' },
  w2: { id: 'gallery-8', alt: 'w2.alt', sizes: '(min-width: 1280px) 384px, (min-width: 900px) 31vw, 82vw' },
  w3: { id: 'project-1', alt: 'w3.alt', sizes: '(min-width: 1280px) 384px, (min-width: 900px) 31vw, 82vw' },
  w4: { id: 'gallery-7', alt: 'w4.alt', sizes: '(min-width: 1280px) 384px, (min-width: 900px) 31vw, 82vw' },
  w5: { id: 'project-5', alt: 'w5.alt', sizes: '(min-width: 1280px) 384px, (min-width: 900px) 31vw, 82vw' },
  w6: { id: 'gallery-15', alt: 'w6.alt', sizes: '(min-width: 1280px) 384px, (min-width: 900px) 31vw, 82vw' },
  estimate: { id: 'gallery-14', alt: 'e.photo.alt', sizes: '(min-width: 1280px) 440px, 34vw' },
};
const widthsFor = (id) => {
  const w = [480, 800, 1200].filter((x) => existsSync(join(root, 'assets', 'img', `${id}-${x}.webp`)) && existsSync(join(root, 'assets', 'img', `${id}-${x}.avif`)));
  if (!w.length) throw new Error(`no images for ${id}; run node tools/site/images.mjs`);
  return w;
};
const srcset = (id, ext) => widthsFor(id).map((w) => `/assets/img/${id}-${w}.${ext} ${w}w`).join(', ');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function picture(p, t, deferred = p.defer) {
  const ws = widthsFor(p.id), max = ws[ws.length - 1], fallback = ws.includes(800) ? 800 : max;
  const load = p.eager ? 'fetchpriority="high" decoding="async"' : 'loading="lazy" decoding="async"';
  if (deferred) {
    // No src/srcset until core.js sets them; <noscript> carries the normal markup.
    return `<picture data-defer><source type="image/avif" data-srcset="${srcset(p.id, 'avif')}" sizes="${p.sizes}">` +
      `<img data-src="/assets/img/${p.id}-${fallback}.webp" data-srcset="${srcset(p.id, 'webp')}" sizes="${p.sizes}" width="${max}" height="${max * 3 / 4}" decoding="async" alt="${esc(t(p.alt))}"></picture>` +
      `<noscript>${picture(p, t, false)}</noscript>`;
  }
  return `<picture><source type="image/avif" srcset="${srcset(p.id, 'avif')}" sizes="${p.sizes}">` +
    `<img src="/assets/img/${p.id}-${fallback}.webp" srcset="${srcset(p.id, 'webp')}" sizes="${p.sizes}" width="${max}" height="${max * 3 / 4}" ${load} alt="${esc(t(p.alt))}"></picture>`;
}
const logo = (sizes, alt, lazy) => `<img src="/assets/img/logo-176.webp" srcset="/assets/img/logo-176.webp 176w, /assets/img/logo-264.webp 264w" sizes="${sizes}" width="264" height="164" alt="${alt}"${lazy ? ' loading="lazy" decoding="async"' : ''}>`;

// ---------- Structured data ----------
const SERVICES = {
  en: ['Septic system installation and repair', 'Drainage and water control', 'Excavation', 'Land grading', 'Land clearing', 'Demolition', 'Concrete', 'Asphalt paving', 'Roofing', 'Decks', 'Carpentry', 'Outdoor living', 'Fencing', 'Brick and tile flooring', 'Electrical'],
  es: ['Instalación y reparación de sistemas sépticos', 'Drenaje y control de agua', 'Excavación', 'Nivelación de terrenos', 'Limpieza de terrenos', 'Demolición', 'Concreto', 'Pavimento de asfalto', 'Techos', 'Decks', 'Carpintería', 'Espacios al aire libre', 'Cercas', 'Pisos de ladrillo y azulejo', 'Trabajos eléctricos'],
};
const DESC = {
  en: 'Septic systems, drainage and site work for homes and land across the CSRA, from North Augusta, SC. Concrete, asphalt, roofing, decks, carpentry, outdoor living, fencing, flooring, demolition and electrical work too.',
  es: 'Sistemas sépticos, drenaje y trabajos de terreno para casas y terrenos en toda la zona del CSRA, desde North Augusta, SC. También concreto, asfalto, techos, decks, carpintería, espacios al aire libre, cercas, pisos, demolición y trabajos eléctricos.',
};
function business(lang) {
  const geo = { '@type': 'GeoCoordinates', latitude: 33.5018, longitude: -81.9651 };
  return {
    // Not "GeneralContractor" (fence): FPC is a septic/drainage/site-work business.
    '@type': ['LocalBusiness', 'HomeAndConstructionBusiness'],
    '@id': `${ORIGIN}/#business`,
    name: 'FPC Construction LLC',
    alternateName: 'FPC Construction',
    slogan: S.SLOGAN,
    description: DESC[lang],
    url: `${ORIGIN}/`,
    telephone: '+1-803-884-9305',
    email: 'info@fpcconstructions.com',
    logo: `${ORIGIN}/assets/img/logo-600.png`,
    image: [`${ORIGIN}/assets/img/og-1200x630.jpg`],
    knowsLanguage: ['en-US', 'es-US'],
    founder: { '@type': 'Person', name: 'Filemon Pineda', jobTitle: 'Owner' },
    address: { '@type': 'PostalAddress', addressLocality: 'North Augusta', addressRegion: 'SC', postalCode: '29860', addressCountry: 'US' },
    geo,
    // 50 mi x 1,609.34 m/mi = 80,467 m
    areaServed: [{ '@type': 'GeoCircle', geoMidpoint: geo, geoRadius: '80467' },
      ...['North Augusta, SC', 'Aiken, SC', 'Edgefield, SC', 'Augusta, GA', 'Martinez, GA', 'Evans, GA', 'Grovetown, GA', 'Thomson, GA', 'Waynesboro, GA'].map((name) => ({ '@type': 'City', name }))],
    // Hours per operator 2026-10-18 (matches the Fil voice agent). Pending Filemon's confirmation.
    openingHoursSpecification: [{ '@type': 'OpeningHoursSpecification', dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], opens: '07:00', closes: '19:00' }],
    hasOfferCatalog: { '@type': 'OfferCatalog', name: lang === 'es' ? 'Servicios' : 'Services', itemListElement: SERVICES[lang].map((name) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name } })) },
    sameAs: ['https://www.facebook.com/p/FPC-Construction-LLC-100066373038903/', 'https://www.instagram.com/fpcconstructions'],
  };
}
const ldScript = (obj) => `<script type="application/ld+json">\n${JSON.stringify(obj, null, 2).replace(/</g, '\\u003c')}\n</script>`;
const strip = (html) => html.replace(/<[^>]+>/g, '');
function jsonld(page, lang, t, url) {
  const graph = [];
  const webpage = { '@type': 'WebPage', '@id': `${url}#webpage`, url, name: t('meta.title'), inLanguage: lang === 'es' ? 'es-US' : 'en-US', about: { '@id': `${ORIGIN}/#business` } };
  if (page === 'home') {
    graph.push(business(lang), webpage);
    graph.push({ '@type': 'FAQPage', '@id': `${url}#faq`, inLanguage: webpage.inLanguage,
      mainEntity: [1, 2, 3, 4].map((n) => ({ '@type': 'Question', name: t(`faq.${n}q`), acceptedAnswer: { '@type': 'Answer', text: strip(t(`faq.${n}a`)) } })) });
  } else {
    graph.push(webpage);
  }
  return ldScript({ '@context': 'https://schema.org', '@graph': graph });
}

// ---------- Analytics ----------
// OFF until a token exists AND privacy.html discloses it. privacy.html currently says the site
// has no analytics, and the A2P texting campaign relies on that page, so the build refuses to
// emit the beacon while the policy does not name Cloudflare Web Analytics. With no token, no
// beacon markup is emitted at all (not even commented out).
if (CF_WEB_ANALYTICS_TOKEN && !/Cloudflare Web Analytics/i.test(readFileSync(join(root, 'privacy.html'), 'utf8'))) {
  throw new Error('CF_WEB_ANALYTICS_TOKEN is set but privacy.html does not disclose Cloudflare Web Analytics. Update privacy.html first.');
}
const analytics = CF_WEB_ANALYTICS_TOKEN
  ? `<script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='${JSON.stringify({ token: CF_WEB_ANALYTICS_TOKEN })}'></script>`
  : '<!-- Web analytics: OFF (no token; see tools/site/build.mjs). -->';

// ---------- PayPal Pay Later message ----------
// Languages whose pages carry the message. PayPal renders this US Pay Later message in English
// even with locale=es_US on the SDK and data-pp-locale/data-pp-language on the message
// (measured 2026-10-18, phase1-r1/vendors-live-r1.json), so Spanish pages leave it out and
// rely on the Spanish FAQ answer, which already explains paying over time through PayPal.
// Add 'es' here once PayPal renders it in Spanish; core.js already passes es_US.
const PAYPAL_MESSAGE_LANGS = ['en'];
// The SDK loads only when the answer is opened (assets/site/core.js), never on page load.
// No data-pp-amount on purpose: the page quotes no prices. Black text: light concrete background.
const ppSlot = (lang) => PAYPAL_MESSAGE_LANGS.includes(lang)
  ? '<div class="pp-slot" data-pp-message data-pp-style-layout="text" data-pp-style-logo-type="inline" data-pp-style-text-color="black"></div>'
  : '<!-- PayPal Pay Later message: English pages only until PayPal renders it in Spanish (tools/site/build.mjs). -->';

// ---------- Pages ----------
const PAGES = [
  { key: 'home', tpl: 'home.html', css: 'home.css', url: { en: '/', es: '/es/' } },
  { key: 'estimate', tpl: 'estimate.html', css: 'estimate.css', url: { en: '/estimate/', es: '/es/estimado/' } },
];
const urlOf = (key, lang) => PAGES.find((p) => p.key === key).url[lang];
const fileFor = (url) => join(root, url.replace(/^\//, ''), 'index.html');
const baseCss = src('base.css');

function render(page, lang) {
  const dict = { ...S.common[lang], ...S[page.key][lang] };
  const t = (k) => { if (!(k in dict)) throw new Error(`missing string ${k} (${page.key}/${lang})`); return dict[k]; };
  const other = lang === 'en' ? 'es' : 'en';
  const cur = ' aria-current="true"';
  const hero = PIC.hero;
  const v = {
    lang,
    home: urlOf('home', lang),
    estimate: urlOf('estimate', lang),
    enUrl: page.url.en, esUrl: page.url.es,
    enAbs: ORIGIN + page.url.en, esAbs: ORIGIN + page.url.es,
    canonical: ORIGIN + page.url[lang],
    enCurrent: lang === 'en' ? cur : '', esCurrent: lang === 'es' ? cur : '',
    estCurrent: page.key === 'estimate' ? ' aria-current="page"' : '',
    ogLocale: lang === 'es' ? 'es_US' : 'en_US', ogLocaleAlt: other === 'es' ? 'es_US' : 'en_US',
    preload: page.key === 'home'
      ? `<link rel="preload" as="image" type="image/avif" imagesrcset="${srcset(hero.id, 'avif')}" imagesizes="${hero.sizes}" fetchpriority="high">`
      : '',
    css: (baseCss + '\n' + src(page.css)).trim(),
    jsonld: jsonld(page.key, lang, t, ORIGIN + page.url[lang]),
    analytics,
    ppSlot: ppSlot(lang),
    endpoint: LEAD_ENDPOINT,
    langEnChecked: lang === 'en' ? ' checked' : '', langEsChecked: lang === 'es' ? ' checked' : '',
    formMsgs: page.key === 'estimate' ? JSON.stringify(Object.fromEntries(S.FORM_RUNTIME_KEYS.map((k) => [k, t(k)]))).replace(/</g, '\\u003c') : '',
    logoHeader: logo('(min-width: 900px) 88px, 72px', esc(t('logo.alt'))),
    logoIsland: logo('56px', ''),
    logoFooter: logo('(min-width: 900px) 88px, 72px', esc(t('logo.alt')), true),
  };
  const expand = (html, depth = 0) => {
    if (depth > 4) throw new Error('partial nesting too deep');
    return html
      .replace(/\{\{> ([a-z]+)\}\}/g, (_, n) => expand(partial(n), depth + 1))
      .replace(/\{\{row ([a-z-]+) ([a-z]+)\}\}/g, (_, slug, k) =>
        `<li><a class="row" href="${v.estimate}?type=${slug}"><span class="row__name">${t(`svc.${k}`)}</span><span class="row__desc">${t(`svc.${k}.d`)}</span><span class="row__nub" aria-hidden="true"><svg><use href="#i-chev"/></svg></span></a></li>`)
      .replace(/\{\{chip ([a-z-]+) ([a-z]+)\}\}/g, (_, slug, k) =>
        `<label class="chip"><input type="radio" name="project_type" value="${slug}"><span>${t(`t.${k}`)}</span></label>`)
      .replace(/\{\{img\.([a-z0-9]+)\}\}/g, (_, n) => { if (!PIC[n]) throw new Error(`unknown image ${n}`); return picture(PIC[n], t); })
      .replace(/\{\{v\.([a-zA-Z]+)\}\}/g, (_, k) => { if (!(k in v)) throw new Error(`unknown var ${k}`); return v[k]; })
      .replace(/\{\{t\.([a-z0-9.]+)\}\}/g, (_, k) => t(k));
  };
  // v.css and v.jsonld can contain "{" sequences, so substitute them last via placeholders.
  const raw = src(page.tpl).replace('{{v.css}}', '\u0000CSS\u0000').replace('{{v.jsonld}}', '\u0000LD\u0000');
  let html = expand(raw);
  if (/\{\{[^}]*\}\}/.test(html)) throw new Error(`unresolved token in ${page.key}/${lang}: ${html.match(/\{\{[^}]*\}\}/)[0]}`);
  html = html.replace('\u0000CSS\u0000', v.css).replace('\u0000LD\u0000', v.jsonld);
  return html;
}

function sitemap() {
  const rows = [];
  for (const p of PAGES) for (const lang of ['en', 'es']) {
    rows.push(`  <url>
    <loc>${ORIGIN}${p.url[lang]}</loc>
    <lastmod>${LASTMOD}</lastmod>
    <xhtml:link rel="alternate" hreflang="en-US" href="${ORIGIN}${p.url.en}"/>
    <xhtml:link rel="alternate" hreflang="es-US" href="${ORIGIN}${p.url.es}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${ORIGIN}${p.url.en}"/>
    <changefreq>monthly</changefreq>
    <priority>${p.key === 'home' ? '1.0' : '0.8'}</priority>
  </url>`);
  }
  for (const legal of ['privacy', 'terms', 'sms-opt-in']) rows.push(`  <url>
    <loc>${ORIGIN}/${legal}</loc>
    <lastmod>2026-10-18</lastmod>
    <changefreq>yearly</changefreq>
    <priority>0.3</priority>
  </url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${rows.join('\n')}
</urlset>
`;
}

const outputs = [];
for (const p of PAGES) for (const lang of ['en', 'es']) outputs.push([fileFor(p.url[lang]), render(p, lang)]);
outputs.push([join(root, 'sitemap.xml'), sitemap()]);

let stale = 0;
for (const [file, content] of outputs) {
  const rel = file.slice(root.length + 1);
  if (CHECK) {
    const now = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (now !== content) { stale++; console.error(`stale: ${rel} (run node tools/site/build.mjs)`); }
  } else {
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    console.log(`wrote ${rel} ${Buffer.byteLength(content)} bytes`);
  }
}
if (CHECK) { if (stale) process.exit(1); console.log(`all ${outputs.length} built files match their sources`); }
