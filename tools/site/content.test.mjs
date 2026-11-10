import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderReviews, GOOGLE_REVIEW_URL } from './reviews.mjs';
import { renderTreeWork, treeMediaFiles, TREE_WORK } from './media.mjs';
import { common } from './strings.mjs';

const t = key => common.en[key];
const url = 'https://www.google.com/maps?cid=synthetic-fixture';
const snapshot = () => ({ verified: true, listingId: 'local-test-only', listingUrl: url, observedOn: '2026-11-10', rating: 4.7, count: 7, items: [{ listingId: 'local-test-only', author: '<b>Fixture</b>', rating: 4, dateLabel: '2026-11-10', text: '<script>Not a real review</script>', language: 'en', sourceUrl: url, excerpt: true }] });

test('empty defaults omit review layout, numbers, and action URL', () => {
  assert.equal(GOOGLE_REVIEW_URL, '');
  assert.deepEqual(renderReviews(t), { summary: '', section: '', footer: '' });
});
test('confirmed link alone permits an ask without inventing a rating', () => {
  const result = renderReviews(t, { reviewUrl: url });
  assert.equal(result.summary + result.section, '');
  assert.ok(result.footer.includes('Leave a Google review'));
});
test('a lookalike/non-Google/unsafe action destination is rejected', () => {
  for (const reviewUrl of ['javascript:alert(1)', 'http://google.com/maps', 'https://google.com.evil.invalid/maps', 'https://user@google.com/maps']) assert.throws(() => renderReviews(t, { reviewUrl }));
});
test('verified content must retain a listing, action URL, rating and exact source attribution', () => {
  for (const field of ['listingId', 'listingUrl', 'observedOn', 'rating', 'count']) {
    const data = snapshot(); data[field] = null;
    assert.throws(() => renderReviews(t, { reviewUrl: url, snapshot: data }));
  }
  assert.throws(() => renderReviews(t, { snapshot: snapshot() }));
  const missingQuotes = snapshot(); missingQuotes.items = [];
  assert.throws(() => renderReviews(t, { reviewUrl: url, snapshot: missingQuotes }));
});
test('reviews from another listing cannot join the snapshot', () => {
  const data = snapshot(); data.items[0].listingId = 'different-listing';
  assert.throws(() => renderReviews(t, { reviewUrl: url, snapshot: data }));
});
test('manually supplied words are escaped and excerpts are explicitly attributed', () => {
  const result = renderReviews(t, { reviewUrl: url, snapshot: snapshot() });
  assert.ok(result.section.includes('&lt;script&gt;Not a real review&lt;/script&gt;'));
  assert.ok(result.section.includes('&lt;b&gt;Fixture&lt;/b&gt;'));
  assert.ok(result.section.includes('Excerpt · Read original on Google'));
  assert.ok(!result.section.includes('<script>'));
  assert.ok(result.summary.includes('4.7 / 5 · 7 Google reviews'));
});
test('Spanish interface labels do not translate the source review words', () => {
  const result = renderReviews(key => common.es[key], { reviewUrl: url, snapshot: snapshot() });
  assert.ok(result.footer.includes('Dejar una reseña en Google'));
  assert.ok(result.section.includes('Not a real review'));
});
test('unapproved media emits no markup or private names even when pending inputs exist', () => {
  assert.equal(renderTreeWork('en', t, { approvedForPublic:false }), '');
  assert.deepEqual(treeMediaFiles({ approvedForPublic:false }), []);
  assert.equal(renderTreeWork('en', t, { approvedForPublic: false, photo: { src: '/private/pending-image.jpeg' } }), '');
});
test('approval alone cannot publish incomplete media', () => {
  assert.throws(() => renderTreeWork('en', t, { approvedForPublic: true, caption: { en: 'Fixture', es: '' } }));
});
test('approved media requires generic local paths and reserved geometry; video loads only on intent', () => {
  const media = { approvedForPublic: true, caption: { en: 'Local fixture', es: 'Prueba local' }, photo: { src: '/assets/img/local-fixture.webp', width: 800, height: 600, alt: { en: 'Fixture photo', es: 'Foto de prueba' } }, clips: [{ src: '/assets/video/local-fixture.mp4', poster: '/assets/img/local-fixture.webp', width: 1280, height: 720 }] };
  const html = renderTreeWork('en', t, media);
  assert.ok(html.includes('preload="none"'));
  assert.ok(html.includes('controls playsinline'));
  assert.ok(!html.includes('autoplay'));
  const unsafe = structuredClone(media); unsafe.photo.src = '/private/client-photo.jpeg';
  assert.throws(() => renderTreeWork('en', t, unsafe));
  const remote = structuredClone(media); remote.clips[0].src = 'https://example.com/clip.mp4';
  assert.throws(() => renderTreeWork('en', t, remote));
});

test('approved message is an exact dated testimonial, never an unverified Google review', () => {
  const text = 'Amazing crew, great work so far that my HOA was impressed! Thanks to the great team Filemon has assembled. Quality workmanship and value pricing.';
  assert.equal(TREE_WORK.testimonial.text, text);
  assert.equal(TREE_WORK.testimonial.author, 'Michael Parker');
  assert.equal(TREE_WORK.testimonial.rating, 5);
  assert.equal(TREE_WORK.testimonial.date, '2026-11-10');
  assert.equal(TREE_WORK.testimonial.town, 'North Augusta, Foxchase subdivision');
  for (const lang of ['en','es']) {
    const html = renderTreeWork(lang, key => common[lang][key]);
    assert.ok(html.includes(text));
    assert.ok(html.includes('lang="en"'));
    assert.ok(html.includes(common[lang]['media.disclosure'].replaceAll("'", '&#39;')) || html.includes(common[lang]['media.disclosure']));
    assert.ok(!html.includes('Google'));
    assert.ok(!html.includes('yes please'));
    assert.ok(html.includes('<span lang="en">North Augusta, Foxchase subdivision</span>'));
  }
  const wrongSource = structuredClone(TREE_WORK); wrongSource.testimonial.kind = 'google-review';
  assert.throws(() => renderTreeWork('en', t, wrongSource));
});
