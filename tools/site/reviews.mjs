import assert from 'node:assert/strict';
import { escapeHtml as esc, googleUrl } from './content-utils.mjs';

// One operator-confirmed review-action destination, shared by EN/ES and all placements.
// Empty until the listing split is resolved. Never guess a listing or derive its rating.
export const GOOGLE_REVIEW_URL = '';
// Manual, approved Google snapshot only. No API, key, scraping or scheduled network work.
// Keep quotes verbatim in the displayed language, with source/date/author attribution.
export const GOOGLE_REVIEWS = {
  verified: false,
  listingId: '', listingUrl: '', observedOn: '', rating: null, count: null,
  // Each item: listingId, author, rating, dateLabel, text, language, sourceUrl, excerpt.
  items: [],
};

export function renderReviews(t, { reviewUrl = GOOGLE_REVIEW_URL, snapshot = GOOGLE_REVIEWS } = {}) {
  const actionUrl = reviewUrl ? googleUrl(reviewUrl) : '';
  const action = actionUrl ? `<a class="btn btn--red review-action" href="${esc(actionUrl)}" rel="noopener noreferrer"><span>${esc(t('reviews.leave'))}</span><span class="btn__nub" aria-hidden="true"><svg><use href="#i-chev"/></svg></span></a>` : '';
  if (!snapshot.verified) return { summary: '', section: '', footer: action };
  assert.ok(actionUrl && snapshot.listingId && snapshot.listingUrl, 'Verified review content needs the confirmed listing and review-action URL');
  const listingUrl = googleUrl(snapshot.listingUrl);
  assert.match(snapshot.observedOn, /^\d{4}-\d{2}-\d{2}$/, 'Review snapshot needs an observation date');
  assert.equal(new Date(snapshot.observedOn).toISOString().slice(0, 10), snapshot.observedOn);
  assert.ok(Number.isFinite(snapshot.rating) && snapshot.rating >= 1 && snapshot.rating <= 5, 'Google rating must be 1–5');
  assert.ok(Number.isInteger(snapshot.count) && snapshot.count > 0, 'Google total must be a positive integer');
  assert.ok(Array.isArray(snapshot.items) && snapshot.items.length > 0 && snapshot.items.length <= snapshot.count, 'Verified reviews need real source quotes');
  const cards = snapshot.items.map(item => {
    assert.equal(item.listingId, snapshot.listingId, 'Do not combine reviews from different listings');
    assert.ok(item.author && item.dateLabel && item.text, 'Review author, displayed date and original words are required');
    assert.ok(Number.isInteger(item.rating) && item.rating >= 1 && item.rating <= 5);
    assert.match(item.language, /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);
    assert.equal(typeof item.excerpt, 'boolean', 'Label excerpts explicitly');
    return `<figure class="review-quote"><figcaption><strong>${esc(item.author)}</strong><span>${item.rating}/5 · ${esc(item.dateLabel)}</span></figcaption><blockquote lang="${esc(item.language)}"><p>${esc(item.text)}</p></blockquote><a href="${esc(googleUrl(item.sourceUrl))}" rel="noopener noreferrer">${esc(t(item.excerpt ? 'reviews.excerpt' : 'reviews.original'))}</a></figure>`;
  }).join('');
  const facts = `${snapshot.rating.toFixed(1)} / 5 · ${snapshot.count} ${esc(t('reviews.count'))}`;
  const stamp = `${esc(t('reviews.observed'))} <time datetime="${snapshot.observedOn}">${snapshot.observedOn}</time>`;
  return {
    summary: `<p class="review-summary"><a href="#google-reviews">${facts}</a><span>${stamp}</span></p>`,
    section: `<section class="reviews-feature" id="google-reviews" aria-labelledby="google-reviews-h"><div class="wrap"><div class="reviews-feature__head"><div><p class="eyebrow">Google</p><h2 class="h2" id="google-reviews-h">${esc(t('reviews.heading'))}</h2><p class="reviews-feature__rating">${facts}</p><p class="small muted">${stamp}</p></div><div class="reviews-feature__actions">${action}<a class="textlink" href="${esc(listingUrl)}" rel="noopener noreferrer">${esc(t('reviews.read'))}</a></div></div><div class="reviews-feature__quotes">${cards}</div></div></section>`,
    footer: action,
  };
}
