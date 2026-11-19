// Local preview of dist/ with the same clean URLs the host serves. Run: node tools/preview.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.webp': 'image/webp', '.avif': 'image/avif', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf' };
const port = Number(process.env.PORT || 4173);
createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path.includes('..')) { res.writeHead(400).end(); return; }
  const tries = path === '/' ? ['/index.html'] : extname(path) ? [path] : [path + '.html', path + '/index.html'];
  for (const t of tries) {
    try {
      const buf = await readFile(join(dist, t));
      res.writeHead(200, { 'Content-Type': types[extname(t)] || 'application/octet-stream' }).end(buf);
      return;
    } catch { /* try next */ }
  }
  res.writeHead(404, { 'Content-Type': types['.html'] }).end(await readFile(join(dist, '404.html')));
}).listen(port, () => console.log(`Preview at http://localhost:${port}`));
