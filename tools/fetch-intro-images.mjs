// Downloads the stadium-intro photos listed in public/data/venues.json from Wikimedia Commons
// into public/img/intro/<venue>/<n>.<ext>, so the game does not depend on Wikimedia at runtime.
// Runs automatically during `docker compose build`. Missing photos are no problem:
// the game then loads them directly from Wikimedia, or draws its own comic panel.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const venues = JSON.parse(readFileSync(join(root, 'public', 'data', 'venues.json'), 'utf8'));
const UA = 'BRASILI-private-team-game/0.1 (internal, non-commercial)';
let ok = 0, failed = 0;

for (const v of Object.values(venues)) {
  for (const [i, m] of (v.images || []).entries()) {
    const ext = (m.url.match(/\.(jpe?g|png)$/i)?.[1] || 'jpg').toLowerCase();
    const dir = join(root, 'public', 'img', 'intro', v.id), file = join(dir, `${i + 1}.${ext}`);
    if (existsSync(file)) { ok++; continue; }
    try {
      const res = await fetch(m.url, { headers: { 'User-Agent': UA } });
      if (!res.ok) throw new Error(res.status);
      mkdirSync(dir, { recursive: true });
      writeFileSync(file, Buffer.from(await res.arrayBuffer()));
      ok++; console.log('ok  ', v.id, i + 1, m.file);
      await new Promise(r => setTimeout(r, 400)); // be polite to Wikimedia
    } catch (e) { failed++; console.log('skip', v.id, i + 1, m.file, String(e.message || e)); }
  }
}
console.log(`intro photos: ${ok} available, ${failed} not downloaded`);
