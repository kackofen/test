// Progress on the world map. The rules live in shared/rules.js (the server applies the same ones);
// the state itself comes from the server (api3d.js), or from this browser in the server-less preview.
export { buildWorlds, playable, levelOpen, bonusOpen, bonusPlayable, BONUS_WORLDS, albumCount, totalScore } from '../shared/rules.js';
