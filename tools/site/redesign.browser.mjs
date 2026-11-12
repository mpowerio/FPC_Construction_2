// Local fixture verification. No production traffic or leads. Install the existing
// tools/contact-form dependencies, then: node tools/site/redesign.browser.mjs
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { services } from './services.mjs';
import { tiktokProfile, whatsappUrl, WHATSAPP_URL } from './social.mjs';

const { chromium } = createRequire(new URL('../contact-form/package.json', import.meta.url))('playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = process.env.FPC_EVIDENCE_DIR || '/tmp/fpc-redesign-evidence';
await mkdir(out, { recursive: true });
const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', avif: 'image/avif', webp: 'image/webp', woff2: 'font/woff2', svg: 'image/svg+xml', ico: 'image/x-icon' };
const pages = ['/', '/es/', '/estimate/', '/es/estimado/', ...services.flatMap(s => Object.values(s.url))];
const receipts = [];
const browser = await chromium.launch({ headless: true });
let productionPosts = 0;
async function fixture(context) {
  await context.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.hostname !== 'fpc.test') {
      if (route.request().method() === 'POST') productionPosts++;
      return route.abort();
    }
    if (route.request().method() !== 'GET') throw new Error('Unexpected fixture mutation');
    const path = join(root, u.pathname, u.pathname.endsWith('/') ? 'index.html' : '');
    try { const body = await readFile(path); return route.fulfill({ contentType: types[path.split('.').pop()] || 'application/octet-stream', body }); }
    catch { return route.fulfill({ status: 404, body: 'missing local fixture' }); }
  });
}
function slug(path) { return path === '/' ? 'home-en' : path.replace(/^\//, '').replaceAll('/', '-').replace(/-$/, ''); }
try {
  // Profile allowlist and red controls: an arbitrary URL cannot become a social link.
  assert.equal(WHATSAPP_URL, '');
  assert.equal(whatsappUrl(), '');
  assert.equal(whatsappUrl('https://wa.me/18035550123'), 'https://wa.me/18035550123');
  for (const url of ['javascript:alert(1)', 'https://example.com/18035550123', 'https://wa.me/18035550123?text=hello', 'https://wa.me/012345678', 'https://user@wa.me/18035550123']) assert.throws(() => whatsappUrl(url));
  assert.equal(tiktokProfile(), '');
  assert.equal(tiktokProfile('https://www.tiktok.com/@synthetic_fixture'), 'https://www.tiktok.com/@synthetic_fixture');
  for (const url of ['javascript:alert(1)', 'https://example.com/@fpc', 'https://tiktok.com.evil.invalid/@fpc', 'https://www.tiktok.com/@fpc?redirect=bad', 'https://user@www.tiktok.com/@fpc', 'https://www.tiktok.com/@fpc/video/1']) assert.throws(() => tiktokProfile(url));
  for (const width of [1440, 820, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await fixture(context);
    for (const path of pages) {
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto('https://fpc.test' + path);
      await page.evaluate(() => document.fonts.ready);
      assert.deepEqual(errors, [], `${path} JavaScript errors`);
      assert.equal(await page.locator('h1').count(), 1);
      const layout = await page.evaluate(() => {
        const box = e => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height }; };
        return { scroll: document.documentElement.scrollWidth, viewport: innerWidth,
          form: document.querySelector('#estimate-form') ? box(document.querySelector('#estimate-form')) : null,
          starter: document.querySelector('.estimate-start') ? box(document.querySelector('.estimate-start')) : null,
          input: document.querySelector('input[name="first_name"]') ? { color: getComputedStyle(document.querySelector('input[name="first_name"]')).color, background: getComputedStyle(document.querySelector('input[name="first_name"]')).backgroundColor } : null,
          shortTargets: [...document.querySelectorAll('a,button,select,summary')].filter(e => !e.closest('[inert]') && e.getBoundingClientRect().width && e.getBoundingClientRect().height && getComputedStyle(e).visibility !== 'hidden').filter(e => { const b = e.getBoundingClientRect(); return b.height < 43.9 || b.width < 43.9; }).map(e => ({ text: e.textContent.trim().slice(0,45), ...box(e) })) };
      });
      assert.ok(layout.scroll <= width, `${path} overflows at ${width}: ${layout.scroll}`);
      assert.deepEqual(layout.shortTargets, [], `${path} small tap targets at ${width}`);
      if (layout.form) assert.ok(layout.form.y < 1000, `Real form below first viewport: ${path} ${width}`);
      if (layout.starter) assert.ok(layout.starter.y + layout.starter.height < 1000, `Estimate starter below first viewport: ${path} ${width}`);
      assert.equal(await page.locator('a[href*="tiktok.com"]').count(), 0, 'Unverified TikTok must be absent');
      assert.equal(await page.locator('a[href*="wa.me"]').count(), 0, 'Unconfirmed WhatsApp must be absent');
      for (const ld of await page.locator('script[type="application/ld+json"]').allTextContents()) {
        const graph = JSON.parse(ld)['@graph']; assert.ok(graph);
        for (const service of graph.filter(n => n['@type'] === 'Service')) {
          const provider = graph.find(n => n['@id'] === service.provider['@id']);
          assert.ok(provider?.name && provider.telephone && provider.address, 'Service provider resolves with NAP on this page');
          assert.ok(provider['@type'].includes('LocalBusiness'));
          assert.equal(service.serviceType, service.name, 'Human service type matches the localized service name');
        }
      }
      const alternate = await page.locator(`link[hreflang="${path.startsWith('/es/') ? 'en' : 'es'}-US"]`).getAttribute('href');
      assert.ok(pages.includes(new URL(alternate).pathname), `Missing language twin: ${path}`);
      const missing = await page.evaluate(async () => {
        const urls = [...new Set([...document.querySelectorAll('a[href^="/"]')].map(a => new URL(a.href).pathname))];
        return (await Promise.all(urls.map(async p => ({ path:p, status:(await fetch(p.endsWith('/') ? p : p + (p.includes('.') ? '' : '.html'))).status })))).filter(r => r.status !== 200);
      });
      assert.deepEqual(missing, [], `Broken same-origin links: ${path}`);
      if (['/', '/es/', '/estimate/', '/es/estimado/', services[0].url.en].includes(path)) {
        await page.screenshot({ path: join(out, `${slug(path)}-${width}.png`) });
        // Paint the lazy photos before taking a full-page receipt.
        await page.evaluate(async () => { for (let y=0; y<document.body.scrollHeight; y+=700) { scrollTo(0,y); await new Promise(r => setTimeout(r,20)); } scrollTo(0,0); });
        await page.screenshot({ path: join(out, `${slug(path)}-${width}-full.png`), fullPage: true });
      }
      if (path === '/' || path === '/es/') {
        assert.ok((await page.locator('.hero__slogan').innerText()).includes('No job too small, no dream too big — FPC Construction for all your needs.'));
        assert.equal(await page.locator('.estimate-start').getAttribute('method'), 'get');
        assert.equal(await page.locator('#start-type').inputValue(), '');
        await page.locator('.estimate-start button').click();
        assert.equal(new URL(page.url()).pathname, path, 'Empty project cannot silently submit a septic selection');
        await page.selectOption('#start-type', 'concrete');
        await Promise.all([page.waitForURL(/(?:estimate|estimado)\/\?type=concrete/), page.locator('.estimate-start button').click()]);
        assert.equal(await page.locator('input[name="project_type"][value="concrete"]').isChecked(), true);
        assert.equal(await page.locator('#estimate-form').getAttribute('data-endpoint'), 'https://crm.fpcconstructions.com/api/public/webhook/lead-intake');
      }
      receipts.push({ path, width, ...layout });
      await page.close();
    }
    await context.close();
  }
  // No-JS: all service copy, language paths and the GET-only starter remain usable.
  const nojs = await browser.newContext({ javaScriptEnabled:false, viewport:{width:390,height:844} });
  await fixture(nojs);
  const p = await nojs.newPage(); await p.goto('https://fpc.test/');
  assert.ok(await p.locator('a[href="/services/septic-systems/"]').count());
  await p.selectOption('#start-type', 'concrete');
  // In a scripts-disabled context Playwright's rAF stability probe can stall.
  // Use a real pointer after checking the painted hit target instead.
  await p.locator('.estimate-start button').evaluate(e => e.scrollIntoView({ behavior:'instant', block:'center' }));
  const button = await p.locator('.estimate-start button').boundingBox();
  const x = button.x + button.width/2, y = button.y + button.height/2;
  assert.equal(await p.evaluate(({x,y}) => document.elementFromPoint(x,y)?.closest('button')?.type, {x,y}), 'submit');
  await p.mouse.click(x,y);
  await p.waitForURL(/estimate/); assert.equal(await p.locator('#estimate-form').count(),1);
  await nojs.close();
  // Normal motion may animate only opacity/transform, and reduced motion has no animations.
  for (const reducedMotion of ['reduce','no-preference']) {
    const c = await browser.newContext({ reducedMotion, viewport:{width:390,height:844} }); await fixture(c);
    const p = await c.newPage(); await p.goto('https://fpc.test/');
    const animations = await p.evaluate(() => document.getAnimations().map(a => a.effect.getKeyframes().flatMap(k => Object.keys(k).filter(n => !['offset','easing','composite','computedOffset','opacity','transform'].includes(n)))));
    assert.ok(animations.flat().length === 0);
    if (reducedMotion === 'reduce') assert.equal(animations.length, 0);
    await c.close();
  }
  assert.equal(productionPosts, 0);
  await writeFile(join(out, 'responsive-results.json'), JSON.stringify({ pages:receipts.length, productionPosts, receipts }, null, 2));
  console.log(`PASS: ${receipts.length} page/viewport combinations; starter handoff; no-JS; schema; local links; hidden TikTok; motion; zero external POST attempts. Evidence: ${out}`);
} finally { await browser.close(); }
