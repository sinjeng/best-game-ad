// Emberfall Arena's rules and state, with no drawing and no browser in it: the player, four
// enemy kinds, waves, boss, upgrades, pickups, particles and score. step() advances one fixed
// step and returns what happened as bit flags, so the caller can react (and play sounds)
// without the world knowing about screens or audio. Nothing here allocates after createWorld
// returns: enemies, bullets, particles and floaters all come from fixed pools.
import {
  BULLET, EBULLET, ENEMY, FIELD, KIND_BOSS, KIND_BRUTE, KIND_DRIFTER, KIND_SPITTER,
  PARTICLES, FLOATERS, PICKUP, PLAYER, SPAWN_INTERVAL, UPGRADES, VICTORY_WAVE, waveComp,
} from './config.js';

export const EVENT_HIT = 1;
export const EVENT_KILL = 2;
export const EVENT_PICKUP = 4;
export const EVENT_WAVE_CLEAR = 8;
export const EVENT_OVER = 16;
export const EVENT_WIN = 32;
export const EVENT_UPGRADE = 64;

const TAU = Math.PI * 2;

function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

export function createWorld(random) {
  const player = {
    x: FIELD.width / 2, y: FIELD.height / 2, radius: PLAYER.radius,
    hp: PLAYER.maxHp, maxHp: PLAYER.maxHp, angle: -Math.PI / 2,
    fireTimer: 0, invuln: 0, speed: PLAYER.speed, damage: PLAYER.damage,
    fireRate: PLAYER.fireRate, multishot: PLAYER.multishot, pierce: PLAYER.pierce,
    bulletSpeed: PLAYER.bulletSpeed, magnet: PLAYER.magnet, starTimer: 0,
    upgradesTaken: {},
  };

  const enemies = [];
  for (let i = 0; i < 48; i += 1) {
    enemies.push({ active: false, kind: KIND_DRIFTER, x: 0, y: 0, vx: 0, vy: 0, hp: 1, maxHp: 1, radius: 14, speed: 90, shootTimer: 0, summonTimer: 0, burstTimer: 0, flash: 0, wobble: random() * TAU });
  }
  const bullets = [];
  for (let i = 0; i < 96; i += 1) bullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, damage: 1, pierce: 0, radius: 5, life: 0 });
  const ebullets = [];
  for (let i = 0; i < 128; i += 1) ebullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, radius: 7, life: 0 });
  const particles = [];
  for (let i = 0; i < PARTICLES; i += 1) particles.push({ active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 3, color: '#fff' });
  const floaters = [];
  for (let i = 0; i < FLOATERS; i += 1) floaters.push({ active: false, x: 0, y: 0, text: '', life: 0, color: '#fff' });
  const pickups = [];
  for (let i = 0; i < 16; i += 1) pickups.push({ active: false, kind: 'heart', x: 0, y: 0, vx: 0, vy: 0, life: 0 });

  const state = {
    player, enemies, bullets, ebullets, particles, floaters, pickups,
    score: 0, kills: 0, wave: 0, time: 0, waveTime: 0,
    waveState: 'fighting', // fighting | upgrade | victory | over
    choices: null, endless: false,
    spawnQueue: [], spawnTimer: 0,
    banner: { text: '', sub: '', timer: 0 },
    shake: 0, shakeX: 0, shakeY: 0,
    boss: null,
  };

  function free(pool) {
    for (let i = 0; i < pool.length; i += 1) if (!pool[i].active) return pool[i];
    return null;
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const p = free(particles);
      if (!p) return;
      const a = random() * TAU;
      const v = speed * (0.3 + random() * 0.7);
      p.active = true;
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
      p.maxLife = 0.35 + random() * 0.4;
      p.life = p.maxLife;
      p.size = 2 + random() * 4;
      p.color = color;
    }
  }

  function floater(x, y, text, color) {
    const f = free(floaters);
    if (!f) return;
    f.active = true;
    f.x = x; f.y = y; f.text = text; f.life = 1; f.color = color;
  }

  function addShake(amount) {
    state.shake = Math.min(14, state.shake + amount);
  }

  function dropPickup(x, y) {
    const roll = random();
    const kind = roll < PICKUP.heartChance ? 'heart' : roll < PICKUP.heartChance + PICKUP.starChance ? 'star' : null;
    if (!kind) return;
    const p = free(pickups);
    if (!p) return;
    p.active = true;
    p.kind = kind;
    p.x = x; p.y = y;
    const a = random() * TAU;
    p.vx = Math.cos(a) * 40; p.vy = Math.sin(a) * 40;
    p.life = 12;
  }

  function spawnEdge(kind) {
    const e = free(enemies);
    if (!e) return;
    const def = ENEMY[kind];
    const side = Math.floor(random() * 4);
    const m = 40;
    let x = m;
    let y = m;
    if (side === 0) { x = m + random() * (FIELD.width - 2 * m); y = -def.radius; }
    else if (side === 1) { x = m + random() * (FIELD.width - 2 * m); y = FIELD.height + def.radius; }
    else if (side === 2) { x = -def.radius; y = m + random() * (FIELD.height - 2 * m); }
    else { x = FIELD.width + def.radius; y = m + random() * (FIELD.height - 2 * m); }
    // Never drop one on top of the player.
    if (dist2(x, y, player.x, player.y) < 250 * 250) { x = FIELD.width - x; y = FIELD.height - y; }
    e.active = true;
    e.kind = kind;
    e.x = x; e.y = y; e.vx = 0; e.vy = 0;
    e.maxHp = def.hp;
    e.hp = def.hp;
    e.radius = def.radius;
    e.speed = def.speed + def.speedPerWave * (state.wave - 1);
    e.shootTimer = 1 + random() * 1.5;
    e.summonTimer = 4;
    e.burstTimer = 2.5;
    e.flash = 0;
    e.wobble = random() * TAU;
    if (kind === KIND_BOSS) state.boss = e;
  }

  function buildQueue(wave) {
    const comp = waveComp(wave);
    const queue = [];
    for (let i = 0; i < comp.drifter; i += 1) queue.push(KIND_DRIFTER);
    for (let i = 0; i < comp.spitter; i += 1) queue.push(KIND_SPITTER);
    for (let i = 0; i < comp.brute; i += 1) queue.push(KIND_BRUTE);
    // Shuffle the queue so the mix arrives in no fixed order; the boss always comes last.
    for (let i = queue.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      const tmp = queue[i]; queue[i] = queue[j]; queue[j] = tmp;
    }
    for (let i = 0; i < comp.boss; i += 1) queue.push(KIND_BOSS);
    return queue;
  }

  function rollChoices() {
    const valid = UPGRADES.filter((u) => (player.upgradesTaken[u.id] ?? 0) < u.max);
    const picks = [];
    const pool = valid.slice();
    while (picks.length < 3 && pool.length > 0) {
      picks.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
    }
    while (picks.length < 3) picks.push({ id: 'cache', title: 'SCORE CACHE', blurb: '+250 score', max: 99 });
    return picks;
  }

  function startWave(n) {
    state.wave = n;
    state.waveTime = 0;
    state.spawnQueue = buildQueue(n);
    state.spawnTimer = 0.5;
    state.waveState = 'fighting';
    state.choices = null;
    state.banner = { text: n === VICTORY_WAVE && !state.endless ? 'FINAL WAVE' : `WAVE ${n}`, sub: n === VICTORY_WAVE && !state.endless ? 'Defeat the Ember King' : '', timer: 2.2 };
  }

  function applyUpgrade(choice) {
    player.upgradesTaken[choice.id] = (player.upgradesTaken[choice.id] ?? 0) + 1;
    if (choice.id === 'damage') player.damage += 1;
    else if (choice.id === 'rate') player.fireRate *= 1.22;
    else if (choice.id === 'multishot') player.multishot += 1;
    else if (choice.id === 'speed') player.speed *= 1.13;
    else if (choice.id === 'heart') { player.maxHp += 1; player.hp = Math.min(player.maxHp, player.hp + 1); }
    else if (choice.id === 'pierce') player.pierce += 1;
    else if (choice.id === 'magnet') player.magnet += 70;
    else if (choice.id === 'swift') player.bulletSpeed *= 1.18;
    else if (choice.id === 'cache') state.score += 250;
  }

  function chooseUpgrade(index) {
    if (state.waveState !== 'upgrade' || !state.choices || index < 0 || index >= state.choices.length) return false;
    applyUpgrade(state.choices[index]);
    burst(player.x, player.y, '#7df9ff', 24, 220);
    startWave(state.wave + 1);
    return true;
  }

  function reset() {
    player.x = FIELD.width / 2;
    player.y = FIELD.height / 2;
    player.hp = PLAYER.maxHp;
    player.maxHp = PLAYER.maxHp;
    player.angle = -Math.PI / 2;
    player.fireTimer = 0;
    player.invuln = 0;
    player.speed = PLAYER.speed;
    player.damage = PLAYER.damage;
    player.fireRate = PLAYER.fireRate;
    player.multishot = PLAYER.multishot;
    player.pierce = PLAYER.pierce;
    player.bulletSpeed = PLAYER.bulletSpeed;
    player.magnet = PLAYER.magnet;
    player.starTimer = 0;
    player.upgradesTaken = {};
    for (const pool of [enemies, bullets, ebullets, particles, floaters, pickups]) {
      for (const item of pool) item.active = false;
    }
    state.score = 0;
    state.kills = 0;
    state.time = 0;
    state.wave = 0;
    state.endless = false;
    state.boss = null;
    state.shake = 0;
    state.shakeX = 0;
    state.shakeY = 0;
    state.banner = { text: '', sub: '', timer: 0 };
    startWave(1);
  }

  function hurtPlayer(events) {
    if (player.invuln > 0) return events;
    player.hp -= 1;
    player.invuln = PLAYER.invulnerable;
    addShake(9);
    burst(player.x, player.y, '#ff5a5a', 18, 260);
    events |= EVENT_HIT;
    if (player.hp <= 0) {
      state.waveState = 'over';
      events |= EVENT_OVER;
      burst(player.x, player.y, '#ffb347', 60, 380);
      addShake(14);
    }
    return events;
  }

  function killEnemy(e, events) {
    e.active = false;
    if (e.kind === KIND_BOSS) state.boss = null;
    const def = ENEMY[e.kind];
    state.score += def.score;
    state.kills += 1;
    floater(e.x, e.y, `+${def.score}`, '#f2c94c');
    burst(e.x, e.y, def.color, e.kind === KIND_BOSS ? 70 : 16, e.kind === KIND_BOSS ? 420 : 260);
    addShake(e.kind === KIND_BRUTE ? 4 : e.kind === KIND_BOSS ? 14 : 2);
    dropPickup(e.x, e.y);
    if (e.kind === KIND_BRUTE) {
      // Brutes split: two drifters crawl out of the wreck.
      for (let i = 0; i < 2; i += 1) {
        const d = free(enemies);
        if (!d) break;
        const ddef = ENEMY[KIND_DRIFTER];
        d.active = true; d.kind = KIND_DRIFTER;
        d.x = e.x + (i === 0 ? -18 : 18); d.y = e.y;
        d.vx = 0; d.vy = 0;
        d.maxHp = ddef.hp; d.hp = ddef.hp; d.radius = ddef.radius;
        d.speed = ddef.speed + ddef.speedPerWave * (state.wave - 1);
        d.shootTimer = 0; d.flash = 0; d.wobble = random() * TAU;
      }
    }
    return events | EVENT_KILL;
  }

  function fireBullets(aim) {
    const spread = 0.14;
    const n = player.multishot;
    const base = Math.atan2(aim.y - player.y, aim.x - player.x);
    player.angle = base;
    for (let i = 0; i < n; i += 1) {
      const b = free(bullets);
      if (!b) return;
      const off = (i - (n - 1) / 2) * spread;
      const a = base + off;
      b.active = true;
      b.x = player.x + Math.cos(a) * (player.radius + 6);
      b.y = player.y + Math.sin(a) * (player.radius + 6);
      b.vx = Math.cos(a) * player.bulletSpeed;
      b.vy = Math.sin(a) * player.bulletSpeed;
      b.damage = player.damage * (player.starTimer > 0 ? 2 : 1);
      b.pierce = player.pierce;
      b.radius = PLAYER.bulletRadius;
      b.life = BULLET.life;
    }
  }

  function stepEnemies(dt, events) {
    for (const e of enemies) {
      if (!e.active) continue;
      if (e.flash > 0) e.flash -= dt;
      const dx = player.x - e.x;
      const dy = player.y - e.y;
      const d = Math.hypot(dx, dy) || 1;
      if (e.kind === KIND_DRIFTER) {
        const wob = Math.sin(state.time * 3 + e.wobble) * 0.5;
        const nx = dx / d;
        const ny = dy / d;
        e.vx = (nx - ny * wob) * e.speed;
        e.vy = (ny + nx * wob) * e.speed;
      } else if (e.kind === KIND_SPITTER) {
        e.shootTimer -= dt;
        let mx = 0;
        let my = 0;
        if (d > 290) { mx = dx / d; my = dy / d; }
        else if (d < 210) { mx = -dx / d; my = -dy / d; }
        else { mx = -dy / d * 0.6; my = dx / d * 0.6; }
        e.vx = mx * e.speed;
        e.vy = my * e.speed;
        if (e.shootTimer <= 0 && d < 560) {
          e.shootTimer = 2.1 + random() * 0.5;
          const b = free(ebullets);
          if (b) {
            b.active = true;
            b.x = e.x; b.y = e.y;
            b.vx = (dx / d) * EBULLET.speed;
            b.vy = (dy / d) * EBULLET.speed;
            b.radius = EBULLET.radius;
            b.life = EBULLET.life;
          }
        }
      } else if (e.kind === KIND_BRUTE) {
        e.vx = (dx / d) * e.speed;
        e.vy = (dy / d) * e.speed;
      } else if (e.kind === KIND_BOSS) {
        e.vx = (dx / d) * e.speed;
        e.vy = (dy / d) * e.speed;
        e.burstTimer -= dt;
        if (e.burstTimer <= 0) {
          e.burstTimer = 3.0;
          const count = 10;
          for (let i = 0; i < count; i += 1) {
            const b = free(ebullets);
            if (!b) break;
            const a = (i / count) * TAU + state.time;
            b.active = true;
            b.x = e.x; b.y = e.y;
            b.vx = Math.cos(a) * EBULLET.speed * 0.85;
            b.vy = Math.sin(a) * EBULLET.speed * 0.85;
            b.radius = EBULLET.radius;
            b.life = EBULLET.life;
          }
          addShake(4);
        }
        e.summonTimer -= dt;
        if (e.summonTimer <= 0) {
          e.summonTimer = 6;
          let adds = 0;
          for (const o of enemies) if (o.active && o.kind === KIND_DRIFTER) adds += 1;
          if (adds < 6) {
            for (let i = 0; i < 2; i += 1) {
              const m = free(enemies);
              if (!m) break;
              const ddef = ENEMY[KIND_DRIFTER];
              m.active = true; m.kind = KIND_DRIFTER;
              m.x = e.x + (random() - 0.5) * 90; m.y = e.y + (random() - 0.5) * 90;
              m.vx = 0; m.vy = 0;
              m.maxHp = ddef.hp; m.hp = ddef.hp; m.radius = ddef.radius;
              m.speed = ddef.speed + ddef.speedPerWave * (state.wave - 1);
              m.shootTimer = 0; m.flash = 0; m.wobble = random() * TAU;
            }
          }
        }
      }
      e.x += e.vx * dt;
      e.y += e.vy * dt;
      // Contact hurts, with the player's brief invulnerability after a hit.
      const rr = e.radius + player.radius;
      if (dist2(e.x, e.y, player.x, player.y) < rr * rr) {
        events = hurtPlayer(events);
        if (state.waveState === 'over') return events;
        // Shove the enemy back so one touch is one hit, not a grind.
        e.x -= (dx / d) * 26;
        e.y -= (dy / d) * 26;
      }
    }
    return events;
  }

  function stepBullets(dt, events) {
    for (const b of bullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      for (const e of enemies) {
        if (!e.active) continue;
        const rr = e.radius + b.radius;
        if (dist2(b.x, b.y, e.x, e.y) >= rr * rr) continue;
        e.hp -= b.damage;
        e.flash = 0.09;
        burst(b.x, b.y, '#ffd97a', 4, 140);
        if (e.hp <= 0) {
          events = killEnemy(e, events);
          if (b.pierce > 0) {
            b.pierce -= 1;
            continue;
          }
        }
        b.active = false;
        break;
      }
    }
    for (const b of ebullets) {
      if (!b.active) continue;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0 || b.x < -20 || b.x > FIELD.width + 20 || b.y < -20 || b.y > FIELD.height + 20) {
        b.active = false;
        continue;
      }
      const rr = b.radius + player.radius;
      if (dist2(b.x, b.y, player.x, player.y) < rr * rr) {
        b.active = false;
        events = hurtPlayer(events);
        if (state.waveState === 'over') return events;
      }
    }
    return events;
  }

  function stepPickups(dt, events) {
    for (const p of pickups) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      const d2 = dist2(p.x, p.y, player.x, player.y);
      if (d2 < player.magnet * player.magnet) {
        const d = Math.sqrt(d2) || 1;
        const pull = 420 * dt;
        p.x += ((player.x - p.x) / d) * pull;
        p.y += ((player.y - p.y) / d) * pull;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.98;
        p.vy *= 0.98;
      }
      const rr = PICKUP.radius + player.radius;
      if (d2 < rr * rr) {
        p.active = false;
        if (p.kind === 'heart') {
          if (player.hp < player.maxHp) {
            player.hp += 1;
            floater(player.x, player.y - 24, '+1 HP', '#ff6b81');
          } else {
            state.score += 50;
            floater(player.x, player.y - 24, '+50', '#f2c94c');
          }
        } else {
          player.starTimer = PICKUP.starSeconds;
          floater(player.x, player.y - 24, 'DOUBLE DAMAGE!', '#7df9ff');
        }
        events |= EVENT_PICKUP;
      }
    }
    return events;
  }

  function stepFx(dt) {
    for (const p of particles) {
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
    }
    for (const f of floaters) {
      if (!f.active) continue;
      f.life -= dt * 0.9;
      if (f.life <= 0) { f.active = false; continue; }
      f.y -= 34 * dt;
    }
    if (state.shake > 0) {
      state.shake = Math.max(0, state.shake - dt * 26);
      state.shakeX = (random() * 2 - 1) * state.shake;
      state.shakeY = (random() * 2 - 1) * state.shake;
    } else {
      state.shakeX = 0;
      state.shakeY = 0;
    }
    if (state.banner.timer > 0) state.banner.timer -= dt;
  }

  function anyEnemyActive() {
    for (const e of enemies) if (e.active) return true;
    return false;
  }

  /**
   * One fixed step. `input` is { move, aim, firing } or null for the title backdrop, where
   * enemies wander and nothing can hurt or score. Returns EVENT_* flags.
   */
  function step(dt, input) {
    let events = 0;
    state.time += dt;
    if (player.invuln > 0) player.invuln = Math.max(0, player.invuln - dt);
    if (player.starTimer > 0) player.starTimer -= dt;
    if (player.fireTimer > 0) player.fireTimer -= dt;

    if (state.waveState === 'upgrade' || state.waveState === 'victory' || state.waveState === 'over') {
      stepFx(dt);
      return events;
    }

    const demo = input === null;
    if (!demo) {
      const mv = input.move;
      player.x = Math.min(FIELD.width - player.radius, Math.max(player.radius, player.x + mv.x * player.speed * dt));
      player.y = Math.min(FIELD.height - player.radius, Math.max(player.radius, player.y + mv.y * player.speed * dt));
      player.angle = Math.atan2(input.aim.y - player.y, input.aim.x - player.x);
      if (input.firing && player.fireTimer <= 0) {
        player.fireTimer = 1 / player.fireRate;
        fireBullets(input.aim);
      }
      state.waveTime += dt;
      if (state.spawnQueue.length > 0) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          state.spawnTimer = SPAWN_INTERVAL;
          spawnEdge(state.spawnQueue.shift());
        }
      }
    } else {
      // Title backdrop: a few wanderers drift across the arena, harmless.
      state.spawnTimer -= dt;
      if (state.spawnTimer <= 0) {
        state.spawnTimer = 1.6;
        let count = 0;
        for (const e of enemies) if (e.active) count += 1;
        if (count < 5) spawnEdge(random() < 0.7 ? KIND_DRIFTER : KIND_SPITTER);
      }
      for (const e of enemies) {
        if (!e.active) continue;
        e.x += Math.cos(state.time * 0.7 + e.wobble) * 26 * dt;
        e.y += Math.sin(state.time * 0.9 + e.wobble) * 26 * dt;
      }
    }

    if (!demo) {
      events = stepEnemies(dt, events);
      if (state.waveState === 'over') { stepFx(dt); return events; }
      events = stepBullets(dt, events);
      if (state.waveState === 'over') { stepFx(dt); return events; }
      events = stepPickups(dt, events);

      if (state.spawnQueue.length === 0 && !anyEnemyActive()) {
        const bonus = 50 + 25 * state.wave;
        state.score += bonus;
        floater(player.x, player.y - 30, `WAVE CLEAR +${bonus}`, '#7df9ff');
        if (state.wave === VICTORY_WAVE && !state.endless) {
          state.waveState = 'victory';
          events |= EVENT_WIN;
        } else {
          state.choices = rollChoices();
          state.waveState = 'upgrade';
          events |= EVENT_UPGRADE;
        }
        events |= EVENT_WAVE_CLEAR;
      }
    }
    stepFx(dt);
    return events;
  }

  reset();
  return {
    state, reset, step, chooseUpgrade,
    startRun() {
      reset();
    },
    continueEndless() {
      state.endless = true;
      startWave(state.wave + 1);
    },
  };
}
