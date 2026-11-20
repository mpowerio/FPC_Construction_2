// Rendered proof that the contractor-license footer line is SEEN (Chair 2026-11-20, site PR #51 r5).
// Markup checks cannot prove visibility: a stylesheet rule or a closed <details> hides the line while the HTML
// looks fine. This opens every public page in headless Chromium (page JS on, network off except this repo's
// files) and asserts, per page while the license is active:
//   - exactly one p.footer-license inside the page's <footer>, whose rendered text equals licenseLine(lang);
//   - it has client rects, a non-zero box, and element.checkVisibility({opacity, visibility, content-visibility});
//   - it PAINTS: a screenshot of its box differs from the same box with the line forced to visibility:hidden
//     (catches transparent text and text the same colour as its background);
// at 390, 768 and 1440 px wide (r6: a media query can hide the line at one width only).
// After expiry it asserts the line is absent. Then it plants must-fail controls (stylesheet display:none,
// closed <details>, visibility:hidden, opacity:0, hidden wrapper, transparent colour, same-as-background colour,
// desktop-only and tablet-only media queries) and requires every one to fail on every page at every width where
// it applies.
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

const WIDTHS = [390, 768, 1440];
// Minimum share of the line's box that must visibly change when it is hidden (see the paint diff below).
const INK_MIN = 0.02;

async function render(browser, file, mutate, width) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, javaScriptEnabled: true, reducedMotion: 'reduce' });
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
  await p.evaluate(() => document.fonts.ready);
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
  if (r.footerCount && r.rects && r.visible && r.w > 0 && r.h > 0) {
    // Paint diff: the line's box as rendered vs the same box with the line hidden. Identical pixels = nothing painted.
    const clipOf = () => p.evaluate(() => {
      const el = [...document.querySelectorAll('p.footer-license')].find((e) => e.closest('footer'));
      el.scrollIntoView({ block: 'center' });
      const b = el.getBoundingClientRect();
      return { x: Math.max(0, b.x), y: Math.max(0, b.y), width: Math.max(1, Math.min(b.width, innerWidth - Math.max(0, b.x))), height: Math.max(1, Math.min(b.height, innerHeight - Math.max(0, b.y))) };
    });
    try {
      const clip = await clipOf();
      const shown = await p.screenshot({ clip, animations: 'disabled' });
      await p.evaluate(() => [...document.querySelectorAll('p.footer-license')].find((e) => e.closest('footer')).style.setProperty('visibility', 'hidden', 'important'));
      const hidden = await p.screenshot({ clip, animations: 'disabled' });
      // Legible paint, not just any change: the share of pixels whose largest channel moves by >= 48/255 when the
      // line is hidden. Text the same colour as a textured background moves pixels only by the texture's own
      // variation; real text moves the glyph pixels by far more.
      r.inked = await p.evaluate(async ([a, b]) => {
        const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
        const [ia, ib] = await Promise.all([load(a), load(b)]);
        const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data; };
        const da = px(ia), db = px(ib); let n = 0;
        for (let i = 0; i < da.length; i += 4) if (Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])) >= 48) n++;
        return n / (da.length / 4);
      }, [`data:image/png;base64,${shown.toString('base64')}`, `data:image/png;base64,${hidden.toString('base64')}`]);
      r.paints = r.inked >= INK_MIN;
    } catch (e) { r.paints = false; r.paintError = String(e.message || e).split('\n')[0]; } // cannot screenshot it = not proven painted
  }
  await ctx.close();
  return r;
}

const inkSeen = {};
function problems(file, r) {
  if (r.inked !== undefined) (inkSeen[file] ??= []).push(Number(r.inked.toFixed(3)));
  const want = licenseLine(r.lang, now);
  if (!licenseActive(now)) return r.count ? [`${file}: license line still present after expiry`] : [];
  const out = [];
  if (r.count !== 1 || r.footerCount !== 1) out.push(`${file}: expected exactly one footer license line in <footer>, found ${r.count} (${r.footerCount} in footer)`);
  if (r.footerCount) {
    if (r.text !== want) out.push(`${file}: rendered text "${r.text}" is not the approved ${r.lang} line`);
    if (!r.rects || !(r.w > 0 && r.h > 0)) out.push(`${file}: license line has no rendered box`);
    if (!r.visible) out.push(`${file}: license line is not visible (checkVisibility false)`);
    else if (!r.paints) out.push(`${file}: license line paints nothing (same pixels as hidden: transparent or background-coloured text)`);
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
  ['stylesheet color:transparent', (n, b) => (n.endsWith('.css') ? `${b}\n.footer-license { color: transparent !important; text-shadow: none !important; }\n` : b)],
  // Same colour as the background: set at load time to the nearest opaque ancestor background.
  ['same-as-background colour', (n, b) => (n.endsWith('.html') ? b.replace('</body>', `<script>(() => { const el = [...document.querySelectorAll('p.footer-license')].find((e) => e.closest('footer')); if (!el) return; let a = el, bg = 'rgb(255, 255, 255)'; while (a) { const c = getComputedStyle(a).backgroundColor; if (c && c !== 'transparent' && !/rgba\\(.*,\\s*0\\)$/.test(c)) { bg = c; break; } a = a.parentElement; } el.style.setProperty('color', bg, 'important'); el.style.setProperty('text-shadow', 'none', 'important'); for (const k of el.querySelectorAll('*')) k.style.setProperty('color', bg, 'important'); })();</script></body>`) : b)],
  ['desktop-only display:none', (n, b) => (n.endsWith('.css') ? `${b}\n@media (min-width: 1024px) { .footer-license { display: none; } }\n` : b), (w) => w >= 1024],
  ['tablet-only display:none', (n, b) => (n.endsWith('.css') ? `${b}\n@media (min-width: 700px) and (max-width: 900px) { .footer-license { display: none; } }\n` : b), (w) => w >= 700 && w <= 900],
];

const browser = await chromium.launch();
let failed = 0;
try {
  for (const w of WIDTHS) {
    let bad = 0;
    for (const f of pages) for (const p of problems(f, await render(browser, f, null, w))) { console.error(`FAIL @${w}px ${p}`); bad++; }
    failed += bad;
    console.log(`@${w}px rendered ${pages.length} pages: ${bad ? `${bad} problem(s)` : 'license line present, in footer, visible and painted'}`);
  }
  if (licenseActive(now)) {
    // Must-fail controls: each control must make every page fail at every width where it applies.
    for (const [name, mutate, applies = () => true] of CONTROLS) {
      const widths = WIDTHS.filter(applies);
      // A width-specific control that no checked width reaches means the check no longer covers that width.
      if (!widths.length) { console.log(`MISS control "${name}": no checked width (${WIDTHS.join(', ')}) reaches it`); failed++; }
      for (const w of widths) {
        let caught = 0;
        for (const f of pages) if (problems(f, await render(browser, f, mutate, w)).length) caught++;
        const ok = caught === pages.length;
        console.log(`${ok ? 'ok  ' : 'MISS'} control "${name}" @${w}px: ${caught}/${pages.length} pages fail`);
        if (!ok) failed++;
      }
    }
  }
} finally { await browser.close(); }
if (process.env.FPC_INK_REPORT) console.log('ink', JSON.stringify(inkSeen));
process.exit(failed ? 1 : 0);
