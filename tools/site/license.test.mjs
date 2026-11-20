import test from 'node:test';
import assert from 'node:assert/strict';
import { licenseLine, licenseCredential, licenseActive } from './license.mjs';

test('exact operator wording, EN and ES', () => {
  const now = new Date('2026-11-20T12:00:00Z');
  assert.equal(licenseLine('en', now), 'SC Licensed General Contractor · Water & Sewer Lines (WL2) · Lic. CLG.128085');
  assert.equal(licenseLine('es', now), 'Contratista General con Licencia de SC · Líneas de Agua y Alcantarillado (WL2) · Lic. CLG.128085');
});

test('fails closed after expiry', () => {
  const after = new Date('2028-11-01T00:00:00Z');
  assert.equal(licenseActive(after), false);
  assert.equal(licenseLine('en', after), '');
  assert.equal(licenseCredential('en', after), null);
  assert.equal(licenseActive(new Date('2028-10-31T12:00:00Z')), true);
});

test('credential carries number, class and dates, never the qualifier or job limit', () => {
  const c = licenseCredential('en', new Date('2026-11-20T00:00:00Z'));
  assert.equal(c.identifier, 'CLG.128085');
  assert.equal(c.credentialCategory, 'license');
  assert.equal(c.validFrom, '2026-11-19');
  assert.equal(c.expires, '2028-10-31');
  const s = JSON.stringify(c);
  for (const banned of ['Jesus', 'Pineda', '400', 'bond', 'insur', 'Georgia', 'GA ']) assert.ok(!s.includes(banned), banned);
});
