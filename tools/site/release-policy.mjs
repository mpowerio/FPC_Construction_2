// Shared by the default SEO command and CI. Draft mode never permits old public tags.
export function releaseProblems(html, { allowDraft = false } = {}) {
  const body = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
  const text = body.replace(/<[^>]+>/g, ' ').replace(/&#(?:x([a-f0-9]+)|(\d+));/gi, (_, h, d) => String.fromCodePoint(parseInt(h || d, h ? 16 : 10))).replace(/\s+/g, ' ');
  const problems = [];
  for (const tag of body.matchAll(/<[a-z][^>]*>/gi)) {
    const value = tag[0].match(/\bclass\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    if ((value?.slice(1).find(v => v !== undefined) || '').split(/\s+/).some(c => ['ph', 'reviews__ph'].includes(c))) problems.push('unfinished public caption or reviews box');
  }
  if (/Placeholder\s*:|Pendiente\s*:|Real Google reviews go here|reseñas reales de Google van aquí/i.test(text)) problems.push('removed internal placeholder copy');
  if (!allowDraft && (/data-release-pending\b/i.test(body) || /Headline pending approval|Titular pendiente de aprobación|Project examples pending verification|Ejemplos de proyectos pendientes de verificación/i.test(text))) problems.push('unapproved headline or public-project slot: release held');
  return [...new Set(problems)];
}
