// What GitHub Pages actually publishes (card FPC-SITE-PAGES-SERVES-INTERNALS-20261121). CI builds the site with
// GitHub's own Pages builder (actions/jekyll-build-pages, the same legacy Jekyll that serves fpcconstructions.com)
// into PAGES_OUT, and this test checks that real output: every required public file is there, and nothing outside the
// public allowlist is. The source-level tests guard _config.yml itself. Run locally with
// PAGES_OUT=<built dir> node --test tools/site/pages-publish.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { publicPages } from './claim-guard.mjs';
import { services } from './services.mjs';

const root = new URL('../../', import.meta.url);

// Allowed in the published output: the built and legal pages, assets other than notes and the internal image-picker
// config, and the files Pages and crawlers read.
const ALLOWED = [
  /^(?:index|privacy|terms|sms-opt-in)\.html$/,
  /^(?:es|estimate|services|holidays)\/(?:.*\/)?index\.html$/,
  /^assets\/(?!data\/)(?!.*\.md$)/,
  /^(?:CNAME|robots\.txt|sitemap\.xml|favicon\.ico|google[0-9a-f]+\.html)$/,
];
// Must be in the published output: EVERY tracked file the allowlist calls public (pages, legal pages, every asset,
// crawler files), not a hand-picked few (#55 review cycle 2: an exclusion dropping the logo SVGs went unseen).
export function trackedFiles() {
  return execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
}
export function requiredOutputs(tracked = trackedFiles()) {
  // Dot-files (e.g. assets/images/projects/.gitkeep) are repo plumbing that Jekyll never publishes.
  const pub = tracked.filter((f) => ALLOWED.some((rx) => rx.test(f)) && !f.split('/').some((seg) => seg.startsWith('.')));
  return [...new Set([...pub, ...publicPages(services)])];
}
export function outputProblems(files, required = requiredOutputs()) {
  const problems = [];
  for (const f of files) if (!ALLOWED.some((rx) => rx.test(f))) problems.push(`published but not public: ${f}`);
  for (const f of required) if (!files.includes(f)) problems.push(`public file missing from the Pages output: ${f}`);
  return problems;
}
function listFiles(dir) {
  const out = [];
  (function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else out.push(relative(dir, p).split('\\').join('/')); } })(dir);
  return out;
}

export function excludesFrom(yml) {
  const lines = yml.split('\n');
  const at = lines.findIndex((l) => /^exclude:\s*$/.test(l));
  assert.ok(at > -1, '_config.yml has no exclude: list');
  const out = [];
  for (const l of lines.slice(at + 1)) {
    const m = l.match(/^\s+-\s+(\S+)\s*$/);
    if (m) out.push(m[1].replace(/\/$/, ''));
    else if (l.trim() && !l.trim().startsWith('#')) break;
  }
  return out;
}

const OUT = process.env.PAGES_OUT;
test('the real Pages output publishes every public file and nothing else', { skip: !OUT && !process.env.CI ? 'PAGES_OUT not set (CI builds the site with actions/jekyll-build-pages and sets it)' : false }, () => {
  assert.ok(OUT, 'CI must set PAGES_OUT to the actions/jekyll-build-pages output; an unchecked build is a failure, not a pass');
  assert.ok(existsSync(OUT), `PAGES_OUT ${OUT} does not exist`);
  const files = listFiles(OUT);
  assert.ok(files.length > 100, `Pages output has only ${files.length} files: the build did not run`);
  assert.deepEqual(outputProblems(files), []);
});
test('controls: an extra published file, a missing public file, and internals all fail', () => {
  const good = requiredOutputs();
  assert.deepEqual(outputProblems(good), []);
  assert.deepEqual(outputProblems([...good, '.htaccess']), ['published but not public: .htaccess']);
  assert.deepEqual(outputProblems(good.filter((f) => f !== 'robots.txt')), ['public file missing from the Pages output: robots.txt']);
  for (const f of ['tools/site/src/home.html', 'package.json', 'README.html', 'assets/data/gallery-config.json', 'assets/brand/README.md', 'docs/GC-FLIP.html'])
    assert.ok(outputProblems([...good, f]).length === 1, f);
  // Cycle 2: any tracked public asset dropped from the output fails (the logo is on every page).
  const logo = 'assets/brand/fpc-lockup-enhanced-light.svg';
  assert.ok(good.includes(logo), 'the logo must be a required output');
  assert.deepEqual(outputProblems(good.filter((f) => f !== logo)), [`public file missing from the Pages output: ${logo}`]);
  assert.ok(good.length > 150, `required list too short to trust (${good.length})`);
});
test('_config.yml excludes the internals and no exclude entry is a prefix of a public path', () => {
  const excludes = excludesFrom(readFileSync(new URL('_config.yml', root), 'utf8'));
  for (const f of ['tools', 'docs', 'fixes', 'package.json', 'package-lock.json', 'README.md', 'assets/data']) assert.ok(excludes.includes(f), `${f} must be excluded`);
  // Jekyll 3.10 also matches exclude entries as prefixes ("robots" would drop robots.txt).
  const tracked = trackedFiles().filter((f) => ALLOWED.some((rx) => rx.test(f)));
  const clashes = tracked.filter((f) => excludes.some((e) => f.startsWith(e)));
  assert.deepEqual(clashes, [], 'an exclude entry matches a public path');
});
