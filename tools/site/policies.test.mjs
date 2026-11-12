import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { services } from './services.mjs';
const read = file => readFileSync(new URL('../../'+file, import.meta.url),'utf8');
const files = ['sms-opt-in.html','es/sms-opt-in/index.html','privacy.html','terms.html'];
const visible = html => html.replace(/<!--[\s\S]*?-->/g,'').replace(/<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<[^>]+>/g,' ').replace(/&(?:amp|nbsp);/g,' ').replace(/\s+/g,' ');
const carrier = 'Text messaging originator opt-in data and consent will not be shared with any third parties.';
test('Spanish SMS terms links use the Spanish policy on every generated page', () => {
  for (const file of ['es/index.html', 'es/estimado/index.html', ...services.map(s => s.url.es.slice(1)+'index.html')]) {
    const links = [...read(file).matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
      .filter(([, , label]) => /SMS/.test(visible(label)));
    assert.ok(links.length > 0, `${file}: SMS terms link exists`);
    for (const [, href] of links) assert.equal(href, '/es/sms-opt-in/', `${file}: Spanish SMS destination`);
  }
});
test('Spanish carrier quotations have an explicit Spanish introduction', () => {
  for (const file of ['es/sms-opt-in/index.html', 'privacy.html']) {
    assert.match(read(file), /<p>El texto oficial en inglés dice:<\/p>\s*<p lang="en">We do not share, sell, rent or provide/,
      `${file}: English carrier original is labelled`);
  }
});
test('phone prompts and runtime validation use localized instructions without a sample number', () => {
  for (const [file, placeholder, error] of [
    ['estimate/index.html', 'Your 10-digit phone number', 'Enter your 10-digit phone number.'],
    ['es/estimado/index.html', 'Su teléfono de 10 dígitos', 'Escriba su teléfono de 10 dígitos.']
  ]) {
    const html = read(file);
    assert.match(html, new RegExp(`id="phone"[^>]*placeholder="${placeholder}"`));
    const messages = JSON.parse(html.match(/<script[^>]*id="form-msgs"[^>]*>([\s\S]*?)<\/script>/)?.[1] || '{}');
    assert.equal(messages['err.phone.bad'], error, `${file}: runtime help`);
    assert.ok(html.includes(error), `${file}: reserved validation help`);
    assert.doesNotMatch(html, /555-0123/);
  }
});
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
  for (const s of ['Appointment','Estimate','Offers','Up to 4 messages per month','Both will start unchecked','optional checkboxes','not a condition of purchase']) assert.ok(en.includes(s),s);
  for (const s of ['Citas y Estimados','Ofertas y Novedades','Hasta 4 mensajes al mes','sin marcar','opcionales','no es condición de compra']) assert.ok(es.includes(s),s);
  for (const file of ['privacy.html','terms.html']) { const text=visible(read(file));assert.match(text,/up to 4 per month/);assert.match(text,/hasta 4 al mes/i);assert.ok(text.includes('Offers'));assert.ok(text.includes('Ofertas')); }
  assert.doesNotMatch(visible(read('terms.html')), /for example by replying START|por ejemplo respondiendo START/, 'No automatic START enrollment promise');
});
test('estimate forms still collect no SMS consent', () => {
  for (const file of ['estimate/index.html','es/estimado/index.html']) {
    const html=read(file);assert.ok(!/type=["']checkbox["']/i.test(html));
    assert.ok(!/name=["']sms_consent/i.test(html));
    assert.ok(html.includes('https://crm.fpcconstructions.com/api/public/webhook/lead-intake'));
  }
});

test('policy-first copy never presents planned signup or consent evidence as live', () => {
  for (const file of files) {
    const html=read(file), text=visible(html);
    if (file !== 'es/sms-opt-in/index.html') {
      assert.ok(text.includes('not open for enrollment yet'), `${file}: English planned-program status`);
      assert.ok(text.includes('Website text-message signup is not available yet'), `${file}: English web signup is unavailable`);
      assert.ok(text.includes("Submitting today's estimate form does not sign you up for texts"), `${file}: current form grants no consent`);
      assert.ok(text.includes('OFFERS/OFERTAS enrollment is not available yet'), `${file}: keyword signup unavailable`);
    }
    assert.doesNotMatch(text,/there are two separate checkboxes|we reply once to confirm|We record when and how you agreed/i);
    if (file !== 'sms-opt-in.html') {
      assert.ok(text.includes('todavía no están abiertos a suscripciones'), `${file}: Spanish program status`);
      assert.ok(text.includes('Enviar el formulario de estimado actual no lo suscribe'), `${file}: Spanish current form warning`);
      assert.ok(text.includes('La suscripción mediante OFFERS/OFERTAS todavía no está disponible'), `${file}: Spanish keyword status`);
      assert.doesNotMatch(text,/hay dos casillas separadas|Le respondemos una vez para confirmar|Registramos cuándo y cómo aceptó/);
    }
  }
  for(const file of ['sms-opt-in.html','privacy.html']) assert.ok(visible(read(file)).includes('we plan to add a consent ledger'), `${file}: future ledger`);
});

test('opt-out copy honors reasonable requests and contains no contradictory enrollment promise', () => {
  for (const file of files) {
    const text = visible(read(file));
    if (file !== 'es/sms-opt-in/index.html') assert.ok(text.includes('We honor any reasonable request to stop'), `${file}: plain-language revocation`);
    if (file !== 'sms-opt-in.html') assert.ok(text.includes('Respetamos cualquier solicitud razonable para dejar de recibir mensajes'), `${file}: Spanish plain-language revocation`);
    assert.doesNotMatch(text, /rather than relying on other keywords|en lugar de depender de otras palabras clave/i);
    assert.doesNotMatch(text, /\b(?:CANCEL|QUIT|STOPALL|UNSUBSCRIBE|END|STOP)\b[^.!?]{0,100}\b(?:will not|won't|do not|does not|cannot|can't)\s+(?:stop|cancel|unsubscribe|opt.out)/i, `${file}: opt-out keyword denial`);
    assert.doesNotMatch(text, /\b(?:CANCEL|QUIT|STOPALL|UNSUBSCRIBE|END|STOP)\b[^.!?]{0,100}\bno\s+(?:cancelan|cancelará|detienen|detendrá|sirven para cancelar)/i, `${file}: Spanish keyword denial`);
    assert.doesNotMatch(text, /(?:re[- ]?enroll|resubscribe|sign (?:back )?up)[^.!?]{0,80}\bSTART\b/i, `${file}: START enrollment promise`);
    assert.doesNotMatch(text, /(?:responda|responder|envíe|enviar)\s+START[^.!?]{0,60}(?:para (?:volver a )?(?:suscrib|inscrib)|y (?:se )?(?:suscrib|inscrib))/i, `${file}: Spanish START enrollment promise`);
    assert.doesNotMatch(text, /(?:puede|puedes)\s+(?:volver a )?(?:suscribirse|inscribirse)[^.!?]{0,60}\bSTART\b/i, `${file}: Spanish START enrollment promise`);
  }
});

test('SMS program headings and current/planned bullet labels form a clear hierarchy', () => {
  for (const [file,current,planned] of [['sms-opt-in.html','Current:','Planned:'],['es/sms-opt-in/index.html','Actual:','Previsto:']]) {
    const html = read(file);
    assert.equal((html.match(/<h3>/g)||[]).length, 2);
    assert.equal(html.split(`<strong>${current}</strong>`).length-1, 2);
    assert.equal(html.split(`<strong>${planned}</strong>`).length-1, 3);
    assert.doesNotMatch(html, /<\/h2>\s*<h[23]>/);
  }
});
