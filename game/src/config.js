// Emberfall Arena — every tuning number and colour in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** Clear this wave to win the run; after it the player may keep going endlessly. */
export const VICTORY_WAVE = 5;

export const PLAYER = {
  radius: 14,
  speed: 330,
  maxHp: 3,
  fireRate: 4.5,
  bulletSpeed: 640,
  bulletRadius: 5,
  damage: 1,
  multishot: 1,
  pierce: 0,
  invulnerable: 1.0,
  magnet: 90,
};

export const BULLET = { life: 1.1 };

/** Enemy kinds. */
export const KIND_DRIFTER = 0;
export const KIND_SPITTER = 1;
export const KIND_BRUTE = 2;
export const KIND_BOSS = 3;

export const ENEMY = {
  [KIND_DRIFTER]: { radius: 14, hp: 2, speed: 96, speedPerWave: 7, score: 10, color: '#e5538a', name: 'Drifter' },
  [KIND_SPITTER]: { radius: 13, hp: 2, speed: 66, speedPerWave: 4, score: 15, color: '#9b6bff', name: 'Spitter' },
  [KIND_BRUTE]: { radius: 22, hp: 6, speed: 56, speedPerWave: 3, score: 25, color: '#e5534b', name: 'Brute' },
  [KIND_BOSS]: { radius: 42, hp: 60, speed: 46, speedPerWave: 0, score: 200, color: '#ff2e63', name: 'Ember King' },
};

/** Enemy bullets (spitters and the boss). */
export const EBULLET = { radius: 7, speed: 210, life: 5 };

/** Wave composition: how many of each kind a wave fields, before the boss wave. */
export function waveComp(wave) {
  return {
    drifter: 4 + wave * 2,
    spitter: Math.max(0, wave - 1),
    brute: Math.max(0, wave - 2),
    boss: wave === VICTORY_WAVE ? 1 : 0,
  };
}

/** Seconds between spawns inside a wave; the trickle keeps the arena from flooding at once. */
export const SPAWN_INTERVAL = 0.65;

/** Upgrade choices offered between waves: id, title, blurb, and the cap on times it can stack. */
export const UPGRADES = [
  { id: 'damage', title: 'HEAVY EMBERS', blurb: '+1 bullet damage', max: 4 },
  { id: 'rate', title: 'RAPID IGNITION', blurb: '+22% fire rate', max: 5 },
  { id: 'multishot', title: 'SPLIT SHOT', blurb: '+1 bullet per shot', max: 2 },
  { id: 'speed', title: 'SWIFT BOOTS', blurb: '+13% move speed', max: 4 },
  { id: 'heart', title: 'EMBER HEART', blurb: '+1 max health, heal 1', max: 3 },
  { id: 'pierce', title: 'PIERCING FLAME', blurb: 'Bullets pierce +1 enemy', max: 3 },
  { id: 'magnet', title: 'GREEDY SPARK', blurb: '+70 pickup magnet range', max: 3 },
  { id: 'swift', title: 'HOT ROUNDS', blurb: '+18% bullet speed', max: 3 },
];

/** Pickups enemies may drop: a heart heals, a star doubles damage for a while. */
export const PICKUP = { heartChance: 0.08, starChance: 0.05, starSeconds: 8, radius: 13 };

export const PARTICLES = 256;
export const FLOATERS = 24;

export const PALETTE = {
  backdrop: '#0d0b1e',
  floor: '#14122a',
  grid: '#1d1a3d',
  rim: '#2c2760',
  player: '#ffb347',
  playerCore: '#fff3d6',
  bullet: '#ffd97a',
  ebullet: '#c77dff',
  gem: '#f2c94c',
  heart: '#ff6b81',
  star: '#7df9ff',
  panel: '#1b1836',
  panelEdge: '#3a3380',
  text: '#eef1f5',
  muted: '#9a94c7',
  banner: '#ffd97a',
  danger: '#ff5a5a',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'emberfall-arena.best';
