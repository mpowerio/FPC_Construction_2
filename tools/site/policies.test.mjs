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

// Privacy truth pass, 2026-11-14 (card PRIVACY-POLICY-TRUTH-PASS-20261113, evidence in
// agent-out/privacy-truth-pass-20261113/FACTS.md). Keep the page matched to what the site does.
const ENT = { aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', ntilde: 'ñ', Uacute: 'Ú', rsquo: '’', ldquo: '“', rdquo: '”', middot: '·', larr: '←' };
const decoded = (html) => visible(html).replace(/&([a-zA-Z]+);/g, (m, n) => ENT[n] ?? m);
export function privacyTruthProblems(html) {
  const cut = html.indexOf('<article class="doc" id="es"');
  const en = decoded(html.slice(0, cut)), es = decoded(html.slice(cut)), found = [];
  const all = en + ' ' + es;
  if (/whenever the home page loads|cada vez que carga la página principal/i.test(all)) found.push('claims every component loads on every home-page visit');
  // core.js only reads fpc-lang to stop re-showing the language suggestion; nothing routes on it (review c9e00ea9).
  if (/next page opens in|siguiente página abra en|opens in (?:that|your) language|abra en (?:ese|su) idioma/i.test(all)) found.push('claims the saved language picks the page language');
  if (/supabase/i.test(all)) found.push('names a gallery provider the public pages no longer load');
  if (/\bpending\b|\bpendientes?\b/i.test(all)) found.push('pending wording');
  // No retention number until it is verified or approved (backup period: operator decision 20).
  // ("menores de 13 años" is the children's age, not a retention period, so tie the number to a keep word.)
  if (/\b(?:kept|keep|keeps|retain\w*|stored|delet\w*|backups?|guarda\w*|conserv\w*|borra\w*|copias? de seguridad)\b[^.]{0,80}\b\d+\s*(?:days?|weeks?|months?|years?|días|semanas?|meses|años)\b/i.test(all)) found.push('retention-style number');
  for (const [part, lang, needles] of [
    [en, 'en', ['as soon as the page opens', 'first click, tap, key press or scroll', 'only when you open the question about payment methods', 'Our Spanish pages do not load it', 'Do Not Track', 'Information stored in your browser', 'How long we keep information', 'we are setting a fixed period', 'Information from other sources', 'does not keep suggesting a language switch']],
    [es, 'es', ['en cuanto se abre la página', 'Nuestras páginas en español no lo cargan', 'No rastrear', 'Información guardada en su navegador', 'estamos fijando un plazo concreto', 'Información de otras fuentes', 'no le siga sugiriendo cambiar de idioma']]]) {
    for (const n of needles) if (!part.includes(n)) found.push(`${lang}: missing "${n}"`);
  }
  return found;
}
test('privacy page states component timing, browser storage, other sources and retention truthfully', () => {
  assert.deepEqual(privacyTruthProblems(read('privacy.html')), []);
});
test('the privacy truth guard catches each planted regression', () => {
  const clean = read('privacy.html');
  for (const [planted, why] of [
    [clean.replace('</main>', '<p>Whenever the home page loads, your browser connects to those providers.</p></main>'), 'every-load claim'],
    [clean.replace('</main>', '<p>Backups are kept for 30 days.</p></main>'), 'retention number'],
    [clean.replace('</main>', '<p>Retention period pending.</p></main>'), 'pending wording'],
    [clean.replace('</main>', '<p>Gallery hosted by Supabase.</p></main>'), 'stale gallery provider'],
    [clean.replace('Our Spanish pages do not load it.', ''), 'dropped PayPal language fact'],
    [clean.replace('</main>', '<p>Your browser remembers the choice so the next page opens in that language.</p></main>'), 'language routing claim'],
    [clean.replaceAll('estamos fijando un plazo concreto', 'X'), 'dropped Spanish retention wording'],
  ]) assert.ok(privacyTruthProblems(planted).length, why);
});
