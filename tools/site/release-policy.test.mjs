import test from 'node:test';
import assert from 'node:assert/strict';
import { releaseProblems } from './release-policy.mjs';
test('release guard rejects every planted unfinished variant', () => {
  for (const html of ['<span class="ph">town</span>', "<span class='ph'>town</span>", '<span class=ph>town</span>', '<div class="reviews__ph">note</div>', '<p>Placeholder: town</p>', '<h1>[Headline pending approval]</h1>', '<h1>[Titular pendiente de aprobación]</h1>', '<p>Project examples pending verification</p>', '<p>Ejemplos de proyectos pendientes de verificación</p>', '<h1 data-release-pending>Any changed words</h1>']) assert.ok(releaseProblems(html).length, html);
});
test('legitimate attributes, comments and icon classes stay allowed', () => {
  for (const html of ['<input placeholder="Name">', '<!-- Placeholder: town -->', '<style>.ph {color:red}</style>', '<script>"Placeholder: town"</script>', '<i class="ph-icon">icon</i>', '<h1>Approved heading</h1>']) assert.deepEqual(releaseProblems(html), []);
});
test('explicit local draft mode never permits removed caption tags', () => {
  assert.deepEqual(releaseProblems('<h1 data-release-pending>[Headline pending approval]</h1>', {allowDraft:true}), []);
  assert.ok(releaseProblems('<span class=ph>town</span>', {allowDraft:true}).length);
});
