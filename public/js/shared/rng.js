// Deterministic random numbers – shared by browser and server so that every
// player gets exactly the same level for a match.
export function hashString(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function makeRng(seed) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.int = (min, max) => min + Math.floor(next() * (max - min + 1)); // inclusive
  next.pick = arr => arr[Math.floor(next() * arr.length)];
  next.chance = p => next() < p;
  next.weighted = entries => { // [[value, weight], ...]
    const total = entries.reduce((s, e) => s + e[1], 0);
    let r = next() * total;
    for (const [v, w] of entries) { if ((r -= w) < 0) return v; }
    return entries[entries.length - 1][0];
  };
  return next;
}
