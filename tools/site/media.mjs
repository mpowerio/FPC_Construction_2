import assert from 'node:assert/strict';
import { escapeHtml as esc, localMedia } from './content-utils.mjs';

// Public tree-work media and this exact testimonial were approved by the operator.
// The town/subdivision wording is operator-approved. No Google attribution or street address.
export const TREE_WORK = {
  approvedForPublic: true,
  caption: { en: 'Tree work by FPC Construction', es: 'Trabajo de árboles de FPC Construction' },
  photo: {
    src: '/assets/img/tree-work-photo-800.webp', width: 800, height: 1067,
    srcset: '/assets/img/tree-work-photo-480.webp 480w, /assets/img/tree-work-photo-800.webp 800w, /assets/img/tree-work-photo-1200.webp 1200w',
    avifSrcset: '/assets/img/tree-work-photo-480.avif 480w, /assets/img/tree-work-photo-800.avif 800w, /assets/img/tree-work-photo-1200.avif 1200w',
    alt: { en: 'FPC crew and an excavator working between homes on a tree-work job', es: 'El equipo de FPC y una excavadora trabajando entre casas en un trabajo de árboles' },
  },
  clips: [
    { src: '/assets/video/tree-work-01.mp4', poster: '/assets/img/tree-work-01-poster.webp', width: 1280, height: 720 },
    { src: '/assets/video/tree-work-02.mp4', poster: '/assets/img/tree-work-02-poster.webp', width: 720, height: 1280 },
    { src: '/assets/video/tree-work-03.mp4', poster: '/assets/img/tree-work-03-poster.webp', width: 720, height: 1280 },
  ],
  testimonial: {
    kind: 'customer-testimonial', author: 'Michael Parker', rating: 5,
    date: '2026-11-10', town: 'North Augusta, Foxchase subdivision', language: 'en',
    text: 'Amazing crew, great work so far that my HOA was impressed! Thanks to the great team Filemon has assembled. Quality workmanship and value pricing.',
  },
};

export function renderTreeWork(lang, t, media = TREE_WORK) {
  if (!media.approvedForPublic) return '';
  assert.ok(media.caption.en && media.caption.es, 'Public media needs approved EN/ES captions');
  const photo = media.photo;
  assert.ok(photo?.alt?.en && photo?.alt?.es, 'Public media needs descriptive EN/ES alt text');
  const dimensions = asset => assert.ok(Number.isInteger(asset.width) && asset.width > 0 && Number.isInteger(asset.height) && asset.height > 0, 'Reserve real media geometry');
  dimensions(photo);
  for (const set of [photo.srcset, photo.avifSrcset].filter(Boolean)) {
    for (const entry of set.split(',')) {
      const [src, descriptor, ...extra] = entry.trim().split(/\s+/);
      localMedia(src, 'photo'); assert.match(descriptor, /^[1-9]\d*w$/); assert.equal(extra.length, 0);
    }
  }
  let testimonial = '';
  if (media.testimonial) {
    const review = media.testimonial;
    assert.equal(review.kind, 'customer-testimonial', 'Do not imply unverified Google provenance');
    assert.ok(review.author && review.text); assert.ok(Number.isInteger(review.rating) && review.rating >= 1 && review.rating <= 5);
    assert.match(review.date, /^\d{4}-\d{2}-\d{2}$/);
    assert.match(review.language, /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/);
    testimonial = `<aside class="tree-testimonial quote panel" data-reveal><p><span class="sign">${esc(t('media.testimonial'))}</span></p><p class="tree-testimonial__rating">${review.rating}/5</p><blockquote lang="${esc(review.language)}"><p>${esc(review.text)}</p></blockquote><p class="tree-testimonial__author"><strong>${esc(review.author)}</strong>${review.town ? `<span lang="en">${esc(review.town)}</span>` : ''}<time datetime="${review.date}">${review.date}</time></p><p class="tree-testimonial__disclosure">${esc(t('media.disclosure'))}</p></aside>`;
  }
  const imageTag = `<img src="${localMedia(photo.src, 'photo')}" width="${photo.width}" height="${photo.height}" alt="${esc(photo.alt[lang])}" loading="lazy" decoding="async"${photo.srcset ? ` srcset="${esc(photo.srcset)}" sizes="(min-width: 900px) 55vw, calc(100vw - 40px)"` : ''}>`;
  const image = photo.avifSrcset ? `<picture><source type="image/avif" srcset="${esc(photo.avifSrcset)}" sizes="(min-width: 900px) 55vw, calc(100vw - 40px)">${imageTag}</picture>` : imageTag;
  const clips = media.clips.map(clip => {
    dimensions(clip);
    return `<video controls playsinline preload="none" width="${clip.width}" height="${clip.height}" poster="${localMedia(clip.poster, 'photo')}" aria-label="${esc(media.caption[lang])}"><source src="${localMedia(clip.src, 'video')}" type="video/mp4"><a href="${localMedia(clip.src, 'video')}">${esc(t('media.open'))}</a></video>`;
  }).join('');
  return `<section class="section joint tree-work" aria-labelledby="tree-work-h"><div class="wrap"><div class="section-head"><p class="label">04 / ${esc(t('section.story'))}</p><h2 class="h2" id="tree-work-h">${esc(t('media.heading'))}</h2></div><div class="story tree-work__story"><figure class="story__photo bezel" data-reveal><div class="frame">${image}</div><figcaption>${esc(media.caption[lang])}</figcaption></figure><div class="story__side">${testimonial}<div class="clips" data-reveal>${clips}</div></div></div></div></section>`;
}

// The real build checks these files exist; held media must not trigger any reads.
export function treeMediaFiles(media = TREE_WORK) {
  if (!media.approvedForPublic) return [];
  return [media.photo?.src, ...[media.photo?.srcset, media.photo?.avifSrcset].filter(Boolean).flatMap(set => set.split(',').map(entry => entry.trim().split(/\s+/)[0])), ...media.clips.flatMap(clip => [clip.src, clip.poster])];
}
