// BRASILI – app shell: login, advent calendar, match page, game stage, leaderboard,
// locker room (look of Brasili), credits.
import { createApi } from './api.js';
import { Game, pickKits } from './game/engine.js';
import { playIntro, prepareVenue } from './game/intro.js';
import { flagDataUrl } from './ui/flags.js';
import { footballerSheet, DEFAULT_LOOK, SKINS, HAIRS, HAIR_STYLES } from './game/sprites.js';
import { buildTheme, themeItem, LAYER_W } from './game/themes.js';
import { LIVES } from './shared/levelgen.js';

const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const S = { data: null, api: null, user: null, levels: null, config: null, anim: [] };
const ITEM_NAMES = { kiwi: 'kiwi fruit', waffle: 'waffle hearts', pretzel: 'pretzels', minttea: 'glasses of mint tea', boomerang: 'boomerangs', croissant: 'croissants', orange: 'oranges', teacup: 'cups of tea', ball: 'footballs' };
const STAGE_SHORT = s => s.startsWith('Group') ? s.toUpperCase() : ({ 'Round of 16': 'ROUND OF 16', 'Quarter-final': 'QUARTER-FINAL', 'Semi-final': 'SEMI-FINAL', 'Third place': 'THIRD PLACE', Final: 'FINAL' }[s] || s.toUpperCase());
const fmtDay = iso => new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const fmtDateTime = iso => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const look = () => ({ ...DEFAULT_LOOK, ...(S.user?.look || {}) });
const flag = (code, cls = '') => `<img class="flag ${cls}" alt="${esc(code)}" src="${flagDataUrl(code, cls ? 66 : 36, cls ? 44 : 24)}">`;
const lum = hex => { const n = parseInt(hex.slice(1), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
const onColor = hex => lum(hex) > 0.6 ? '#1a1222' : '#ffffff';
const firstMode = () => S.config?.scoreMode === 'first';
const tries = n => `${n} ${n === 1 ? 'TRY' : 'TRIES'}`;
const RULES = () => `${LIVES} lives per try. Lose one and you go back to the last checkpoint – cooling break, half-time, cooling break. Lose all ${LIVES} and it's game over: the level starts again from kick-off. Unlimited tries – ${firstMode() ? 'your first finished try counts' : 'your best score counts'}.`;

// ------------------------------------------------------------------ boot
async function boot() {
  const names = ['teams', 'squads', 'schedule', 'venues'];
  const embedded = window.BRASILI_DATA;
  const vals = embedded ? names.map(n => embedded[n]) : await Promise.all(names.map(n => fetch(`data/${n}.json`).then(r => r.json())));
  S.data = Object.fromEntries(names.map((n, i) => [n, vals[i]]));
  await Promise.all([document.fonts.load('10px "Press Start 2P"'), document.fonts.load('24px "Bangers"')]).catch(() => {});
  S.api = await createApi(S.data);
  S.config = await S.api.config().catch(() => ({ unlockMode: 'all', invite: false }));
  try { S.user = (await S.api.me()).user; } catch { S.user = null; }
  // preview without a server: no login, straight to the level selection
  if (S.api.demo && !S.user) S.user = (await S.api.register('You')).user;
  window.addEventListener('hashchange', route);
  route();
}

// routing: the URL hash on the server; in-memory inside the demo preview (its frame keeps the URL fixed)
const memRouting = () => !!window.BRASILI_DEMO;
function curRoute() { return memRouting() ? (S.route || '#/calendar') : location.hash; }
function go(h) {
  if (memRouting()) { S.route = h; route(); return; }
  if (location.hash === h) route(); else location.hash = h;
}
document.addEventListener('click', e => {
  const a = e.target.closest?.('a[href^="#/"]');
  if (a && memRouting()) { e.preventDefault(); go(a.getAttribute('href')); }
});

function stopAnims() { S.anim.forEach(cancelAnimationFrame); S.anim = []; }
function setNav(r) {
  $('#topbar').classList.toggle('hidden', !S.user);
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('active', a.dataset.r === r));
  if (S.user) {
    $('#userchip').innerHTML = `<canvas width="20" height="28"></canvas><span>${esc(S.user.nickname)}</span>${S.api.demo ? '' : '<button id="logout">LOG OUT</button>'}`;
    const cv = $('#userchip canvas'), sh = footballerSheet(look(), look().kit);
    cv.getContext('2d').drawImage(sh.right.stand, 0, 0);
    if ($('#logout')) $('#logout').onclick = async () => { await S.api.logout().catch(() => {}); S.user = null; go('#/login'); };
  }
}

async function route() {
  stopAnims();
  const [, r = 'calendar', arg] = (curRoute() || '#/calendar').split('/');
  if (!S.user && r !== 'login') { go('#/login'); return; }
  if (S.user && r === 'login') { go('#/calendar'); return; }
  setNav(r);
  window.scrollTo(0, 0);
  try {
    if (r === 'login') return viewAuth();
    if (r === 'match') return await viewMatch(+arg);
    if (r === 'leaderboard') return await viewLeaderboard(arg ? +arg : null);
    if (r === 'locker') return viewLocker();
    if (r === 'credits') return viewCredits();
    return await viewCalendar();
  } catch (e) {
    if (e.status === 401) { S.user = null; go('#/login'); return; }
    $('#view').innerHTML = `<div class="panel" style="padding:24px"><h2 class="h-comic h-m">Oops!</h2><p>${esc(e.message)}</p></div>`;
  }
}

// ------------------------------------------------------------------ auth
function viewAuth() {
  const demo = S.api.demo;
  $('#view').innerHTML = `
  <section class="auth">
    <div class="panel auth-hero">
      <h1 class="h-comic h-xl">BRASILI</h1>
      <p style="font-size:20px;margin-top:14px"><b>The team challenge for the Women's World Cup 2027.</b></p>
      <p>64 matches, 64 levels. Every match day the doors of the calendar open, every level runs through the worlds of both teams and ends with a header in the stadium where the real match is played. Three lives per try, a checkpoint at every cooling break, unlimited tries – your best score counts.</p>
      <canvas class="strip" id="strip" width="384" height="120"></canvas>
    </div>
    <form class="panel auth-form" id="authform" autocomplete="on">
      <div class="tabs"><button type="button" data-t="login" class="on">Log in</button><button type="button" data-t="register">Sign up</button></div>
      <label class="field reg hidden">NICKNAME <input name="nickname" maxlength="20" autocomplete="nickname"></label>
      <label class="field">E-MAIL <input name="email" type="email" autocomplete="email" required></label>
      <label class="field">PASSWORD <input name="password" type="password" autocomplete="current-password" required minlength="8"></label>
      ${S.config.invite ? '<label class="field reg hidden">TEAM CODE <input name="invite" autocomplete="off"></label>' : ''}
      <div class="form-error hidden" id="autherr"></div>
      <button class="btn" type="submit" id="authbtn">Let's play!</button>
      <p class="note">${demo ? '<b>Preview mode:</b> no server connected – your progress stays in this browser only.' : 'Your nickname appears on the leaderboard. Your e-mail is only used to log in.'}</p>
    </form>
  </section>`;
  let mode = 'login';
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    mode = b.dataset.t;
    document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    document.querySelectorAll('.reg').forEach(x => x.classList.toggle('hidden', mode !== 'register'));
    $('[name=password]').autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  });
  $('#authform').onsubmit = async e => {
    e.preventDefault();
    const f = new FormData(e.target), err = $('#autherr');
    err.classList.add('hidden'); $('#authbtn').disabled = true;
    try {
      const r = mode === 'register' ? await S.api.register(f.get('nickname'), f.get('email'), f.get('password'), f.get('invite') || undefined) : await S.api.login(f.get('email'), f.get('password'));
      S.user = r.user; go('#/calendar');
    } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
    finally { $('#authbtn').disabled = false; }
  };
  animateStrip($('#strip'));
}

function animateStrip(cv) {
  const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false;
  const th = buildTheme(S.data.teams.ESP), sh = footballerSheet(look(), S.data.teams.BRA.kit);
  let t = 0;
  const loop = () => {
    t += 1;
    const cam = t * 1.6;
    ctx.drawImage(th.sky, 0, -100);
    for (const [L, f] of [[th.far, 0.12], [th.mid, 0.32], [th.near, 0.62]]) { const x = -((cam * f) % LAYER_W); ctx.drawImage(L, x, -96); ctx.drawImage(L, x + LAYER_W, -96); }
    for (let x = -1; x < 26; x++) { const X = Math.round(x * 16 - (cam % 16)); ctx.drawImage(th.groundTop[(((x + Math.floor(cam / 16)) % 3) + 3) % 3], X, 96); ctx.drawImage(th.groundFill[0], X, 112); }
    const frames = ['run1', 'run2', 'run3', 'run4'];
    const jump = Math.max(0, Math.sin(t / 22)) ** 2 * 26;
    ctx.drawImage(sh.right[jump > 2 ? 'jump' : frames[Math.floor(t / 5) % 4]], 150, 70 - jump);
    S.anim.push(requestAnimationFrame(loop));
  };
  loop();
}

// ------------------------------------------------------------------ calendar
async function viewCalendar() {
  const res = await S.api.levels();
  S.levels = res.levels;
  const lb = await S.api.leaderboard().catch(() => null);
  const mine = S.levels.filter(l => l.run.finished);
  const total = mine.reduce((s, l) => s + l.run.score, 0), goals = mine.filter(l => l.run.goal).length;
  const filter = sessionStorage.getItem('brasili-filter') || 'all';
  const show = l => filter === 'all' || (filter === 'playable' && l.playable && l.unlocked && !l.run.finished) || (filter === 'group' && l.group) || (filter === 'ko' && !l.group);
  const days = {};
  for (const l of S.levels) if (show(l)) (days[l.date] ||= []).push(l);
  $('#view').innerHTML = `
    <section class="hero">
      <div><h1 class="h-comic h-xl">ROAD TO RIO</h1>
      <p style="color:#c8cbe8;max-width:620px;line-height:1.5">One level per World Cup match. Doors open at 06:00 on match day – and stay open.</p>
      ${res.unlockMode === 'all' ? `<span class="ribbon">TEST MODE · ALL DOORS OPEN · TEAMS = 2023 PLACEHOLDERS${S.api.demo ? ' · PREVIEW: NOTHING IS SAVED ON A SERVER' : ''}</span>` : ''}</div>
      <div class="stats">
        <div class="panel stat"><b>${total.toLocaleString('en')}</b><span>POINTS</span></div>
        <div class="panel stat"><b>${lb?.me ? '#' + lb.me.rank : '–'}</b><span>RANK</span></div>
        <div class="panel stat"><b>${goals}</b><span>GOALS</span></div>
        <div class="panel stat"><b>${mine.length}/64</b><span>LEVELS</span></div>
      </div>
    </section>
    <div class="toolbar">${[['all', 'All 64'], ['playable', 'Not finished yet'], ['group', 'Group stage'], ['ko', 'Knockouts']].map(([k, t]) => `<button class="chip ${filter === k ? 'on' : ''}" data-f="${k}">${t}</button>`).join('')}</div>
    ${Object.entries(days).map(([d, ls]) => `<section class="day"><h3>${esc(fmtDay(d).toUpperCase())}</h3><div class="doors">${ls.map(door).join('')}</div></section>`).join('') || '<p class="pixel" style="font-size:10px;margin-top:30px">NOTHING HERE YET.</p>'}`;
  document.querySelectorAll('.chip').forEach(c => c.onclick = () => { sessionStorage.setItem('brasili-filter', c.dataset.f); viewCalendar(); });
}
function door(l) {
  const T = S.data.teams, V = S.data.venues[l.venue], home = T[l.home], away = T[l.away];
  let status;
  if (!l.unlocked) status = `<span class="state-soon">OPENS ${esc(fmtDateTime(l.unlockAt).toUpperCase())}</span>`;
  else if (!l.playable) status = `<span class="state-soon">LEVEL IN PRODUCTION</span>`;
  else if (l.run.finished) status = `<span class="state-done">★ ${l.run.score.toLocaleString('en')} PTS${l.run.goal ? ' · GOAL' : ''}</span>`;
  else status = `<span class="state-play">PLAY ▶</span>`;
  const hearts = l.playable && l.unlocked && l.run.attempts ? `<span class="tries">${tries(l.run.attempts)}</span>` : '';
  return `<a class="door panel ${l.unlocked ? '' : 'locked'}" href="#/match/${l.id}">
    <div class="stripe" style="background:linear-gradient(105deg, ${home.kit.shirt} 0 49.5%, #1a1222 49.5% 50.5%, ${away.kit.shirt} 50.5% 100%)"><span class="num">#${l.id}</span><span class="tag stage">${esc(STAGE_SHORT(l.stage))}</span></div>
    <div class="body">
      <div class="teams">${flag(l.home)} ${l.home} <span class="vs">vs</span> ${l.away} ${flag(l.away)}</div>
      <div class="venue">${esc(V.stadium)} · ${esc(V.city)}</div>
      <div class="foot">${status}${hearts}</div>
    </div>${l.unlocked ? '' : '<span class="lock">🔒</span>'}
  </a>`;
}

// ------------------------------------------------------------------ match page
async function viewMatch(id) {
  if (!S.levels) S.levels = (await S.api.levels()).levels;
  let l = S.levels.find(x => x.id === id);
  if (!l) throw new Error('Unknown match.');
  const T = S.data.teams, V = S.data.venues[l.venue], teams = { home: T[l.home], away: T[l.away] };
  const sq = c => S.data.squads[c] || { players: [], featured: [] };
  const can = l.unlocked && l.playable;
  let side = l.run.side;
  const card = (key, half) => {
    const t = teams[key], s = sq(t.code);
    const xi = s.featured.map(no => s.players.find(p => p.no === no)).filter(Boolean);
    return `<div class="panel team-card ${side === key ? 'chosen' : ''}" data-side="${key}">
      <div class="top" style="background:${t.kit.shirt};color:${onColor(t.kit.shirt)}">${flag(t.code, 'lg')}<div><div class="h-comic">${esc(t.name)}</div>
      <div class="world">${half} half: ${t.theme ? `world of ${esc(t.name)} – collect ${ITEM_NAMES[themeItem(t.code)]}` : 'world not built yet'}</div></div></div>
      <ol>${xi.map(p => `<li><span class="no">${p.no}</span><span class="pos">${p.pos}</span><span>${esc(p.name)}</span></li>`).join('')}</ol>
      ${can ? `<div class="pick">${l.run.side ? (side === key ? '<span class="tag">YOUR TEAM</span>' : '') : `<button class="btn pickbtn" data-side="${key}" style="background:${t.kit.shirt};color:${onColor(t.kit.shirt)}">Play for ${esc(t.name)}</button>`}</div>` : ''}
    </div>`;
  };
  let note = '';
  if (!l.unlocked) note = `This door opens on <b>${esc(fmtDateTime(l.unlockAt))}</b>.`;
  else if (!l.playable) note = 'This level is still in production – the worlds of these teams are being built.';
  else if (l.run.finished) note = firstMode()
    ? `Your first finished try counts: <b>${l.run.score.toLocaleString('en')}</b> points${l.run.goal ? ' with a goal' : ''}. Keep playing for fun – it won't change your score.`
    : `Your best so far: <b>${l.run.score.toLocaleString('en')}</b> points${l.run.goal ? ' with a goal' : ''}. Play again as often as you like – only your best try counts.`;
  $('#view').innerHTML = `
    <section class="panel match-head">
      <div>
        <span class="tag">${esc(STAGE_SHORT(l.stage))} · MATCH ${l.id}</span>
        <div class="vsline" style="margin-top:12px">${flag(l.home, 'lg')}<span class="h-comic h-l">${esc(teams.home.name)}</span><span class="vs">VS</span><span class="h-comic h-l">${esc(teams.away.name)}</span>${flag(l.away, 'lg')}</div>
        <p style="margin:12px 0 0;font-size:16px">${esc(fmtDay(l.date))} 2027 · ${esc(V.local)}, ${esc(V.city)}</p>
      </div>
      <div class="runstats">${can ? `<div><span class="pixel">LIVES PER TRY</span><b class="hearts">${'♥'.repeat(LIVES)}</b></div><div><span class="pixel">${firstMode() ? 'SCORE' : 'BEST'}</span><b>${l.run.finished ? l.run.score.toLocaleString('en') : '–'}</b></div><div><span class="pixel">TRIES</span><b>${l.run.attempts}</b></div>` : ''}</div>
    </section>
    <section class="lineups">${card('home', '1st')}${card('away', '2nd')}</section>
    <section class="panel kickoff">
      <div>${note ? `<p style="margin:0 0 12px;font-size:17px">${note}</p>` : ''}${can ? `<div class="keys"><span><kbd>←</kbd> <kbd>→</kbd> run</span><span><kbd>SHIFT</kbd> sprint</span><span><kbd>SPACE</kbd> jump (hold = higher)</span><span><kbd>ESC</kbd> pause</span></div>
        <p class="note vsnote" style="margin:10px 0 0">Collect the stickers of the squad with the bonus jumps, jump over defenders, and head the final cross as high as you can – the higher, the harder the header. You play against ${side ? esc(teams[side === 'home' ? 'away' : 'home'].name) : 'the other team'} – same rules for both sides.</p>
        <p class="note rules" style="margin:8px 0 0">${RULES()}</p>` : ''}</div>
      <div style="display:flex;gap:12px;align-items:center">
        <a class="btn ghost" href="#/leaderboard/${l.id}">Leaderboard</a>
        ${can ? `<button class="btn" id="kickoff" ${side ? '' : 'disabled'}>${l.run.finished ? 'Play again' : l.run.attempts ? 'Try again' : 'Kick-off!'}</button>` : ''}
      </div>
    </section>`;
  document.querySelectorAll('.pickbtn').forEach(b => b.onclick = () => {
    side = b.dataset.side;
    document.querySelectorAll('.team-card').forEach(c => c.classList.toggle('chosen', c.dataset.side === side));
    $('#kickoff').disabled = false;
    $('.vsnote').innerHTML = $('.vsnote').innerHTML.replace(/You play against [^–]+–/, `You play against ${esc(teams[side === 'home' ? 'away' : 'home'].name)} –`);
  });
  if ($('#kickoff')) $('#kickoff').onclick = () => playMatch(l, side);
  if (can) setTimeout(() => prepareVenue(V), 700); // stylise the intro photos in the background
}

// ------------------------------------------------------------------ game stage
const stage = { game: null };
window.BRASILI_STAGE = stage; // handy for debugging in the console
function stageUi(html) { $('#stage-ui').innerHTML = html; }
function showStage() { $('#stage').classList.remove('hidden'); document.body.style.overflow = 'hidden'; }
function hideStage() {
  stage.game?.stop(); stage.game = null;
  $('#stage').classList.add('hidden'); document.body.style.overflow = '';
  stageUi(''); for (const id of ['game', 'fx', 'intro']) { const c = $('#' + id); c.getContext('2d').clearRect(0, 0, c.width, c.height); }
  $('#intro').classList.remove('hidden');
}

async function playMatch(l, side, opts = {}) {
  const T = S.data.teams, teams = { home: T[l.home], away: T[l.away] }, V = S.data.venues[l.venue];
  showStage();
  stageUi(`<div class="loading-card"><div>WARMING UP…</div><div class="bar"><i id="lbar"></i></div></div>`);
  let life;
  try { life = await S.api.start(l.id, side); }
  catch (e) { stageUi(dialog('Hold on!', `<p>${esc(e.message)}</p>`, [['Back', 'back']])); bindDialog({ back: () => { hideStage(); route(); } }); return; }
  $('#lbar') && ($('#lbar').style.width = '40%');
  const lv = { ...l, run: { ...l.run, side: life.side } };
  const again = () => { stage.game?.stop(); playMatch(lv, life.side, { skipIntro: true }); };
  const leave = to => { hideStage(); S.levels = null; go(to); };
  const game = new Game($('#game'), $('#fx'), {
    match: l, teams, squads: S.data.squads, playerSide: life.side, look: look(), lives: life.lives || LIVES,
    callbacks: {
      onGameOver: ({ reason }) => {
        const msg = { time: 'The referee blew the whistle – time is up!', pit: 'You fell out of play!', tackle: 'A defender stopped you!' }[reason] || 'Ouch!';
        stageUi(dialog('Game over', `<p>${msg}</p><p>All ${LIVES} lives of this try are used. The level starts again from kick-off – as often as you like.</p>`, [['Try again', 'again'], ['Back to the match', 'back', 'secondary']]));
        bindDialog({ again, back: () => leave(`#/match/${l.id}`) });
      },
      onFinish: async result => {
        let r;
        try { r = await S.api.finish(l.id, life.token, result); }
        catch (e) { stageUi(dialog('Hmm…', `<p>The result could not be saved: ${esc(e.message)}</p>`, [['Try again', 'again'], ['Back', 'back', 'secondary']])); bindDialog({ again, back: () => leave(`#/match/${l.id}`) }); return; }
        const b = r.breakdown, rows = [['Reached the penalty area', b.finish], ['National collectibles', b.items], ['Player stickers', b.stickers], ['Full squad bonus', b.squad], ['Defenders dribbled', b.dribbles], ['Time left on the clock', b.time], ['Header power', b.header], ['Goal!', b.goal]];
        const line = r.scoreMode === 'first'
          ? (r.finishes === 1 ? 'Your first finished try – this score counts.' : `Just for fun – your first finished try counts: <b>${r.counted.toLocaleString('en')}</b>.`)
          : (r.newBest ? (r.finishes === 1 ? 'On the leaderboard!' : '<b>New best score!</b> The leaderboard is updated.') : `Your best stays at <b>${r.best.toLocaleString('en')}</b>.`);
        stageUi(dialog(r.goal ? 'GOAL!' : 'Full time!', `<table class="breakdown">${rows.filter(x => x[1]).map(([k, v]) => `<tr><td>${k}</td><td>+${v.toLocaleString('en')}</td></tr>`).join('')}<tr class="total"><td>Total</td><td>${r.score.toLocaleString('en')}</td></tr></table>
          <p class="result-line">${line} <span class="muted">· ${tries(r.attempts).toLowerCase()}</span></p>`, [['Play again', 'again'], ['Leaderboard', 'lb', 'secondary'], ['Calendar', 'back', 'secondary']]));
        bindDialog({ again, lb: () => leave(`#/leaderboard/${l.id}`), back: () => leave('#/calendar') });
      },
      onPause: paused => {
        if (paused) {
          stageUi(dialog('Pause', '<p>Take a breath. The clock is stopped.</p>', [['Resume', 'resume'], ['Restart from kick-off', 'restart', 'secondary'], ['Leave the pitch', 'quit', 'secondary']]));
          bindDialog({ resume: () => { game.resume(); stageUi(''); }, restart: again, quit: () => leave(`#/match/${l.id}`) });
        } else stageUi('');
      },
    },
  });
  stage.game = game;
  if (!opts.skipIntro) {
    $('#lbar') && ($('#lbar').style.width = '70%');
    await prepareVenue(V);
    stageUi('<div class="skiphint">PRESS ANY KEY TO SKIP</div>');
    $('#intro').classList.remove('hidden');
    await playIntro($('#intro'), { venue: V, match: l, teams, startFrame: () => game.startFrame(), stageLabel: `${STAGE_SHORT(l.stage)} · MATCH ${l.id}` });
  }
  $('#intro').classList.add('hidden');
  stageUi('');
  game.start();
}
function dialog(title, body, actions) {
  return `<div class="dialog-wrap"><div class="panel dialog"><h2 class="h-comic">${esc(title)}</h2>${body}<div class="actions">${actions.map(([t, k, cls]) => `<button class="btn ${cls || ''}" data-a="${k}">${esc(t)}</button>`).join('')}</div></div></div>`;
}
function bindDialog(map) {
  document.querySelectorAll('#stage-ui [data-a]').forEach(b => b.onclick = () => map[b.dataset.a]?.());
  const first = $('#stage-ui [data-a]'); first?.focus();
}

// ------------------------------------------------------------------ leaderboard
async function viewLeaderboard(matchId) {
  if (!S.levels) S.levels = (await S.api.levels()).levels;
  const r = await S.api.leaderboard(matchId);
  const opts = S.levels.filter(l => l.playable).map(l => `<option value="${l.id}" ${l.id === matchId ? 'selected' : ''}>#${l.id} ${l.home} vs ${l.away}</option>`).join('');
  $('#view').innerHTML = `
    <section class="hero"><div><h1 class="h-comic h-xl">LEADERBOARD</h1><p style="color:#c8cbe8">${r.players} players registered.</p></div>
    <div class="toolbar"><button class="chip ${matchId ? '' : 'on'}" id="overall">Overall</button><select class="sel" id="msel"><option value="">Pick a level…</option>${opts}</select></div></section>
    <div class="panel" style="padding:8px 14px">
      <table class="board"><thead><tr><th>#</th><th>PLAYER</th>${matchId ? '<th>TEAM</th><th>GOAL</th><th>TRIES</th>' : '<th>LEVELS</th><th>GOALS</th>'}<th style="text-align:right">${matchId && !firstMode() ? 'BEST' : 'POINTS'}</th></tr></thead>
      <tbody>${r.rows.map(x => `<tr class="${x.nickname === S.user.nickname ? 'me' : ''}"><td class="rank">${x.rank}</td><td>${esc(x.nickname)}</td>${matchId ? `<td>${x.side ? flag(S.levels.find(l => l.id === matchId)[x.side]) : ''}</td><td>${x.goal ? '⚽' : ''}</td><td>${x.attempts ?? ''}</td>` : `<td>${x.levels}</td><td>${x.goals}</td>`}<td class="pts">${x.points.toLocaleString('en')}</td></tr>`).join('') || `<tr><td colspan="6" style="padding:24px;text-align:center">No results yet – be the first!</td></tr>`}</tbody></table>
    </div>`;
  $('#overall').onclick = () => { go('#/leaderboard'); };
  $('#msel').onchange = e => { go(e.target.value ? `#/leaderboard/${e.target.value}` : '#/leaderboard'); };
}

// ------------------------------------------------------------------ locker room
function viewLocker() {
  const L = look();
  const KIT_COLORS = ['#14b8a6', '#ff4d6d', '#3a86ff', '#ffd23f', '#7b2cbf', '#2fbf71', '#f4f4f4', '#1b1b1f', '#ff9f1c'];
  const BOOTS = ['#ff4fa3', '#1b1b1b', '#f5f5f5', '#ffd400', '#3a86ff', '#2fbf71', '#ff6b00'];
  $('#view').innerHTML = `
    <section class="hero"><div><h1 class="h-comic h-xl">LOCKER ROOM</h1><p style="color:#c8cbe8">This is Brasili. In a level she wears the kit of the team you play for – here you choose her look and her training kit.</p></div></section>
    <section class="locker">
      <div class="panel preview"><canvas id="pv" width="20" height="28"></canvas><div class="pixel" style="font-size:10px;color:#1a1222">#<span id="pvno">${L.number}</span> BRASILI</div></div>
      <div class="panel options">
        <div class="opt"><h4>HAIR STYLE</h4><div class="swatches" id="o-style">${HAIR_STYLES.map(s => `<button class="txt ${s === L.hairStyle ? 'on' : ''}" data-v="${s}">${s.toUpperCase()}</button>`).join('')}</div></div>
        <div class="opt"><h4>HAIR</h4><div class="swatches" id="o-hair">${HAIRS.map(c => `<button style="background:${c}" class="${c === L.hair ? 'on' : ''}" data-v="${c}"></button>`).join('')}</div></div>
        <div class="opt"><h4>SKIN</h4><div class="swatches" id="o-skin">${SKINS.map(c => `<button style="background:${c}" class="${c === L.skin ? 'on' : ''}" data-v="${c}"></button>`).join('')}</div></div>
        <div class="opt"><h4>BOOTS</h4><div class="swatches" id="o-boots">${BOOTS.map(c => `<button style="background:${c}" class="${c === L.boots ? 'on' : ''}" data-v="${c}"></button>`).join('')}</div></div>
        <div class="opt"><h4>TRAINING SHIRT</h4><div class="swatches" id="o-shirt">${KIT_COLORS.map(c => `<button style="background:${c}" class="${c === L.kit.shirt ? 'on' : ''}" data-v="${c}"></button>`).join('')}</div></div>
        <div class="opt"><h4>TRAINING SHORTS</h4><div class="swatches" id="o-shorts">${KIT_COLORS.map(c => `<button style="background:${c}" class="${c === L.kit.shorts ? 'on' : ''}" data-v="${c}"></button>`).join('')}</div></div>
        <label class="field" style="max-width:160px">SHIRT NUMBER <input id="o-no" type="number" min="1" max="99" value="${L.number}"></label>
        <div><button class="btn" id="savelook">Save look</button> <span id="saved" class="pixel hidden" style="font-size:9px;margin-left:10px">SAVED!</span></div>
      </div>
    </section>`;
  const cur = JSON.parse(JSON.stringify(L));
  const bind = (id, fn) => document.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => { document.querySelectorAll(`#${id} button`).forEach(x => x.classList.toggle('on', x === b)); fn(b.dataset.v); redraw(); });
  bind('o-style', v => cur.hairStyle = v); bind('o-hair', v => cur.hair = v); bind('o-skin', v => cur.skin = v); bind('o-boots', v => cur.boots = v);
  bind('o-shirt', v => { cur.kit.shirt = v; cur.kit.socks = v; }); bind('o-shorts', v => cur.kit.shorts = v);
  $('#o-no').oninput = e => { cur.number = Math.max(1, Math.min(99, +e.target.value || 10)); $('#pvno').textContent = cur.number; };
  let sheet;
  const redraw = () => { sheet = footballerSheet(cur, cur.kit); };
  redraw();
  const cv = $('#pv'), ctx = cv.getContext('2d'); let t = 0;
  const loop = () => { t++; ctx.clearRect(0, 0, 20, 28); const seq = ['stand', 'stand', 'run1', 'run2', 'run3', 'run4', 'run1', 'run2', 'run3', 'run4', 'jump', 'cheer']; ctx.drawImage(sheet.right[seq[Math.floor(t / 9) % seq.length]], 0, 0); S.anim.push(requestAnimationFrame(loop)); };
  loop();
  $('#savelook').onclick = async () => { const r = await S.api.saveLook(cur); S.user = r.user; setNav('locker'); $('#saved').classList.remove('hidden'); setTimeout(() => $('#saved')?.classList.add('hidden'), 1500); };
}

// ------------------------------------------------------------------ credits
function viewCredits() {
  const V = Object.values(S.data.venues).filter(v => v.images.length);
  $('#view').innerHTML = `
    <section class="hero"><div><h1 class="h-comic h-xl">CREDITS</h1><p style="color:#c8cbe8">BRASILI is a private, internal team game – not affiliated with FIFA or any federation.</p></div></section>
    <div class="panel" style="padding:22px 26px">
      <h2 class="h-comic h-m">Stadium intro photos</h2>
      <p class="note">All photos come from Wikimedia Commons and are turned into comic illustrations by the game. Licences: Public domain / CC0, or Creative Commons as noted.</p>
      <ul class="credits">${V.map(v => v.images.map(m => `<li><b>${esc(v.city)}</b> (${m.role}) – <a href="${esc(m.page)}" target="_blank" rel="noopener">${esc(m.file)}</a> · ${esc(m.author)} · ${esc(m.license)}</li>`).join('')).join('')}</ul>
      <h2 class="h-comic h-m" style="margin-top:20px">Fonts</h2>
      <ul class="credits"><li>Press Start 2P – CodeMan38, SIL Open Font License 1.1</li><li>Bangers – Vernon Adams, SIL Open Font License 1.1</li></ul>
      <h2 class="h-comic h-m" style="margin-top:20px">Data</h2>
      <ul class="credits"><li>Match schedule, cities and stadiums: FIFA Women's World Cup 2027 (group-stage match numbers provisional).</li><li>Teams and squads: FIFA Women's World Cup 2023 squads as placeholders until the 2027 draw (11 Dec 2026) and squad announcements.</li></ul>
      <h2 class="h-comic h-m" style="margin-top:20px">Game</h2>
      <p class="note">All game graphics (Brasili, worlds, landmarks, items) are original pixel art drawn in code.</p>
    </div>`;
}

boot();
