// CLAIM VOCABULARY — CLOSED, OPERATOR-OWNED LIST (Chair ruling 2026-11-20).
//
// This file is the complete list of claim words the site claim guard (tools/site/claim-guard.mjs) rejects.
// It is closed: change it only by a PR the operator has approved. A reviewer who finds a new claim word or
// phrasing that passes reports it as a (b) note proposing an addition to this list. It is not a blocker.
// Structural misses (a claim the guard fails to look at, or a footer line it fails to see) are still blockers.
//
// Frozen 2026-11-20 after site PR #51 review round 4, which added: insurance wording in Spanish
// ("seguro de responsabilidad civil", "contamos con seguro"), "GC", and prose counts of years and projects
// ("more than 15 years of experience", "over 500 projects", "más de 15 años").
//
// Bare "seguro" is NOT in the list: the live Spanish pages use it to mean "secure" ("completamente seguro"),
// in "Seguro Social" and in "copia de seguridad". Insurance wording is matched by its context instead.

// Licensed / insured / bonded / general-contractor claims, English and Spanish.
const LICENSE_TERMS = [
  String.raw`licen[cs]ed?`, String.raw`licen[cs]es`, String.raw`licencia`, String.raw`licenciad[oa]s?`,
  String.raw`insured`, String.raw`insurance`, String.raw`asegurad[oa]s?`,
  String.raw`seguros?\s+(?:de\s+|contra\s+)?(?:responsabilidad|da[ñn]os|obra|accidentes|compensaci[óo]n|trabajadores|riesgos?)`,
  String.raw`(?:con|tenemos|contamos\s+con|cuenta\s+con|tiene|incluye)\s+(?:un\s+|el\s+)?seguros?`,
  String.raw`p[óo]lizas?`,
  String.raw`bonded`, String.raw`bonding`, String.raw`bonds?`, String.raw`surety`, String.raw`afianzad[oa]s?`, String.raw`fianzas?`,
  String.raw`general\s+contractors?`, String.raw`contratistas?\s+generale?s?`, String.raw`GCs?`,
];

// Marketing claims: warranties, and counts of years or projects (numeric "15+" and prose).
const NUMBER = String.raw`(?:\d[\d,.]*\s*\+?|a\s+few|several|many|dozens|hundreds|thousands|decades|ten|fifteen|twenty|thirty|fifty|hundred|thousand|varios|muchos|docenas|cientos|miles|d[ée]cadas|diez|quince|veinte|treinta|cincuenta|cien|mil)`;
const COUNTED = String.raw`(?:years?|a[ñn]os|projects?|proyectos|jobs|trabajos)`;
const MARKETING_TERMS = [
  String.raw`warrant`, String.raw`garant[ií]as?`, String.raw`\b15\s*\+`, String.raw`\b500\s*\+`,
  // Ages are not claims: "menores de 13 años", "under 13 years of age", "13 years old", "13 años de edad".
  String.raw`(?<!(?:menores|mayores|under|over\s+age)\s+(?:de\s+)?)\b${NUMBER}\s+(?:[\p{L}-]+\s+){0,3}?${COUNTED}\b(?!\s+(?:old|of\s+age|de\s+edad))`,
  String.raw`\b(?:years?\s+of\s+experience|a[ñn]os\s+de\s+experiencia|decades\s+of|d[ée]cadas\s+de)\b`,
];

export const LICENSE_CLAIM = new RegExp(String.raw`\b(?:${LICENSE_TERMS.join('|')})\b`, 'iu');
export const MARKETING_CLAIM = new RegExp(MARKETING_TERMS.join('|'), 'iu');
