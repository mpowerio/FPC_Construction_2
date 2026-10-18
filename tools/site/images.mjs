// Image pipeline for the "Bench Cut" pages (phase 1).
//
//   node tools/site/images.mjs            regenerate everything under assets/img/
//
// Needs ImageMagick 7-compatible `convert` with AVIF + WebP write support
// (`convert -list format | grep -E 'AVIF|WEBP'`). Outputs are committed, so the
// site itself has no build step at deploy time (GitHub Pages serves files as-is).
//
// - Job photos: one consistent grade (saturation x0.93, sigmoidal contrast 2.2),
//   EXIF/GPS stripped, AVIF + WebP at 480/800/1200 (capped at source width).
// - Logo: resolution upgrade only. The brand-pack trace (geometry verified against
//   assets/images/logo.png by bounding-box overlay) is trimmed of transparent margin
//   and resized. Never recolored or redrawn.
// - Favicons: the brand-pack excavator mark on a white tile (charcoal vanishes on
//   dark tab bars, per the brand pack's background rule).
// - Open Graph: 1200x630 crop of the hero photo with the logo on a white plate.
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const out = join(root, 'assets', 'img');
const brand = process.env.FPC_BRAND_PACK || join(homedir(), 'projects', 'brand-packs-2026-07-18', 'fpc');
const tmp = mkdtempSync(join(tmpdir(), 'fpc-img-'));
mkdirSync(out, { recursive: true });

const im = (...args) => execFileSync('convert', args, { stdio: ['ignore', 'ignore', 'inherit'] });
const size = (f) => execFileSync('identify', ['-format', '%w %h', f]).toString().split(' ').map(Number);

// ---------- Job photos ----------
// Photos used on home + estimate (ids = files in assets/images/projects/).
const PHOTOS = ['gallery-19', 'gallery-12', 'gallery-9', 'gallery-3', 'gallery-8', 'project-1', 'gallery-7', 'project-5', 'gallery-15', 'gallery-14'];
const WIDTHS = [480, 800, 1200];
for (const id of PHOTOS) {
  const src = join(root, 'assets', 'images', 'projects', `${id}.jpg`);
  const graded = join(tmp, `${id}.png`);
  im(src, '-auto-orient', '-strip', '-modulate', '100,93,100', '-sigmoidal-contrast', '2.2x50%', graded);
  const [w] = size(graded);
  for (const width of WIDTHS.filter((x) => x <= w)) {
    im(graded, '-resize', `${width}x`, '-strip', '-quality', '62', '-define', 'webp:method=6', join(out, `${id}-${width}.webp`));
    im(graded, '-resize', `${width}x`, '-strip', '-quality', '52', join(out, `${id}-${width}.avif`));
  }
}

// ---------- Logo (resolution upgrade of the frozen geometry) ----------
const lockup = join(brand, 'png', 'lockup-2400.png');
if (!existsSync(lockup)) throw new Error(`brand pack not found at ${brand} (set FPC_BRAND_PACK)`);
const trimmed = join(tmp, 'lockup-trim.png');
im(lockup, '-trim', '+repage', trimmed);
for (const w of [176, 264]) im(trimmed, '-resize', `${w}x`, '-strip', '-define', 'webp:lossless=false', '-quality', '92', '-define', 'webp:alpha-quality=100', join(out, `logo-${w}.webp`));
im(trimmed, '-resize', '600x', '-background', 'white', '-alpha', 'remove', '-alpha', 'off', '-strip', join(out, 'logo-600.png'));

// ---------- Favicons (excavator mark on a white tile) ----------
const mark = join(brand, 'png', 'mark-1024.png');
const tile = (px, padPct, file, extra = []) => {
  const inner = Math.round(px * (1 - padPct * 2));
  im('-size', `${px}x${px}`, 'xc:white', '(', mark, '-trim', '+repage', '-resize', `${inner}x${inner}`, ')', '-gravity', 'center', '-composite', '-strip', ...extra, file);
};
tile(32, 0.06, join(out, 'favicon-32.png'));
tile(180, 0.12, join(out, 'apple-touch-icon.png'));
tile(512, 0.12, join(out, 'icon-512.png'));
const icoParts = [16, 32, 48].map((px) => { const f = join(tmp, `ico-${px}.png`); tile(px, px === 16 ? 0.02 : 0.06, f); return f; });
im(...icoParts, join(root, 'favicon.ico'));
// The legacy pages (privacy/terms/sms-opt-in) link /assets/images/favicon.png, which was a
// text placeholder. Replacing the file gives them a real favicon without editing them.
tile(64, 0.06, join(root, 'assets', 'images', 'favicon.png'));
// SVG favicon: the brand-pack mark, untouched paths, with a white tile behind it and a
// square viewBox. Only the wrapper changes.
const markSvg = readFileSync(join(brand, 'svg', 'logo-mark.svg'), 'utf8');
const vb = markSvg.match(/viewBox="([\d.\s-]+)"/)[1].trim().split(/\s+/).map(Number);
const side = Math.max(vb[2], vb[3]) * 1.12;
const cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2;
const sq = [cx - side / 2, cy - side / 2, side, side].map((n) => Math.round(n));
const body = markSvg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '').replace(/<!--[\s\S]*?-->/g, '');
writeFileSync(join(out, 'favicon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${sq.join(' ')}"><rect x="${sq[0]}" y="${sq[1]}" width="${sq[2]}" height="${sq[3]}" rx="${Math.round(side * 0.18)}" fill="#fff"/>${body.trim()}</svg>\n`);

// ---------- Open Graph image ----------
const og = join(tmp, 'og-base.png');
im(join(root, 'assets', 'images', 'projects', 'gallery-19.jpg'), '-strip', '-modulate', '100,93,100', '-sigmoidal-contrast', '2.2x50%',
  '-gravity', 'NorthWest', '-crop', '1200x630+0+150', '+repage', og);
const plate = join(tmp, 'og-plate.png');
im('-size', '332x216', 'xc:none', '-fill', 'white', '-draw', 'roundrectangle 0,0 331,215 18,18',
  '(', trimmed, '-resize', '292x', ')', '-gravity', 'center', '-composite', plate);
im(og, plate, '-gravity', 'NorthWest', '-geometry', '+40+40', '-composite', '-strip', '-quality', '82', join(out, 'og-1200x630.jpg'));

rmSync(tmp, { recursive: true, force: true });
console.log('images written to assets/img/');
