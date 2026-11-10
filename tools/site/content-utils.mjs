export const escapeHtml = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);

export function googleUrl(value) {
  const url = new URL(value);
  const allowed = ['google.com', 'www.google.com', 'maps.google.com', 'search.google.com', 'maps.app.goo.gl', 'g.page'];
  if (url.protocol !== 'https:' || !allowed.includes(url.hostname) || url.username || url.password || url.port) throw new Error('Expected a verified HTTPS Google URL');
  return url.href;
}

export function localMedia(value, kind) {
  const pattern = kind === 'photo' ? /^\/assets\/img\/[a-z0-9-]+\.(webp|avif)$/ : /^\/assets\/video\/[a-z0-9-]+\.mp4$/;
  if (!pattern.test(value)) throw new Error('Expected a generic local media asset path');
  return value;
}
