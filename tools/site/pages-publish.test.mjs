// What GitHub Pages publishes (site card FPC-SITE-PAGES-SERVES-INTERNALS-20261121): every tracked file must be either
// a named public path or excluded by _config.yml. Jekyll already skips dot-paths (.github, .gitignore) and _-paths.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../../', import.meta.url);

// The public site: built pages, legal pages, assets (except notes), and the files Pages and crawlers read.
const PUBLIC = [
  /^(?:index|privacy|terms|sms-opt-in)\.html$/,
  /^(?:es|estimate|services|holidays)\/.*index\.html$/,
  /^assets\/(?!.*\.md$)/,
  /^(?:CNAME|robots\.txt|sitemap\.xml|favicon\.ico|google[0-9a-f]+\.html)$/,
];

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
export function unpublishedProblems(tracked, excludes) {
  const skipped = (f) => f.split('/').some((seg) => seg.startsWith('.') || seg.startsWith('_')) ||
    excludes.some((e) => f === e || f.startsWith(e + '/'));
  const isPublic = (f) => PUBLIC.some((rx) => rx.test(f));
  return tracked.filter((f) => f && !skipped(f) && !isPublic(f));
}

test('every tracked file is a named public path or excluded from Pages', () => {
  const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
  assert.ok(tracked.length > 50, 'git ls-files returned too few files to trust');
  const excludes = excludesFrom(readFileSync(new URL('_config.yml', root), 'utf8'));
  assert.deepEqual(unpublishedProblems(tracked, excludes), []);
});
test('internals are excluded and public pages are not', () => {
  const excludes = excludesFrom(readFileSync(new URL('_config.yml', root), 'utf8'));
  for (const f of ['tools', 'docs', 'fixes', 'package.json', 'package-lock.json', 'README.md']) assert.ok(excludes.includes(f), `${f} must be excluded`);
  for (const f of ['index.html', 'es', 'assets', 'services', 'estimate', 'sitemap.xml', 'robots.txt', 'CNAME']) assert.ok(!excludes.includes(f), `${f} must stay published`);
});
test('controls: an internal file that is not excluded fails; a dot-path and an excluded path pass', () => {
  const ex = ['tools'];
  assert.deepEqual(unpublishedProblems(['notes/plan.md', 'tools/x.mjs', '.github/w.yml', 'index.html'], ex), ['notes/plan.md']);
  assert.deepEqual(unpublishedProblems(['assets/brand/README.md'], ex), ['assets/brand/README.md'], 'notes under assets are not public');
  assert.throws(() => excludesFrom('title: x\n'), /no exclude/);
});
