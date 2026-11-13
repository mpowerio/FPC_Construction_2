// End-to-end controls execute the real default SEO command on scratch output only.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { services } from './services.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const command = join(root, 'tools/seo-check.mjs');
const files = ['index.html', 'es/index.html', 'estimate/index.html', 'es/estimado/index.html', ...services.flatMap(s => Object.values(s.url).map(u => u.slice(1) + 'index.html')), 'privacy.html', 'terms.html', 'sms-opt-in.html', 'sitemap.xml'];
const dir = mkdtempSync(join(tmpdir(), 'fpc-release-controls-'));
function run() { return spawnSync(process.execPath, [command], {cwd:dir, encoding:'utf8'}); }
try {
  for (const file of files) {
    mkdirSync(dirname(join(dir,file)), {recursive:true});
    // Explicitly fictional copy lives only in this throwaway test fixture.
    const fixture = readFileSync(join(root,file),'utf8').replace(/\sdata-release-pending\b/g,'').replace(/\[Headline pending approval\]|\[Titular pendiente de aprobación\]/g,'Release-control fixture heading').replace(/Project examples pending verification|Ejemplos de proyectos pendientes de verificación/g,'Release-control fixture example');
    writeFileSync(join(dir,file),fixture);
  }
  const baseline = run(); assert.equal(baseline.status,0,baseline.stderr);
  const markers = ['<span class="ph">caption</span>', '<span class=ph>caption</span>', '<div class="reviews__ph">note</div>', '<h1>[Headline pending approval]</h1>', '<h1>[Titular pendiente de aprobación]</h1>', '<p>Project examples pending verification</p>', '<p>Ejemplos de proyectos pendientes de verificación</p>', '<p data-release-pending>Changed words</p>'];
  let rejected = 0;
  for (const file of ['index.html','es/index.html','services/concrete/index.html','privacy.html']) {
    const clean = readFileSync(join(dir,file),'utf8');
    for (const marker of markers) {
      writeFileSync(join(dir,file),clean.replace('</body>', marker+'</body>'));
      const result=run(); assert.notEqual(result.status,0,`${file}: guard accepted ${marker}`); assert.match(result.stderr,/unfinished public|unapproved headline|removed internal/); rejected++;
    }
    writeFileSync(join(dir,file),clean);
  }
  // The locked paragraph cannot be removed, nor can a second heading be introduced.
  const file=join(dir,'index.html'), clean=readFileSync(file,'utf8');
  writeFileSync(file,clean.replace(/<p class="hero__slogan"[\s\S]*?<\/p>/,''));
  assert.match(run().stderr,/locked English slogan/);
  writeFileSync(file,clean.replace('</main>','<h1>Second heading</h1></main>'));
  assert.match(run().stderr,/one non-empty H1/);
  console.log(`Real SEO command: release-eligible scratch baseline passes; ${rejected} planted placeholders, removed slogan and duplicate H1 all fail.`);
} finally { rmSync(dir,{recursive:true,force:true}); }
