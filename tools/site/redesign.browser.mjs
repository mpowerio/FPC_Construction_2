// Local fixture verification. No production traffic or leads. Install the existing
// tools/contact-form dependencies, then: node tools/site/redesign.browser.mjs
import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { services } from './services.mjs';
import { common, home } from './strings.mjs';
import { renderReviews } from './reviews.mjs';
import { TREE_WORK } from './media.mjs';
import { tiktokProfile, whatsappUrl, WHATSAPP_URL } from './social.mjs';

const { chromium } = createRequire(new URL('../contact-form/package.json', import.meta.url))('playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const out = process.env.FPC_EVIDENCE_DIR || '/tmp/fpc-redesign-evidence';
await mkdir(out, { recursive: true });
const types = { html: 'text/html', js: 'text/javascript', css: 'text/css', avif: 'image/avif', webp: 'image/webp', woff2: 'font/woff2', svg: 'image/svg+xml', ico: 'image/x-icon', mp4: 'video/mp4' };
const pages = ['/', '/es/', '/estimate/', '/es/estimado/', ...services.flatMap(s => Object.values(s.url))];
const receipts = [];
const browser = await chromium.launch({ headless: true });
let productionPosts = 0;
async function fixture(context, insert = '', summary = '') {
  await context.route('**/*', async route => {
    const u = new URL(route.request().url());
    if (u.hostname !== 'fpc.test') {
      if (route.request().method() === 'POST') productionPosts++;
      return route.abort();
    }
    if (route.request().method() !== 'GET') throw new Error('Unexpected fixture mutation');
    const path = join(root, u.pathname, u.pathname.endsWith('/') ? 'index.html' : '');
    try { let body = await readFile(path); if (insert && (u.pathname === '/' || u.pathname === '/es/')) body = Buffer.from(body.toString().replace('<footer class="site-footer', insert + '<footer class="site-footer').replace('<form class="estimate-start"', summary + '<form class="estimate-start"')); return route.fulfill({ contentType: types[path.split('.').pop()] || 'application/octet-stream', body }); }
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
      assert.equal(await page.locator('#google-reviews, .review-summary, .review-action').count(), 0, 'Unverified Google reviews remain absent');
      const isHome = path === '/' || path === '/es/';
      assert.equal(await page.locator('.tree-work').count(), isHome ? 1 : 0);
      if (isHome) {
        assert.equal(await page.locator('.tree-testimonial blockquote').innerText(), TREE_WORK.testimonial.text);
        assert.equal(await page.locator('.tree-testimonial strong').innerText(), 'Michael Parker');
        assert.equal(await page.locator('.tree-testimonial time').getAttribute('datetime'), '2026-11-10');
        assert.equal(await page.locator('.tree-testimonial__rating').innerText(), '5/5');
        assert.ok(!(await page.locator('.tree-testimonial').innerText()).includes('Google'));
        assert.equal(await page.locator('.tree-testimonial__author span').innerText(), 'North Augusta, Foxchase subdivision', 'Only operator-approved town/subdivision wording');
        assert.equal(await page.locator('.tree-testimonial__author span').getAttribute('lang'), 'en');
        assert.equal(await page.locator('.tree-testimonial__disclosure').innerText(), common[path === '/es/' ? 'es' : 'en']['media.disclosure']);
        assert.equal(await page.locator('#services .trade').count(), 3);
        const hierarchy = await page.evaluate(() => {
          const service = document.querySelector('#services'), tree = document.querySelector('.tree-work');
          const cards = [...service.querySelectorAll('.trade')].map(e => {const r=e.getBoundingClientRect(); return {width:r.width,top:r.top};});
          return {treeBelow: Boolean(service.compareDocumentPosition(tree) & Node.DOCUMENT_POSITION_FOLLOWING), cards};
        });
        assert.ok(hierarchy.treeBelow, 'Tree work follows all three main service paths');
        assert.ok(hierarchy.cards.every(card => Math.abs(card.width-hierarchy.cards[0].width)<1), 'Three equal service paths');
        assert.equal((await page.locator('h1').innerText()).replace(/\s+/g, ' '), path === '/es/' ? 'Sépticos. Concreto. Obras comerciales y públicas.' : 'Septic. Concrete. Commercial & public works.');
        assert.equal(await page.locator('[data-release-pending]').count(), 0, 'No held public copy remains');
        // v3 (Chair ruling A): the third lane carries a real FPC site-work photo with a factual caption, never a public-project claim.
        assert.equal(await page.locator('.trade--public .lane__cap').innerText(), home[path === '/es/' ? 'es' : 'en']['core.d.cap']);
        assert.equal(await page.locator('main').getByText(/Pending verification|Pendiente de verificación/).count(), 0, 'No pending wording on public pages');
        assert.equal(await page.locator('.site-header .plate img').first().getAttribute('src'), '/assets/brand/fpc-lockup-enhanced-light.svg');
        assert.equal(await page.locator('.site-footer .plate img').getAttribute('src'), '/assets/brand/fpc-lockup-enhanced-light.svg');
        assert.ok(!(await page.content()).includes('agent-out/'));
        assert.equal(await page.locator('.tree-work video').count(), 3);
        for (const video of await page.locator('.tree-work video').all()) {
          assert.equal(await video.getAttribute('preload'), 'none');
          assert.equal(await video.getAttribute('autoplay'), null);
        }
      }
      assert.equal(await page.locator('a[href="https://mpowerio.ai"]').innerText(), path.startsWith('/es/') ? 'Desarrollado por mpowerio.ai' : 'Powered by mpowerio.ai', 'Agency credit is unchanged');
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
  // Synthetic populated layouts live only in fixture responses, never in generated files.
  for (const width of [1440, 820, 390]) for (const lang of ['en', 'es']) {
    const t = key => common[lang][key];
    const source = 'https://www.google.com/maps?cid=synthetic-fixture';
    const reviews = renderReviews(t, { reviewUrl: source, snapshot: { verified: true, listingId:'fixture-only', listingUrl:source, observedOn:'2026-11-10', rating:4.7, count:7, items:[
      { listingId:'fixture-only', author:'Local fixture A', rating:5, dateLabel:'2026-11-10', text:'Synthetic layout fixture. This is not a real customer review.', language:'en', sourceUrl:source, excerpt:true },
      { listingId:'fixture-only', author:'Local fixture B', rating:4, dateLabel:'2026-11-10', text:'Prueba de diseño local. No es una reseña de un cliente real.', language:'es', sourceUrl:source, excerpt:true }
    ] } });
    const c = await browser.newContext({ viewport:{width,height:1000}, reducedMotion:'reduce' });
    await fixture(c, reviews.section, reviews.summary);
    const p = await c.newPage(); await p.goto('https://fpc.test' + (lang === 'es' ? '/es/' : '/'));
    await p.locator('#google-reviews').scrollIntoViewIfNeeded();
    assert.equal(await p.locator('.review-quote').count(), 2);
    assert.equal(await p.locator('.review-action').innerText(), t('reviews.leave'));
    assert.equal(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    for (const link of await p.locator('#google-reviews a').all()) {
      const box = await link.boundingBox(); assert.ok(box.height >= 44 && box.width >= 44);
    }
    await p.screenshot({path:join(out, `synthetic-reviews-${lang}-${width}.png`)});
    await p.locator('.tree-work').scrollIntoViewIfNeeded();
    assert.equal(await p.locator('.tree-work img').getAttribute('loading'), 'lazy');
    await p.locator('.tree-work__story').scrollIntoViewIfNeeded();
    await p.locator('.tree-work img').evaluate(image => image.decode());
    await p.locator('.tree-work__story').screenshot({path:join(out, `tree-testimonial-${lang}-${width}.png`)});
    await c.close();
  }
  // Exercise actual silent local clips; no provider or external request is involved.
  const playback = await browser.newContext({ viewport:{width:390,height:1000}, reducedMotion:'reduce' });
  await fixture(playback);
  const videoPage = await playback.newPage(); await videoPage.goto('https://fpc.test/');
  for (const video of await videoPage.locator('.tree-work video').all()) {
    await video.scrollIntoViewIfNeeded();
    await video.evaluate(async v => { await v.play(); });
    await videoPage.waitForFunction(v => v.currentTime > 0.1 && !v.error, await video.elementHandle());
    const result = await video.evaluate(v => { v.pause(); return { width:v.videoWidth,height:v.videoHeight,duration:v.duration,error:v.error?.message }; });
    assert.ok(result.width > 0 && result.height > 0 && result.duration > 6 && !result.error);
  }
  await playback.close();
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
  await writeFile(join(out, 'responsive-results.json'), JSON.stringify({ pages:receipts.length, syntheticLayouts:6, productionPosts, receipts }, null, 2));
  console.log(`PASS: ${receipts.length} page/viewport combinations; starter handoff; no-JS; schema; local links; hidden TikTok/Google reviews; approved exact testimonial and three silent clips with playback; six synthetic review layouts; motion; zero external POST attempts. Evidence: ${out}`);
} finally { await browser.close(); }
