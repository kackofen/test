// BRASILI game server – plain Node.js (>= 20), no dependencies.
// Serves the 3D game and keeps everything that counts on the server: accounts (nickname + e-mail +
// password), progress (levels, sticker album, bonus levels), the unlock rules (a level opens when the
// one before is finished) and the leaderboard (best or first finished try counts).
// Data lives in one JSON file.
import http from 'node:http';
import { readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, statSync, createReadStream } from 'node:fs';
import { join, extname, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { HALF_SECONDS, LIVES } from '../public/js/shared/levelgen.js';
import { makeContext, blankProgress, clientState, countedOf, startLevel, finishLevel, finishBonus } from '../public/js/shared/rules.js';

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC = join(here, '..', 'public');
const env = (k, d) => process.env[k] ?? d;
const CFG = {
  port: +env('PORT', 8090),
  dataDir: env('DATA_DIR', join(here, '..', 'data')),
  unlockAll: env('UNLOCK_ALL', '0') === '1',      // test phase: every level is open for everybody
  admins: env('ADMIN_EMAILS', '').toLowerCase().split(',').map(s => s.trim()).filter(Boolean),
  inviteCode: env('INVITE_CODE', ''),
  boardKey: env('BOARD_KEY', ''),
  cookieSecure: env('COOKIE_SECURE', 'auto'),     // auto | 1 | 0
  frameAncestors: env('FRAME_ANCESTORS', "'self'"),
  scoreMode: env('SCORE_MODE', 'best') === 'first' ? 'first' : 'best', // best | first finished try counts
  lives: LIVES,
};
mkdirSync(CFG.dataDir, { recursive: true });

// ------------------------------------------------------------------ static data
const readJson = f => JSON.parse(readFileSync(join(PUBLIC, 'data', f), 'utf8'));
const CTX = makeContext({ teams: readJson('teams.json'), squads: readJson('squads.json'), schedule: readJson('schedule.json') });

// ------------------------------------------------------------------ storage
// db.runs (levels of the old pixel version) is kept untouched but no longer used.
const DB_FILE = join(CFG.dataDir, 'db.json');
let db = { users: {}, sessions: {}, progress: {}, secret: crypto.randomBytes(32).toString('hex') };
if (existsSync(DB_FILE)) db = { ...db, ...JSON.parse(readFileSync(DB_FILE, 'utf8')) };
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    writeFileSync(tmp, JSON.stringify(db));
    renameSync(tmp, DB_FILE);
  }, 150);
}
save();

// ------------------------------------------------------------------ helpers
const id = (n = 16) => crypto.randomBytes(n).toString('hex');
const hashPw = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => e ? rej(e) : res(k.toString('hex'))));
const userByEmail = email => Object.values(db.users).find(u => u.email === email);
const userByNick = nick => Object.values(db.users).find(u => u.nickname.toLowerCase() === nick.toLowerCase());
const isAdmin = u => CFG.admins.includes(u.email);
const getProgress = uid => db.progress[uid] ||= blankProgress();
// the test switch "unlock all": on for everybody via UNLOCK_ALL, or per admin via the map button
const unlockAllFor = u => CFG.unlockAll || (isAdmin(u) && !!u.testUnlock);
const stateFor = u => ({ state: clientState(getProgress(u.id), CFG.scoreMode, unlockAllFor(u)), canToggleUnlock: isAdmin(u) && !CFG.unlockAll });

const attempts = new Map(); // rate limiting for login/register
function limited(key, max = 10, windowMs = 10 * 60 * 1000) {
  const t = Date.now(), a = (attempts.get(key) || []).filter(x => t - x < windowMs);
  a.push(t); attempts.set(key, a);
  return a.length > max;
}

function send(res, code, body, headers = {}) {
  const data = typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(code, { 'Content-Type': typeof body === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(data);
}
const fail = (res, code, msg) => send(res, code, { error: msg });
async function readBody(req) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > 64 * 1024) throw new Error('too large'); chunks.push(c); }
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').map(s => s.trim().split('=')).filter(x => x[0]).map(([k, ...v]) => [k, decodeURIComponent(v.join('='))])); }
function secure(req) { return CFG.cookieSecure === '1' || (CFG.cookieSecure === 'auto' && (req.headers['x-forwarded-proto'] === 'https' || req.socket.encrypted)); }
function setSession(req, res, uid) {
  const token = id(32);
  db.sessions[token] = { uid, created: Date.now(), seen: Date.now() };
  save();
  res.setHeader('Set-Cookie', `brasili_sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 24 * 3600}${secure(req) ? '; Secure' : ''}`);
}
function currentUser(req) {
  const t = cookies(req).brasili_sid;
  const s = t && db.sessions[t];
  if (!s) return null;
  if (Date.now() - s.seen > 3600 * 1000) { s.seen = Date.now(); save(); }
  return db.users[s.uid] || null;
}
const publicUser = u => ({ nickname: u.nickname, look: u.look || null, admin: isAdmin(u) });

const LOOK_KEYS = { hairStyle: /^(ponytail|bun|short|braids|afro)$/, hair: /^#[0-9a-f]{6}$/i, skin: /^#[0-9a-f]{6}$/i, boots: /^#[0-9a-f]{6}$/i };
function cleanLook(l = {}) {
  const out = {};
  for (const [k, re] of Object.entries(LOOK_KEYS)) if (typeof l[k] === 'string' && re.test(l[k])) out[k] = l[k];
  const n = parseInt(l.number); if (n >= 1 && n <= 99) out.number = n;
  if (l.kit && typeof l.kit === 'object') { const kit = {}; for (const k of ['shirt', 'shorts', 'socks']) if (/^#[0-9a-f]{6}$/i.test(l.kit[k] || '')) kit[k] = l.kit[k]; if (Object.keys(kit).length === 3) out.kit = kit; }
  return out;
}

// rows of the leaderboard: one level (best/first try) or everything (levels + bonus levels)
function leaderboard(matchId) {
  const rows = [];
  for (const [uid, ps] of Object.entries(db.progress)) {
    const u = db.users[uid]; if (!u) continue;
    if (matchId) {
      const lv = ps.levels[matchId];
      if (!lv?.done) continue;
      const c = countedOf(lv, CFG.scoreMode);
      rows.push({ nickname: u.nickname, points: c.score, goal: c.goal, side: lv.side, attempts: lv.tries });
    } else {
      const a = { nickname: u.nickname, points: 0, goals: 0, levels: 0 };
      for (const lv of Object.values(ps.levels)) if (lv.done) { const c = countedOf(lv, CFG.scoreMode); a.points += c.score; a.goals += c.goal ? 1 : 0; a.levels++; }
      for (const b of Object.values(ps.bonus)) a.points += b.best || 0;
      if (a.levels > 0 || a.points > 0) rows.push(a);
    }
  }
  rows.sort((a, b) => b.points - a.points || (b.goals || 0) - (a.goals || 0) || a.nickname.localeCompare(b.nickname));
  let rank = 0, prev = null;
  rows.forEach((r, i) => { if (r.points !== prev) rank = i + 1; r.rank = rank; prev = r.points; });
  return rows;
}

// ------------------------------------------------------------------ API
const routes = {
  'GET /api/config': async (req, res) => send(res, 200, { invite: !!CFG.inviteCode, halfSeconds: HALF_SECONDS, lives: CFG.lives, scoreMode: CFG.scoreMode, unlockAll: CFG.unlockAll }),

  'POST /api/register': async (req, res) => {
    if (limited('reg:' + req.socket.remoteAddress, 8)) return fail(res, 429, 'Too many attempts – try again in a few minutes.');
    const b = await readBody(req);
    const nickname = String(b.nickname || '').trim(), email = String(b.email || '').trim().toLowerCase(), password = String(b.password || '');
    if (CFG.inviteCode && b.invite !== CFG.inviteCode) return fail(res, 403, 'Invalid team code.');
    if (!/^[\p{L}\p{N} _.\-]{2,20}$/u.test(nickname)) return fail(res, 400, 'Nickname: 2–20 letters, numbers, spaces, - _ .');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 120) return fail(res, 400, 'Please enter a valid e-mail address.');
    if (password.length < 8 || password.length > 200) return fail(res, 400, 'Password: at least 8 characters.');
    if (userByEmail(email)) return fail(res, 409, 'This e-mail is already registered.');
    if (userByNick(nickname)) return fail(res, 409, 'This nickname is taken.');
    const salt = id(16), uid = id(8);
    db.users[uid] = { id: uid, nickname, email, salt, hash: await hashPw(password, salt), created: Date.now(), look: null };
    setSession(req, res, uid);
    send(res, 200, { user: publicUser(db.users[uid]) });
  },
  'POST /api/login': async (req, res) => {
    const b = await readBody(req);
    const email = String(b.email || '').trim().toLowerCase();
    if (limited('login:' + req.socket.remoteAddress + ':' + email)) return fail(res, 429, 'Too many attempts – try again in a few minutes.');
    const u = userByEmail(email);
    const hash = await hashPw(String(b.password || ''), u ? u.salt : 'x'.repeat(32));
    if (!u || !crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(u.hash, 'hex'))) return fail(res, 401, 'E-mail or password is wrong.');
    setSession(req, res, u.id);
    send(res, 200, { user: publicUser(u) });
  },
  'POST /api/logout': async (req, res) => {
    const t = cookies(req).brasili_sid; if (t) { delete db.sessions[t]; save(); }
    res.setHeader('Set-Cookie', 'brasili_sid=; Path=/; Max-Age=0');
    send(res, 200, { ok: true });
  },
  'GET /api/me': async (req, res, u) => send(res, 200, { user: publicUser(u) }),
  'POST /api/profile': async (req, res, u) => { const b = await readBody(req); u.look = cleanLook(b.look); save(); send(res, 200, { user: publicUser(u) }); },

  // everything the game needs to draw the map: levels, album, bonus levels
  'GET /api/state': async (req, res, u) => send(res, 200, stateFor(u)),
  'POST /api/at': async (req, res, u) => {
    const b = await readBody(req), m = CTX.matches.get(+b.matchId);
    if (m) { getProgress(u.id).at = m.id; save(); }
    send(res, 200, { ok: !!m });
  },
  // test switch for admins: open every level for this account
  'POST /api/unlock': async (req, res, u) => {
    if (!isAdmin(u) || CFG.unlockAll) return fail(res, 403, 'Admins only.');
    const b = await readBody(req); u.testUnlock = !!b.on; save();
    send(res, 200, stateFor(u));
  },

  // a new try: always allowed once the level is open (3 lives per try are handled in the game)
  'POST /api/run/start': async (req, res, u) => {
    const b = await readBody(req), ps = getProgress(u.id), mid = +b.matchId;
    const r = startLevel(ps, CTX, mid, b.side, unlockAllFor(u));
    if (r.error) return fail(res, ...r.error);
    const token = id(16);
    (ps.active ||= {})[mid] = { token, started: Date.now() };
    save();
    send(res, 200, { token, attempt: r.tries, lives: CFG.lives, ...stateFor(u) });
  },
  'POST /api/run/finish': async (req, res, u) => {
    const b = await readBody(req), ps = getProgress(u.id), mid = +b.matchId, act = ps.active?.[mid];
    if (!CTX.matches.has(mid)) return fail(res, 404, 'Unknown match.');
    if (!act || act.token !== b.token) return fail(res, 409, 'This try is no longer active – a newer one was started.');
    // a try always runs from kick-off; restarts at checkpoints only add time
    const r = finishLevel(ps, CTX, mid, b.result, b.album, (Date.now() - act.started) / 1000);
    if (r.error) return fail(res, ...r.error);
    delete ps.active[mid]; save();
    send(res, 200, { ...r, scoreMode: CFG.scoreMode, ...stateFor(u) });
  },
  'POST /api/bonus/finish': async (req, res, u) => {
    const b = await readBody(req), r = finishBonus(getProgress(u.id), CTX, String(b.key), b.hits, unlockAllFor(u));
    if (r.error) return fail(res, ...r.error);
    save(); send(res, 200, { ...r, ...stateFor(u) });
  },

  'GET /api/leaderboard': async (req, res, u) => {
    const q = new URL(req.url, 'http://x').searchParams;
    const mid = q.get('match') ? +q.get('match') : null;
    const rows = leaderboard(mid);
    send(res, 200, { match: mid, rows: rows.slice(0, 300), me: rows.find(r => r.nickname === u.nickname) || null, players: Object.keys(db.users).length });
  },

  // admin
  'GET /api/admin/users': async (req, res, u) => {
    if (!isAdmin(u)) return fail(res, 403, 'Admins only.');
    const totals = Object.fromEntries(leaderboard(null).map(r => [r.nickname, r.points]));
    send(res, 200, { users: Object.values(db.users).map(x => ({ nickname: x.nickname, email: x.email, created: x.created, points: totals[x.nickname] || 0 })) });
  },
  'POST /api/admin/reset': async (req, res, u) => {
    if (!isAdmin(u)) return fail(res, 403, 'Admins only.');
    const b = await readBody(req);
    const target = b.nickname ? userByNick(String(b.nickname)) : null;
    if (b.nickname && !target) return fail(res, 404, 'Unknown nickname.');
    let n = 0;
    for (const [uid, ps] of Object.entries(db.progress)) {
      if (target && uid !== target.id) continue;
      if (b.matchId) { if (ps.levels[+b.matchId]) { delete ps.levels[+b.matchId]; n++; } }
      else { n += Object.keys(ps.levels).length + Object.keys(ps.bonus).length; db.progress[uid] = blankProgress(); }
    }
    save(); send(res, 200, { reset: n });
  },
};
// public read-only summary for the dashboard (needs ?key=BOARD_KEY when set)
function boardData() {
  const overall = leaderboard(null).slice(0, 10);
  let latest = null, at = 0; // the level that was finished last
  for (const ps of Object.values(db.progress)) for (const [mid, lv] of Object.entries(ps.levels)) if (lv.done && (lv.lastAt || 0) > at) { at = lv.lastAt; latest = +mid; }
  return { updated: new Date().toISOString(), players: Object.keys(db.users).length, overall, latest: latest ? { match: CTX.matches.get(latest), rows: leaderboard(latest).slice(0, 5) } : null };
}

// ------------------------------------------------------------------ static files
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
function serveStatic(req, res, path) {
  if (path === '/' || path === '') path = '/index.html';
  const file = normalize(join(PUBLIC, decodeURIComponent(path)));
  if (!file.startsWith(PUBLIC) || /\/dev-|\/devimg\//.test(file)) return send(res, 404, 'Not found');
  let st; try { st = statSync(file); } catch { return send(res, 404, 'Not found'); }
  if (st.isDirectory()) return serveStatic(req, res, path.replace(/\/?$/, '/index.html'));
  const ext = extname(file);
  const cache = ext === '.html' || ext === '.json' ? 'no-cache' : (/(fonts|img)\//.test(file) ? 'public, max-age=604800' : 'no-cache');
  res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': cache });
  createReadStream(file).pipe(res);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'same-origin');
  try {
    const url = new URL(req.url, 'http://x');
    const path = url.pathname;
    if (path === '/api/board') {
      if (CFG.boardKey && url.searchParams.get('key') !== CFG.boardKey) return fail(res, 403, 'Wrong key.');
      return send(res, 200, boardData(), { 'Access-Control-Allow-Origin': '*' });
    }
    if (path.startsWith('/api/')) {
      const route = routes[`${req.method} ${path}`];
      if (!route) return fail(res, 404, 'Not found');
      const open = ['GET /api/config', 'POST /api/register', 'POST /api/login', 'POST /api/logout'].includes(`${req.method} ${path}`);
      const u = currentUser(req);
      if (!open && !u) return fail(res, 401, 'Please log in.');
      if (req.method === 'POST' && req.headers['content-type']?.includes('application/json') !== true && path !== '/api/logout') return fail(res, 415, 'JSON expected.');
      return await route(req, res, u);
    }
    if (path === '/proto3d.html') { res.writeHead(302, { Location: './' }); return res.end(); } // the old address of the 3D prototype
    res.setHeader('Content-Security-Policy', `frame-ancestors ${path.startsWith('/board') ? CFG.frameAncestors : "'self'"}`);
    return serveStatic(req, res, path);
  } catch (e) {
    console.error(e);
    if (!res.headersSent) fail(res, 500, 'Server error.');
  }
});
server.listen(CFG.port, () => console.log(`BRASILI running on :${CFG.port} (unlock all: ${CFG.unlockAll}, data: ${CFG.dataDir})`));
