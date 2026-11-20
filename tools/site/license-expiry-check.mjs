// Scheduled guard for the static site (GitHub Pages serves committed HTML; nothing re-renders on its own).
// Fails 60 days before the license expires, and fails if the committed pages no longer match a fresh
// build (for example after expiry, when the build would drop the line). A red run is the signal to renew
// the license in tools/site/license.mjs and the hand-written pages, or to remove the line and rebuild.
import { CONTRACTOR_LICENSE } from './license.mjs';
const now = new Date(process.env.LICENSE_CHECK_NOW || Date.now());
const expires = new Date(`${CONTRACTOR_LICENSE.expires}T23:59:59Z`);
const days = Math.floor((expires - now) / 86400000);
if (days < 0) { console.error(`License ${CONTRACTOR_LICENSE.number} expired ${-days} day(s) ago: remove or renew the license line now.`); process.exit(1); }
if (days <= 60) { console.error(`License ${CONTRACTOR_LICENSE.number} expires in ${days} day(s) (${CONTRACTOR_LICENSE.expires}): renew it and update tools/site/license.mjs.`); process.exit(1); }
console.log(`License ${CONTRACTOR_LICENSE.number} valid for ${days} more day(s).`);
