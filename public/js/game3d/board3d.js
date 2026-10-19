// The leaderboard: overall (all levels + bonus levels) or one level. Every player counts with the best try.
import { playable } from './progress.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function openBoard(root, { api, data, user, onClose }) {
  const levels = data.schedule.filter(m => playable(m, data));
  let cur = null, token = 0;

  async function render() {
    const mine = ++token;
    root.innerHTML = `<div class="veil"><div class="card board"><h2>TOP LIST</h2>
      <p><select id="bd-sel" aria-label="Leaderboard"><option value="">Overall</option>${levels.map(m => `<option value="${m.id}" ${cur === m.id ? 'selected' : ''}>#${m.id} ${esc(data.teams[m.home].name)} vs ${esc(data.teams[m.away].name)}</option>`).join('')}</select></p>
      <div id="bd-rows"><p class="note">Loading…</p></div>
      <div class="actions"><button class="btn" data-a="close">Close <kbd>ESC</kbd></button></div></div></div>`;
    root.querySelector('#bd-sel').onchange = e => { cur = e.target.value ? +e.target.value : null; render(); };
    root.querySelector('[data-a=close]').onclick = close; root.querySelector('[data-a=close]').focus();
    let html;
    try {
      const d = await api.leaderboard(cur);
      if (mine !== token) return;
      const row = (r, hl) => `<tr class="${hl ? 'me' : ''}"><td>${r.rank}</td><td>${esc(r.nickname)}${r.goal || r.goals ? ' ⚽' : ''}</td><td>${r.points.toLocaleString('en')}</td></tr>`;
      const top = d.rows.slice(0, 15);
      html = d.rows.length ? `<table>${top.map(r => row(r, r.nickname === user.nickname)).join('')}${d.me && !top.some(r => r.nickname === d.me.nickname) ? `<tr><td colspan="3">…</td></tr>${row(d.me, true)}` : ''}</table>
        <p class="rules">${d.players} players · best try counts</p>` : '<p class="note">No results yet – be the first!</p>';
    } catch (e) { if (mine !== token) return; html = `<p class="note">${esc(e.message)}</p>`; }
    root.querySelector('#bd-rows').innerHTML = html;
  }
  const onKey = e => { if (e.code === 'Escape' || e.code === 'KeyL') { e.preventDefault(); e.stopImmediatePropagation(); close(); } };
  function close() { window.removeEventListener('keydown', onKey, true); root.innerHTML = ''; onClose?.(); }
  window.addEventListener('keydown', onKey, true);
  render();
}
