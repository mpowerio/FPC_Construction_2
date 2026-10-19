import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium } from 'playwright';

// Browser regression suite for the estimate form (/estimate/ and /es/estimado/).
// Every request is intercepted: lead POSTs get synthetic local responses, the site is served
// from this checkout, and every other external request is aborted. Nothing reaches the CRM.
const root = new URL('../../', import.meta.url);
const accepted = { success: true, booking_id: '3f9c2a71-5d2e-4b8a-9e61-0c4d7f1a2b90', message: 'Thank you!' };
const inquiry = {
  first_name: 'Synthetic', last_name: 'Browser Check', phone: '(803) 555-0123',
  email: 'browser-check@example.invalid', address: '1 Placeholder Rd, North Augusta',
  details: 'Synthetic local-only inquiry retained on failure.'
};
let browser;
// The language-hint tests run against the real local preview server (tools/site/serve.mjs) over HTTP.
let site;
async function freePort() {
  return new Promise((res, rej) => { const s = createServer().once('error', rej).listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => res(port)); }); });
}
async function startSite() {
  const port = await freePort();
  const proc = spawn(process.execPath, [new URL('../site/serve.mjs', import.meta.url).pathname, String(port)], { stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res, rej) => {
    proc.once('exit', (code) => rej(new Error(`serve.mjs exited ${code}`)));
    proc.stdout.on('data', (b) => { if (String(b).includes('serving')) res(); });
  });
  return { proc, origin: `http://127.0.0.1:${port}` };
}
before(async () => { browser = await chromium.launch({ headless: true }); site = await startSite(); });
after(async () => { await browser?.close(); site?.proc.kill(); });

const TYPES = { html: 'text/html', js: 'text/javascript', css: 'text/css', json: 'application/json', svg: 'image/svg+xml', webp: 'image/webp', avif: 'image/avif', woff2: 'font/woff2', png: 'image/png', ico: 'image/x-icon' };
async function resolve(pathname) {
  // GitHub Pages resolution: directories -> index.html, extensionless -> .html
  let rel = decodeURIComponent(pathname).replace(/^\//, '');
  if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  for (const candidate of [rel, `${rel}.html`]) {
    try { if ((await stat(new URL(candidate, root))).isFile()) return candidate; } catch {}
  }
  return null;
}

async function setup(respond, { path = '/estimate/', clock = false, mutate, mutateFiles = {}, noEndpoint = false, locale, viewport, http = false } = {}) {
  const context = await browser.newContext({ ...(locale ? { locale } : {}), ...(viewport ? { viewport } : {}) });
  const page = await context.newPage();
  let requests = 0;
  const payloads = [];
  const externals = [];
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/webhook/lead-intake')) {
      requests++;
      payloads.push({ url: url.href, body: route.request().postDataJSON() });
      return respond(route);
    }
    if (http && url.origin === site.origin) return route.continue(); // served by tools/site/serve.mjs
    if (url.hostname !== 'fpc.test') { externals.push(url.href); return route.abort(); } // no production traffic, ever
    const rel = await resolve(url.pathname);
    if (!rel) return route.fulfill({ status: 404, body: '' });
    let body = await readFile(new URL(rel, root));
    if (mutate && rel === 'assets/site/estimate.js') body = Buffer.from(mutate(body.toString()));
    if (mutateFiles[rel]) body = Buffer.from(mutateFiles[rel](body.toString()));
    await route.fulfill({ body, contentType: TYPES[rel.split('.').pop()] || 'application/octet-stream' });
  });
  await page.goto(`${http ? site.origin : 'https://fpc.test'}${path}`, { waitUntil: 'load' });
  if (noEndpoint) await page.evaluate(() => { globalThis.FPC_LEAD_URL = ''; });
  if (clock) await page.clock.install();
  return { page, context, requests: () => requests, payloads, externals };
}
async function fill(page) {
  for (const [field, value] of Object.entries(inquiry)) await page.locator(`#${field}`).fill(value);
  await page.locator('label.chip:has(input[name="project_type"][value="concrete"]) span').click();
}
async function submit(page) { await page.locator('#estimate-form').dispatchEvent('submit'); }
async function settled(page) {
  await page.waitForFunction(() => !document.querySelector('#submit').disabled || document.querySelector('.success'));
}
async function preserved(page) {
  for (const [field, value] of Object.entries(inquiry)) assert.equal(await page.locator(`#${field}`).inputValue(), value, `preserve ${field}`);
  assert.equal(await page.locator('input[name="project_type"]:checked').inputValue(), 'concrete');
}
async function failed(page) {
  await settled(page);
  assert.equal(await page.locator('.success').count(), 0, 'no success panel');
  assert.equal(await page.locator('#estimate-form').isVisible(), true);
  await preserved(page);
  const alert = page.locator('#failure[role="alert"]');
  assert.equal(await alert.isVisible(), true, 'failure banner visible');
  assert.match(await alert.innerText(), /couldn't confirm|No pudimos confirmar/i);
  assert.equal(await alert.locator('a[href="tel:+18038849305"]').count(), 1);
  assert.equal(await alert.locator('[data-retry]').count(), 1);
}
async function succeeded(page) {
  await page.locator('.success[role="status"]').waitFor();
  assert.equal(await page.locator('#estimate-form').isHidden(), true);
  assert.match(await page.locator('.success').innerText(), /FPC-3F9C2A71/);
  assert.equal(await page.locator('#failure[role="alert"]').count(), 0);
}
function json(status, body) { return route => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) }); }

for (const [label, respond] of [
  ['HTTP503 JSON', json(503, { error: 'Unavailable' })],
  ['HTTP400 JSON', json(400, { success: false, error: 'validation_error' })],
  ['HTTP403 with success-shaped body', json(403, accepted)],
  ['HTTP500 with success-shaped body', json(500, accepted)],
  ['false success', json(200, { ...accepted, success: false })],
  ['string success', json(200, { ...accepted, success: 'true' })],
  ['missing receipt (honeypot ack)', json(200, { message: 'Received.' })],
  ['empty receipt', json(200, { ...accepted, booking_id: '  ' })],
  ['numeric receipt', json(200, { ...accepted, booking_id: 123 })],
  ['null JSON', json(200, null)],
  ['malformed JSON', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{' })],
  ['offline network failure', route => route.abort('internetdisconnected')],
]) {
  test(`${label} keeps every answer and never claims delivery`, async () => {
    const { page, context, requests } = await setup(respond);
    try { await fill(page); await submit(page); await failed(page); assert.equal(requests(), 1); }
    finally { await context.close(); }
  });
}

test('absent endpoint shows the failure banner and sends nothing', async () => {
  const { page, context, requests } = await setup(json(201, accepted), { noEndpoint: true });
  try { await fill(page); await submit(page); await failed(page); assert.equal(requests(), 0); }
  finally { await context.close(); }
});

for (const status of [200, 201]) {
  test(`${status} with a booking receipt shows success with a reference number`, async () => {
    const { page, context, requests, payloads } = await setup(json(status, accepted));
    try {
      await fill(page); await submit(page); await succeeded(page);
      assert.equal(requests(), 1);
      const { url, body } = payloads[0];
      assert.equal(url, 'https://crm.fpcconstructions.com/api/public/webhook/lead-intake');
      assert.deepEqual(Object.keys(body).sort(), ['company_website', 'email', 'first_name', 'language_preference', 'last_name', 'notes', 'phone', 'project_type', 'service_area'],
        'only keys the CRM accepts today (unknown keys are silently dropped there)');
      assert.equal(body.first_name, 'Synthetic');
      assert.equal(body.last_name, 'Browser Check');
      assert.equal(body.phone, '8035550123');
      assert.equal(body.email, inquiry.email);
      assert.equal(body.project_type, 'concrete');
      assert.equal(body.language_preference, 'en');
      assert.equal(body.service_area, 'Website Contact Form');
      assert.equal(body.company_website, '');
      assert.match(body.notes, /^Synthetic local-only inquiry retained on failure\./);
      assert.match(body.notes, /\nProperty address: 1 Placeholder Rd, North Augusta\n/);
      assert.match(body.notes, /\nBest time to call: Any time\n/);
      assert.match(body.notes, /\nPreferred language: English\n/);
      assert.match(body.notes, /\nSent from: \/estimate\/ \(English page\)$/);
    } finally { await context.close(); }
  });
}

test('Spanish page sends language_preference "es", Spanish messages, Spanish success', async () => {
  const { page, context, payloads } = await setup(json(201, accepted), { path: '/es/estimado/' });
  try {
    await submit(page);
    assert.match(await page.locator('#summary').innerText(), /Revise esto antes de enviar/);
    await fill(page); await submit(page); await succeeded(page);
    assert.equal(payloads[0].body.language_preference, 'es');
    assert.match(payloads[0].body.notes, /Preferred language: Spanish/);
    assert.match(await page.locator('.success').innerText(), /Recibimos su solicitud/);
  } finally { await context.close(); }
});

test('an English-page visitor who picks Español is tagged "es"', async () => {
  const { page, context, payloads } = await setup(json(201, accepted));
  try {
    await fill(page);
    await page.locator('label.chip:has(input[name="language_preference"][value="es"]) span').click();
    assert.equal(await page.locator('input[name="language_preference"][value="es"]').isChecked(), true);
    await submit(page); await succeeded(page);
    assert.equal(payloads[0].body.language_preference, 'es');
  } finally { await context.close(); }
});

test('email is optional; phone, first and last name are required with inline errors and a summary', async () => {
  const { page, context, requests } = await setup(json(201, accepted));
  try {
    await submit(page);
    assert.equal(requests(), 0);
    assert.equal(await page.locator('#summary[role="alert"] li').count(), 3);
    for (const id of ['first_name', 'last_name', 'phone']) assert.equal(await page.locator(`#${id}`).getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator('#email').getAttribute('aria-invalid'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'summary', 'focus moves to the summary');
    await page.locator('#summary a[href="#phone"]').click();
    assert.equal(await page.evaluate(() => document.activeElement.id), 'phone', 'summary links focus their field');
    await fill(page); await page.locator('#phone').fill('555-01'); await submit(page);
    assert.equal(requests(), 0);
    assert.match(await page.locator('#phone-err').innerText(), /10-digit phone number/);
    await page.locator('#phone').fill(inquiry.phone); await page.locator('#email').fill('invalid'); await submit(page);
    assert.equal(requests(), 0);
    assert.match(await page.locator('#email-err').innerText(), /looks incomplete/);
    await page.locator('#email').fill(''); await submit(page); await succeeded(page);
    assert.equal(requests(), 1, 'a phone-only lead is sent');
  } finally { await context.close(); }
});

// ----- Zero layout shift when inline errors appear, change or wrap (EN + ES, phone + desktop) -----
const FIELD_IDS = ['first_name', 'last_name', 'phone', 'email', 'address', 'details'];
async function layout(page) {
  return page.evaluate((ids) => {
    const ref = document.querySelector('#estimate-form fieldset').getBoundingClientRect().top;
    return ids.map((id) => {
      const r = document.getElementById(id).getBoundingClientRect();
      return { id, x: r.x, y: r.top + scrollY, rel: r.top - ref };
    });
  }, FIELD_IDS);
}
function assertSame(before, after, key, step) {
  before.forEach((b, i) => {
    const a = after[i];
    assert.ok(Math.abs(a.x - b.x) < 0.5 && Math.abs(a[key] - b[key]) < 0.5,
      `${step}: #${b.id} moved ${(a[key] - b[key]).toFixed(1)}px vertically, ${(a.x - b.x).toFixed(1)}px horizontally`);
  });
}
async function errorShift(page) {
  // Shift-free blur-driven errors (no summary involved): absolute positions must not change.
  const start = await layout(page);
  await page.locator('#phone').fill('5'); await page.locator('#phone').blur();
  assert.ok((await page.locator('#phone-err .err__msg').innerText()).length > 10, 'phone error shown');
  assertSame(start, await layout(page), 'y', 'phone error on blur');
  await page.locator('#email').fill('x'); await page.locator('#email').blur();
  assert.ok((await page.locator('#email-err .err__msg').innerText()).length > 10, 'email error shown');
  assertSame(start, await layout(page), 'y', 'email error on blur');
  // Submit with everything empty: the summary banner appears above the fields (that move is the
  // banner's own height); below it, required errors on every field must not move anything.
  for (const id of ['phone', 'email']) await page.locator(`#${id}`).fill('');
  await submit(page);
  assert.equal(await page.locator('#summary[role="alert"]').isVisible(), true);
  const withSummary = await layout(page);
  assertSame(start, withSummary, 'rel', 'required errors after submit');
  await page.locator('#phone').fill('5');
  assertSame(withSummary, await layout(page), 'y', 'phone error swaps from required to invalid');
  await page.locator('#email').fill('x');
  assertSame(withSummary, await layout(page), 'y', 'email error appears after submit');
}
for (const path of ['/estimate/', '/es/estimado/']) {
  for (const width of [320, 390, 1440]) {
    test(`inline errors never move the layout: ${path} at ${width}px`, async () => {
      const { page, context } = await setup(json(201, accepted), { path, viewport: { width, height: 900 } });
      try { await errorShift(page); } finally { await context.close(); }
    });
  }
}
// Negative control: without the stacked sizer messages the slot is one line tall, and the
// wrapped phone error at 390px pushes the fields below it down. Proves errorShift() can fail.
test('negative control: removing the reserved error sizers makes the 390px phone error shift layout', async () => {
  const strip = (html) => {
    const out = html.replace(/<span class="err__size" aria-hidden="true">(?:<span>[^<]*<\/span>)+<\/span>/g, '');
    assert.notEqual(out, html, 'mutation applied');
    return out;
  };
  const { page, context } = await setup(json(201, accepted), { path: '/es/estimado/', viewport: { width: 390, height: 900 }, mutateFiles: { 'es/estimado/index.html': strip } });
  try { await assert.rejects(errorShift(page), /moved/); } finally { await context.close(); }
});

// ----- Third-party controls start in the page language, whatever the browser prefers -----
const FIL_TEXT = {
  en: { 'expand-text': 'Chat with Fil', 'action-text': 'Questions? Ask Fil', 'start-call-text': 'Start a call', 'end-call-text': 'End call', 'listening-text': 'Listening', 'speaking-text': 'Talk to interrupt' },
  es: { 'expand-text': 'Hablar con Fil', 'action-text': '¿Preguntas? Pregúntele a Fil', 'start-call-text': 'Iniciar llamada', 'end-call-text': 'Colgar', 'listening-text': 'Escuchando', 'speaking-text': 'Hable para interrumpir' }
};
const lum = (hex) => {
  const [r, g, b] = hex.trim().replace('#', '').match(/../g).map((h) => parseInt(h, 16) / 255).map((v) => v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
for (const [path, locale, want] of [['/es/', 'en-US', 'es'], ['/es/estimado/', 'en-US', 'es'], ['/', 'es-MX', 'en'], ['/estimate/', 'es-MX', 'en']]) {
  test(`${path} with a ${locale} browser initializes Fil${path === '/' ? ' and PayPal' : path === '/es/' ? ' (and no English PayPal message)' : ''} in ${want === 'es' ? 'Spanish' : 'English'}`, async () => {
    const { page, context, externals } = await setup(json(201, accepted), { path, locale });
    try {
      assert.equal(await page.locator('elevenlabs-convai').count(), 0, 'Fil waits for the first interaction');
      await page.keyboard.press('Shift');
      await page.locator('elevenlabs-convai').waitFor({ state: 'attached' });
      const fil = page.locator('elevenlabs-convai');
      const attrs = await fil.evaluate((el) => Object.fromEntries([...el.attributes].map((a) => [a.name, a.value])));
      assert.equal(attrs['override-language'], want, 'Fil language comes from <html lang>');
      for (const [k, v] of Object.entries(FIL_TEXT[want])) assert.equal(attrs[k], v, `${k} in the page language`);
      assert.ok(externals.some((u) => u === 'https://elevenlabs.io/convai-widget/index.js'), 'widget script requested (and blocked here)');
      // Widget buttons are background var(--el-btn-color) with text var(--el-btn-text-color);
      // the panel and secondary buttons are var(--el-text-color) on var(--el-bg-color).
      const v = await fil.evaluate((el) => { const cs = getComputedStyle(el); return Object.fromEntries(['btn-color', 'btn-text-color', 'bg-color', 'text-color', 'focus-color'].map((n) => [n, cs.getPropertyValue(`--el-${n}`).trim()])); });
      for (const [n, c] of Object.entries(v)) assert.match(c, /^#[0-9a-f]{6}$/i, `--el-${n} is set by the site (got "${c}")`);
      assert.ok(contrast(v['btn-text-color'], v['btn-color']) >= 4.5, `button text ${v['btn-text-color']} on ${v['btn-color']}`);
      assert.ok(contrast(v['text-color'], v['bg-color']) >= 4.5, `panel text ${v['text-color']} on ${v['bg-color']}`);
      assert.ok(contrast(v['focus-color'], v['bg-color']) >= 3, `focus ring ${v['focus-color']} on ${v['bg-color']}`);
      if (path === '/') {
        assert.equal(externals.some((u) => u.includes('paypal.com')), false, 'PayPal waits for the payment answer');
        await page.locator('details[data-paypal] summary').click();
        await page.waitForFunction(() => [...document.scripts].some((s) => s.src.includes('paypal.com/sdk/js')));
        const sdk = await page.evaluate(() => [...document.scripts].map((s) => s.src).find((s) => s.includes('paypal.com/sdk/js')));
        assert.equal(new URL(sdk).searchParams.get('locale'), 'en_US', 'SDK locale follows the page, not the es-MX browser');
        assert.equal(new URL(sdk).searchParams.get('components'), 'messages');
        assert.equal(await page.locator('[data-pp-message]').getAttribute('data-pp-locale'), 'en_US', 'message locale follows the page');
      }
      if (path === '/es/') {
        // PayPal renders this message in English even with es_US, so the Spanish page carries
        // no message and never loads the SDK; the Spanish answer explains PayPal itself.
        assert.equal(await page.locator('[data-pp-message]').count(), 0, 'no English PayPal message slot on the Spanish page');
        await page.locator('details[data-paypal] summary').click();
        await page.waitForTimeout(300);
        assert.equal(externals.some((u) => u.includes('paypal.com')), false, 'no PayPal SDK request on the Spanish page');
        assert.match(await page.locator('details[data-paypal] .faq__a').innerText(), /Con PayPal también puede pagar en partes/);
      }
      assert.equal(externals.some((u) => u.includes('cloudflareinsights')), false, 'no analytics beacon while analytics is OFF');
    } finally { await context.close(); }
  });
}

test('?type= preselects the job type', async () => {
  const { page, context } = await setup(json(201, accepted), { path: '/estimate/?type=septic-systems' });
  try { assert.equal(await page.locator('input[name="project_type"]:checked').inputValue(), 'septic-systems'); }
  finally { await context.close(); }
});

test('the form has no SMS opt-in and no photo upload; legal links are present', async () => {
  const { page, context } = await setup(json(201, accepted));
  try {
    assert.equal(await page.locator('#estimate-form input[type="checkbox"]').count(), 0);
    assert.equal(await page.locator('#estimate-form input[type="file"]').count(), 0);
    for (const href of ['/privacy', '/terms', '/sms-opt-in']) {
      assert.equal(await page.locator(`#form-note a[href="${href}"]`).count(), 1);
      assert.equal(await page.locator(`footer a[href="${href}"]`).count(), 1);
    }
  } finally { await context.close(); }
});

test('honeypot value is passed through so the CRM can drop the bot', async () => {
  const { page, context, payloads } = await setup(json(200, { message: 'Received.' }));
  try {
    await fill(page);
    await page.evaluate(() => { document.getElementById('company_website').value = 'http://spam.example'; });
    await submit(page); await failed(page);
    assert.equal(payloads[0].body.company_website, 'http://spam.example');
  } finally { await context.close(); }
});

test('ten repeated submissions during loading send one request', async () => {
  let release;
  const response = new Promise(r => { release = r; });
  const { page, context, requests } = await setup(async route => { await response; await json(201, accepted)(route); });
  try {
    await fill(page); await submit(page);
    await page.waitForFunction(() => document.querySelector('#submit').disabled);
    assert.equal(await page.locator('#submit').getAttribute('aria-busy'), 'true');
    assert.match(await page.locator('#submit').innerText(), /Sending your request/);
    for (let i = 0; i < 10; i++) await submit(page);
    release(); await succeeded(page);
    assert.equal(requests(), 1);
  } finally { release(); await context.close(); }
});

test('timeout restores the form with every answer and a retry', async () => {
  const { page, context } = await setup(() => {}, { clock: true });
  try {
    await fill(page); await submit(page);
    await page.waitForFunction(() => document.querySelector('#submit').disabled);
    await page.clock.fastForward(15001);
    await failed(page);
  } finally { await context.close(); }
});

test('the deadline covers a pending JSON body and ignores its late receipt', async () => {
  const { page, context } = await setup(json(201, accepted), { clock: true });
  try {
    await page.evaluate(() => {
      const parse = Response.prototype.json;
      Response.prototype.json = function () {
        if (this.url.endsWith('/webhook/lead-intake')) return new Promise(r => { globalThis.releaseReceipt = () => r({ success: true, booking_id: 'late-receipt' }); });
        return parse.call(this);
      };
    });
    await fill(page); await submit(page);
    await page.waitForFunction(() => typeof globalThis.releaseReceipt === 'function');
    await page.clock.fastForward(15001);
    await failed(page);
    await page.evaluate(() => globalThis.releaseReceipt());
    await page.clock.fastForward(500);
    await failed(page);
  } finally { await context.close(); }
});

test('retry after a failure replaces the banner with success', async () => {
  let count = 0;
  const { page, context, requests } = await setup(route => json(++count === 2 ? 201 : 503, count === 2 ? accepted : { error: 'Unavailable' })(route));
  try {
    await fill(page); await submit(page); await failed(page);
    await page.locator('#failure [data-retry]').click();
    await succeeded(page);
    assert.equal(requests(), 2);
  } finally { await context.close(); }
});

// Negative control: proves the receipt tests above can fail. With the booking_id check
// removed from estimate.js, a honeypot-style 200 is wrongly shown as a captured lead.
test('negative control: removing the booking_id check makes a receipt-less 200 look captured', async () => {
  const mutate = (src) => {
    const out = src.replace(/typeof receipt\.booking_id === 'string' && receipt\.booking_id\.trim\(\)\.length > 0/, 'true')
      .replace("var ref = 'FPC-' + receipt.booking_id.trim()", "var ref = 'FPC-' + String(receipt.booking_id || '')");
    assert.notEqual(out, src, 'mutation applied');
    return out;
  };
  const { page, context } = await setup(json(200, { success: true, message: 'Received.' }), { mutate });
  try {
    await fill(page); await submit(page);
    await page.locator('.success[role="status"]').waitFor();
    assert.equal(await page.locator('.success').count(), 1, 'the unpatched check would claim delivery');
  } finally { await context.close(); }
});

// ----- Language switch keeps the visitor's answers (per-tab draft, cleared once a send is captured) -----
const choice = { project_type: 'outdoor-living', best_time: 'afternoon' };
async function fillAll(page) {
  for (const [field, value] of Object.entries(inquiry)) await page.locator(`#${field}`).fill(value);
  for (const [name, value] of Object.entries(choice)) await page.locator(`label.chip:has(input[name="${name}"][value="${value}"]) span`).click();
}
async function kept(page, extra = {}) {
  for (const [field, value] of Object.entries(inquiry)) assert.equal(await page.locator(`#${field}`).inputValue(), value, `keep ${field}`);
  for (const [name, value] of Object.entries({ ...choice, ...extra })) assert.equal(await page.locator(`input[name="${name}"]:checked`).inputValue(), value, `keep ${name}`);
}
// The header toggle (a real click event, so core.js handles it exactly as for a visitor).
async function switchTo(page, to) { await page.locator(`.lang a[data-lang="${to}"]`).first().evaluate((a) => a.click()); }
async function landed(page, path) { await page.waitForURL((u) => u.pathname === path); await page.waitForLoadState('load'); }
const drafts = (page) => page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('fpc-estimate')));
function held(final) {
  let release;
  const gate = new Promise((r) => { release = r; });
  return { release: () => release(), respond: async (route) => { await gate; await final(route); } };
}

test('switching language after a failed send keeps every answer, both chips and the failure banner; the retry sends the original answers', async () => {
  let count = 0;
  const { page, context, payloads } = await setup((route) => json(++count === 1 ? 503 : 201, count === 1 ? { error: 'Unavailable' } : accepted)(route), { path: '/estimate/?type=concrete' });
  try {
    await fillAll(page); await submit(page); await settled(page);
    assert.equal(await page.locator('#failure[role="alert"]').isVisible(), true);
    await switchTo(page, 'es'); await landed(page, '/es/estimado/');
    assert.equal(new URL(page.url()).search, '?type=concrete', 'the query rides along');
    await kept(page);
    assert.equal(await page.locator('input[name="language_preference"]:checked').inputValue(), 'es', 'untouched language follows the new page');
    const banner = page.locator('#failure[role="alert"]');
    assert.equal(await banner.isVisible(), true, 'failure banner carried over');
    assert.match(await banner.innerText(), /No pudimos confirmar/);
    await page.locator('#failure [data-retry]').click(); await succeeded(page);
    assert.equal(payloads.length, 2);
    const body = payloads[1].body;
    assert.equal(body.first_name, inquiry.first_name); assert.equal(body.last_name, inquiry.last_name);
    assert.equal(body.phone, '8035550123'); assert.equal(body.email, inquiry.email);
    assert.equal(body.project_type, 'outdoor-living', 'the chip the visitor chose, not ?type=');
    assert.equal(body.language_preference, 'es');
    assert.match(body.notes, /^Synthetic local-only inquiry retained on failure\.\nProperty address: 1 Placeholder Rd, North Augusta\nBest time to call: Afternoon\n/);
    assert.deepEqual(await drafts(page), [], 'draft cleared once the request is captured');
    await switchTo(page, 'en'); await landed(page, '/estimate/');
    assert.equal(await page.locator('#first_name').inputValue(), '', 'a captured request is not refilled');
  } finally { await context.close(); }
});

test('switching EN -> ES -> EN after validation keeps answers, shows errors in each language, keeps an explicit language choice', async () => {
  const { page, context, requests } = await setup(json(201, accepted));
  try {
    await page.locator('#first_name').fill('Synthetic');
    await page.locator('#phone').fill('555');
    await page.locator('#details').fill('Línea uno\nLínea dos');
    await page.locator('label.chip:has(input[name="language_preference"][value="es"]) span').click();
    await submit(page);
    assert.equal(requests(), 0);
    await switchTo(page, 'es'); await landed(page, '/es/estimado/');
    assert.equal(await page.locator('#first_name').inputValue(), 'Synthetic');
    assert.equal(await page.locator('#phone').inputValue(), '(555');
    assert.equal(await page.locator('#details').inputValue(), 'Línea uno\nLínea dos');
    assert.match(await page.locator('#last_name-err').innerText(), /Escriba su apellido/);
    assert.match(await page.locator('#phone-err').innerText(), /número de 10 dígitos/);
    assert.match(await page.locator('#summary').innerText(), /Revise esto antes de enviar/);
    assert.equal(await page.locator('#failure[role="alert"]').count(), 0, 'no failure banner: nothing was sent');
    await switchTo(page, 'en'); await landed(page, '/estimate/');
    assert.equal(await page.locator('#first_name').inputValue(), 'Synthetic');
    assert.match(await page.locator('#phone-err').innerText(), /10-digit phone number/);
    assert.equal(await page.locator('input[name="language_preference"]:checked').inputValue(), 'es', 'explicit Español choice survives the round trip');
  } finally { await context.close(); }
});

test('a language switch during a send waits for it, then carries the answers and the failure banner', async () => {
  const gate = held(json(503, { error: 'Unavailable' }));
  const { page, context, requests } = await setup(gate.respond);
  try {
    await fillAll(page); await submit(page);
    await page.waitForFunction(() => document.querySelector('#submit').disabled);
    await switchTo(page, 'es');
    await page.waitForTimeout(500);
    assert.equal(new URL(page.url()).pathname, '/estimate/', 'switch held while sending');
    gate.release();
    await landed(page, '/es/estimado/');
    await kept(page);
    assert.match(await page.locator('#failure[role="alert"]').innerText(), /No pudimos confirmar/);
    assert.equal(requests(), 1);
  } finally { gate.release(); await context.close(); }
});

test('a language switch during a send that succeeds lands on the success panel in the new language', async () => {
  const gate = held(json(201, accepted));
  const { page, context, requests } = await setup(gate.respond);
  try {
    await fillAll(page); await submit(page);
    await page.waitForFunction(() => document.querySelector('#submit').disabled);
    await switchTo(page, 'es');
    await page.waitForTimeout(500);
    assert.equal(new URL(page.url()).pathname, '/estimate/', 'switch held while sending');
    gate.release();
    await landed(page, '/es/estimado/');
    await succeeded(page);
    assert.match(await page.locator('.success').innerText(), /Recibimos su solicitud/);
    assert.match(await page.locator('.success .sent').innerText(), /Espacios al aire libre/);
    assert.deepEqual(await drafts(page), []);
    assert.equal(requests(), 1);
    await page.reload(); await page.waitForLoadState('load');
    assert.equal(await page.locator('.success').count(), 0, 'the hand-over is shown once');
    assert.equal(await page.locator('#first_name').inputValue(), '');
  } finally { gate.release(); await context.close(); }
});

// ----- Nothing can change while a request is sending; success shows exactly what was sent -----
const fieldsLocked = (page) => page.evaluate(() => [...document.querySelectorAll('#estimate-form fieldset input, #estimate-form fieldset textarea')].every((el) => el.matches(':disabled')));
async function attemptEdits(page) {
  await assert.rejects(page.locator('#phone').fill('(706) 555-0199', { timeout: 300 }), 'phone is not editable while sending');
  await assert.rejects(page.locator('#details').fill('Changed while sending', { timeout: 300 }), 'details are not editable while sending');
  await page.locator('label.chip:has(input[name="best_time"][value="morning"]) span').click({ force: true });
}
test('every field is locked while sending; success lists exactly what was sent', async () => {
  const gate = held(json(201, accepted));
  const { page, context, payloads } = await setup(gate.respond);
  try {
    await fillAll(page);
    const before = await layout(page);
    await submit(page);
    await page.waitForFunction(() => document.querySelector('#submit').disabled);
    assert.equal(await fieldsLocked(page), true, 'all fields disabled while sending');
    assertSame(before, await layout(page), 'y', 'locking the form');
    // Contrast fence: locked fields keep the explicit ink text, unfaded.
    for (const id of FIELD_IDS) {
      const cs = await page.locator(`#${id}`).evaluate((el) => { const c = getComputedStyle(el); return [c.color, c.webkitTextFillColor, c.opacity]; });
      assert.deepEqual(cs, ['rgb(38, 38, 38)', 'rgb(38, 38, 38)', '1'], `#${id} text while locked`);
    }
    await attemptEdits(page);
    assert.equal(await page.locator('#phone').inputValue(), inquiry.phone);
    assert.equal(await page.locator('input[name="best_time"]:checked').inputValue(), 'afternoon');
    gate.release(); await succeeded(page);
    const body = payloads[0].body;
    const rows = await page.locator('.success .sent').evaluate((dl) => Object.fromEntries([...dl.querySelectorAll('div')].map((d) => [d.dataset.k, d.querySelector('dd').textContent])));
    assert.deepEqual(rows, {
      name: `${body.first_name} ${body.last_name}`, phone: '(803) 555-0123', email: body.email,
      address: inquiry.address, type: 'Outdoor living', best: 'Afternoon', lang: 'English', details: inquiry.details,
    });
    assert.equal(body.phone, '8035550123');
    assert.match(await page.locator('.success').innerText(), /What you sent us/);
  } finally { gate.release(); await context.close(); }
});

test('a failed send unlocks the form, and the retry sends the corrections', async () => {
  let count = 0;
  const { page, context, payloads } = await setup((route) => json(++count === 1 ? 503 : 201, count === 1 ? { error: 'Unavailable' } : accepted)(route));
  try {
    await fillAll(page); await submit(page); await settled(page);
    assert.equal(await page.locator('#failure[role="alert"]').isVisible(), true);
    await kept(page);
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('#estimate-form fieldset input, #estimate-form fieldset textarea')].some((el) => el.matches(':disabled'))), false, 'unlocked after failure');
    await page.locator('#phone').fill('(706) 555-0199');
    await page.locator('#failure [data-retry]').click(); await succeeded(page);
    assert.equal(payloads[1].body.phone, '7065550199');
    assert.match(await page.locator('.success .sent [data-k="phone"] dd').innerText(), /\(706\) 555-0199/);
  } finally { await context.close(); }
});

// Negative controls: prove the lock and draft tests above can fail. Without the fieldset lock an
// edit made while sending is accepted on screen but never sent; without restore() a language
// switch empties the form.
test('negative control: removing the fieldset lock lets an edit during sending go unsent', async () => {
  const mutate = (src) => {
    const out = src.replace("form.querySelectorAll('fieldset').forEach(function (f) { f.disabled = on; });", '');
    assert.notEqual(out, src, 'mutation applied');
    return out;
  };
  const gate = held(json(201, accepted));
  const { page, context, payloads } = await setup(gate.respond, { mutate });
  try {
    await fillAll(page); await submit(page);
    await page.waitForFunction(() => document.querySelector('#submit').disabled);
    assert.equal(await fieldsLocked(page), false);
    await page.locator('#phone').fill('(706) 555-0199', { timeout: 1000 });
    gate.release(); await succeeded(page);
    assert.equal(payloads[0].body.phone, '8035550123', 'the visible correction was silently dropped');
  } finally { gate.release(); await context.close(); }
});
test('negative control: removing the draft restore empties the form on a language switch', async () => {
  const mutate = (src) => {
    const out = src.replace(/\n  restore\(\);\n/, '\n');
    assert.notEqual(out, src, 'mutation applied');
    return out;
  };
  const { page, context } = await setup(json(503, { error: 'Unavailable' }), { mutate });
  try {
    await fillAll(page); await submit(page); await settled(page);
    await switchTo(page, 'es'); await landed(page, '/es/estimado/');
    await assert.rejects(kept(page), /keep first_name/);
  } finally { await context.close(); }
});

// ----- "¿Prefiere español?" hint: the same guarded switch as the header toggle -----
// A first-time visitor whose browser prefers Spanish (es-MX, nothing saved in fpc-lang) gets the
// hint on the English page. Served over HTTP by tools/site/serve.mjs; the lead route is a
// synthetic in-test backend that records each POST on arrival and holds its receipt.
async function hint(page) {
  const a = page.locator('.lang-hint a');
  await a.waitFor();
  assert.equal(await page.evaluate(() => localStorage.getItem('fpc-lang')), null, 'no saved language');
  return a;
}
test('the Spanish hint during a send waits for it, then lands on the Spanish success panel (one POST, no blank form)', async () => {
  const gate = held(json(201, accepted));
  const { page, context, requests } = await setup(gate.respond, { http: true, locale: 'es-MX' });
  try {
    const a = await hint(page);
    await fillAll(page); await submit(page);
    await page.waitForFunction(() => document.querySelector('#submit').disabled);
    assert.equal(requests(), 1, 'the lead reached the backend before the hint was clicked');
    await a.click();
    await page.waitForTimeout(500);
    assert.equal(new URL(page.url()).pathname, '/estimate/', 'hint switch held while sending');
    gate.release();
    await landed(page, '/es/estimado/');
    await succeeded(page);
    assert.match(await page.locator('.success').innerText(), /Recibimos su solicitud/);
    assert.match(await page.locator('.success .sent').innerText(), /Espacios al aire libre/);
    assert.equal(await page.evaluate(() => localStorage.getItem('fpc-lang')), 'es', 'the hint remembers Spanish');
    assert.deepEqual(await drafts(page), []);
    assert.equal(requests(), 1, 'exactly one POST in total');
  } finally { gate.release(); await context.close(); }
});
test('the Spanish hint during a send that fails carries every answer and the failure banner; the retry sends one POST', async () => {
  let count = 0;
  const gate = held((route) => json(count === 1 ? 503 : 201, count === 1 ? { error: 'Unavailable' } : accepted)(route));
  const { page, context, requests, payloads } = await setup(async (route) => { count++; await gate.respond(route); }, { http: true, locale: 'es-MX' });
  try {
    const a = await hint(page);
    await fillAll(page); await submit(page);
    await page.waitForFunction(() => document.querySelector('#submit').disabled);
    await a.click();
    await page.waitForTimeout(500);
    assert.equal(new URL(page.url()).pathname, '/estimate/', 'hint switch held while sending');
    gate.release();
    await landed(page, '/es/estimado/');
    await kept(page);
    assert.match(await page.locator('#failure[role="alert"]').innerText(), /No pudimos confirmar/);
    assert.equal(await page.locator('.success').count(), 0);
    assert.equal(requests(), 1);
    await page.locator('#failure [data-retry]').click(); await succeeded(page);
    assert.equal(requests(), 2, 'the retry sends exactly one more POST');
    assert.equal(payloads[1].body.first_name, inquiry.first_name);
    assert.equal(payloads[1].body.project_type, 'outdoor-living');
    assert.equal(payloads[1].body.language_preference, 'es');
  } finally { gate.release(); await context.close(); }
});
test('the Spanish hint with nothing sending carries the answers to the Spanish page', async () => {
  const { page, context, requests } = await setup(json(201, accepted), { http: true, locale: 'es-MX', path: '/estimate/?type=concrete' });
  try {
    const a = await hint(page);
    await fillAll(page);
    await a.click(); await landed(page, '/es/estimado/');
    assert.equal(new URL(page.url()).search, '?type=concrete', 'the query rides along');
    await kept(page);
    assert.equal(requests(), 0);
  } finally { await context.close(); }
});
test('with the hint showing, the header toggle still holds a send and carries its success', async () => {
  const gate = held(json(201, accepted));
  const { page, context, requests } = await setup(gate.respond, { http: true, locale: 'es-MX' });
  try {
    await hint(page);
    await fillAll(page); await submit(page);
    await page.waitForFunction(() => document.querySelector('#submit').disabled);
    await switchTo(page, 'es');
    await page.waitForTimeout(500);
    assert.equal(new URL(page.url()).pathname, '/estimate/', 'header switch held while sending');
    gate.release();
    await landed(page, '/es/estimado/');
    await succeeded(page);
    assert.equal(requests(), 1);
    await switchTo(page, 'en'); await landed(page, '/estimate/');
    assert.equal(await page.locator('.success').count(), 0, 'the hand-over is shown once');
    assert.equal(requests(), 1, 'going back sends nothing');
  } finally { gate.release(); await context.close(); }
});
test('an inline error from blur (before any submit) survives the language switch, in the new language', async () => {
  const { page, context, requests } = await setup(json(201, accepted), { http: true });
  try {
    await page.locator('#phone').fill('555'); await page.locator('#phone').blur();
    assert.match(await page.locator('#phone-err').innerText(), /10-digit phone number/);
    await switchTo(page, 'es'); await landed(page, '/es/estimado/');
    assert.equal(await page.locator('#phone').inputValue(), '(555');
    assert.match(await page.locator('#phone-err').innerText(), /número de 10 dígitos/);
    assert.equal(await page.locator('#phone').getAttribute('aria-invalid'), 'true');
    assert.equal(await page.locator('#summary').isHidden(), true, 'no summary: nothing was submitted');
    for (const id of ['first_name', 'last_name', 'email']) assert.equal(await page.locator(`#${id}-err`).innerText(), '', `untouched #${id} stays quiet`);
    await switchTo(page, 'en'); await landed(page, '/estimate/');
    assert.match(await page.locator('#phone-err').innerText(), /10-digit phone number/);
    await page.locator('#phone').fill('(803) 555-0123');
    assert.equal(await page.locator('#phone-err').innerText(), '', 'fixing it clears the error as before');
    assert.equal(requests(), 0);
  } finally { await context.close(); }
});
// Negative control: proves the hint tests can fail. With the hint as a plain link again (no
// data-lang, so core.js does not route it through the guarded switch), it leaves mid-send.
test('negative control: a hint outside the guarded switch abandons a pending send', async () => {
  const strip = (src) => {
    const out = src.replace("link.setAttribute('data-lang', 'es');", '');
    assert.notEqual(out, src, 'mutation applied');
    return out;
  };
  const gate = held(json(201, accepted));
  const { page, context } = await setup(gate.respond, { locale: 'es-MX', mutateFiles: { 'assets/site/core.js': strip } });
  try {
    const a = await hint(page);
    await fillAll(page); await submit(page);
    await page.waitForFunction(() => document.querySelector('#submit').disabled);
    await a.click();
    await landed(page, '/es/estimado/');
    gate.release();
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.success').count(), 0, 'receipt lost');
    assert.equal(await page.locator('#first_name').inputValue(), '', 'blank Spanish form');
  } finally { gate.release(); await context.close(); }
});
