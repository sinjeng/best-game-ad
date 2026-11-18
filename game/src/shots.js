// The screenshot scenes behind ?shot=start|play|end|win. Each one plays the real rules forward
// from a fresh world for a fixed number of steps, steered by an autopilot that reads only the
// world state — no wall clock and no unseeded random — so the same seed always gives the same
// frame. The strong pilot kites the nearest enemy and shoots it; the weak one wanders in a
// circle and never fires, so it is caught out, as a hurried player is.
import { FIELD, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE, SCREEN_WIN } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 13;
const LIMIT_SECONDS = 900;
/** Upgrade ids the strong pilot prefers, best first. */
const PICK_ORDER = ['damage', 'multishot', 'rate', 'pierce', 'heart', 'speed', 'swift', 'magnet', 'cache'];

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

function nearestEnemy(state) {
  const p = state.player;
  let target = null;
  let best = Infinity;
  for (const e of state.enemies) {
    if (!e.active) continue;
    const d2 = dist2(e.x, e.y, p.x, p.y);
    if (d2 < best) {
      best = d2;
      target = e;
    }
  }
  return target;
}

/** Kite the nearest enemy at 200-300 px and shoot it; strafe when the range is right. */
function strongPilot(state) {
  const p = state.player;
  const target = nearestEnemy(state);
  const aim = target ? { x: target.x, y: target.y } : { x: FIELD.width / 2, y: FIELD.height / 2 };
  let mx = 0;
  let my = 0;
  if (target) {
    const dx = p.x - target.x;
    const dy = p.y - target.y;
    const d = Math.hypot(dx, dy) || 1;
    if (d < 190) {
      mx = dx / d;
      my = dy / d;
    } else if (d > 300) {
      mx = -dx / d;
      my = -dy / d;
    } else {
      // Strafe around the target, switching direction every couple of seconds.
      const dir = Math.floor(state.time / 2) % 2 === 0 ? 1 : -1;
      mx = (-dy / d) * dir;
      my = (dx / d) * dir;
    }
  }
  // Never hug a wall: steer back toward the middle near the edges.
  if (p.x < 120) mx += 0.7;
  if (p.x > FIELD.width - 120) mx -= 0.7;
  if (p.y < 120) my += 0.7;
  if (p.y > FIELD.height - 120) my -= 0.7;
  const len = Math.hypot(mx, my) || 1;
  return { move: { x: mx / len, y: my / len }, aim, firing: target !== null };
}

/** Drift in a slow circle and shoot badly: it aims well off the nearest enemy, so most shots
 * miss, a few land by luck, and the arena catches up with it. */
function weakPilot(state) {
  const a = state.time * 0.45;
  const p = state.player;
  const target = nearestEnemy(state);
  let aim = { x: FIELD.width / 2, y: FIELD.height / 2 };
  if (target) {
    // Aim 70 degrees away from the target: the shots go wide on purpose.
    const dx = target.x - p.x;
    const dy = target.y - p.y;
    const rot = 1.22;
    const rx = dx * Math.cos(rot) - dy * Math.sin(rot);
    const ry = dx * Math.sin(rot) + dy * Math.cos(rot);
    aim = { x: p.x + rx, y: p.y + ry };
  }
  // A third of full speed: drifters (80-95) are faster than this, so they close in.
  return {
    move: { x: Math.cos(a) * 0.3, y: Math.sin(a) * 0.3 },
    aim,
    firing: target !== null,
  };
}

/** Pick the pilot's favourite upgrade of the three on offer. */
function autoPick(world) {
  const choices = world.state.choices ?? [];
  let bestIdx = 0;
  let bestRank = PICK_ORDER.length;
  for (let i = 0; i < choices.length; i += 1) {
    const rank = PICK_ORDER.indexOf(choices[i].id);
    if (rank !== -1 && rank < bestRank) {
      bestRank = rank;
      bestIdx = i;
    }
  }
  world.chooseUpgrade(bestIdx);
}

/**
 * Set `world` to the named scene (start, play, end or win; any other name is start) and return
 * the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end' && name !== 'win') {
    for (let i = 0; i < START_SECONDS / STEP; i += 1) world.step(STEP, null);
    return { screen: SCREEN_TITLE, best: 0 };
  }
  const pilot = name === 'end' ? weakPilot : strongPilot;
  const limit = LIMIT_SECONDS;
  for (let i = 0; i < limit / STEP; i += 1) {
    if (world.state.waveState === 'upgrade') {
      autoPick(world);
      continue;
    }
    if (world.state.waveState === 'victory' || world.state.waveState === 'over') break;
    if (name === 'play' && world.state.time >= PLAY_SECONDS) break;
    world.step(STEP, pilot(world.state));
  }
  if (world.state.waveState === 'victory') return { screen: SCREEN_WIN, best: world.state.score };
  if (world.state.waveState === 'over') return { screen: SCREEN_OVER, best: world.state.score };
  return { screen: SCREEN_PLAY, best: world.state.score };
}
