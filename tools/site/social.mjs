// Set only after the operator verifies FPC's own profile URL. Empty hides every TikTok slot.
// No embed script is loaded. A specific approved post and permission are separate decisions.
export const TIKTOK_PROFILE_URL = '';
// Empty until the operator confirms the WhatsApp destination recorded in PLAN.md.
// The historical candidate is absent from the current live site and base.
export const WHATSAPP_URL = '';

export function tiktokProfile(value = TIKTOK_PROFILE_URL) {
  if (!value) return '';
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['www.tiktok.com', 'tiktok.com'].includes(url.hostname) ||
      !/^\/@[a-zA-Z0-9._]+\/?$/.test(url.pathname) || url.search || url.hash || url.username || url.password || url.port) {
    throw new Error('TikTok must be a verified HTTPS profile URL, without query parameters');
  }
  return url.href;
}

export function whatsappUrl(value = WHATSAPP_URL) {
  if (!value) return '';
  if (!/^https:\/\/wa\.me\/[1-9]\d{7,14}$/.test(value)) {
    throw new Error('WhatsApp must be an operator-confirmed HTTPS wa.me number');
  }
  return value;
}
