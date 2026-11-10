import assert from 'node:assert/strict';
import { escapeHtml as esc, localMedia } from './content-utils.mjs';

// No private file paths, previews or captions in public source. The operator must
// approve public use and the exact EN/ES caption before any assets are committed.
export const TREE_WORK = {
  approvedForPublic: false,
  caption: { en: '', es: '' },
  photo: null, // { src, width, height, alt: { en, es } }, stripped of EXIF/GPS
  clips: [], // { src, poster, width, height }; silent MP4 derivatives only
};

export function renderTreeWork(lang, t, media = TREE_WORK) {
  if (!media.approvedForPublic) return '';
  assert.ok(media.caption.en && media.caption.es, 'Public media needs approved EN/ES captions');
  const photo = media.photo;
  assert.ok(photo?.alt?.en && photo?.alt?.es, 'Public media needs descriptive EN/ES alt text');
  const dimensions = asset => assert.ok(Number.isInteger(asset.width) && asset.width > 0 && Number.isInteger(asset.height) && asset.height > 0, 'Reserve real media geometry');
  dimensions(photo);
  const image = `<img src="${localMedia(photo.src, 'photo')}" width="${photo.width}" height="${photo.height}" alt="${esc(photo.alt[lang])}" loading="lazy" decoding="async">`;
  const clips = media.clips.map(clip => {
    dimensions(clip);
    return `<video controls playsinline preload="none" width="${clip.width}" height="${clip.height}" poster="${localMedia(clip.poster, 'photo')}" aria-label="${esc(media.caption[lang])}"><source src="${localMedia(clip.src, 'video')}" type="video/mp4"><a href="${localMedia(clip.src, 'video')}">${esc(t('media.open'))}</a></video>`;
  }).join('');
  return `<section class="tree-work" aria-labelledby="tree-work-h"><div class="wrap"><p class="eyebrow">FPC Construction</p><h2 class="h2" id="tree-work-h">${esc(t('media.heading'))}</h2><figure>${image}<figcaption>${esc(media.caption[lang])}</figcaption></figure><div class="tree-work__clips">${clips}</div></div></section>`;
}

// The real build checks these files exist; held media must not trigger any reads.
export function treeMediaFiles(media = TREE_WORK) {
  if (!media.approvedForPublic) return [];
  return [media.photo?.src, ...media.clips.flatMap(clip => [clip.src, clip.poster])];
}
