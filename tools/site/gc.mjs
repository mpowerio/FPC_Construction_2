// General-contractor capability for fpcconstructions.com, built ahead of license day.
//
// Operator ruling (2026-11-13, relayed by the Chair): "no pending just build it like a GC site and then
// we'll promote general contracting when it's available, but they need all the tools all the abilities.
// They're going to be the premier general contractor in the area."
//
// So: every GC page, section and tool is built here and designed in the site's Concrete system, but
// NOTHING is published while GC.enabled is false. Public pages carry no GC wording, pending or otherwise
// (tools/seo-check.mjs and tools/site/release-policy.mjs enforce that and stay unchanged).
// docs/GC-FLIP.md is the switch: fill the records below from the issued license and the carrier and
// surety documents, set enabled to true, follow the checklist.
//
// Truth rules for this file:
// - Every record value comes from a document FPC holds (license certificate, bond letter, COI, SAM
//   registration). Empty string or empty list means "not on file"; the build refuses to enable GC
//   with a required value missing, and never prints a placeholder on a public page.
// - Projects are real FPC jobs with the owner's permission to name them. None are listed yet.
import assert from 'node:assert/strict';
import { escapeHtml as esc } from './content-utils.mjs';

export const GC = {
  enabled: false,
  license: {
    number: '',            // SC LLR Contractor's Licensing Board license number
    classifications: [],   // e.g. building, highway, grading: exactly as printed on the license
    group: '',             // financial group (sets the project limit), as printed
    expires: '',           // YYYY-MM-DD
  },
  bonding: { single: '', aggregate: '', surety: '' },   // from the surety's bond-capacity letter
  insurance: { gl: '', auto: '', wc: '', umbrella: '' }, // limits as printed on the current COI
  ids: { uei: '', cage: '', naics: [] },                // from the SAM.gov registration record
  safety: { emr: '', osha: '' },                        // EMR from the carrier letter; OSHA cards held
  // Delivery methods FPC offers. Filemon confirms each before flip; set false to hide one.
  delivery: { generalContracting: true, designBuild: true, constructionManagement: true, selfPerform: true },
  // Real FPC projects only, with the owner's OK: { title: {en, es}, owner, role: {en, es}, scope: {en, es}, value, year, photo }
  projects: [],
};

// Values a GC page cannot go live without.
export function missingRecords(gc = GC) {
  const need = [
    ['license.number', gc.license.number], ['license.classifications', gc.license.classifications.length ? 'x' : ''],
    ['license.group', gc.license.group], ['license.expires', gc.license.expires],
    ['bonding.single', gc.bonding.single], ['bonding.aggregate', gc.bonding.aggregate], ['bonding.surety', gc.bonding.surety],
    ['insurance.gl', gc.insurance.gl], ['insurance.wc', gc.insurance.wc],
    ['ids.uei', gc.ids.uei], ['ids.naics', gc.ids.naics.length ? 'x' : ''],
  ];
  return need.filter(([, v]) => !v).map(([k]) => k);
}

export function assertReadyToPublish(gc = GC) {
  if (!gc.enabled) return;
  const missing = missingRecords(gc);
  assert.deepEqual(missing, [], `GC.enabled is true but records are missing: ${missing.join(', ')} (see docs/GC-FLIP.md)`);
  assert.match(gc.license.expires, /^\d{4}-\d{2}-\d{2}$/, 'license.expires must be YYYY-MM-DD');
  assert.ok(new Date(gc.license.expires) > new Date(), 'The license on file has expired');
}

export const GC_PAGES = {
  commercial: { en: '/commercial-public-works/', es: '/es/obras-comerciales-publicas/' },
  capabilities: { en: '/capabilities/', es: '/es/capacidades/' },
  subcontractors: { en: '/subcontractors/', es: '/es/subcontratistas/' },
};

// Copy. English approved wording is the operator's direction; Spanish is a DRAFT (PENDING-ES): every key
// here needs a native-speaker read before flip.
export const GC_STRINGS = {
  en: {
    'gc.nav': 'Commercial & public works', 'gc.nav.cap': 'Capabilities', 'gc.nav.subs': 'Subcontractors',
    'gc.c.meta.title': 'General contractor | Commercial & public works | FPC Construction, North Augusta, SC',
    'gc.c.meta.desc': 'FPC Construction is a licensed South Carolina general contractor for commercial, municipal and public-works projects across the CSRA, from North Augusta, SC.',
    'gc.c.label': 'General contracting', 'gc.c.h1': 'Commercial and public works, built and run by FPC.',
    'gc.c.lead': 'From site work to closeout, one crew answers for the job. FPC builds for owners, developers and public agencies across the CSRA.',
    'gc.c.cta': 'Discuss a project', 'gc.c.cta2': 'Capability statement',
    'gc.d.label': 'How we deliver', 'gc.d.h': 'Pick the delivery that fits the project.',
    'gc.d.gc.h': 'General contracting', 'gc.d.gc.p': 'You bring the drawings. FPC prices the work, runs the job and is the single contract for the build.',
    'gc.d.db.h': 'Design-build', 'gc.d.db.p': 'One contract for design and construction. FPC brings the design team and holds the schedule from the first sketch.',
    'gc.d.cm.h': 'Construction management', 'gc.d.cm.p': 'FPC joins early, prices as the design develops and manages the trades through completion.',
    'gc.d.sp.h': 'Self-performed site work', 'gc.d.sp.p': 'Excavation, grading, utilities, drainage, septic and concrete with FPC crews and equipment, so the critical path stays in house.',
    'gc.s.label': 'Who we build for', 'gc.s.h': 'Sectors.',
    'gc.s.1': 'Commercial owners and developers', 'gc.s.2': 'Municipal and county agencies', 'gc.s.3': 'State and public works', 'gc.s.4': 'Residential developments and subdivisions',
    'gc.p.label': 'Process', 'gc.p.h': 'From bid to closeout.',
    'gc.p.1h': 'Preconstruction', 'gc.p.1p': 'Site walk, plan review, budget and schedule.',
    'gc.p.2h': 'Bid and contract', 'gc.p.2p': 'A written scope and price, with the bonds and insurance the job requires.',
    'gc.p.3h': 'Build', 'gc.p.3p': 'Daily supervision on site, weekly reporting to the owner.',
    'gc.p.4h': 'Closeout', 'gc.p.4p': 'Punch list, as-builts, warranties and the final walk.',
    'gc.pp.label': 'Past performance', 'gc.pp.h': 'Recent projects.',
    'gc.pp.owner': 'Owner', 'gc.pp.role': 'FPC’s role', 'gc.pp.scope': 'Scope', 'gc.pp.value': 'Contract value', 'gc.pp.year': 'Completed',
    'gc.cap.meta.title': 'Capability statement | FPC Construction, licensed SC general contractor',
    'gc.cap.meta.desc': 'FPC Construction capability statement: license, bonding, insurance, NAICS codes, safety record and past performance. North Augusta, SC, serving the CSRA.',
    'gc.cap.label': 'Capability statement', 'gc.cap.h1': 'Capabilities &amp; qualifications',
    'gc.cap.lead': 'The records owners, primes and public agencies ask for, on one page. Print it or save it as a PDF.',
    'gc.cap.print': 'Print this page',
    'gc.r.h': 'Records on file.', 'gc.r.company': 'Company', 'gc.r.name': 'Legal name', 'gc.r.base': 'Base', 'gc.r.area': 'Service area', 'gc.r.areav': 'About 50 miles around North Augusta, in South Carolina and Georgia',
    'gc.r.phone': 'Phone', 'gc.r.email': 'Email', 'gc.r.langs': 'Languages', 'gc.r.langsv': 'English and Spanish',
    'gc.r.license': 'License', 'gc.r.licno': 'SC general contractor license', 'gc.r.class': 'Classifications', 'gc.r.group': 'Financial group', 'gc.r.exp': 'Expires',
    'gc.r.bond': 'Bonding', 'gc.r.single': 'Single project', 'gc.r.agg': 'Aggregate', 'gc.r.surety': 'Surety',
    'gc.r.ins': 'Insurance', 'gc.r.gl': 'General liability', 'gc.r.auto': 'Commercial auto', 'gc.r.wc': 'Workers’ compensation', 'gc.r.umb': 'Umbrella',
    'gc.r.ids': 'Registrations', 'gc.r.uei': 'SAM UEI', 'gc.r.cage': 'CAGE code', 'gc.r.naics': 'NAICS codes',
    'gc.r.safety': 'Safety', 'gc.r.emr': 'Experience modification rate (EMR)', 'gc.r.osha': 'OSHA training',
    'gc.r.coi': 'Certificates of insurance and bond letters are sent on request.',
    'gc.comp.label': 'Core competencies', 'gc.comp.h': 'What FPC self-performs and manages.',
    'gc.sub.meta.title': 'Subcontractors and suppliers | FPC Construction, North Augusta, SC',
    'gc.sub.meta.desc': 'Subcontractors and suppliers: how to get on FPC Construction’s bid list for commercial and public projects across the CSRA.',
    'gc.sub.label': 'Subcontractors and suppliers', 'gc.sub.h1': 'Get on our bid list.',
    'gc.sub.lead': 'FPC buys trade work and materials for commercial and public projects across the CSRA. Send us your trade, area and paperwork, and we will invite you to bid.',
    'gc.sub.trades.h': 'Trades we buy', 'gc.sub.trades': 'Electrical, plumbing, HVAC, roofing, framing, drywall, painting, flooring, steel, masonry, landscaping, paving and specialty work.',
    'gc.sub.need.h': 'What to send', 'gc.sub.need.1': 'Company name, trade and the counties you cover', 'gc.sub.need.2': 'A current certificate of insurance', 'gc.sub.need.3': 'A signed W-9', 'gc.sub.need.4': 'Your license number, where your trade needs one',
    'gc.sub.safety.h': 'On our sites', 'gc.sub.safety.p': 'Every crew follows FPC’s site safety rules, attends the job-start briefing and keeps its own work area clean.',
    'gc.sub.cta': 'Email your information', 'gc.sub.mail': 'Bid list: ',
  },
  es: {
    'gc.nav': 'Obras comerciales y públicas', 'gc.nav.cap': 'Capacidades', 'gc.nav.subs': 'Subcontratistas',
    'gc.c.meta.title': 'Contratista general | Obras comerciales y públicas | FPC Construction, North Augusta, SC',
    'gc.c.meta.desc': 'FPC Construction es un contratista general con licencia en Carolina del Sur para obras comerciales, municipales y públicas en la zona del CSRA, desde North Augusta, SC.',
    'gc.c.label': 'Contratista general', 'gc.c.h1': 'Obras comerciales y públicas, construidas y dirigidas por FPC.',
    'gc.c.lead': 'Del trabajo de terreno a la entrega final, un solo equipo responde por la obra. FPC construye para dueños, desarrolladores y agencias públicas en el CSRA.',
    'gc.c.cta': 'Hablar de un proyecto', 'gc.c.cta2': 'Declaración de capacidades',
    'gc.d.label': 'Cómo trabajamos', 'gc.d.h': 'Elija la forma de contratar que le conviene.',
    'gc.d.gc.h': 'Contratista general', 'gc.d.gc.p': 'Usted trae los planos. FPC cotiza el trabajo, dirige la obra y es el único contrato de la construcción.',
    'gc.d.db.h': 'Diseño y construcción', 'gc.d.db.p': 'Un solo contrato para el diseño y la obra. FPC trae al equipo de diseño y controla el calendario desde el primer boceto.',
    'gc.d.cm.h': 'Gerencia de construcción', 'gc.d.cm.p': 'FPC entra desde el principio, cotiza mientras avanza el diseño y coordina a los oficios hasta terminar.',
    'gc.d.sp.h': 'Trabajo de terreno propio', 'gc.d.sp.p': 'Excavación, nivelación, servicios, drenaje, sépticos y concreto con equipo y personal de FPC, para que la ruta crítica quede en casa.',
    'gc.s.label': 'Para quién construimos', 'gc.s.h': 'Sectores.',
    'gc.s.1': 'Dueños y desarrolladores comerciales', 'gc.s.2': 'Agencias municipales y del condado', 'gc.s.3': 'Obras estatales y públicas', 'gc.s.4': 'Desarrollos residenciales y fraccionamientos',
    'gc.p.label': 'Proceso', 'gc.p.h': 'De la cotización a la entrega.',
    'gc.p.1h': 'Preconstrucción', 'gc.p.1p': 'Visita al sitio, revisión de planos, presupuesto y calendario.',
    'gc.p.2h': 'Cotización y contrato', 'gc.p.2p': 'Un alcance y precio por escrito, con las fianzas y seguros que pida la obra.',
    'gc.p.3h': 'Construcción', 'gc.p.3p': 'Supervisión diaria en la obra e informe semanal al dueño.',
    'gc.p.4h': 'Entrega', 'gc.p.4p': 'Lista de pendientes, planos finales, garantías y el recorrido final.',
    'gc.pp.label': 'Experiencia', 'gc.pp.h': 'Proyectos recientes.',
    'gc.pp.owner': 'Dueño', 'gc.pp.role': 'Papel de FPC', 'gc.pp.scope': 'Alcance', 'gc.pp.value': 'Valor del contrato', 'gc.pp.year': 'Terminado',
    'gc.cap.meta.title': 'Declaración de capacidades | FPC Construction, contratista general con licencia en SC',
    'gc.cap.meta.desc': 'Declaración de capacidades de FPC Construction: licencia, fianzas, seguros, códigos NAICS, historial de seguridad y experiencia. North Augusta, SC, en el CSRA.',
    'gc.cap.label': 'Declaración de capacidades', 'gc.cap.h1': 'Capacidades y calificaciones',
    'gc.cap.lead': 'Los datos que piden los dueños, contratistas principales y agencias públicas, en una sola página. Imprímala o guárdela como PDF.',
    'gc.cap.print': 'Imprimir esta página',
    'gc.r.h': 'Documentos en archivo.', 'gc.r.company': 'Empresa', 'gc.r.name': 'Nombre legal', 'gc.r.base': 'Base', 'gc.r.area': 'Área de servicio', 'gc.r.areav': 'Unas 50 millas alrededor de North Augusta, en Carolina del Sur y Georgia',
    'gc.r.phone': 'Teléfono', 'gc.r.email': 'Correo', 'gc.r.langs': 'Idiomas', 'gc.r.langsv': 'Inglés y español',
    'gc.r.license': 'Licencia', 'gc.r.licno': 'Licencia de contratista general de SC', 'gc.r.class': 'Clasificaciones', 'gc.r.group': 'Grupo financiero', 'gc.r.exp': 'Vence',
    'gc.r.bond': 'Fianzas', 'gc.r.single': 'Por proyecto', 'gc.r.agg': 'Total', 'gc.r.surety': 'Afianzadora',
    'gc.r.ins': 'Seguros', 'gc.r.gl': 'Responsabilidad general', 'gc.r.auto': 'Vehículos comerciales', 'gc.r.wc': 'Compensación laboral', 'gc.r.umb': 'Póliza paraguas',
    'gc.r.ids': 'Registros', 'gc.r.uei': 'UEI de SAM', 'gc.r.cage': 'Código CAGE', 'gc.r.naics': 'Códigos NAICS',
    'gc.r.safety': 'Seguridad', 'gc.r.emr': 'Tasa de modificación de experiencia (EMR)', 'gc.r.osha': 'Capacitación OSHA',
    'gc.r.coi': 'Enviamos certificados de seguro y cartas de fianza a petición.',
    'gc.comp.label': 'Capacidades principales', 'gc.comp.h': 'Lo que FPC hace con su propio equipo y lo que coordina.',
    'gc.sub.meta.title': 'Subcontratistas y proveedores | FPC Construction, North Augusta, SC',
    'gc.sub.meta.desc': 'Subcontratistas y proveedores: cómo entrar a la lista de cotización de FPC Construction para obras comerciales y públicas en el CSRA.',
    'gc.sub.label': 'Subcontratistas y proveedores', 'gc.sub.h1': 'Entre a nuestra lista de cotización.',
    'gc.sub.lead': 'FPC contrata oficios y compra materiales para obras comerciales y públicas en el CSRA. Mándenos su oficio, su zona y sus documentos, y le invitamos a cotizar.',
    'gc.sub.trades.h': 'Oficios que contratamos', 'gc.sub.trades': 'Electricidad, plomería, aire acondicionado, techos, estructura, tablaroca, pintura, pisos, acero, mampostería, jardinería, pavimento y trabajos especiales.',
    'gc.sub.need.h': 'Qué mandar', 'gc.sub.need.1': 'Nombre de la empresa, oficio y condados que cubre', 'gc.sub.need.2': 'Un certificado de seguro vigente', 'gc.sub.need.3': 'Un W-9 firmado', 'gc.sub.need.4': 'Su número de licencia, si su oficio la necesita',
    'gc.sub.safety.h': 'En nuestras obras', 'gc.sub.safety.p': 'Cada equipo sigue las reglas de seguridad de FPC, asiste a la junta de inicio y mantiene limpia su área de trabajo.',
    'gc.sub.cta': 'Mandar su información', 'gc.sub.mail': 'Lista de cotización: ',
  },
};
export const GC_PENDING_ES_KEYS = Object.keys(GC_STRINGS.es);

// ---------- Rendering ----------
// h = { t, nub, tnub, label(no, text), pic(id, alt), estimateUrl, url(key) }. In preview a missing
// record renders as a visible MISSING marker; when publishing, assertReadyToPublish has already
// guaranteed none are missing.
function val(v, preview) {
  if (Array.isArray(v)) v = v.join(', ');
  if (v) return esc(v);
  if (!preview) throw new Error('GC record missing at render time');
  return '<span class="gc-missing">MISSING</span>';
}
const row = (dt, dd) => `<div><dt>${dt}</dt><dd>${dd}</dd></div>`;

export function renderGcPage(which, lang, h, { gc = GC, preview = false } = {}) {
  const { t, nub, tnub, label } = h;
  const s = (k) => GC_STRINGS[lang][k];
  if (which === 'commercial') {
    const methods = [['generalContracting', 'gc'], ['designBuild', 'db'], ['constructionManagement', 'cm'], ['selfPerform', 'sp']].filter(([k]) => gc.delivery[k]);
    const projects = gc.projects.length ? `
  <section class="section section--asphalt joint" aria-labelledby="gc-pp-h"><div class="wrap">
    <div class="section-head">${label('04', s('gc.pp.label'))}<h2 id="gc-pp-h" class="h2">${s('gc.pp.h')}</h2></div>
    <div class="stories">${gc.projects.map((p) => `<article class="storycard panel"><h3>${esc(p.title[lang])}</h3><dl>${row(s('gc.pp.owner'), esc(p.owner))}${row(s('gc.pp.role'), esc(p.role[lang]))}${row(s('gc.pp.scope'), esc(p.scope[lang]))}${p.value ? row(s('gc.pp.value'), esc(p.value)) : ''}${row(s('gc.pp.year'), esc(p.year))}</dl></article>`).join('')}</div>
  </div></section>` : '';
    return `
  <section class="cap-hero" aria-labelledby="h1"><div class="wrap"><div class="cap-hero__grid">
    <div class="cap-hero__text" data-bar-sentinel>
      ${label('mark', s('gc.c.label'))}
      <h1 id="h1" class="display">${s('gc.c.h1')}</h1>
      <p class="lead">${s('gc.c.lead')}</p>
      <div class="hero__actions"><a class="btn btn--cta" href="${h.estimateUrl}?type=commercial-and-public-works"><span>${s('gc.c.cta')}</span>${nub()}</a><a class="btn btn--gold" href="${h.url('capabilities')}"><span>${s('gc.c.cta2')}</span>${nub()}</a></div>
    </div>
    <figure class="hero__photo bezel"><div class="frame">${h.pic('gallery-3', t('w1.alt'))}</div><figcaption class="caption-bar"><span>${t('w1')}</span></figcaption></figure>
  </div></div></section>
  <section class="section" aria-labelledby="gc-d-h"><div class="wrap">
    <div class="section-head section-head--split">${label('01', s('gc.d.label'))}<h2 id="gc-d-h" class="h2">${s('gc.d.h')}</h2></div>
    <div class="lanes">${methods.map(([, k], i) => `<article class="lane" data-reveal><span class="lane__no" aria-hidden="true">0${i + 1}</span><div class="lane__body"><h3 class="lane__name">${s(`gc.d.${k}.h`)}</h3><p class="lane__desc">${s(`gc.d.${k}.p`)}</p></div></article>`).join('')}</div>
  </div></section>
  <section class="section section--band joint" aria-labelledby="gc-s-h"><div class="wrap index__grid">
    <div class="index__aside">${label('02', s('gc.s.label'))}<h2 id="gc-s-h" class="h2">${s('gc.s.h')}</h2></div>
    <ul class="gc-sectors">${[1, 2, 3, 4].map((n) => `<li>${s(`gc.s.${n}`)}</li>`).join('')}</ul>
  </div></section>
  <section class="section joint steps" aria-labelledby="gc-p-h"><div class="wrap">
    <div class="section-head">${label('03', s('gc.p.label'))}<h2 id="gc-p-h" class="h2">${s('gc.p.h')}</h2></div>
    <ol class="steps__list">${[1, 2, 3, 4].map((n) => `<li data-reveal><h3>${s(`gc.p.${n}h`)}</h3><p>${s(`gc.p.${n}p`)}</p></li>`).join('')}</ol>
  </div></section>${projects}`;
  }
  if (which === 'capabilities') {
    const L = gc.license, B = gc.bonding, I = gc.insurance, D = gc.ids, Sf = gc.safety;
    const opt = (dt, v) => (v || preview ? row(dt, val(v, preview)) : '');
    return `
  <section class="cap-hero" aria-labelledby="h1"><div class="wrap"><div class="cap-hero__grid">
    <div class="cap-hero__text" data-bar-sentinel>
      ${label('mark', s('gc.cap.label'))}
      <h1 id="h1" class="display">${s('gc.cap.h1')}</h1>
      <p class="lead">${s('gc.cap.lead')}</p>
      <div class="hero__actions" data-noprint><a class="btn btn--cta" href="${h.estimateUrl}?type=commercial-and-public-works"><span>${s('gc.c.cta')}</span>${nub()}</a><button class="btn btn--line" type="button" data-print><span>${s('gc.cap.print')}</span>${nub('print')}</button></div>
    </div>
    <section class="titleblock panel" aria-labelledby="gc-co-h"><h2 id="gc-co-h">${s('gc.r.company')}</h2><dl>
      ${row(s('gc.r.name'), 'FPC Construction LLC')}${row(s('gc.r.base'), 'North Augusta, SC 29860')}${row(s('gc.r.area'), s('gc.r.areav'))}
      ${row(s('gc.r.phone'), '<a class="num" href="tel:+18038849305">(803) 884-9305</a>')}${row(s('gc.r.email'), '<a href="mailto:info@fpcconstructions.com">info@fpcconstructions.com</a>')}
      ${row(t('foot.hours'), `<span class="hours">${t('foot.hours1')}</span>`)}${row(s('gc.r.langs'), s('gc.r.langsv'))}
    </dl></section>
  </div></div></section>
  <section class="section" id="records" aria-labelledby="gc-rec-h"><div class="wrap">
    <div class="section-head">${label('A', s('gc.r.ids') === 'Registros' ? 'Licencia, fianzas y seguros' : 'License, bonding &amp; insurance')}<h2 id="gc-rec-h" class="h2">${s('gc.r.h')}</h2></div>
    <div class="creds__grid">
      <article class="cred cred--license"><h3>${s('gc.r.license')}</h3><dl class="gc-dl">${row(s('gc.r.licno'), val(L.number, preview))}${row(s('gc.r.class'), val(L.classifications, preview))}${row(s('gc.r.group'), val(L.group, preview))}${row(s('gc.r.exp'), val(L.expires, preview))}</dl></article>
      <article class="cred cred--wide"><h3>${s('gc.r.bond')}</h3><dl class="gc-dl">${row(s('gc.r.single'), val(B.single, preview))}${row(s('gc.r.agg'), val(B.aggregate, preview))}${row(s('gc.r.surety'), val(B.surety, preview))}</dl></article>
      <article class="cred cred--wide"><h3>${s('gc.r.ins')}</h3><dl class="gc-dl">${row(s('gc.r.gl'), val(I.gl, preview))}${opt(s('gc.r.auto'), I.auto)}${row(s('gc.r.wc'), val(I.wc, preview))}${opt(s('gc.r.umb'), I.umbrella)}</dl><p class="muted">${s('gc.r.coi')}</p></article>
      <article class="cred cred--wide"><h3>${s('gc.r.ids')}</h3><dl class="gc-dl">${row(s('gc.r.uei'), val(D.uei, preview))}${opt(s('gc.r.cage'), D.cage)}${row(s('gc.r.naics'), val(D.naics, preview))}</dl></article>
      <article class="cred cred--wide"><h3>${s('gc.r.safety')}</h3><dl class="gc-dl">${opt(s('gc.r.emr'), Sf.emr)}${opt(s('gc.r.osha'), Sf.osha)}</dl></article>
    </div>
  </div></section>
  <section class="section section--asphalt joint" aria-labelledby="gc-comp-h"><div class="wrap index__grid">
    <div class="index__aside">${label('B', s('gc.comp.label'))}<h2 id="gc-comp-h" class="h2">${s('gc.comp.h')}</h2></div>
    <ul class="gc-sectors">${[['gc', 'generalContracting'], ['db', 'designBuild'], ['cm', 'constructionManagement'], ['sp', 'selfPerform']].filter(([, k]) => gc.delivery[k]).map(([k]) => `<li><b>${s(`gc.d.${k}.h`)}</b><span>${s(`gc.d.${k}.p`)}</span></li>`).join('')}</ul>
  </div></section>`;
  }
  if (which === 'subcontractors') {
    const mail = `mailto:info@fpcconstructions.com?subject=${encodeURIComponent(lang === 'es' ? 'Lista de cotización FPC' : 'FPC bid list')}`;
    return `
  <section class="cap-hero" aria-labelledby="h1"><div class="wrap"><div class="cap-hero__grid">
    <div class="cap-hero__text" data-bar-sentinel>
      ${label('mark', s('gc.sub.label'))}
      <h1 id="h1" class="display">${s('gc.sub.h1')}</h1>
      <p class="lead">${s('gc.sub.lead')}</p>
      <div class="hero__actions"><a class="btn btn--cta" href="${mail}"><span>${s('gc.sub.cta')}</span>${nub('mail')}</a></div>
      <p class="muted">${s('gc.sub.mail')}<a href="${mail}">info@fpcconstructions.com</a></p>
    </div>
    <section class="titleblock panel" aria-labelledby="gc-need-h"><h2 id="gc-need-h">${s('gc.sub.need.h')}</h2>
      <ul class="checks">${[1, 2, 3, 4].map((n) => `<li><svg aria-hidden="true"><use href="#i-check"/></svg><span>${s(`gc.sub.need.${n}`)}</span></li>`).join('')}</ul>
    </section>
  </div></div></section>
  <section class="section section--band joint" aria-labelledby="gc-tr-h"><div class="wrap index__grid">
    <div class="index__aside">${label('01', s('gc.sub.trades.h'))}<h2 id="gc-tr-h" class="h2">${s('gc.sub.trades.h')}</h2></div>
    <p class="lead">${s('gc.sub.trades')}</p>
  </div></section>
  <section class="section joint" aria-labelledby="gc-sf-h"><div class="wrap">
    <div class="section-head">${label('02', s('gc.sub.label'))}<h2 id="gc-sf-h" class="h2">${s('gc.sub.safety.h')}</h2><p class="lead">${s('gc.sub.safety.p')}</p></div>
  </div></section>`;
  }
  throw new Error(`unknown GC page ${which}`);
}
