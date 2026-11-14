// Release gate for Spanish copy. Every shipped Spanish string added by the v3 redesign is a draft until
// a native speaker reads it. The reader clears the markers by emptying PENDING_ES_KEYS (strings.mjs) and,
// on license day, GC_PENDING_ES_KEYS (gc.mjs). This test is red until then, so the site cannot release
// with unread Spanish while it is red. It runs in its own visible, non-required workflow (.github/workflows/spanish-read.yml),
// so it never blocks a fix (Chair, 2026-11-13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PENDING_ES_KEYS, home, common } from './strings.mjs';
import { GC, GC_PENDING_ES_KEYS } from './gc.mjs';
import { readFileSync } from 'node:fs';

// Hand-written legal pages mark Spanish that still needs a native read with data-es-read="needed"
// on the element itself (privacy.html, 2026-11-14 truth pass). The reader removes the attribute.
const LEGAL_ES_PAGES = ['privacy.html'];
export function unreadLegalSpanish(read = (f) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8')) {
  return LEGAL_ES_PAGES.flatMap((f) => [...read(f).matchAll(/data-es-read="needed"/g)].map((_, i) => `${f}#${i + 1}`));
}

export function unreadSpanish({ pending = PENDING_ES_KEYS, gcPending = GC_PENDING_ES_KEYS, gcOn = GC.enabled } = {}) {
  return [...pending, ...(gcOn ? gcPending : [])];
}
test('every pending key names a real shipped Spanish string', () => {
  for (const k of PENDING_ES_KEYS) assert.ok(k in home.es || k in common.es, `unknown key ${k}`);
});
test('shipped Spanish has had its native-speaker read (no PENDING-ES markers left)', () => {
  const left = [...unreadSpanish(), ...unreadLegalSpanish()];
  assert.deepEqual(left, [], `PENDING-ES: ${left.length} Spanish strings still need a native read: ${left.join(', ')}`);
});
test('legal-page markers are counted, and only on the marked elements', () => {
  assert.deepEqual(unreadLegalSpanish(() => '<p data-es-read="needed">a</p><p>b</p><li data-es-read="needed">c</li>'), ['privacy.html#1', 'privacy.html#2']);
  assert.deepEqual(unreadLegalSpanish(() => '<p>a</p>'), []);
});
test('the gate passes once the markers are cleared, and GC keys count only when GC ships', () => {
  assert.deepEqual(unreadSpanish({ pending: [], gcPending: ['x'], gcOn: false }), []);
  assert.deepEqual(unreadSpanish({ pending: [], gcPending: ['x'], gcOn: true }), ['x']);
});
