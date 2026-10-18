// Local preview server that resolves paths the way GitHub Pages does:
//   /            -> index.html        /es/estimado/ -> es/estimado/index.html
//   /privacy     -> privacy.html      /estimate     -> 301 /estimate/
// Text responses are gzipped (as GitHub Pages does) so local Lighthouse numbers are comparable.
// Usage: node tools/site/serve.mjs [port]   (default 8080). Never use it in production.
import { createServer } from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const port = Number(process.argv[2] || process.env.PORT || 8080);
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json',
  '.xml': 'application/xml', '.txt': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };
const isFile = async (p) => { try { return (await stat(p)).isFile(); } catch { return false; } };
const isDir = async (p) => { try { return (await stat(p)).isDirectory(); } catch { return false; } };

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const rel = normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  const base = join(root, rel);
  if (!base.startsWith(root) || rel.includes('/.git')) { res.writeHead(403).end(); return; }
  let file = null;
  if (rel.endsWith('/')) { if (await isFile(join(base, 'index.html'))) file = join(base, 'index.html'); }
  else if (await isFile(base)) file = base;
  else if (await isDir(base) && await isFile(join(base, 'index.html'))) { res.writeHead(301, { Location: url.pathname + '/' + url.search }).end(); return; }
  else if (await isFile(base + '.html')) file = base + '.html';
  if (!file) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404'); return; }
  let body = await readFile(file);
  const headers = { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', Vary: 'Accept-Encoding' };
  // GitHub Pages gzips text responses; do the same so local Lighthouse runs are comparable.
  if (/\.(html|css|js|json|xml|svg|txt)$/.test(file) && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    body = gzipSync(body, { level: 9 }); headers['Content-Encoding'] = 'gzip';
  }
  res.writeHead(200, headers);
  res.end(body);
}).listen(port, () => console.log(`serving ${root} on http://localhost:${port}`));
