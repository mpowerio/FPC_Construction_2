import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = file => readFileSync(new URL('../../'+file, import.meta.url),'utf8');
const files = ['sms-opt-in.html','es/sms-opt-in/index.html','privacy.html','terms.html'];
const visible = html => html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ').replace(/&(?:amp|nbsp);/g,' ').replace(/\s+/g,' ');
const carrier = 'Text messaging originator opt-in data and consent will not be shared with any third parties.';
for (const file of files) test(`${file}: disclosure is separate from signup and has no draft/placeholder copy`, () => {
  const html = read(file), text = visible(html);
  assert.ok(!/<(?:form|input|textarea|select)\b/i.test(html),'Policy-only release must not collect consent');
  assert.doesNotMatch(text,/\bDRAFT\b|\[FPC |\[número|\[effective|\[fecha|\[correo/i);
  assert.ok(text.includes(carrier),'English carrier statement retained');
  assert.match(text,/STOP/);assert.match(text,/HELP/);
  assert.ok(html.includes('color-scheme: light'));
  assert.ok(html.includes('-webkit-autofill'));
  assert.ok((html.match(/<li>/g)||[]).length >= 8, 'Program scope and signup methods must be readable lists');
});
test('SMS pages have reciprocal language links, canonical and sitemap entries', () => {
  for (const [file,lang,url] of [['sms-opt-in.html','en','/sms-opt-in'],['es/sms-opt-in/index.html','es','/es/sms-opt-in/']]) {
    const html=read(file);assert.ok(html.includes(`<html lang="${lang}">`));
    assert.ok(html.includes(`rel="canonical" href="https://fpcconstructions.com${url}"`));
    for (const [hl,path] of [['en-US','/sms-opt-in'],['es-US','/es/sms-opt-in/'],['x-default','/sms-opt-in']]) assert.ok(html.includes(`hreflang="${hl}" href="https://fpcconstructions.com${path}"`));
    assert.ok(read('sitemap.xml').includes(`<loc>https://fpcconstructions.com${url}</loc>`));
    assert.ok(html.includes('mailto:fpineda@fpcconstructions.com'));
  }
});
test('both language copies disclose the marketing ceiling and separate optional consent', () => {
  const en=visible(read('sms-opt-in.html')), es=visible(read('es/sms-opt-in/index.html'));
  for (const s of ['Appointment','Estimate','Offers','Up to 4 messages per month','Both start unchecked','both are optional','not a condition of purchase']) assert.ok(en.includes(s),s);
  for (const s of ['Citas y Estimados','Ofertas y Novedades','Hasta 4 mensajes al mes','sin marcar','opcionales','no es condición de compra']) assert.ok(es.includes(s),s);
  for (const file of ['privacy.html','terms.html']) { const text=visible(read(file));assert.match(text,/up to 4 per month/);assert.match(text,/hasta 4 al mes/i);assert.ok(text.includes('Offers'));assert.ok(text.includes('Ofertas')); }
  assert.ok(!/START/.test(read('sms-opt-in.html')+read('es/sms-opt-in/index.html')+read('terms.html')),'No unsupported automatic START promise');
});
test('estimate forms still collect no SMS consent', () => {
  for (const file of ['estimate/index.html','es/estimado/index.html']) {
    const html=read(file);assert.ok(!/type=["']checkbox["']/i.test(html));
    assert.ok(!/name=["']sms_consent/i.test(html));
    assert.ok(html.includes('https://crm.fpcconstructions.com/api/public/webhook/lead-intake'));
  }
});
