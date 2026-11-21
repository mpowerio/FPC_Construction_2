// Holiday season by date: the boundaries, the Augusta calendar day, and the inline script the
// built pages actually ship, run at fixed instants against the built HTML.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { SEASONS, seasonFor, augustaDate } from './holiday.mjs';

const read = (f) => readFileSync(new URL('../../' + f, import.meta.url), 'utf8');

test('each boundary, on both sides', () => {
  const cases = { '2026-11-22': null, '2026-11-23': 'thanks', '2026-11-26': 'thanks', '2026-11-29': 'thanks', '2026-11-30': 'winter', '2026-12-25': 'winter', '2027-01-03': 'winter', '2027-01-04': null };
  for (const [day, want] of Object.entries(cases)) assert.equal(seasonFor(day, SEASONS), want, day);
});

test('the day is Augusta’s calendar day, not UTC', () => {
  // EST is UTC-5 in late November.
  assert.equal(augustaDate(new Date('2026-11-23T04:59:59Z')), '2026-11-22');
  assert.equal(augustaDate(new Date('2026-11-23T05:00:00Z')), '2026-11-23');
  assert.equal(augustaDate(new Date('2026-11-30T04:59:59Z')), '2026-11-29');
  assert.equal(augustaDate(new Date('2026-11-30T05:00:00Z')), '2026-11-30');
});

// A tiny stand-in DOM built from the shipped markup: the scope element and its data-season children.
function fakeDom(html, scopeAttr) {
  const at = html.indexOf(scopeAttr);
  assert.ok(at > -1, `missing ${scopeAttr}`);
  const open = html.lastIndexOf('<', at);
  const tag = html.slice(open, html.indexOf('>', at) + 1);
  const end = html.indexOf('<script>(function(){', at);
  const kids = [...html.slice(at, end).matchAll(/<[a-z]+[^>]*\bdata-season="([a-z]+)"([^>]*)>/g)].map((m) => ({
    season: m[1], hidden: /\shidden\b/.test(m[0]), getAttribute() { return this.season; },
  }));
  const root = { hidden: /\shidden\b/.test(tag), attrs: {}, setAttribute(k, v) { this.attrs[k] = v; }, querySelectorAll: () => kids };
  return { root, kids, script: html.slice(end, html.indexOf('</script>', end)).replace('<script>', '') };
}
function runAt(file, scopeAttr, iso, search = '') {
  const dom = fakeDom(read(file), scopeAttr);
  const RealDate = Date;
  class FixedDate extends RealDate { constructor(...a) { super(...(a.length ? a : [iso])); } }
  vm.runInNewContext(dom.script, { document: { querySelector: () => dom.root }, location: { search }, Date: FixedDate, Intl });
  const shown = dom.kids.filter((k) => !k.hidden).map((k) => k.season);
  return { rootHidden: dom.root.hidden, shown };
}

test('home strip (EN and ES): hidden outside the dates, the right greeting inside', () => {
  for (const file of ['index.html', 'es/index.html']) {
    const scope = 'data-season-strip';
    assert.deepEqual(runAt(file, scope, '2026-11-23T04:59:59Z'), { rootHidden: true, shown: [] }, `${file} 11-22 late evening`);
    assert.deepEqual(runAt(file, scope, '2026-11-23T05:00:00Z'), { rootHidden: false, shown: ['thanks'] }, `${file} 11-23 midnight`);
    assert.deepEqual(runAt(file, scope, '2026-11-30T04:59:59Z'), { rootHidden: false, shown: ['thanks'] }, `${file} 11-29 late evening`);
    assert.deepEqual(runAt(file, scope, '2026-11-30T05:00:00Z'), { rootHidden: false, shown: ['winter'] }, `${file} 11-30 midnight`);
    assert.deepEqual(runAt(file, scope, '2027-01-04T05:00:00Z'), { rootHidden: true, shown: [] }, `${file} after New Year`);
  }
});

test('holiday page (EN and ES): default copy without a season, season copy inside the dates', () => {
  for (const file of ['holidays/index.html', 'es/fiestas/index.html']) {
    const scope = 'data-season-scope';
    assert.deepEqual(runAt(file, scope, '2026-11-20T12:00:00Z').shown, ['default', 'default'], `${file} before`);
    assert.deepEqual(runAt(file, scope, '2026-11-24T12:00:00Z').shown, ['thanks', 'thanks'], `${file} Thanksgiving week`);
    assert.deepEqual(runAt(file, scope, '2026-12-01T12:00:00Z').shown, ['winter', 'winter'], `${file} December`);
    assert.deepEqual(runAt(file, scope, '2027-02-01T12:00:00Z').shown, ['default', 'default'], `${file} after`);
  }
});

test('no-JS markup: the strip is hidden and the page shows its default copy', () => {
  for (const file of ['index.html', 'es/index.html']) assert.equal(fakeDom(read(file), 'data-season-strip').root.hidden, true, file);
  for (const file of ['holidays/index.html', 'es/fiestas/index.html']) assert.deepEqual(fakeDom(read(file), 'data-season-scope').kids.filter((k) => !k.hidden).map((k) => k.season), ['default', 'default'], file);
});

test('?season= previews a season for review and none clears it', () => {
  assert.deepEqual(runAt('index.html', 'data-season-strip', '2026-11-01T12:00:00Z', '?season=winter').shown, ['winter']);
  assert.equal(runAt('index.html', 'data-season-strip', '2026-11-24T12:00:00Z', '?season=none').rootHidden, true);
});

test('the page offers no promo, price or sales-tax wording', () => {
  for (const file of ['holidays/index.html', 'es/fiestas/index.html']) {
    const main = read(file).split('<main id="main">')[1].split('</main>')[0].replace(/<script[\s\S]*?<\/script>/g, '').replace(/<[^>]+>/g, ' ');
    assert.doesNotMatch(main, /\$\s*\d|\bsale\b|discount|% off|promo|coupon|sales tax|descuento|oferta|impuesto/i, file);
  }
});
