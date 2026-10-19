// Builds the JSON data files in public/data from the raw sources in this folder.
// Run: node tools/build-data.mjs
// Edit THIS file (teams, schedule, venues) and squads2023.txt, then re-run.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'public', 'data');

// ---------------------------------------------------------------- teams
// kit: shirt / shorts / socks, away: alternative shirt/shorts/socks, gk: goalkeeper shirt
// theme: true = a country world (theme pack) exists in public/js/game/themes.js
const T = (code, name, squadName, shirt, shorts, socks, away, gk, theme = false) =>
  ({ code, name, squadName, kit: { shirt, shorts, socks }, away, gk, theme });
const A = (shirt, shorts, socks) => ({ shirt, shorts, socks });

const teams = [
  T('NZL', 'New Zealand', 'New Zealand', '#f4f4f4', '#1b1b1f', '#f4f4f4', A('#1b1b1f', '#1b1b1f', '#1b1b1f'), '#3fb54a', true),
  T('NOR', 'Norway', 'Norway', '#d62a36', '#f4f4f4', '#1c3f94', A('#f4f4f4', '#1c3f94', '#f4f4f4'), '#f2c230', true),
  T('PHI', 'Philippines', 'Philippines', '#1f3fa6', '#1f3fa6', '#1f3fa6', A('#f4f4f4', '#f4f4f4', '#f4f4f4'), '#e8742a'),
  T('SUI', 'Switzerland', 'Switzerland', '#d8202c', '#d8202c', '#d8202c', A('#f4f4f4', '#f4f4f4', '#f4f4f4'), '#2a2a32'),
  T('AUS', 'Australia', 'Australia', '#ffd200', '#00843d', '#ffd200', A('#0f5132', '#0f5132', '#0f5132'), '#c2185b', true),
  T('IRL', 'Republic of Ireland', 'Republic of Ireland', '#169b62', '#f4f4f4', '#169b62', A('#f4f4f4', '#169b62', '#f4f4f4'), '#ff8c1a'),
  T('NGA', 'Nigeria', 'Nigeria', '#008751', '#008751', '#008751', A('#f4f4f4', '#f4f4f4', '#f4f4f4'), '#f2c230'),
  T('CAN', 'Canada', 'Canada', '#d52b1e', '#d52b1e', '#d52b1e', A('#f4f4f4', '#f4f4f4', '#f4f4f4'), '#2b2b2b'),
  T('ESP', 'Spain', 'Spain', '#c60b1e', '#14285e', '#c60b1e', A('#f3e9c6', '#f3e9c6', '#f3e9c6'), '#2f9e44', true),
  T('CRC', 'Costa Rica', 'Costa Rica', '#ce1126', '#002b7f', '#f4f4f4', A('#f4f4f4', '#f4f4f4', '#f4f4f4'), '#2f9e44'),
  T('ZAM', 'Zambia', 'Zambia', '#198a00', '#f4f4f4', '#198a00', A('#ef7d00', '#ef7d00', '#ef7d00'), '#2b2b2b'),
  T('JPN', 'Japan', 'Japan', '#1c3f94', '#1c3f94', '#1c3f94', A('#f4f4f4', '#f4f4f4', '#f4f4f4'), '#f2c230'),
  T('ENG', 'England', 'England', '#f4f4f4', '#1c2c5b', '#f4f4f4', A('#7a1f3d', '#7a1f3d', '#7a1f3d'), '#2f9e44', true),
  T('HAI', 'Haiti', 'Haiti', '#00209f', '#d21034', '#00209f', A('#f4f4f4', '#f4f4f4', '#f4f4f4'), '#f2c230'),
  T('DEN', 'Denmark', 'Denmark', '#c8102e', '#f4f4f4', '#c8102e', A('#f4f4f4', '#c8102e', '#f4f4f4'), '#2b2b2b'),
  T('CHN', 'China', 'China', '#de2910', '#de2910', '#de2910', A('#f4f4f4', '#f4f4f4', '#f4f4f4'), '#2b2b2b'),
  T('USA', 'United States', 'United States', '#f4f4f4', '#f4f4f4', '#f4f4f4', A('#1c2c5b', '#1c2c5b', '#1c2c5b'), '#f2c230'),
  T('VIE', 'Vietnam', 'Vietnam', '#da251d', '#da251d', '#da251d', A('#f4f4f4', '#f4f4f4', '#f4f4f4'), '#2b2b2b'),
  T('NED', 'Netherlands', 'Netherlands', '#f36c21', '#f36c21', '#f36c21', A('#1c2c5b', '#1c2c5b', '#1c2c5b'), '#2f9e44'),
  T('POR', 'Portugal', 'Portugal', '#c8102e', '#046a38', '#c8102e', A('#f4f4f4', '#f4f4f4', '#f4f4f4'), '#f2c230'),
  T('FRA', 'France', 'France', '#1f3d8a', '#f4f4f4', '#d6202c', A('#f4f4f4', '#f4f4f4', '#f4f4f4'), '#2f9e44', true),
  T('JAM', 'Jamaica', 'Jamaica', '#fed100', '#1b1b1f', '#fed100', A('#009b3a', '#009b3a', '#009b3a'), '#d21034'),
  T('BRA', 'Brazil', 'Brazil', '#ffdc02', '#1f4fa8', '#f4f4f4', A('#1f4fa8', '#f4f4f4', '#1f4fa8'), '#2b2b2b'),
  T('PAN', 'Panama', 'Panama', '#d21034', '#1c2c5b', '#d21034', A('#f4f4f4', '#f4f4f4', '#f4f4f4'), '#f2c230'),
  T('SWE', 'Sweden', 'Sweden', '#ffcd00', '#1c4fa0', '#ffcd00', A('#1c4fa0', '#1c4fa0', '#1c4fa0'), '#2b2b2b'),
  T('RSA', 'South Africa', 'South Africa', '#ffb612', '#007749', '#ffb612', A('#007749', '#007749', '#007749'), '#c2185b'),
  T('ITA', 'Italy', 'Italy', '#2b6fc4', '#f4f4f4', '#2b6fc4', A('#f4f4f4', '#2b6fc4', '#f4f4f4'), '#f2c230'),
  T('ARG', 'Argentina', 'Argentina', '#75aadb', '#1b1b1f', '#f4f4f4', A('#3a1f6a', '#3a1f6a', '#3a1f6a'), '#2f9e44'),
  T('GER', 'Germany', 'Germany', '#f4f4f4', '#1b1b1f', '#f4f4f4', A('#2a8c6b', '#2a8c6b', '#2a8c6b'), '#c2185b', true),
  T('MAR', 'Morocco', 'Morocco', '#c1272d', '#006233', '#c1272d', A('#f4f4f4', '#f4f4f4', '#f4f4f4'), '#f2c230', true),
  T('COL', 'Colombia', 'Colombia', '#fcd116', '#003893', '#ce1126', A('#003893', '#003893', '#003893'), '#2b2b2b'),
  T('KOR', 'South Korea', 'South Korea', '#cd2e3a', '#1b1b1f', '#cd2e3a', A('#f4f4f4', '#f4f4f4', '#f4f4f4'), '#2f9e44'),
];
const byName = Object.fromEntries(teams.map(t => [t.squadName, t.code]));

// ---------------------------------------------------------------- squads (2023 placeholders)
const squads = {};
for (const line of readFileSync(join(here, 'squads2023.txt'), 'utf8').split('\n')) {
  if (!line.trim()) continue;
  const i = line.indexOf(':');
  const team = line.slice(0, i).trim();
  const code = byName[team];
  if (!code) throw new Error('unknown team ' + team);
  const players = line.slice(i + 1).split(';').map(s => {
    const [no, pos, name, caps] = s.trim().split('|');
    return { no: +no, pos, name: name.trim(), caps: +caps || 0 };
  });
  squads[code] = { players, featured: pickFeatured(players) };
}
// "Main 11": 1 GK + 4 DF + 3 MF + 3 FW, most caps first (ties: lower shirt number).
// Teams without caps data fall back to shirt numbers 1–11.
function pickFeatured(players) {
  const haveCaps = players.filter(p => p.caps > 0).length >= 11;
  const order = (a, b) => haveCaps ? (b.caps - a.caps) || (a.no - b.no) : a.no - b.no;
  if (!haveCaps) return players.slice().sort(order).filter(p => p.no <= 11).map(p => p.no);
  const want = { GK: 1, DF: 4, MF: 3, FW: 3 };
  const chosen = [];
  for (const pos of ['GK', 'DF', 'MF', 'FW']) {
    chosen.push(...players.filter(p => p.pos === pos).sort(order).slice(0, want[pos]));
  }
  for (const p of players.slice().sort(order)) {           // fill if a position was short
    if (chosen.length >= 11) break;
    if (!chosen.includes(p) && p.pos !== 'GK') chosen.push(p);
  }
  return chosen.map(p => p.no);
}

// ---------------------------------------------------------------- venues (2027 host stadiums)
// Intro photos: Wikimedia Commons. Public domain / CC0 where available, otherwise CC BY / CC BY-SA
// (credits are shown in-game). Photos are only the base for the comic filter, never shown raw.
// role: city | exterior | interior     focus: point of interest (0..1) for cropping / camera moves
const C = 'https://thumb.wikimedia.org/wikipedia/commons/thumb/';
const img = (role, file, path, license, author, focus = [0.5, 0.5]) => ({
  role, file, license, author, focus,
  url: C + path + '/1920px-' + path.split('/').pop(),
  page: 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(file.replace(/ /g, '_')),
});
const venues = {
  rio: {
    city: 'Rio de Janeiro', stadium: 'Maracanã Stadium', local: 'Estádio do Maracanã',
    colors: ['#0c7c59', '#f7c548', '#1d3557'],
    images: [
      img('city', 'Cristo Redentor on the Corcovado, Rio de Janeiro.jpg', 'f/f9/Cristo_Redentor_on_the_Corcovado%2C_Rio_de_Janeiro.jpg', 'CC0', 'Wilfredor', [0.5, 0.35]),
      img('city', 'Sugarloaf Cable Car viewed from Rio de Janeiro, Brazil.jpg', 'e/ed/Sugarloaf_Cable_Car_viewed_from_Rio_de_Janeiro%2C_Brazil.jpg', 'CC0', 'Wilfredor', [0.5, 0.45]),
      img('exterior', 'Maracanã 2014 e.jpg', 'd/d4/Maracan%C3%A3_2014_e.jpg', 'CC BY 3.0 BR', 'Daniel Basil', [0.5, 0.5]),
      img('interior', 'Maracanã Stadium Panorama.jpg', 'b/b9/Maracan%C3%A3_Stadium_Panorama.jpg', 'CC0', 'ianjvoos', [0.5, 0.55]),
    ],
  },
  saopaulo: { city: 'São Paulo', stadium: 'Arena Itaquera', local: 'Arena de São Paulo', colors: ['#2b2d42', '#ef233c', '#edf2f4'], images: [] },
  bh: { city: 'Belo Horizonte', stadium: 'Mineirão Stadium', local: 'Estádio Mineirão', colors: ['#264653', '#e9c46a', '#2a9d8f'], images: [] },
  brasilia: {
    city: 'Brasília', stadium: 'Estádio Nacional', local: 'Estádio Nacional Mané Garrincha',
    colors: ['#3a86ff', '#ffbe0b', '#fb5607'],
    images: [
      img('city', 'Brasilia Congresso Nacional 05 2007 221.jpg', '7/74/Brasilia_Congresso_Nacional_05_2007_221.jpg', 'Public domain', 'Mario Roberto Duran Ortiz', [0.5, 0.5]),
      img('city', 'Catedral de Brasília - DSC00066.JPG', '2/22/Catedral_de_Bras%C3%ADlia_-_DSC00066.JPG', 'CC0', 'Daderot', [0.5, 0.5]),
      img('exterior', 'Brasilia aerea estadionacional.jpg', '5/57/Brasilia_aerea_estadionacional.jpg', 'CC BY 3.0 BR', 'Portal da Copa / Rui Faquini', [0.5, 0.5]),
      img('interior', 'Estádio Nacional de Brasília (panorâmica).jpg', 'f/f2/Est%C3%A1dio_Nacional_de_Bras%C3%ADlia_%28panor%C3%A2mica%29.jpg', 'CC BY 3.0', 'Danilo Borges', [0.5, 0.55]),
    ],
  },
  salvador: { city: 'Salvador', stadium: 'Arena Fonte Nova', local: 'Arena Fonte Nova', colors: ['#006d77', '#ffb703', '#e29578'], images: [] },
  recife: { city: 'Recife', stadium: 'Arena Pernambuco', local: 'Arena de Pernambuco', colors: ['#7209b7', '#f72585', '#4cc9f0'], images: [] },
  fortaleza: {
    city: 'Fortaleza', stadium: 'Arena Castelão', local: 'Arena Castelão',
    colors: ['#0077b6', '#f4a261', '#2a9d8f'],
    images: [
      img('city', 'JADEQUEIROZ PRAIA DE IRACEMA FORTALEZA CE (41060805232).jpg', '5/50/JADEQUEIROZ_PRAIA_DE_IRACEMA_FORTALEZA_CE_%2841060805232%29.jpg', 'Public domain', 'Jade Queiroz / MTur', [0.5, 0.5]),
      img('city', 'Ponte dos Ingleses - Ponte Metálica.png', '1/1f/Ponte_dos_Ingleses_-_Ponte_Met%C3%A1lica.png', 'CC BY 3.0 BR', 'ME / Portal da Copa / Embratur', [0.5, 0.5]),
      img('exterior', 'JADEQUEIROZ CASTELAO FORTALEZA CE (40209564415).jpg', '8/87/JADEQUEIROZ_CASTELAO_FORTALEZA_CE_%2840209564415%29.jpg', 'Public domain', 'Jade Queiroz / MTur', [0.5, 0.5]),
      img('interior', 'JADEQUEIROZ CASTELAO FORTALEZA CE (40394007274).jpg', '7/72/JADEQUEIROZ_CASTELAO_FORTALEZA_CE_%2840394007274%29.jpg', 'Public domain', 'Jade Queiroz / MTur', [0.5, 0.55]),
    ],
  },
  portoalegre: {
    city: 'Porto Alegre', stadium: 'Beira-Rio Stadium', local: 'Estádio Beira-Rio',
    colors: ['#d62828', '#f77f00', '#003049'],
    images: [
      img('city', 'Usina do Gasômetro - Porto Alegre (6307004827).jpg', '1/1a/Usina_do_Gas%C3%B4metro_-_Porto_Alegre_%286307004827%29.jpg', 'CC BY 2.0', 'Pedro Belleza', [0.5, 0.45]),
      img('city', 'Sun striking through the clouds over Guaiba river.jpg', 'b/bf/Sun_striking_through_the_clouds_over_Guaiba_river.jpg', 'CC BY 2.0', 'Felipe Valduga', [0.5, 0.45]),
      img('exterior', 'Estádio Beira-Rio 2021 12.jpg', '6/6b/Est%C3%A1dio_Beira-Rio_2021_12.jpg', 'CC BY-SA 4.0', 'Hedestad', [0.5, 0.55]),
    ],
  },
};
for (const [id, v] of Object.entries(venues)) v.id = id;

// ---------------------------------------------------------------- schedule
// Dates, cities and stadiums: real FIFA Women's World Cup 2027 schedule (group-stage
// match numbers are provisional). Teams: 2023 placeholders, inserted group by group
// (2023 Group A -> 2027 Group A slots, matchday order), knockout pairings of 2023 1:1.
const slots = [ // [no, date, group/round, venue]
  [1, '2027-06-24', 'A', 'rio'], [2, '2027-06-25', 'A', 'salvador'], [3, '2027-06-25', 'B', 'brasilia'], [4, '2027-06-25', 'B', 'saopaulo'],
  [5, '2027-06-26', 'C', 'bh'], [6, '2027-06-26', 'C', 'portoalegre'], [7, '2027-06-26', 'D', 'fortaleza'], [8, '2027-06-26', 'D', 'rio'],
  [9, '2027-06-27', 'E', 'recife'], [10, '2027-06-27', 'E', 'brasilia'], [11, '2027-06-27', 'F', 'salvador'], [12, '2027-06-27', 'F', 'saopaulo'],
  [13, '2027-06-28', 'G', 'fortaleza'], [14, '2027-06-28', 'G', 'bh'], [15, '2027-06-28', 'H', 'portoalegre'], [16, '2027-06-29', 'H', 'salvador'],
  [17, '2027-06-29', 'A', 'recife'], [18, '2027-06-29', 'A', 'saopaulo'], [19, '2027-06-30', 'B', 'bh'], [20, '2027-06-30', 'B', 'portoalegre'],
  [21, '2027-06-30', 'C', 'rio'], [22, '2027-07-01', 'C', 'brasilia'], [23, '2027-07-01', 'D', 'recife'], [24, '2027-07-01', 'D', 'saopaulo'],
  [25, '2027-07-02', 'E', 'fortaleza'], [26, '2027-07-02', 'E', 'salvador'], [27, '2027-07-02', 'F', 'bh'], [28, '2027-07-03', 'F', 'portoalegre'],
  [29, '2027-07-03', 'G', 'recife'], [30, '2027-07-03', 'G', 'rio'], [31, '2027-07-04', 'H', 'fortaleza'], [32, '2027-07-04', 'H', 'saopaulo'],
  [33, '2027-07-04', 'A', 'salvador'], [34, '2027-07-04', 'A', 'brasilia'], [35, '2027-07-05', 'B', 'recife'], [36, '2027-07-05', 'B', 'rio'],
  [37, '2027-07-05', 'C', 'bh'], [38, '2027-07-05', 'C', 'portoalegre'], [39, '2027-07-06', 'D', 'fortaleza'], [40, '2027-07-06', 'D', 'brasilia'],
  [41, '2027-07-07', 'E', 'recife'], [42, '2027-07-07', 'E', 'bh'], [43, '2027-07-07', 'F', 'salvador'], [44, '2027-07-07', 'F', 'rio'],
  [45, '2027-07-08', 'G', 'fortaleza'], [46, '2027-07-08', 'G', 'saopaulo'], [47, '2027-07-08', 'H', 'brasilia'], [48, '2027-07-08', 'H', 'portoalegre'],
  [49, '2027-07-10', 'R16', 'fortaleza'], [50, '2027-07-10', 'R16', 'recife'], [51, '2027-07-11', 'R16', 'bh'], [52, '2027-07-11', 'R16', 'saopaulo'],
  [53, '2027-07-12', 'R16', 'portoalegre'], [54, '2027-07-12', 'R16', 'salvador'], [55, '2027-07-13', 'R16', 'fortaleza'], [56, '2027-07-13', 'R16', 'brasilia'],
  [57, '2027-07-16', 'QF', 'bh'], [58, '2027-07-16', 'QF', 'rio'], [59, '2027-07-17', 'QF', 'fortaleza'], [60, '2027-07-17', 'QF', 'saopaulo'],
  [61, '2027-07-20', 'SF', 'saopaulo'], [62, '2027-07-21', 'SF', 'rio'], [63, '2027-07-24', '3RD', 'saopaulo'], [64, '2027-07-25', 'FINAL', 'rio'],
];
// 2023 group matches in matchday order (MD1 x2, MD2 x2, MD3 x2)
const groups2023 = {
  A: [['NZL', 'NOR'], ['PHI', 'SUI'], ['SUI', 'NOR'], ['NZL', 'PHI'], ['NOR', 'PHI'], ['SUI', 'NZL']], // NZL (host) in the host slots 1/18/34
  B: [['AUS', 'IRL'], ['NGA', 'CAN'], ['CAN', 'IRL'], ['AUS', 'NGA'], ['IRL', 'NGA'], ['CAN', 'AUS']],
  C: [['ESP', 'CRC'], ['ZAM', 'JPN'], ['JPN', 'CRC'], ['ESP', 'ZAM'], ['JPN', 'ESP'], ['CRC', 'ZAM']],
  D: [['ENG', 'HAI'], ['DEN', 'CHN'], ['ENG', 'DEN'], ['CHN', 'HAI'], ['CHN', 'ENG'], ['HAI', 'DEN']],
  E: [['USA', 'VIE'], ['NED', 'POR'], ['USA', 'NED'], ['POR', 'VIE'], ['VIE', 'NED'], ['POR', 'USA']],
  F: [['FRA', 'JAM'], ['BRA', 'PAN'], ['FRA', 'BRA'], ['PAN', 'JAM'], ['PAN', 'FRA'], ['JAM', 'BRA']],
  G: [['SWE', 'RSA'], ['ITA', 'ARG'], ['ARG', 'RSA'], ['SWE', 'ITA'], ['ARG', 'SWE'], ['RSA', 'ITA']],
  H: [['GER', 'MAR'], ['COL', 'KOR'], ['KOR', 'MAR'], ['GER', 'COL'], ['MAR', 'COL'], ['KOR', 'GER']],
};
const knockout2023 = {
  49: ['SUI', 'ESP'], 50: ['JPN', 'NOR'], 51: ['NED', 'RSA'], 52: ['SWE', 'USA'], 53: ['ENG', 'NGA'], 54: ['AUS', 'DEN'],
  55: ['COL', 'JAM'], 56: ['FRA', 'MAR'], 57: ['ESP', 'NED'], 58: ['JPN', 'SWE'], 59: ['AUS', 'FRA'], 60: ['ENG', 'COL'],
  61: ['ESP', 'SWE'], 62: ['AUS', 'ENG'], 63: ['SWE', 'AUS'], 64: ['ESP', 'ENG'],
};
const stageName = { R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', '3RD': 'Third place', FINAL: 'Final' };
const used = {};
const schedule = slots.map(([no, date, g, venue]) => {
  let pair;
  if (groups2023[g]) { used[g] = (used[g] || 0); pair = groups2023[g][used[g]++]; }
  else pair = knockout2023[no];
  return { id: no, date, stage: stageName[g] || 'Group ' + g, group: groups2023[g] ? g : null, venue, home: pair[0], away: pair[1] };
});

writeFileSync(join(out, 'teams.json'), JSON.stringify(Object.fromEntries(teams.map(t => [t.code, t])), null, 1));
writeFileSync(join(out, 'squads.json'), JSON.stringify(squads));
writeFileSync(join(out, 'venues.json'), JSON.stringify(venues, null, 1));
writeFileSync(join(out, 'schedule.json'), JSON.stringify(schedule, null, 1));
const themed = new Set(teams.filter(t => t.theme).map(t => t.code));
console.log('teams', teams.length, 'squads', Object.keys(squads).length, 'matches', schedule.length);
console.log('playable (both teams themed):', schedule.filter(m => themed.has(m.home) && themed.has(m.away)).map(m => `${m.id} ${m.home}-${m.away} @${m.venue}`).join(', '));
console.log('NOR featured:', squads.NOR.featured.map(n => squads.NOR.players.find(p => p.no === n).name).join(', '));
