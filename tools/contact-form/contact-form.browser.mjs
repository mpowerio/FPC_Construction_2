import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { readFile, stat } from 'node:fs/promises';
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
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

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

async function setup(respond, { path = '/estimate/', clock = false, mutate, noEndpoint = false, locale } = {}) {
  const context = await browser.newContext(locale ? { locale } : {});
  const page = await context.newPage();
  let requests = 0;
  const payloads = [];
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/webhook/lead-intake')) {
      requests++;
      payloads.push({ url: url.href, body: route.request().postDataJSON() });
      return respond(route);
    }
    if (url.hostname !== 'fpc.test') return route.abort(); // no production traffic, ever
    const rel = await resolve(url.pathname);
    if (!rel) return route.fulfill({ status: 404, body: '' });
    let body = await readFile(new URL(rel, root));
    if (mutate && rel === 'assets/site/estimate.js') body = Buffer.from(mutate(body.toString()));
    await route.fulfill({ body, contentType: TYPES[rel.split('.').pop()] || 'application/octet-stream' });
  });
  await page.goto(`https://fpc.test${path}`, { waitUntil: 'load' });
  if (noEndpoint) await page.evaluate(() => { globalThis.FPC_LEAD_URL = ''; });
  if (clock) await page.clock.install();
  return { page, context, requests: () => requests, payloads };
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

test('showing an inline error does not move the layout (reserved error slot)', async () => {
  const { page, context } = await setup(json(201, accepted));
  try {
    const before = await page.locator('#email').boundingBox();
    await submit(page);
    const afterBox = await page.locator('#email').boundingBox();
    assert.equal(afterBox.x, before.x);
    // The summary banner sits above the fields, so only the summary's own height may move them.
    const summaryH = (await page.locator('#summary').boundingBox()).height;
    const margin = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('#summary')).marginBottom));
    assert.ok(Math.abs(afterBox.y - before.y - summaryH - margin) < 1, 'fields moved only by the summary height');
  } finally { await context.close(); }
});

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
