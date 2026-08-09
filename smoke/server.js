/**
 * Servidor estático mínimo para las pruebas de humo (Playwright).
 * Sirve la raíz del proyecto en el puerto 8123 — sin dependencias.
 */
'use strict';

const http = require('http');
const { createReadStream, statSync } = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PORT = 8123;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.xml': 'application/xml',
  '.musicxml': 'application/xml',
  '.mxl': 'application/octet-stream',
  '.mid': 'audio/midi',
  '.json': 'application/json',
  '.md': 'text/plain; charset=utf-8',
};

http.createServer((req, res) => {
  try {
    const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const filePath = path.normalize(path.join(ROOT, urlPath));
    if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const st = statSync(filePath);
    if (!st.isFile()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream' });
    createReadStream(filePath).pipe(res);
  } catch (e) {
    res.writeHead(404); res.end();
  }
}).listen(PORT, () => console.log('smoke server en http://localhost:' + PORT));
