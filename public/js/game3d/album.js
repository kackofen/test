// The sticker album: one page per team (the 11 players of the bonus jumps). Stickers go in
// when a level is finished. Teams are listed by group.
import { drawFlag } from '../ui/flags.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lum = hex => { const n = parseInt(String(hex).slice(1), 16); return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };

export function albumTeams(data, worlds) {
  return worlds.filter(w => !w.ko).flatMap(w => w.teams.map(code => ({ code, group: w.key, team: data.teams[code], squad: data.squads[code] || { players: [], featured: [] } })));
}
export const albumTotal = (data, worlds) => albumTeams(data, worlds).reduce((s, t) => s + t.squad.featured.length, 0);

export function openAlbum(root, { data, worlds, progress, onClose, focus }) {
  const teams = albumTeams(data, worlds);
  const have = code => new Set(progress.album[code] || []);
  let cur = focus && teams.some(t => t.code === focus) ? focus : (teams.find(t => (progress.album[t.code] || []).length) || teams[0]).code;
  const flagUrl = code => { const c = document.createElement('canvas'); c.width = 48; c.height = 32; drawFlag(c.getContext('2d'), code, 0, 0, 48, 32); return c.toDataURL(); };
  const flags = Object.fromEntries(teams.map(t => [t.code, flagUrl(t.code)]));
  const total = teams.reduce((s, t) => s + t.squad.featured.length, 0), got = teams.reduce((s, t) => s + have(t.code).size, 0);

  function render() {
    const T = teams.find(t => t.code === cur), h = have(cur), kit = T.team?.kit || { shirt: '#3a86ff', shorts: '#1a1222' };
    const players = T.squad.featured.map(no => T.squad.players.find(p => p.no === no)).filter(Boolean);
    const groups = [...new Set(teams.map(t => t.group))];
    root.innerHTML = `<div class="album-veil"><div class="album">
      <header><h2>STICKER ALBUM</h2><span class="album-count">${got} / ${total}</span><button class="btn ghost" data-a="close">Close <kbd>ESC</kbd></button></header>
      <div class="album-body">
        <nav>${groups.map(g => `<div class="ag"><b>GROUP ${g}</b>${teams.filter(t => t.group === g).map(t => { const n = have(t.code).size, f = t.squad.featured.length; return `<button class="at ${t.code === cur ? 'on' : ''} ${n === f && f ? 'full' : ''}" data-t="${t.code}"><img alt="" src="${flags[t.code]}"><span>${esc(t.team?.name || t.code)}</span><em>${n}/${f}</em></button>`; }).join('')}</div>`).join('')}</nav>
        <section class="page" style="--kit:${kit.shirt};--kit2:${kit.shorts};--on:${lum(kit.shirt) > 0.6 ? '#1a1222' : '#ffffff'}">
          <div class="page-head"><img alt="" src="${flags[cur]}"><h3>${esc(T.team?.name || cur)}</h3><span>${h.size} / ${players.length}${h.size === players.length && players.length ? ' · COMPLETE!' : ''}</span></div>
          <div class="cards">${players.map(p => h.has(p.no) ? `<div class="sticker"><div class="ph"><i></i><b>${p.no}</b></div><div class="nm"><small>${esc(p.pos)}</small>${esc(p.name)}</div></div>` : `<div class="sticker empty"><b>${p.no}</b><small>${esc(p.pos)}</small></div>`).join('')}</div>
          <p class="hint">Collect stickers with the bonus jumps in a level – they go into the album when you finish the level.</p>
        </section>
      </div></div></div>`;
    root.querySelectorAll('[data-t]').forEach(b => b.onclick = () => { cur = b.dataset.t; render(); });
    root.querySelector('[data-a=close]').onclick = close;
  }
  const onKey = e => {
    if (e.code === 'Escape' || e.code === 'KeyA') { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    if (e.code === 'ArrowDown' || e.code === 'ArrowUp') { e.preventDefault(); e.stopImmediatePropagation(); const i = teams.findIndex(t => t.code === cur); cur = teams[(i + (e.code === 'ArrowDown' ? 1 : teams.length - 1)) % teams.length].code; render(); }
  };
  function close() { window.removeEventListener('keydown', onKey, true); root.innerHTML = ''; onClose?.(); }
  window.addEventListener('keydown', onKey, true);
  render();
}
