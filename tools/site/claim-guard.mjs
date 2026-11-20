// Claim guard for every public page. Positive structure, not pattern-stripping:
//   1. Parse the page with parse5 (the WHATWG HTML parser), so entities and markup decode exactly as a browser
//      decodes them (&Tab;, &#101 without a semicolon, tags inside words...).
//   2. The ONLY allowed contractor-license wording is:
//        - exactly one <p class="small footer-license"> inside the page's <footer>, with no child elements, whose
//          text equals licenseLine(page language) byte for byte; and
//        - on pages that publish the business JSON-LD node, exactly one hasCredential on that node, deep-equal to
//          licenseCredential(page language); no other EducationalOccupationalCredential anywhere.
//      After expiry, neither may appear at all.
//   3. Every other piece of visible text, every attribute a person or search engine reads (title, alt, aria-label,
//      meta content) and every JSON-LD string is checked for licensed / insured / bonded / general-contractor claims
//      in English and Spanish, and for marketing claims (warranty, 15+, 500+).
//   4. The only exemption: the two Terms passages that describe the customer's written agreement may say
//      "warranties"; they are matched by their full text, and only the warranty check is skipped for them.
import { parse } from 'parse5';
import { licenseLine, licenseCredential, licenseActive } from './license.mjs';

const LICENSE_CLAIM = /\b(licensed|licencia|licenciad[oa]s?|insured|asegurad[oa]s?|bonded|afianzad[oa]s?|general\s+contractors?|contratistas?\s+generale?s?)\b/i;
const MARKETING_CLAIM = /warrant|garant[ií]as?|\b15\s*\+|\b500\s*\+/i;
const READ_ATTRS = new Set(['title', 'alt', 'aria-label', 'placeholder', 'content', 'value']);

// Exact text of the two Terms passages allowed to mention warranties (whitespace-normalised).
export const TERMS_WARRANTY_PASSAGES = [
  'We provide land clearing, grading, privacy fencing, septic, concrete and related contractor work. Information on this website is general. Asking for an estimate does not create a contract. The scope of work, price and schedule for a job are set out in a written estimate, proposal or agreement from FPC Construction. Warranty terms for a job are described in that written agreement.',
  'We work to keep this website accurate, but it is provided “as is,” without promises that it is complete, current or always available. Nothing in this section changes the warranties in your written agreement with us.',
  'Hacemos limpieza de terrenos, nivelación, cercas de privacidad, sistemas sépticos, concreto y trabajos de construcción relacionados. La información de este sitio web es general. Pedir un presupuesto no crea un contrato. El alcance del trabajo, el precio y el calendario de cada proyecto se establecen en un presupuesto, propuesta o acuerdo por escrito de FPC Construction. Las condiciones de garantía de un trabajo se describen en ese acuerdo por escrito.',
  'Nos esforzamos por mantener este sitio web al día y correcto, pero se ofrece “tal cual,” sin prometer que esté completo, actualizado o siempre disponible. Nada en esta sección cambia las garantías de su acuerdo por escrito con nosotros.',
];

const norm = (s) => s.replace(/\s+/g, ' ').trim();
const attr = (node, name) => node.attrs?.find((a) => a.name === name)?.value;
const classes = (node) => (attr(node, 'class') || '').split(/\s+/).filter(Boolean);
const childElements = (node) => (node.childNodes || []).filter((c) => c.tagName);

function textOf(node) {
  if (node.nodeName === '#text') return node.value;
  if (node.tagName === 'script' || node.tagName === 'style' || node.tagName === 'template') return '';
  return (node.childNodes || []).map(textOf).join(node.tagName && /^(p|div|li|h\d|td|th|br|section|footer|header)$/.test(node.tagName) ? ' ' : '');
}

function walk(node, visit, ancestors = []) {
  visit(node, ancestors);
  const kids = node.tagName === 'template' ? node.content?.childNodes : node.childNodes;
  for (const c of kids || []) walk(c, visit, [...ancestors, node]);
}

function* jsonStrings(v, path = '') {
  if (typeof v === 'string') yield [path, v];
  else if (Array.isArray(v)) for (let i = 0; i < v.length; i++) yield* jsonStrings(v[i], `${path}[${i}]`);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { yield [`${path}.${k}`, k]; yield* jsonStrings(x, `${path}.${k}`); }
}

function deepEqual(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

/** Returns a list of problems for one page. `file` is used to apply the Terms exemption. */
export function claimProblems(html, { file = '', now = new Date() } = {}) {
  const problems = [];
  const doc = parse(html);
  let lang = 'en';
  walk(doc, (n) => { if (n.tagName === 'html') lang = (attr(n, 'lang') || 'en').toLowerCase().startsWith('es') ? 'es' : 'en'; });
  const active = licenseActive(now);
  const line = licenseLine(lang, now);

  // --- 2a. license footer element: exactly one, in <footer>, exact text, no children (or none after expiry) ---
  const licenseEls = [];
  walk(doc, (n, anc) => { if (n.tagName && classes(n).includes('footer-license')) licenseEls.push({ n, anc }); });
  const approved = new Set();
  if (!active) {
    if (licenseEls.length) problems.push('license expired: the footer license line must be removed and the site republished');
  } else if (licenseEls.length !== 1) {
    problems.push(`expected exactly one footer license line, found ${licenseEls.length}`);
  } else {
    const { n, anc } = licenseEls[0];
    const inFooter = anc.some((a) => a.tagName === 'footer');
    const exact = n.tagName === 'p' && deepEqual(classes(n).sort(), ['footer-license', 'small']) && childElements(n).length === 0
      && (n.childNodes || []).every((c) => c.nodeName === '#text') && textOf(n) === line && n.attrs.length === 1;
    if (!inFooter) problems.push('footer license line is not inside <footer>');
    else if (!exact) problems.push('footer license line differs from the approved wording or markup');
    else approved.add(n);
  }

  // --- 2b. JSON-LD credential: only on the business node, deep-equal to the approved object ---
  const credential = licenseCredential(lang, now);
  const ldStrings = [];
  let credentialsSeen = 0;
  walk(doc, (n) => {
    if (n.tagName !== 'script' || attr(n, 'type') !== 'application/ld+json') return;
    let data;
    try { data = JSON.parse(textOf({ childNodes: n.childNodes })); } catch { problems.push('JSON-LD does not parse'); return; }
    const scrub = (v, parent) => {
      if (Array.isArray(v)) return v.map((x) => scrub(x, parent));
      if (!v || typeof v !== 'object') return v;
      const out = {};
      for (const [k, x] of Object.entries(v)) {
        if (k === 'hasCredential') {
          credentialsSeen++;
          const onBusiness = typeof parent === 'object' && v['@id']?.endsWith('/#business');
          if (!active) problems.push('license expired: JSON-LD hasCredential must be removed and the site republished');
          else if (!onBusiness) problems.push('hasCredential appears outside the business node');
          else if (!deepEqual(x, credential)) problems.push('JSON-LD credential differs from the approved credential');
          continue; // the approved credential is the one exempt object; anything wrong is reported above
        }
        out[k] = scrub(x, v);
      }
      return out;
    };
    const rest = scrub(data, null);
    for (const [, s] of jsonStrings(rest)) ldStrings.push(s);
    if (JSON.stringify(rest).includes('"GeneralContractor"')) problems.push('JSON-LD types FPC as a GeneralContractor');
    if (/EducationalOccupationalCredential/.test(JSON.stringify(rest))) problems.push('a credential object appears outside the approved hasCredential');
  });
  if (credentialsSeen > 1) problems.push(`expected at most one hasCredential, found ${credentialsSeen}`);

  // --- 3. every other readable string ---
  const texts = [];
  walk(doc, (n, anc) => {
    if (anc.some((a) => approved.has(a)) || approved.has(n)) return;
    if (anc.some((a) => a.tagName === 'script' || a.tagName === 'style')) return;
    if (n.nodeName === '#text') texts.push({ text: n.value, el: anc[anc.length - 1] });
    if (n.tagName === 'title') return;
    for (const a of n.attrs || []) if (READ_ATTRS.has(a.name)) texts.push({ text: a.value, el: n });
  });
  const blockTexts = [];
  walk(doc, (n, anc) => {
    if (!n.tagName || anc.some((a) => approved.has(a)) || approved.has(n)) return;
    if (/^(script|style|template)$/.test(n.tagName)) return;
    if (/^(p|li|h[1-6]|td|th|dd|dt|figcaption|blockquote|label|button|a|span|summary|title|small|strong|em|b|i|footer|div)$/.test(n.tagName)) {
      blockTexts.push({ n, text: norm(approved.size ? textOfExcluding(n, approved) : textOf(n)) });
    }
  });
  const exemptTerms = file.endsWith('terms.html');
  for (const { n, text } of blockTexts) {
    if (!text) continue;
    if (LICENSE_CLAIM.test(text)) problems.push(`license/insurance/GC claim in <${n.tagName}>: "${text.slice(0, 90)}"`);
    const warrantyAllowed = exemptTerms && n.tagName === 'p' && TERMS_WARRANTY_PASSAGES.includes(text);
    if (MARKETING_CLAIM.test(text) && !warrantyAllowed) problems.push(`marketing claim (warranty/years/projects) in <${n.tagName}>: "${text.slice(0, 90)}"`);
  }
  for (const { text } of texts) if (text && LICENSE_CLAIM.test(norm(text)) && !blockTexts.some((b) => b.text.includes(norm(text)))) problems.push(`license/insurance/GC claim in an attribute: "${norm(text).slice(0, 90)}"`);
  for (const s of ldStrings) {
    if (LICENSE_CLAIM.test(s)) problems.push(`license/insurance/GC claim in JSON-LD: "${s.slice(0, 90)}"`);
    if (MARKETING_CLAIM.test(s)) problems.push(`marketing claim in JSON-LD: "${s.slice(0, 90)}"`);
  }
  return [...new Set(problems)];
}

function textOfExcluding(node, approved) {
  if (approved.has(node)) return '';
  if (node.nodeName === '#text') return node.value;
  if (node.tagName === 'script' || node.tagName === 'style' || node.tagName === 'template') return '';
  return (node.childNodes || []).map((c) => textOfExcluding(c, approved)).join(node.tagName && /^(p|div|li|h\d|td|th|br|section|footer|header)$/.test(node.tagName) ? ' ' : '');
}

// Every public page the guard covers (generated + hand-written).
export function publicPages(services) {
  return [
    'index.html', 'es/index.html', 'estimate/index.html', 'es/estimado/index.html',
    ...services.flatMap((s) => Object.values(s.url).map((u) => u.slice(1) + 'index.html')),
    'privacy.html', 'terms.html', 'sms-opt-in.html', 'es/sms-opt-in/index.html',
  ];
}
