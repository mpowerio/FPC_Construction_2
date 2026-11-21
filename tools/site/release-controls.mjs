// End-to-end controls execute the real default SEO command on scratch output only.
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { services } from './services.mjs';
import { publicPages } from './claim-guard.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const command = join(root, 'tools/seo-check.mjs');
// Every public page from the shared inventory (so a new page is in the fixture), plus the sitemap and stylesheets.
const files = [...publicPages(services), 'sitemap.xml', 'assets/site/site.css', 'assets/site/legal.css'];
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
  for (const file of ['index.html','es/index.html','services/concrete/index.html','privacy.html','holidays/index.html','es/fiestas/index.html']) {
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
  writeFileSync(file,clean);
  // Stylesheets anywhere in the tree, and every linked stylesheet, are claim-checked (site PR #51 r6).
  const priv=join(dir,'privacy.html'), privClean=readFileSync(priv,'utf8');
  writeFileSync(join(dir,'footer.css'),'.site-footer::before { content: "Fully insured."; }\n');
  let r=run(); assert.notEqual(r.status,0,'root-level stylesheet (unlinked) was not scanned'); assert.match(r.stderr,/footer\.css: license\/insurance\/GC claim in CSS content/);
  writeFileSync(priv,privClean.replace('</head>','<link rel="stylesheet" href="/footer.css"></head>'));
  r=run(); assert.notEqual(r.status,0,'root-level linked stylesheet was not scanned'); assert.match(r.stderr,/footer\.css: license\/insurance\/GC claim in CSS content/);
  rmSync(join(dir,'footer.css'));
  r=run(); assert.notEqual(r.status,0,'missing linked stylesheet passed'); assert.match(r.stderr,/linked stylesheet not found in the repo: \/footer\.css/);
  writeFileSync(priv,privClean.replace('</head>','<link rel="stylesheet" href="https://example.com/footer.css"></head>'));
  r=run(); assert.notEqual(r.status,0,'external stylesheet passed'); assert.match(r.stderr,/external stylesheet cannot be claim-checked/);
  writeFileSync(priv,privClean);
  assert.equal(run().status,0,'scratch baseline did not recover');
  console.log(`Real SEO command: release-eligible scratch baseline passes; ${rejected} planted placeholders, removed slogan and duplicate H1 all fail; root-level, linked, missing and external stylesheets all fail.`);
} finally { rmSync(dir,{recursive:true,force:true}); }
