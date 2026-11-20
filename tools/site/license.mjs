// SC contractor license, from the certificate (operator-verified 2026-11-20; photos in the owner's
// files). One source for the footer line and the JSON-LD credential. Wording is fixed by the
// operator: never shorten to "licensed GC", never imply building/residential/grading/Georgia work.
// Not printed here: the qualifier's name and the Group 2 job limit (internal facts only).
export const CONTRACTOR_LICENSE = {
  number: 'CLG.128085',
  board: "South Carolina Department of Labor, Licensing and Regulation — Contractor's Licensing Board",
  classCode: 'WL2',
  className: { en: 'Water & Sewer Lines', es: 'Líneas de Agua y Alcantarillado' },
  issued: '2026-11-19',
  expires: '2028-10-31',
};

const LINE = {
  en: 'SC Licensed General Contractor · Water & Sewer Lines (WL2) · Lic. CLG.128085',
  es: 'Contratista General con Licencia de SC · Líneas de Agua y Alcantarillado (WL2) · Lic. CLG.128085',
};

// After the expiry date the generator stops emitting the line and the credential. The site is static
// (GitHub Pages serves committed HTML), so that only reaches visitors after a rebuild and a merge to main;
// tools/site/claim-guard.mjs fails any page that still shows the line after expiry, and the weekly
// license-expiry workflow runs it.
export function licenseActive(now = new Date(), lic = CONTRACTOR_LICENSE) {
  return now.toISOString().slice(0, 10) <= lic.expires;
}

export function licenseLine(lang, now = new Date()) {
  return licenseActive(now) ? LINE[lang === 'es' ? 'es' : 'en'] : '';
}

// schema.org: Organization.hasCredential takes an EducationalOccupationalCredential; credentialCategory
// "license", recognizedBy the issuing board, validFrom/expires from the certificate.
export function licenseCredential(lang, now = new Date(), lic = CONTRACTOR_LICENSE) {
  if (!licenseActive(now, lic)) return null;
  return {
    '@type': 'EducationalOccupationalCredential',
    name: LINE[lang === 'es' ? 'es' : 'en'],
    credentialCategory: 'license',
    identifier: lic.number,
    competencyRequired: `${lic.className[lang === 'es' ? 'es' : 'en']} (${lic.classCode})`,
    recognizedBy: { '@type': 'GovernmentOrganization', name: lic.board, areaServed: 'South Carolina' },
    validFrom: lic.issued,
    expires: lic.expires,
  };
}
