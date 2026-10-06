#!/usr/bin/env node
// Development server: serves site/, rebuilds site/data when content/ or scripts/ change,
// live-reloads open pages, and registers quotes copied from the reader (POST /api/quotes).
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { ROOT, loadLibrary } from './lib/content.mjs';
import { makeWorkResolver } from './lib/refs.mjs';
import { QuoteRegistry } from './lib/quotes.mjs';

const PORT = Number(process.env.PORT) || 5180;
const SITE = path.join(ROOT, 'site');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};
const RELOAD = `<script>(() => { const es = new EventSource('api/events'); es.onmessage = e => { if (e.data === 'reload') location.reload(); }; })();</script>`;

const clients = new Set();
const broadcast = msg => { for (const res of clients) res.write(`data: ${msg}\n\n`); };

let building = false, again = false;
function rebuild(reason) {
  if (building) { again = true; return Promise.resolve(); }
  building = true;
  // Each build runs in a fresh process, so edits to the build scripts and their imports always apply.
  return new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(ROOT, 'scripts', 'build.mjs')], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.on('data', d => { out += d; });
    child.stderr.on('data', d => { out += d; });
    child.on('close', code => {
      process.stdout.write(out.split('\n').filter(Boolean).map(l => `${l}\n`).join(''));
      if (code === 0) broadcast('reload');
      else console.log(`  (build failed after ${reason}; fix the errors above)`);
      building = false;
      if (again) { again = false; rebuild('queued change'); }
      resolve();
    });
  });
}

let timer = null;
const schedule = reason => { clearTimeout(timer); timer = setTimeout(() => rebuild(reason), 150); };
for (const dir of ['content', 'scripts']) {
  fs.watch(path.join(ROOT, dir), { recursive: true }, (evt, file) => { if (file && !file.includes('.DS_Store')) schedule(`${dir}/${file}`); });
}
fs.watch(path.join(SITE, 'assets'), { recursive: true }, () => { clearTimeout(timer); timer = setTimeout(() => broadcast('reload'), 80); });

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => { data += c; if (data.length > 1e5) reject(new Error('Body too large')); });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/api/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write('retry: 1000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  if (url.pathname === '/api/quotes' && req.method === 'POST') {
    try {
      const { work, ref, title } = JSON.parse(await readBody(req));
      const registry = new QuoteRegistry(makeWorkResolver(loadLibrary().works));
      const id = registry.register({ work, ref, title });
      registry.save();
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id }));
    } catch (e) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  let rel = decodeURIComponent(url.pathname);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.join(SITE, rel);
  if (!file.startsWith(SITE + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('Not found'); return; }
    const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
    res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(type.startsWith('text/html') ? buf.toString().replace('</body>', `${RELOAD}</body>`) : buf);
  });
});

await rebuild('startup');
server.listen(PORT, '127.0.0.1', () => console.log(`\n  GreekIndexBounty is running at http://localhost:${PORT}\n`));
