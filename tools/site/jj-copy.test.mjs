// Guard: the phone is answered by JJ (operator ruling 2026-11-10). The old "Fil answers" step
// copy came back once through a merge (#34, 2026-11-13); this fails if it reaches built output again.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { services } from './services.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const built = ['index.html', 'es/index.html', 'estimate/index.html', 'es/estimado/index.html',
  ...services.flatMap((s) => Object.values(s.url).map((u) => u.slice(1) + 'index.html'))];
const banned = [/Fil answers any time/i, /Fil contesta a cualquier hora/i];

for (const file of built) test(`${file}: the step copy names JJ, never the old Fil agent`, () => {
  const html = readFileSync(join(root, file), 'utf8');
  for (const re of banned) assert.doesNotMatch(html, re, `${file} contains ${re}`);
});
test('home pages carry the JJ step line in both languages', () => {
  assert.match(readFileSync(join(root, 'index.html'), 'utf8'), /JJ answers any time, day or night\./);
  assert.match(readFileSync(join(root, 'es/index.html'), 'utf8'), /JJ contesta a cualquier hora, de día o de noche\./);
});
