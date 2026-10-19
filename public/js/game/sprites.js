// Procedural 16-bit sprites: footballers (Brasili, defenders, goalkeepers), items, props.
import { makeCanvas, outline, flipped, shade, disc, line, px, poly, OUTLINE, luminance } from './pixel.js';

export const SKINS = ['#f6d3b3', '#eab88f', '#d39b6b', '#b07447', '#8a5432', '#5e3a22'];
export const HAIRS = ['#1d1a1f', '#4a2c1a', '#7b4a24', '#c58b3a', '#e6c76a', '#b0442a', '#e9e2d0'];
export const HAIR_STYLES = ['ponytail', 'bun', 'short', 'braids', 'afro'];
export const DEFAULT_LOOK = { hairStyle: 'ponytail', hair: '#4a2c1a', skin: '#eab88f', boots: '#ff4fa3', number: 10, kit: { shirt: '#14b8a6', shorts: '#0f172a', socks: '#14b8a6' } };

export const FW = 20, FH = 28; // footballer frame size

// joint positions per pose (facing right). legs: [hip, knee, foot], arms: [shoulder, elbow, hand]
const POSES = {
  stand: { bob: 0, headUp: 0, fl: [[11, 19], [11.5, 22], [12, 25]], bl: [[9, 19], [9, 22], [8.5, 25]], fa: [[12, 12], [12.5, 15], [12.5, 17]], ba: [[8.5, 12], [8, 15], [8, 17]] },
  run1: { bob: 0, headUp: 0, fl: [[11, 19], [13.5, 21], [15, 24.5]], bl: [[9, 19], [7.5, 22], [5, 24]], fa: [[12, 12], [10, 14.5], [9, 16.5]], ba: [[8.5, 12], [10.5, 14], [12.5, 14]] },
  run2: { bob: -1, headUp: 0, fl: [[11, 19], [13.5, 20], [12.5, 23]], bl: [[9, 19], [9.5, 22], [9, 25]], fa: [[12, 12], [12, 15], [11.5, 17]], ba: [[8.5, 12], [8.5, 15], [9, 17]] },
  run3: { bob: 0, headUp: 0, fl: [[11, 19], [9.5, 22], [7, 24]], bl: [[9, 19], [11.5, 21], [13.5, 24.5]], fa: [[12, 12], [14, 14], [15.5, 13.5]], ba: [[8.5, 12], [7, 14.5], [6, 16.5]] },
  run4: { bob: -1, headUp: 0, fl: [[11, 19], [11, 22], [11, 25]], bl: [[9, 19], [11.5, 20], [10.5, 23]], fa: [[12, 12], [12.5, 15], [12.5, 17]], ba: [[8.5, 12], [8, 15], [8, 17]] },
  jump: { bob: -1, headUp: 0, fl: [[11, 19], [14, 19.5], [13.5, 22.5]], bl: [[9, 19], [8, 22], [6, 23.5]], fa: [[12, 12], [14, 10], [15, 7.5]], ba: [[8.5, 12], [6.5, 10.5], [5.5, 8.5]] },
  fall: { bob: 0, headUp: 0, fl: [[11, 19], [13, 22], [14, 25]], bl: [[9, 19], [8, 22], [6.5, 25]], fa: [[12, 12], [14.5, 12.5], [16, 11]], ba: [[8.5, 12], [6, 12.5], [4.5, 11]] },
  header: { bob: -1, headUp: 1, fl: [[11, 19], [13, 21], [12, 24]], bl: [[9, 19], [7.5, 21.5], [6, 24]], fa: [[12, 12], [10.5, 15], [9, 16.5]], ba: [[8.5, 12], [6.5, 14], [5, 15]] },
  hurt: { bob: 0, headUp: -1, fl: [[11, 19], [12.5, 22], [14, 24.5]], bl: [[9, 19], [9, 22], [9, 25]], fa: [[12, 12], [14, 9.5], [14.5, 7]], ba: [[8.5, 12], [6.5, 9.5], [6, 7]] },
  cheer: { bob: -1, headUp: 0, fl: [[11, 19], [11.5, 22], [12.5, 25]], bl: [[9, 19], [8.5, 22], [7.5, 25]], fa: [[12, 12], [14, 9], [15, 6]], ba: [[8.5, 12], [7, 9], [6, 6]] },
  dive: { bob: 0, headUp: 0, fl: [[11, 19], [13.5, 20.5], [16, 21]], bl: [[9, 19], [12, 22], [15, 23]], fa: [[12, 12], [15, 9.5], [17.5, 7.5]], ba: [[8.5, 12], [12, 10], [15, 8.5]] },
};
export const POSE_NAMES = Object.keys(POSES);

function limb(ctx, pts, colors, w = 2) {
  // pts: [a, b, c]; colors: [upper, lower]
  line(ctx, pts[0][0], pts[0][1], pts[1][0], pts[1][1], colors[0], w);
  line(ctx, pts[1][0], pts[1][1], pts[2][0], pts[2][1], colors[1], w);
}

export function drawFootballer(poseName, look, kit, opts = {}) {
  const P = POSES[poseName] || POSES.stand;
  const [c, ctx] = makeCanvas(FW, FH);
  const by = P.bob;
  const skin = look.skin, skinD = shade(look.skin, -0.18);
  const shirt = kit.shirt, shirtD = shade(kit.shirt, luminance(kit.shirt) > 0.85 ? -0.16 : -0.28);
  const shorts = kit.shorts, shortsD = shade(kit.shorts, luminance(kit.shorts) > 0.85 ? -0.16 : -0.3);
  const socks = kit.socks, socksD = shade(kit.socks, luminance(kit.socks) > 0.85 ? -0.16 : -0.3);
  const boots = look.boots || '#222', bootsD = shade(boots, -0.35);
  const gk = !!opts.gk, gloves = opts.gloves || '#f5f5f5';
  const T = (pts) => pts.map(([x, y]) => [x, y + by]);

  // back arm + back leg (darker)
  const ba = T(P.ba), bl = T(P.bl), fa = T(P.fa), fl = T(P.fl);
  limb(ctx, ba, [shirtD, gk ? shirtD : skinD]);
  px(ctx, ba[2][0] - 1, ba[2][1] - 0.5, gk ? shade(gloves, -0.2) : skinD, 2, 2);
  limb(ctx, bl, [skinD, socksD]);
  px(ctx, bl[2][0] - 1, bl[2][1] - 1, bootsD, 4, 2);

  // shorts + torso
  px(ctx, 8, 17 + by, shorts, 6, 3); px(ctx, 8, 17 + by, shortsD, 1, 3); px(ctx, 8, 19 + by, shortsD, 6, 1);
  px(ctx, 8, 11 + by, shirt, 6, 7);
  px(ctx, 8, 11 + by, shirtD, 1, 7); px(ctx, 9, 16 + by, shirtD, 5, 1);
  px(ctx, 12, 11 + by, shade(shirt, luminance(shirt) > 0.5 ? -0.45 : 0.45), 2, 1); // collar trim
  if (opts.stripes) for (let x = 9; x < 14; x += 2) px(ctx, x, 12 + by, opts.stripes, 1, 4);

  // front leg + front arm
  limb(ctx, fl, [skin, socks]);
  px(ctx, fl[1][0] - 0.5, fl[1][1] + 0.5, socks, 2, 1);
  px(ctx, fl[2][0] - 1, fl[2][1] - 1, boots, 4, 2); px(ctx, fl[2][0] - 1, fl[2][1], bootsD, 4, 1);
  limb(ctx, fa, [shirt, gk ? shirt : skin]);
  if (gk) px(ctx, fa[2][0] - 1, fa[2][1] - 1, gloves, 3, 3); else px(ctx, fa[2][0] - 1, fa[2][1] - 0.5, skin, 2, 2);

  // neck + head
  px(ctx, 10, 10 + by, skinD, 3, 1);
  const hx = 11, hy = 6 + by - P.headUp * 0.5;
  const style = look.hairStyle || 'ponytail', hair = look.hair, hairD = shade(look.hair, -0.3), hairL = shade(look.hair, 0.25);
  if (style === 'afro') disc(ctx, hx - 0.5, hy - 1, 5, hair);
  if (style === 'bun') { disc(ctx, hx - 3.5, hy - 4, 2, hairD); px(ctx, hx - 4, hy - 5, hairL, 1, 1); }
  if (style === 'ponytail') {
    const sw = opts.sway || 0;
    line(ctx, hx - 3, hy - 2, hx - 6 - sw, hy + 1, hair, 2); line(ctx, hx - 6 - sw, hy + 1, hx - 7 - sw * 1.5, hy + 4, hairD, 2);
  }
  if (style === 'braids') { line(ctx, hx - 4, hy, hx - 5, hy + 7, hairD, 1); line(ctx, hx - 3, hy + 1, hx - 3.5, hy + 7, hair, 1); }
  disc(ctx, hx, hy, 4, skin);
  // hair cap
  const capTop = style === 'afro' ? 2 : 0.6;
  ctx.fillStyle = hair;
  for (let y = -4; y <= 4; y++) for (let x = -4; x <= 4; x++) {
    if (x * x + y * y > 18.5) continue;
    if (y < -capTop || (x < -1 && y < 2) || (x < -2 && y < 3.5)) ctx.fillRect(Math.round(hx + x), Math.round(hy + y), 1, 1);
  }
  px(ctx, hx + 1, hy - 1, hair, 3, 1);        // fringe
  px(ctx, hx - 2, hy - 4, hairL, 3, 1);       // shine
  px(ctx, hx - 1, hy + 1, skinD, 1, 2);       // ear
  // face
  if (opts.face === 'ouch') { px(ctx, hx + 2, hy, OUTLINE, 1, 1); px(ctx, hx + 2, hy - 1 + 2, OUTLINE, 1, 1); px(ctx, hx + 3, hy + 2, '#7a2230', 1, 1); }
  else {
    px(ctx, hx + 2, hy - P.headUp * 0.5, OUTLINE, 1, 2);
    px(ctx, hx + 3, hy + 2 - P.headUp * 0.5, '#b5545c', 1, 1);
  }
  px(ctx, hx + 3, hy + 1 - P.headUp * 0.5, shade(skin, -0.08), 1, 1);
  if (opts.headband) px(ctx, hx - 3, hy - 2, opts.headband, 7, 1);
  return outline(c);
}

// all frames for one look+kit, both directions: { right: {pose: canvas}, left: {...} }
export function footballerSheet(look, kit, opts = {}) {
  const right = {}, left = {};
  for (const p of POSE_NAMES) {
    const sway = p.startsWith('run') ? (p === 'run2' || p === 'run4' ? 1 : 0) : (p === 'jump' ? -1 : 0);
    right[p] = drawFootballer(p, look, kit, { ...opts, sway, face: p === 'hurt' ? 'ouch' : undefined });
    left[p] = flipped(right[p]);
  }
  return { right, left };
}

// --------------------------------------------------------------------- items (12x12)
const ITEMS = {
  kiwi(ctx) { disc(ctx, 6, 6, 5, '#6b4423'); disc(ctx, 6, 6, 4, '#7cb342'); disc(ctx, 6, 6, 2, '#c5e1a5'); disc(ctx, 6, 6, 1, '#f1f8e9');
    for (let a = 0; a < 8; a++) px(ctx, 6 + Math.cos(a * 0.785) * 2.8, 6 + Math.sin(a * 0.785) * 2.8, '#1b1b1b'); },
  waffle(ctx) { poly(ctx, [[6, 11], [1, 6], [1, 3], [3, 1], [6, 3], [9, 1], [11, 3], [11, 6]], '#e3a548');
    for (let i = 2; i < 11; i += 3) { line(ctx, i, 1, i, 10, '#b97d2a'); line(ctx, 1, i, 11, i, '#b97d2a'); } px(ctx, 3, 3, '#f6d28b', 2, 1); },
  pretzel(ctx) { const b = '#a05a26', d = '#7a3f15';
    disc(ctx, 6, 6.5, 5, b); ctx.clearRect(4, 4, 4, 5); disc(ctx, 3.5, 5.5, 1.2, 'rgba(0,0,0,0)');
    ctx.clearRect(2, 4, 2, 3); ctx.clearRect(8, 4, 2, 3);
    line(ctx, 6, 2, 3, 10, b, 2); line(ctx, 6, 2, 9, 10, b, 2); line(ctx, 4.5, 7, 7.5, 7, d, 1);
    px(ctx, 1, 5, b, 1, 3); px(ctx, 10, 5, b, 1, 3);
    [[3, 3], [9, 3], [2, 8], [10, 8], [6, 4]].forEach(([x, y]) => px(ctx, x, y, '#ffffff')); },
  minttea(ctx) { poly(ctx, [[3, 3], [9, 3], [8, 11], [4, 11]], '#d9eef0'); poly(ctx, [[3.6, 5], [8.6, 5], [8, 10.5], [4, 10.5]], '#c58f1e');
    px(ctx, 3, 3, '#e8c252', 7, 1); px(ctx, 4, 10, '#e8c252', 5, 1); disc(ctx, 6, 2, 1.5, '#4caf50'); px(ctx, 7, 1, '#81c784', 2, 1); px(ctx, 5, 6, '#e8b850', 1, 3); },
  boomerang(ctx) { line(ctx, 1, 9, 6, 2, '#c4763b', 3); line(ctx, 6, 2, 11, 9, '#c4763b', 3); line(ctx, 2, 8, 6, 3, '#e3a066', 1); px(ctx, 4, 5, '#7a3e12'); px(ctx, 8, 5, '#7a3e12'); px(ctx, 6, 3, '#f2e3c6'); },
  croissant(ctx) { const c1 = '#d99a3d', c2 = '#b8742a'; disc(ctx, 6, 7, 3, c1); disc(ctx, 3, 8, 2, c1); disc(ctx, 9, 8, 2, c1); disc(ctx, 1.5, 9.5, 1, c2); disc(ctx, 10.5, 9.5, 1, c2);
    line(ctx, 4, 5, 5, 9, c2); line(ctx, 8, 5, 7, 9, c2); px(ctx, 5, 5, '#f2c36b', 2, 1); },
  orange(ctx) { disc(ctx, 6, 7, 4.5, '#f08a00'); disc(ctx, 5, 6, 2, '#ffb340'); px(ctx, 4, 5, '#ffe0a3'); line(ctx, 6, 2, 9, 1, '#3e8e41', 2); px(ctx, 6, 2, '#5d4037'); },
  teacup(ctx) { px(ctx, 1, 10, '#e9e4dc', 10, 1); px(ctx, 2, 4, '#ffffff', 7, 6); px(ctx, 2, 6, '#2f5aa8', 7, 1); px(ctx, 9, 5, '#ffffff', 2, 1); px(ctx, 10, 5, '#ffffff', 1, 3); px(ctx, 9, 7, '#ffffff', 2, 1);
    px(ctx, 3, 4, '#8b5a2b', 5, 1); px(ctx, 4, 1, '#cfd8dc', 1, 2); px(ctx, 6, 0, '#cfd8dc', 1, 2); },
  ball(ctx) { disc(ctx, 6, 6, 5, '#ffffff'); disc(ctx, 6, 6, 1.5, '#222'); [[3, 3], [9, 3], [3, 9], [9, 9], [6, 1], [6, 11]].forEach(([x, y]) => px(ctx, x, y, '#333', 1, 1)); px(ctx, 4, 4, '#e0e0e0', 1, 1); },
};
export const ITEM_KINDS = Object.keys(ITEMS);
export function itemSprite(kind) {
  const [c, ctx] = makeCanvas(14, 14);
  ctx.translate(1, 1);
  (ITEMS[kind] || ITEMS.ball)(ctx);
  return outline(c);
}

export function ballSprite() {
  const [c, ctx] = makeCanvas(10, 10);
  disc(ctx, 5, 5, 3.6, '#ffffff'); px(ctx, 4, 4, '#222', 2, 2); px(ctx, 2, 3, '#555', 1, 1); px(ctx, 7, 6, '#555', 1, 1); px(ctx, 3, 7, '#555', 1, 1);
  px(ctx, 3, 2, '#e8e8e8', 1, 1);
  return outline(c);
}

// player sticker card (shirt colour of the team)
export function stickerSprite(kit, shine = 0) {
  const [c, ctx] = makeCanvas(16, 20);
  px(ctx, 1, 1, '#fdfaf0', 14, 18);
  px(ctx, 2, 2, kit.shirt, 12, 12);
  px(ctx, 2, 10, shade(kit.shirt, -0.25), 12, 4);
  disc(ctx, 8, 6, 2.5, '#2a2030'); px(ctx, 4, 10, '#2a2030', 8, 4); // silhouette
  px(ctx, 2, 15, shade(kit.shorts, 0), 12, 3);
  px(ctx, 4, 16, '#fdfaf0', 8, 1);
  if (shine) { line(ctx, 2 + shine, 2, 2 + shine - 4, 13, 'rgba(255,255,255,0.7)', 1); }
  return outline(c);
}

export function shieldSprite(kit) {
  const [c, ctx] = makeCanvas(12, 14);
  poly(ctx, [[2, 1], [9, 1], [10, 3], [10, 12], [6, 13], [1, 12], [1, 3]], '#f5f5f5');
  px(ctx, 2, 4, kit.shirt, 8, 3); px(ctx, 2, 9, shade(kit.shirt, -0.2), 8, 1);
  px(ctx, 3, 2, '#ffffff', 2, 1);
  return outline(c);
}

export function springSprite(kit, squash = 0) {
  const [c, ctx] = makeCanvas(18, 12);
  const top = 3 + squash * 4;
  px(ctx, 1, 10, '#3d3d46', 16, 2);
  px(ctx, 2, top + 1, '#8a8a96', 2, 10 - top); px(ctx, 14, top + 1, '#8a8a96', 2, 10 - top);
  for (let x = 4; x < 14; x += 2) line(ctx, x, top + 2, x + 1, 10, '#c9c9d4');
  px(ctx, 1, top, kit.shirt, 16, 2); px(ctx, 1, top + 1, shade(kit.shirt, -0.3), 16, 1);
  px(ctx, 3, top, '#ffffff', 4, 1);
  return outline(c);
}
