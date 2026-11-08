// Set only after the operator verifies FPC's own profile URL. Empty hides every TikTok slot.
// No embed script is loaded. A specific approved post and permission are separate decisions.
export const TIKTOK_PROFILE_URL = '';
// Historical published destination. It differs from the call number; do not normalize it.
export const WHATSAPP_URL = 'https://wa.me/18036402595';

export function tiktokProfile(value = TIKTOK_PROFILE_URL) {
  if (!value) return '';
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['www.tiktok.com', 'tiktok.com'].includes(url.hostname) ||
      !/^\/@[a-zA-Z0-9._]+\/?$/.test(url.pathname) || url.search || url.hash || url.username || url.password || url.port) {
    throw new Error('TikTok must be a verified HTTPS profile URL, without query parameters');
  }
  return url.href;
}
