// Claim guard for every public page.
// Threat model (Chair, 2026-11-20): guards against careless or mistaken copy by FPC's own authors and agents, plus
// every evasion class already found in review. Out of scope: deliberate obfuscation by someone with commit access (a
// trust and review problem, not a guard problem), and text drawn by images/canvas or fetched at runtime (the site ships
// none). Reviewers: a new in-scope miss is a blocker; an out-of-scope one is a note.
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
//      in English and Spanish, and for marketing claims (warranty, counts of years or projects). The words are
//      the CLOSED, operator-owned list in ./claim-vocabulary.mjs: a newly found claim word is a (b) note proposing
//      an addition, not a blocker.
//   5. Visibility of the footer line is proven by rendering, not by reading markup: tools/site/license-visible.browser.mjs
//      opens every page in headless Chromium and asserts the exact line is in the footer, has client rects and is
//      computed-visible (covers stylesheets, <details>, hidden, inert, display/visibility/opacity/content-visibility).
//   4. The only exemption: the two Terms passages that describe the customer's written agreement may say
//      "warranties"; they are matched by their full text, and only the warranty check is skipped for them.
import { parse } from 'parse5';
import { licenseLine, licenseCredential, licenseActive } from './license.mjs';
import { HOLIDAY_URL } from './holiday.mjs';

import { LICENSE_CLAIM, MARKETING_CLAIM } from './claim-vocabulary.mjs';
const ORIGIN = 'https://fpcconstructions.com';
const BUSINESS_ID = `${ORIGIN}/#business`;
const BUSINESS_TYPES = ['LocalBusiness', 'HomeAndConstructionBusiness'];

// Exact text of the Terms passages allowed to mention warranties (element text only, never attributes).
export const TERMS_WARRANTY_PASSAGES = [
  'We provide land clearing, grading, privacy fencing, septic, concrete and related contractor work. Information on this website is general. Asking for an estimate does not create a contract. The scope of work, price and schedule for a job are set out in a written estimate, proposal or agreement from FPC Construction. Warranty terms for a job are described in that written agreement.',
  'We work to keep this website accurate, but it is provided “as is,” without promises that it is complete, current or always available. Nothing in this section changes the warranties in your written agreement with us.',
  'Hacemos limpieza de terrenos, nivelación, cercas de privacidad, sistemas sépticos, concreto y trabajos de construcción relacionados. La información de este sitio web es general. Pedir un presupuesto no crea un contrato. El alcance del trabajo, el precio y el calendario de cada proyecto se establecen en un presupuesto, propuesta o acuerdo por escrito de FPC Construction. Las condiciones de garantía de un trabajo se describen en ese acuerdo por escrito.',
  'Nos esforzamos por mantener este sitio web al día y correcto, pero se ofrece “tal cual,” sin prometer que esté completo, actualizado o siempre disponible. Nada en esta sección cambia las garantías de su acuerdo por escrito con nosotros.',
];

// Normalise what a reader sees: NFKC, drop invisible characters (soft hyphen, zero-width), fold common
// Cyrillic/Greek look-alikes to Latin, collapse whitespace.
const CONFUSABLES = { 'а': 'a', 'е': 'e', 'і': 'i', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'ѕ': 's', 'ј': 'j', 'ԁ': 'd', 'ɡ': 'g', 'ӏ': 'l', 'Ι': 'I', 'ο': 'o', 'ν': 'v', 'Α': 'A', 'Β': 'B', 'Ε': 'E', 'Ο': 'O', 'Ѕ': 'S', 'І': 'I', 'С': 'C', 'Е': 'E' };
const seen = (s) => String(s).normalize('NFKC').replace(/[­​-‍⁠﻿᠎]/g, '')
  .replace(/[Ͱ-ϿЀ-ӿԀ-ԯɡ]/g, (c) => CONFUSABLES[c] ?? c).replace(/\s+/g, ' ').trim();
const attr = (node, name) => node.attrs?.find((a) => a.name === name)?.value;
const classes = (node) => (attr(node, 'class') || '').split(/\s+/).filter(Boolean);
const childElements = (node) => (node.childNodes || []).filter((c) => c.tagName);
// Hidden from readers: the HTML hidden attribute, inline display:none / visibility:hidden, or inert content.
const isHidden = (n) => n.attrs?.some((a) => a.name === 'hidden' || a.name === 'inert' || (a.name === 'aria-hidden' && a.value === 'true')
  || (a.name === 'style' && /(display\s*:\s*none|visibility\s*:\s*hidden|content-visibility\s*:\s*hidden)/i.test(a.value)));
const inertAncestor = (anc) => anc.some((a) => /^(template|noscript)$/.test(a.tagName || '') || a.nodeName === '#document-fragment');
const kids = (n) => (n.tagName === 'template' ? n.content?.childNodes : n.childNodes) || [];
const BLOCK = /^(address|article|aside|blockquote|br|dd|div|dl|dt|figcaption|figure|footer|form|h[1-6]|header|hr|li|main|nav|ol|p|pre|section|table|td|th|tr|ul|output|summary|details)$/;

// Text a reader sees in a subtree: text nodes + img alt (inline), comments ignored, template/noscript content
// INCLUDED (strict), script/style excluded (style is checked separately as CSS).
function readable(node, skip) {
  if (skip?.has(node)) return '';
  if (node.nodeName === '#text') return node.value;
  if (node.nodeName === '#comment') return '';
  if (node.tagName === 'script' || node.tagName === 'style') return '';
  if (node.tagName === 'img' || node.tagName === 'area') return attr(node, 'alt') || '';
  const inner = kids(node).map((c) => readable(c, skip)).join('');
  return node.tagName && BLOCK.test(node.tagName) ? ` ${inner} ` : inner;
}

function walk(node, visit, ancestors = []) {
  visit(node, ancestors);
  for (const c of kids(node)) walk(c, visit, [...ancestors, node]);
}

function* jsonStrings(v) {
  if (typeof v === 'string') yield v;
  else if (Array.isArray(v)) for (const x of v) yield* jsonStrings(x);
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { yield k; yield* jsonStrings(x); }
}
const deepEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isCredentialKey = (k) => /(^|[/#:])hasCredential$/.test(k);
const typesOf = (n) => [].concat(n?.['@type'] ?? []);

/** Returns a list of problems for one page. `file` is used for the Terms exemption. */
export function claimProblems(html, { file = '', now = new Date() } = {}) {
  const problems = [];
  // scriptingEnabled:false → <noscript> content is parsed as markup (what a no-JS reader and many indexers see).
  const doc = parse(html, { scriptingEnabled: false });
  let lang = 'en';
  walk(doc, (n) => { if (n.tagName === 'html') lang = (attr(n, 'lang') || 'en').toLowerCase().startsWith('es') ? 'es' : 'en'; });
  const active = licenseActive(now);
  const line = licenseLine(lang, now);

  // --- 1. footer line: exactly one, live in <footer> (not in template/noscript), exact markup and text ---
  const licenseEls = [];
  walk(doc, (n, anc) => { if (n.tagName && classes(n).includes('footer-license')) licenseEls.push({ n, anc }); });
  const approved = new Set();
  if (!active) {
    if (licenseEls.length) problems.push('license expired: the footer license line must be removed and the site republished');
  } else if (licenseEls.length !== 1) {
    problems.push(`expected exactly one footer license line, found ${licenseEls.length}`);
  } else {
    const { n, anc } = licenseEls[0];
    const live = anc.some((a) => a.tagName === 'footer') && !inertAncestor(anc) && !anc.some(isHidden) && !isHidden(n);
    const exact = n.tagName === 'p' && deepEqual(classes(n).sort(), ['footer-license', 'small']) && n.attrs.length === 1
      && childElements(n).length === 0 && (n.childNodes || []).every((c) => c.nodeName === '#text') && readable(n).trim() === line;
    if (!live) problems.push('footer license line is not a live element inside <footer>');
    else if (!exact) problems.push('footer license line differs from the approved wording or markup');
    else approved.add(n);
  }

  // --- 2. JSON-LD: exactly one credential (any key spelling) on the one business node; nothing else credential-like ---
  const credential = licenseCredential(lang, now);
  const ldStrings = [];
  let credentials = 0, businessNodes = 0, credentialOnBusiness = false;
  walk(doc, (n, anc) => {
    if (n.tagName !== 'script' || attr(n, 'type') !== 'application/ld+json') return;
    const liveScript = !inertAncestor(anc) && !anc.some(isHidden);
    if (!liveScript) problems.push('JSON-LD inside inert/hidden markup (template, noscript or hidden): not read by indexers');
    let data;
    try { data = JSON.parse(kids(n).map((c) => c.value || '').join('')); } catch { problems.push('JSON-LD does not parse'); return; }
    const scrub = (v) => {
      if (Array.isArray(v)) return v.map(scrub);
      if (!v || typeof v !== 'object') return v;
      const isBusiness = v['@id'] === BUSINESS_ID && BUSINESS_TYPES.every((t) => typesOf(v).includes(t));
      if (v['@id'] === BUSINESS_ID && !isBusiness && Object.keys(v).some((k) => k !== '@id')) problems.push('another JSON-LD object reuses the business @id');
      if (isBusiness && liveScript) businessNodes++;
      const out = {};
      for (const [k, x] of Object.entries(v)) {
        if (isCredentialKey(k)) {
          credentials++;
          if (!active) problems.push('license expired: JSON-LD hasCredential must be removed and the site republished');
          else if (!isBusiness) problems.push('hasCredential appears outside the business node');
          else if (k !== 'hasCredential' || !deepEqual(x, credential)) problems.push('JSON-LD credential differs from the approved credential');
          else if (liveScript) credentialOnBusiness = true;
          continue;
        }
        out[k] = scrub(x);
      }
      return out;
    };
    const rest = scrub(data);
    for (const s of jsonStrings(rest)) ldStrings.push(seen(s));
    const flat = JSON.stringify(rest);
    if (/GeneralContractor/.test(flat)) problems.push('JSON-LD types FPC as a GeneralContractor');
    if (/Credential|Certification|CLG\.\d/.test(flat)) problems.push('credential-like JSON-LD outside the approved hasCredential');
  });
  if (credentials > 1) problems.push(`expected at most one hasCredential, found ${credentials}`);
  if (active && businessNodes > 0 && !credentialOnBusiness) problems.push('the business node is missing the approved hasCredential');

  // --- 3. every element's readable text (strict: nested elements are checked too) ---
  // The Terms warranty exemption is bound to the exact <p> NODES whose whole text equals an approved passage;
  // their text is removed only for the warranty check, never for license/insurance claims, never for attributes.
  const exemptNodes = new Set();
  if (file.endsWith('terms.html')) walk(doc, (n, anc) => {
    if (n.tagName === 'p' && !inertAncestor(anc) && childElements(n).length === 0 && TERMS_WARRANTY_PASSAGES.includes(seen(readable(n)))) exemptNodes.add(n);
  });
  const skipForMarketing = new Set([...approved, ...exemptNodes]);
  walk(doc, (n, anc) => {
    if (!n.tagName || approved.has(n) || anc.some((a) => approved.has(a))) return;
    if (n.tagName === 'script' || n.tagName === 'style') return;
    const text = seen(readable(n, approved));
    if (text && LICENSE_CLAIM.test(text)) problems.push(`license/insurance/GC claim in <${n.tagName}>: "${text.slice(0, 90)}"`);
    if (exemptNodes.has(n) || anc.some((a) => exemptNodes.has(a))) return;
    const marketing = seen(readable(n, skipForMarketing));
    if (marketing && MARKETING_CLAIM.test(marketing)) problems.push(`marketing claim (warranty/years/projects) in <${n.tagName}>: "${marketing.slice(0, 90)}"`);
  });
  // Attributes people and indexers read: every attribute value except URLs/ids/classes/styles (styles checked as CSS).
  walk(doc, (n, anc) => {
    if (!n.attrs || approved.has(n)) return;
    for (const a of n.attrs) {
      if (/^(href|src|srcset|class|id|style|rel|type|lang|dir|width|height|viewbox|d|xmlns.*|on.*)$/i.test(a.name)) continue;
      const v = seen(a.value);
      if (LICENSE_CLAIM.test(v)) problems.push(`license/insurance/GC claim in ${n.tagName}[${a.name}]: "${v.slice(0, 90)}"`);
      if (MARKETING_CLAIM.test(v)) problems.push(`marketing claim in ${n.tagName}[${a.name}]: "${v.slice(0, 90)}"`);
    }
    const style = attr(n, 'style');
    if (style) checkCss(style, problems);
  });
  walk(doc, (n) => { if (n.tagName === 'style') checkCss(kids(n).map((c) => c.value || '').join(''), problems); });
  for (const s of ldStrings) {
    if (LICENSE_CLAIM.test(s)) problems.push(`license/insurance/GC claim in JSON-LD: "${s.slice(0, 90)}"`);
    if (MARKETING_CLAIM.test(s)) problems.push(`marketing claim in JSON-LD: "${s.slice(0, 90)}"`);
  }
  return [...new Set(problems)];
}

// CSS generated content (content: "…") is rendered text; check every quoted string in CSS.
export function cssProblems(css) { const p = []; checkCss(css, p); return [...new Set(p)]; }

function checkCss(css, problems) {
  for (const m of css.matchAll(/(["'])((?:\\.|(?!\1).)*)\1/g)) {
    const v = seen(m[2].replace(/\\([0-9a-f]{1,6})\s?/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/\\(.)/g, '$1'));
    if (LICENSE_CLAIM.test(v)) problems.push(`license/insurance/GC claim in CSS content: "${v.slice(0, 90)}"`);
    if (MARKETING_CLAIM.test(v)) problems.push(`marketing claim in CSS content: "${v.slice(0, 90)}"`);
  }
}

// Every stylesheet a page links (<link rel~=stylesheet href>), parsed with parse5 so markup tricks decode as a browser
// decodes them. Inert copies (template) are included: strict.
export function linkedStylesheets(html) {
  const doc = parse(html, { scriptingEnabled: false });
  const out = [];
  walk(doc, (n) => {
    if (n.tagName !== 'link') return;
    const rel = (attr(n, 'rel') || '').toLowerCase().split(/\s+/);
    const href = attr(n, 'href');
    if (rel.includes('stylesheet') && href) out.push(href.trim());
  });
  return out;
}

// Every public page the guard covers (generated + hand-written).
export function publicPages(services) {
  return [
    'index.html', 'es/index.html', 'estimate/index.html', 'es/estimado/index.html',
    ...services.flatMap((s) => Object.values(s.url).map((u) => u.slice(1) + 'index.html')),
    ...Object.values(HOLIDAY_URL).map((u) => u.slice(1) + 'index.html'),
    'privacy.html', 'terms.html', 'sms-opt-in.html', 'es/sms-opt-in/index.html',
  ];
}
