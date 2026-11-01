// Kleiner Webserver für das Duke-Nukem-3D-Spiel (Node 22, keine Abhängigkeiten).
// Passwortschutz per HTTP Basic Auth (DUKE_USER / DUKE_PASS), Start nur mit gesetztem Passwort.
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), zlib = require('zlib'), crypto = require('crypto');

const PORT = +process.env.PORT || 8091;
const ROOT = path.resolve(process.env.WEB_DIR || path.join(__dirname, 'web'));
const USER = process.env.DUKE_USER || 'duke';
const PASS = process.env.DUKE_PASS || '';
if (!PASS) { console.error('DUKE_PASS ist nicht gesetzt – der Server startet nicht ohne Passwort.'); process.exit(1); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm',
  '.png': 'image/png', '.json': 'application/json', '.data': 'application/octet-stream' };
const GZIP = new Set(['.html', '.js', '.wasm', '.json']);

const eq = (a, b) => { const x = crypto.createHash('sha256').update(a).digest(), y = crypto.createHash('sha256').update(b).digest(); return crypto.timingSafeEqual(x, y); };
function authorized(req) {
  const m = /^Basic (.+)$/.exec(req.headers.authorization || ''); if (!m) return false;
  const s = Buffer.from(m[1], 'base64').toString(); const i = s.indexOf(':'); if (i < 0) return false;
  return eq(s.slice(0, i), USER) & eq(s.slice(i + 1), PASS) ? true : false;
}

const server = http.createServer((req, res) => {
  const deny = (code, msg, h = {}) => { res.writeHead(code, { 'content-type': 'text/plain; charset=utf-8', ...h }); res.end(msg); };
  if (req.url === '/healthz') return deny(200, 'ok');
  if (!authorized(req)) return deny(401, 'Login erforderlich', { 'www-authenticate': 'Basic realm="Duke", charset="UTF-8"' });
  if (req.method !== 'GET' && req.method !== 'HEAD') return deny(405, 'nur GET');
  let p; try { p = decodeURIComponent(req.url.split('?')[0]); } catch { return deny(400, 'bad url'); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, path.normalize(p));
  if (file !== ROOT && !file.startsWith(ROOT + path.sep)) return deny(403, 'nein');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return deny(404, 'nicht gefunden');
    const ext = path.extname(file).toLowerCase();
    const h = { 'content-type': TYPES[ext] || 'application/octet-stream', 'cache-control': ext === '.html' ? 'no-cache' : 'private, max-age=3600',
      'x-content-type-options': 'nosniff', 'x-robots-tag': 'noindex, nofollow' };
    const gz = GZIP.has(ext) && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (gz) { h['content-encoding'] = 'gzip'; h.vary = 'accept-encoding'; } else h['content-length'] = st.size;
    res.writeHead(200, h);
    if (req.method === 'HEAD') return res.end();
    const rs = fs.createReadStream(file); rs.on('error', () => res.destroy());
    (gz ? rs.pipe(zlib.createGzip({ level: 6 })) : rs).pipe(res);
  });
});
server.listen(PORT, () => console.log(`Duke3D auf Port ${PORT}, Dateien aus ${ROOT}`));
