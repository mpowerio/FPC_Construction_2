// Set only after the operator verifies FPC's own profile URL. Empty hides every TikTok slot.
// No embed script is loaded. A specific approved post and permission are separate decisions.
export const TIKTOK_PROFILE_URL = '';
// Set only after the operator verifies FPC's own YouTube channel URL (operator 2026-11-13: "add tik tok ... and youtube").
// Empty hides every YouTube slot. No embed script is loaded.
export const YOUTUBE_CHANNEL_URL = '';
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

export function youtubeChannel(value = YOUTUBE_CHANNEL_URL) {
  if (!value) return '';
  const url = new URL(value);
  if (url.protocol !== 'https:' || !['www.youtube.com', 'youtube.com'].includes(url.hostname) ||
      !/^\/(@[a-zA-Z0-9._-]+|channel\/UC[a-zA-Z0-9_-]{22})\/?$/.test(url.pathname) || url.search || url.hash || url.username || url.password || url.port) {
    throw new Error('YouTube must be a verified HTTPS channel URL (/@handle or /channel/UC...), without query parameters');
  }
  return url.href;
}
