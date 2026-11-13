// Release gate for Spanish copy. Every shipped Spanish string added by the v3 redesign is a draft until
// a native speaker reads it. The reader clears the markers by emptying PENDING_ES_KEYS (strings.mjs) and,
// on license day, GC_PENDING_ES_KEYS (gc.mjs). This test is red until then, so the site cannot release
// with unread Spanish. That is intended (Chair, 2026-11-13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PENDING_ES_KEYS, home, common } from './strings.mjs';
import { GC, GC_PENDING_ES_KEYS } from './gc.mjs';

export function unreadSpanish({ pending = PENDING_ES_KEYS, gcPending = GC_PENDING_ES_KEYS, gcOn = GC.enabled } = {}) {
  return [...pending, ...(gcOn ? gcPending : [])];
}
test('every pending key names a real shipped Spanish string', () => {
  for (const k of PENDING_ES_KEYS) assert.ok(k in home.es || k in common.es, `unknown key ${k}`);
});
test('shipped Spanish has had its native-speaker read (no PENDING-ES markers left)', () => {
  const left = unreadSpanish();
  assert.deepEqual(left, [], `PENDING-ES: ${left.length} Spanish strings still need a native read: ${left.join(', ')}`);
});
test('the gate passes once the markers are cleared, and GC keys count only when GC ships', () => {
  assert.deepEqual(unreadSpanish({ pending: [], gcPending: ['x'], gcOn: false }), []);
  assert.deepEqual(unreadSpanish({ pending: [], gcPending: ['x'], gcOn: true }), ['x']);
});
