// Rendered proof that the contractor-license footer line is SEEN (Chair 2026-11-20, site PR #51 r5).
// Markup checks cannot prove visibility: a stylesheet rule or a closed <details> hides the line while the HTML
// looks fine. This opens every public page in headless Chromium (page JS on, network off except this repo's
// files) and asserts, per page while the license is active:
//   - exactly one p.footer-license inside the page's <footer>, whose rendered text equals licenseLine(lang);
//   - it has client rects, a non-zero box, and element.checkVisibility({opacity, visibility, content-visibility}).
// After expiry it asserts the line is absent. Then it plants must-fail controls (stylesheet display:none,
// closed <details>, visibility:hidden, opacity:0, hidden wrapper) and requires every one to fail.
// Dev-only: Playwright is pinned in package.json/package-lock.json and runs in CI; nothing ships to visitors.
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { services } from './services.mjs';
import { publicPages } from './claim-guard.mjs';
import { licenseLine, licenseActive } from './license.mjs';

const root = new URL('../../', import.meta.url);
const TYPES = { html: 'text/html', js: 'text/javascript', css: 'text/css', svg: 'image/svg+xml', woff2: 'font/woff2', webp: 'image/webp', avif: 'image/avif', png: 'image/png', jpg: 'image/jpeg', json: 'application/json' };
const pages = publicPages(services);
const now = new Date();

async function render(browser, file, mutate) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: true });
  await ctx.route('**/*', async (route) => {
    const u = new URL(route.request().url());
    if (u.hostname !== 'fpc.test' || route.request().method() !== 'GET') return route.abort();
    let name = decodeURIComponent(u.pathname.replace(/^\//, '')); if (!name || name.endsWith('/')) name += 'index.html';
    try {
      let body = (await readFile(new URL(name, root))).toString('binary');
      if (mutate) body = mutate(name, body);
      return route.fulfill({ body: Buffer.from(body, 'binary'), contentType: TYPES[name.split('.').pop()] || 'application/octet-stream' });
    } catch { return route.fulfill({ status: 404, body: '' }); }
  });
  const p = await ctx.newPage();
  await p.goto(`https://fpc.test/${file}`, { waitUntil: 'load' });
  const r = await p.evaluate(() => {
    const lang = (document.documentElement.lang || 'en').toLowerCase().startsWith('es') ? 'es' : 'en';
    const all = [...document.querySelectorAll('p.footer-license')];
    const inFooter = all.filter((el) => el.closest('footer'));
    const el = inFooter[0];
    if (!el) return { lang, count: all.length, footerCount: 0 };
    const box = el.getBoundingClientRect();
    return {
      lang, count: all.length, footerCount: inFooter.length, text: el.innerText.trim(),
      rects: el.getClientRects().length, w: box.width, h: box.height,
      visible: el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true }),
    };
  });
  await ctx.close();
  return r;
}

function problems(file, r) {
  const want = licenseLine(r.lang, now);
  if (!licenseActive(now)) return r.count ? [`${file}: license line still present after expiry`] : [];
  const out = [];
  if (r.count !== 1 || r.footerCount !== 1) out.push(`${file}: expected exactly one footer license line in <footer>, found ${r.count} (${r.footerCount} in footer)`);
  if (r.footerCount) {
    if (r.text !== want) out.push(`${file}: rendered text "${r.text}" is not the approved ${r.lang} line`);
    if (!r.rects || !(r.w > 0 && r.h > 0)) out.push(`${file}: license line has no rendered box`);
    if (!r.visible) out.push(`${file}: license line is not visible (checkVisibility false)`);
  }
  return out;
}

const LINE_RE = /<p class="small footer-license">[^<]*<\/p>/;
const CONTROLS = [
  ['stylesheet display:none', (n, b) => (n.endsWith('.css') ? `${b}\n.footer-license { display: none; }\n` : b)],
  ['closed <details>', (n, b) => (n.endsWith('.html') ? b.replace(LINE_RE, (m) => `<details><summary>Company details</summary>${m}</details>`) : b)],
  ['stylesheet visibility:hidden', (n, b) => (n.endsWith('.css') ? `${b}\n.footer-license { visibility: hidden; }\n` : b)],
  ['stylesheet opacity:0', (n, b) => (n.endsWith('.css') ? `${b}\n.footer-license { opacity: 0; }\n` : b)],
  ['hidden wrapper', (n, b) => (n.endsWith('.html') ? b.replace(LINE_RE, (m) => `<div hidden>${m}</div>`) : b)],
];

const browser = await chromium.launch();
let failed = 0;
try {
  for (const f of pages) {
    const ps = problems(f, await render(browser, f));
    for (const p of ps) { console.error(`FAIL ${p}`); failed++; }
  }
  console.log(`rendered ${pages.length} pages: ${failed ? `${failed} problem(s)` : 'license line present, in footer, visible'}`);
  if (licenseActive(now)) {
    // Must-fail controls on every page: each control must make every page fail.
    for (const [name, mutate] of CONTROLS) {
      let caught = 0;
      for (const f of pages) if (problems(f, await render(browser, f, mutate)).length) caught++;
      const ok = caught === pages.length;
      console.log(`${ok ? 'ok  ' : 'MISS'} control "${name}": ${caught}/${pages.length} pages fail`);
      if (!ok) failed++;
    }
  }
} finally { await browser.close(); }
process.exit(failed ? 1 : 0);
