// BRASILI 3D: login -> world map -> team pick -> stadium intro -> level -> result -> map,
// plus the bonus level, the sticker album and the leaderboard. Progress, album, bonus levels and
// scores live on the server (api3d.js); the browser only plays and reports.
/* global THREE */
import { Game3D } from './game3d.js';
import { WorldMap } from './map3d.js';
import { GoalWall } from './bonus3d.js';
import { openAlbum, albumTotal } from './album.js';
import { openBoard } from './board3d.js';
import { createApi } from './api3d.js';
import { buildWorlds, levelOpen, bonusOpen, albumCount, totalScore } from './progress.js';
import { playIntro, prepareVenue } from '../game/intro.js';
import { LIVES } from '../shared/levelgen.js';
import { finaleKind, FINALE_LABEL } from '../shared/finale.js';
import { DEFAULT_LOOK } from '../game/sprites.js';
import { flagDataUrl } from '../ui/flags.js';
import { ITEM_NAME, world3d } from './themes3d.js';

const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const A = { data: null, worlds: null, api: null, user: null, cfg: null, canToggleUnlock: false, st: { levels: {}, album: {}, bonus: {}, at: null, unlockAll: false }, run: null, renderer: null, map: null, game: null, bonus: null, introSeen: new Set() };
window.BRASILI3D = A; // handy for testing

async function boot() {
  const names = ['teams', 'squads', 'schedule', 'venues'];
  const vals = window.BRASILI_DATA ? names.map(n => window.BRASILI_DATA[n]) : await Promise.all(names.map(n => fetch(`data/${n}.json`).then(r => r.json())));
  A.data = Object.fromEntries(names.map((n, i) => [n, vals[i]]));
  await Promise.all([document.fonts.load('24px "Bangers"'), document.fonts.load('10px "Press Start 2P"')]).catch(() => {});
  A.worlds = buildWorlds(A.data);
  A.api = await createApi(A.data);
  A.cfg = await A.api.config();
  try { A.user = (await A.api.me()).user; } catch (e) { if (e.status !== 401) return fatal(e); A.user = await authScreen(); }
  try { await loadState(); } catch (e) { return fatal(e); }
  const R = A.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75)); R.outputColorSpace = THREE.SRGBColorSpace;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  A.map = new WorldMap($('#mapview'), {
    renderer: R, data: A.data, worlds: A.worlds, progress: A.st, look: DEFAULT_LOOK,
    score: () => totalScore(A.st), albumCount: () => albumCount(A.st), albumTotal: () => albumTotal(A.data, A.worlds),
    onEnter: n => n.type === 'bonus' ? playBonus(n) : pickTeam(n),
    onAlbum: () => showAlbum(), onBoard: () => showBoard(), onMoved: () => A.api.setAt(A.st.at),
    canToggleUnlock: () => A.canToggleUnlock,
    onToggleUnlock: async () => { try { applyState(await A.api.setUnlock(!A.st.unlockAll)); A.map.refresh(); } catch (e) { toast(e.message); } },
  });
  showMap();
  titleCard();
}

// the progress object is shared with the map, so new server state is copied in, not swapped
function applyState(r) {
  if (r.canToggleUnlock != null) A.canToggleUnlock = r.canToggleUnlock;
  for (const k of Object.keys(A.st)) delete A.st[k];
  Object.assign(A.st, r.state);
}
async function loadState() { applyState(await A.api.state()); }
function fatal(e) { ui(card('Oops', `<p>${esc(e.message)}</p>`, [['Reload', 'reload']])); bind({ reload: () => location.reload() }); }
function toast(msg) { const t = document.createElement('div'); t.className = 'skip'; t.textContent = msg; $('.screen').appendChild(t); setTimeout(() => t.remove(), 3500); }

// ------------------------------------------------------------------ login
function authScreen() {
  return new Promise(resolve => {
    let reg = false, busy = false;
    const draw = (err = '') => {
      ui(`<div class="veil"><div class="card"><h2>BRASILI <span>${reg ? 'SIGN UP' : 'LOG IN'}</span></h2>
        <p class="kicker">Women's World Cup 2027 · team game</p>
        <form id="auth" autocomplete="on">
          ${reg ? '<label>Nickname<input name="nickname" maxlength="20" autocomplete="nickname" required></label>' : ''}
          <label>E-mail<input name="email" type="email" autocomplete="email" required></label>
          <label>Password${reg ? ' (min. 8 characters)' : ''}<input name="password" type="password" minlength="${reg ? 8 : 1}" autocomplete="${reg ? 'new-password' : 'current-password'}" required></label>
          ${reg && A.cfg.invite ? '<label>Team code<input name="invite" autocomplete="off" required></label>' : ''}
          <p class="err" role="alert">${esc(err)}</p>
          <div class="actions"><button class="btn" type="submit">${reg ? 'Sign up' : 'Log in'}</button></div>
        </form>
        <p class="note">${reg ? 'Already signed up?' : 'First time here?'} <button class="link" type="button" id="swap">${reg ? 'Log in' : 'Sign up'}</button></p></div></div>`);
      $('#swap').onclick = () => { reg = !reg; draw(); };
      $('#auth input').focus();
      $('#auth').onsubmit = async e => {
        e.preventDefault(); if (busy) return; busy = true;
        const f = Object.fromEntries(new FormData(e.target));
        try { const r = reg ? await A.api.register(f.nickname, f.email, f.password, f.invite) : await A.api.login(f.email, f.password); ui(''); resolve(r.user); }
        catch (x) { busy = false; draw(x.message); }
      };
    };
    draw();
  });
}

function ui(html) { $('#ui').innerHTML = html; }
function card(title, body, actions, cls = '') {
  return `<div class="veil ${cls}"><div class="card">${title ? `<h2>${title}</h2>` : ''}${body}<div class="actions">${actions.map(([t, k, c]) => `<button class="btn ${c || ''}" data-a="${k}">${t}</button>`).join('')}</div></div></div>`;
}
function bind(map) { document.querySelectorAll('#ui [data-a]').forEach(b => b.onclick = () => map[b.dataset.a]?.()); $('#ui [data-a]')?.focus(); }
function view(which) { for (const id of ['mapview', 'gameview']) $('#' + id).hidden = id !== which; }

// ------------------------------------------------------------------ map
function showMap(celebrate) {
  view('mapview');
  A.map.refresh(); A.map.inputOff = false; A.map.start();
  mapTouch();
  if (celebrate) A.map.celebrate(celebrate);
}
function titleCard() {
  A.map.inputOff = true;
  const done = Object.values(A.st.levels).filter(l => l.done).length;
  ui(card('BRASILI <span>3D</span>', `
    <p class="kicker">Hi ${esc(A.user.nickname)} · Women's World Cup 2027 · Teams = 2023 placeholders</p>
    <p>Nine worlds: Group A to H and the knockouts. Walk from match to match – every level you finish opens the next one. Group A is playable: New Zealand, Norway, the Philippines and Switzerland, each with its own world, and three different finales.</p>
    <div class="keys"><span><kbd>←</kbd><kbd>→</kbd> walk / run</span><span><kbd>Shift</kbd> sprint</span><span><kbd>Space</kbd> play · jump · shoot</span><span><kbd>A</kbd> album</span><span><kbd>L</kbd> top list</span><span><kbd>Esc</kbd> pause</span></div>
    <p class="rules">${LIVES} lives per try · back to the last checkpoint when you lose one · unlimited tries · best score counts</p>`,
  [[done ? 'Continue' : 'Start', 'go'], ...(A.api.local ? [] : [['Log out', 'logout', 'ghost']])], 'title'));
  bind({ go: () => { ui(''); A.map.inputOff = false; }, logout: async () => { await A.api.logout().catch(() => {}); location.reload(); } });
}
function showBoard() {
  A.map.inputOff = true;
  openBoard($('#ui'), { api: A.api, data: A.data, user: A.user, onClose: () => { A.map.inputOff = false; } });
}
function showAlbum(focus) {
  A.map.inputOff = true;
  openAlbum($('#ui'), { data: A.data, worlds: A.worlds, progress: A.st, focus, onClose: () => { A.map.inputOff = false; } });
}

// ------------------------------------------------------------------ level
function pickTeam(n) {
  const m = n.m, T = A.data.teams, teams = { home: T[m.home], away: T[m.away] };
  const lv = A.st.levels[m.id] || {};
  let side = lv.side || 'home';
  A.map.inputOff = true;
  const kind = finaleKind(m.id), V = A.data.venues[m.venue];
  ui(card(`${esc(teams.home.name)} <span>vs</span> ${esc(teams.away.name)}`, `
    <p class="kicker">Level ${esc(n.label)} · Match ${m.id} · ${esc(V.stadium)}, ${esc(V.city)}</p>
    <p>1st half in the world of ${esc(teams.home.name)} (collect ${ITEM_NAME[world3d(teams.home).item]}), 2nd half in ${esc(teams.away.name)} (${ITEM_NAME[world3d(teams.away).item]}). Finale: <b>${FINALE_LABEL[kind]}</b>.</p>
    <div class="pick">${['home', 'away'].map(k => `<button class="team ${side === k ? 'on' : ''}" data-side="${k}" style="--kit:${teams[k].kit.shirt}"><img alt="" src="${flagDataUrl(teams[k].code, 60, 40)}"><b>${esc(teams[k].name)}</b><small>play for ${esc(teams[k].code)}</small></button>`).join('')}</div>
    ${lv.done ? `<p class="rules">Your best: ${lv.best.toLocaleString('en')}${lv.goal ? ' · goal' : ''} · ${lv.tries} ${lv.tries === 1 ? 'try' : 'tries'}</p>` : ''}`,
  [['Kick-off!', 'go'], ['Back to the map', 'back', 'ghost']]));
  document.querySelectorAll('.team').forEach(b => b.onclick = () => { side = b.dataset.side; document.querySelectorAll('.team').forEach(x => x.classList.toggle('on', x === b)); });
  const keys = e => { if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') { side = e.code === 'ArrowLeft' ? 'home' : 'away'; document.querySelectorAll('.team').forEach(x => x.classList.toggle('on', x.dataset.side === side)); } if (e.code === 'Escape') back(); };
  window.addEventListener('keydown', keys);
  const back = () => { window.removeEventListener('keydown', keys); ui(''); A.map.inputOff = false; };
  bind({ go: () => { window.removeEventListener('keydown', keys); startLevel(n, side); }, back });
}

async function startLevel(n, side, retry = false) {
  const m = n.m, T = A.data.teams, teams = { home: T[m.home], away: T[m.away] }, V = A.data.venues[m.venue];
  A.map.stop();
  ui('<div class="veil plain"><div class="loading">WARMING UP…</div></div>');
  // the server opens the try (and checks that the level is open)
  try { const r = await A.api.start(m.id, side); applyState(r); A.run = { matchId: m.id, token: r.token }; }
  catch (e) { A.run = null; ui(card('Not yet', `<p>${esc(e.message)}</p>`, [['Back to the map', 'map']])); bind({ map: () => leaveLevel() }); return; }
  await new Promise(r => setTimeout(r, 30));
  view('gameview');
  A.game?.stop();
  const game = A.game = new Game3D($('#gameview'), {
    match: m, teams, squads: A.data.squads, playerSide: side, look: DEFAULT_LOOK, renderer: A.renderer,
    onPause: p => p ? pauseCard(n, side) : ui(''),
    onGameOver: () => gameOver(n, side),
    onFinish: r => finish(n, side, r),
  });
  if (!retry && !A.introSeen.has(m.id)) {
    A.introSeen.add(m.id);
    await prepareVenue(V).catch(() => {});
    ui('<div class="skip">PRESS ANY KEY TO SKIP</div>');
    const ic = $('#introcv'); ic.hidden = false;
    await playIntro(ic, { venue: V, match: m, teams, startFrame: () => game.startFrame(), stageLabel: `LEVEL ${n.label} · MATCH ${m.id}`, transition: 'halftone' });
    ic.hidden = true;
  }
  ui('');
  game.start();
  touchControls();
}
function leaveLevel(celebrate) { A.game?.stop(); A.game = null; ui(''); removeTouch(); showMap(celebrate); }
function pauseCard(n, side) {
  ui(card('Pause', '<p>The clock is stopped.</p>', [['Resume', 'resume'], ['Restart from kick-off', 'restart', 'ghost'], ['Back to the map', 'map', 'ghost']]));
  bind({ resume: () => { A.game.resume(); ui(''); }, restart: () => startLevel(n, side, true), map: () => leaveLevel() });
}
function gameOver(n, side) {
  ui(card('Game over', `<p>All ${LIVES} lives are used. The level starts again from kick-off – as often as you like.</p>`, [['Try again', 'again'], ['Back to the map', 'map', 'ghost']]));
  bind({ again: () => startLevel(n, side, true), map: () => leaveLevel() });
}
async function finish(n, side, r) {
  const m = n.m, sim = A.game.sim;
  const album = sim.stickers.filter(st => st.got && st.person?.no != null).map(st => [sim.halfTeam[st.half].code, st.person.no]);
  const run = A.run;
  const send = async () => {
    ui('<div class="veil plain"><div class="loading">FULL TIME…</div></div>');
    let res;
    try { res = await A.api.finish(m.id, run.token, r, album); }
    catch (e) {
      ui(card('Result not saved', `<p>${esc(e.message)}</p>`, e.status && e.status !== 429 && e.status < 500 ? [['Back to the map', 'map']] : [['Send again', 'retry'], ['Back to the map', 'map', 'ghost']]));
      bind({ retry: send, map: () => { leaveLevel(); loadState().then(() => A.map.refresh()).catch(() => {}); } });
      return;
    }
    showResult(n, side, res);
  };
  send();
}
function showResult(n, side, res) {
  const m = n.m, sim = A.game.sim;
  const wasDone = !!A.st.levels[m.id]?.done;
  const nextIdx = A.map.seq.indexOf(n) + 1, next = A.map.seq[nextIdx];
  const nextWasOpen = next ? levelOpen(A.st, A.worlds, next.w, next.i) : true;
  const bonusWasOpen = bonusOpen(A.st, A.worlds[n.w]);
  applyState(res);
  const best = A.st.levels[m.id].best, isBest = res.newBest;
  const nowOpen = next ? levelOpen(A.st, A.worlds, next.w, next.i) : false;
  const b = res.breakdown, fin = FINALE_LABEL[res.kind] || 'Header';
  const rows = [['Reached the penalty area', b.finish], [`${ITEM_NAME[world3d(sim.halfTeam[0]).item]} & ${ITEM_NAME[world3d(sim.halfTeam[1]).item]}`, b.items], ['Player stickers', b.stickers], ['Full squad bonus', b.squad], ['Defenders dribbled', b.dribbles], ['Time left on the clock', b.time], [res.kind === 'header' ? 'Header power' : `${fin} quality`, b.header], ['Goal!', b.goal]].filter(x => x[1]);
  const notes = [];
  if (isBest && wasDone) notes.push('<b>New best score!</b>');
  if (!isBest) notes.push(`Your best stays at <b>${best.toLocaleString('en')}</b>.`);
  if (res.fresh) notes.push(`<b>+${res.fresh}</b> new sticker${res.fresh > 1 ? 's' : ''} in your album.`);
  if (!nextWasOpen && nowOpen) notes.push(next.w !== n.w ? `<b>${esc(A.worlds[next.w].name)} is open!</b>` : `<b>Level ${esc(next.label)} is open!</b>`);
  const bonusNew = !bonusWasOpen && bonusOpen(A.st, A.worlds[n.w]);
  if (bonusNew) notes.push('<b>Bonus level unlocked:</b> The Goal Wall ★');
  ui(card(res.goal ? 'GOAL!' : 'Full time!', `<table>${rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>+${v.toLocaleString('en')}</td></tr>`).join('')}<tr class="tot"><td>Total</td><td>${res.score.toLocaleString('en')}</td></tr></table>
    <p>${notes.join(' ')}</p>`, [['Back to the map', 'map'], ['Play again', 'again', 'ghost']]));
  bind({ map: () => leaveLevel(!nextWasOpen && nowOpen ? next : (bonusNew ? n.bonus : null)), again: () => startLevel(n, side, true) });
  A.map.focusMatch(m.id);
}

// ------------------------------------------------------------------ bonus level
function playBonus(n) {
  A.map.stop(); A.map.inputOff = true;
  view('gameview');
  const wall = A.bonus = new GoalWall($('#gameview'), {
    renderer: A.renderer, look: DEFAULT_LOOK, kit: DEFAULT_LOOK.kit,
    onQuit: () => { wall.stop(); A.bonus = null; ui(''); showMap(); },
    onFinish: async g => {
      let res;
      try { res = await A.api.bonus(n.key, g.hits); applyState(res); }
      catch (e) { ui(card('Result not saved', `<p>${esc(e.message)}</p>`, [['Back to the map', 'map']])); bind({ map: () => { wall.stop(); A.bonus = null; ui(''); showMap(); } }); return; }
      const isBest = res.newBest, b = { best: res.best };
      ui(card(res.hits === 6 ? 'GOAL WALL QUEEN!' : `${res.hits} / 6`, `<p>${res.hits} hit${res.hits === 1 ? '' : 's'} · <b>${res.score.toLocaleString('en')}</b> points${isBest ? ' · new best!' : ` · best ${b.best.toLocaleString('en')}`}</p><p class="rules">250 per hit · 500 extra for all six</p>`, [['Back to the map', 'map'], ['Again', 'again', 'ghost']]));
      bind({ map: () => { wall.stop(); A.bonus = null; ui(''); showMap(); }, again: () => { wall.stop(); A.bonus = null; ui(''); playBonus(n); } });
    },
  });
  ui('');
  wall.start();
}

// ------------------------------------------------------------------ touch (phones / tablets)
function touchControls() {
  if (!matchMedia('(pointer: coarse)').matches || $('.touch')) return;
  const pad = document.createElement('div'); pad.className = 'touch';
  pad.innerHTML = '<button data-k="left" aria-label="Left">◀</button><button data-k="right" aria-label="Right">▶</button><button data-k="jump" class="j" aria-label="Jump">JUMP</button>';
  $('.screen').appendChild(pad);
  pad.querySelectorAll('button').forEach(b => {
    const k = b.dataset.k;
    const on = e => { e.preventDefault(); const g = A.game; if (!g?.running) return; if (!g.sim.keys[k]) g.sim.pressed[k] = true; g.sim.keys[k] = true; g.sim.keys.run = true; };
    const off = e => { e.preventDefault(); if (A.game) A.game.sim.keys[k] = false; };
    b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
  });
}
function removeTouch() { $('.touch')?.remove(); }
function mapTouch() {
  if (!matchMedia('(pointer: coarse)').matches || $('.touch-map')) return;
  const pad = document.createElement('div'); pad.className = 'touch touch-map';
  pad.innerHTML = '<button data-d="left" aria-label="Back">◀</button><button data-d="up" aria-label="Bonus">▲</button><button data-d="right" aria-label="Next">▶</button><button data-d="play" class="j" aria-label="Play">PLAY</button>';
  $('#mapview').appendChild(pad);
  pad.querySelectorAll('button').forEach(b => b.addEventListener('pointerdown', e => { e.preventDefault(); if (A.map.inputOff) return; const d = b.dataset.d; if (d === 'play') A.map.enter(); else A.map.go(d === 'up' && A.map.cur.type === 'bonus' ? 'down' : d); }));
}

boot();
