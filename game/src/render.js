// The canvas painter: the arena, every entity, the HUD and each screen. It reads state and
// draws it, and never changes a rule. Screens: title, play, paused, upgrade, game over and
// victory. The logical field is 1280x720 and the painter scales it to the canvas, so the
// screenshots at 1280x720 are exactly what a player sees.
import { ENEMY, FIELD, FONT, KIND_BOSS, KIND_BRUTE, KIND_DRIFTER, KIND_SPITTER, PALETTE, VICTORY_WAVE } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_UPGRADE = 3;
export const SCREEN_OVER = 4;
export const SCREEN_WIN = 5;

function circle(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.2, y, x - s * 0.6, y - s, x, y - s * 0.3);
  ctx.bezierCurveTo(x + s * 0.6, y - s, x + s * 1.2, y, x, y + s * 0.9);
  ctx.closePath();
}

function starPath(ctx, x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function polygon(ctx, x, y, r, sides, rot) {
  ctx.beginPath();
  for (let i = 0; i < sides; i += 1) {
    const a = rot + (i / sides) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/** The on-canvas rectangles of the upgrade cards, so clicks land on the card drawn there. */
export function upgradeCardRects(count) {
  const w = 300;
  const h = 210;
  const gap = 36;
  const total = count * w + (count - 1) * gap;
  const rects = [];
  let x = (FIELD.width - total) / 2;
  for (let i = 0; i < count; i += 1) {
    rects.push({ x, y: 250, w, h });
    x += w + gap;
  }
  return rects;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function fit() {
    const w = canvas.clientWidth || FIELD.width;
    const h = canvas.clientHeight || FIELD.height;
    const scale = Math.min(w / FIELD.width, h / FIELD.height);
    ctx.setTransform(scale, 0, 0, scale, (w - FIELD.width * scale) / 2, (h - FIELD.height * scale) / 2);
  }

  function text(str, x, y, size, color, align = 'center', weight = 700) {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = align;
    ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }

  function panel(x, y, w, h) {
    ctx.fillStyle = 'rgba(13, 11, 30, 0.82)';
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 14);
    ctx.fill();
    ctx.stroke();
  }

  function drawArena(state) {
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    ctx.fillStyle = PALETTE.floor;
    ctx.beginPath();
    ctx.roundRect(14, 14, FIELD.width - 28, FIELD.height - 28, 18);
    ctx.fill();
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    for (let x = 94; x < FIELD.width; x += 80) {
      ctx.beginPath();
      ctx.moveTo(x, 14);
      ctx.lineTo(x, FIELD.height - 14);
      ctx.stroke();
    }
    for (let y = 94; y < FIELD.height; y += 80) {
      ctx.beginPath();
      ctx.moveTo(14, y);
      ctx.lineTo(FIELD.width - 14, y);
      ctx.stroke();
    }
    ctx.strokeStyle = PALETTE.rim;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(14, 14, FIELD.width - 28, FIELD.height - 28, 18);
    ctx.stroke();
  }

  function drawPickups(state) {
    for (const p of state.pickups) {
      if (!p.active) continue;
      const bob = Math.sin(state.time * 5 + p.x) * 3;
      if (p.kind === 'heart') {
        ctx.fillStyle = PALETTE.heart;
        heartPath(ctx, p.x, p.y + bob, 11);
        ctx.fill();
      } else {
        ctx.fillStyle = PALETTE.star;
        starPath(ctx, p.x, p.y + bob, 13);
        ctx.fill();
      }
    }
  }

  function drawEnemies(state) {
    for (const e of state.enemies) {
      if (!e.active) continue;
      const def = ENEMY[e.kind];
      const color = e.flash > 0 ? '#ffffff' : def.color;
      ctx.save();
      ctx.translate(e.x, e.y);
      if (e.kind === KIND_DRIFTER) {
        ctx.rotate(state.time * 1.5 + e.wobble);
        ctx.fillStyle = color;
        polygon(ctx, 0, 0, e.radius + 3, 8, 0);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        circle(ctx, 0, 0, e.radius * 0.45);
        ctx.fill();
      } else if (e.kind === KIND_SPITTER) {
        ctx.rotate(Math.PI / 4 + Math.sin(state.time * 2 + e.wobble) * 0.2);
        ctx.fillStyle = color;
        ctx.fillRect(-e.radius * 0.8, -e.radius * 0.8, e.radius * 1.6, e.radius * 1.6);
        ctx.fillStyle = '#2a1052';
        circle(ctx, 0, 0, e.radius * 0.35);
        ctx.fill();
      } else if (e.kind === KIND_BRUTE) {
        ctx.fillStyle = color;
        polygon(ctx, 0, 0, e.radius, 6, state.time * 0.4);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        polygon(ctx, 0, 0, e.radius * 0.5, 6, -state.time * 0.4);
        ctx.fill();
      } else if (e.kind === KIND_BOSS) {
        ctx.fillStyle = color;
        polygon(ctx, 0, 0, e.radius, 8, state.time * 0.3);
        ctx.fill();
        ctx.fillStyle = '#ffd97a';
        polygon(ctx, 0, -e.radius - 6, 12, 3, -Math.PI / 2);
        ctx.fill();
        ctx.fillStyle = '#1a0510';
        circle(ctx, -12, -6, 5);
        ctx.fill();
        circle(ctx, 12, -6, 5);
        ctx.fill();
      }
      ctx.restore();
      // A thin health bar over anything hurt.
      if (e.hp < e.maxHp) {
        const w = e.radius * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, w, 5);
        ctx.fillStyle = '#7dff8a';
        ctx.fillRect(e.x - w / 2, e.y - e.radius - 12, (w * e.hp) / e.maxHp, 5);
      }
    }
  }

  function drawPlayer(state) {
    const p = state.player;
    if (state.waveState === 'over') return;
    const blink = p.invuln > 0 && Math.floor(state.time * 14) % 2 === 0;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.starTimer > 0) {
      ctx.globalAlpha = 0.35 + 0.2 * Math.sin(state.time * 10);
      ctx.fillStyle = PALETTE.star;
      circle(ctx, 0, 0, p.radius + 10);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Gun barrel toward the aim.
    ctx.rotate(p.angle);
    ctx.fillStyle = '#7a5a2e';
    ctx.fillRect(p.radius * 0.4, -3.5, p.radius + 6, 7);
    ctx.restore();
    ctx.save();
    ctx.translate(p.x, p.y);
    if (blink) ctx.globalAlpha = 0.35;
    ctx.fillStyle = PALETTE.player;
    circle(ctx, 0, 0, p.radius);
    ctx.fill();
    ctx.fillStyle = PALETTE.playerCore;
    circle(ctx, 0, 0, p.radius * 0.5);
    ctx.fill();
    ctx.fillStyle = '#3a2410';
    circle(ctx, Math.cos(p.angle) * 5, Math.sin(p.angle) * 5, 3.5);
    ctx.fill();
    ctx.restore();
  }

  function drawShots(state) {
    for (const b of state.bullets) {
      if (!b.active) continue;
      ctx.fillStyle = PALETTE.bullet;
      circle(ctx, b.x, b.y, b.radius + 2);
      ctx.fill();
      ctx.fillStyle = '#fff8e0';
      circle(ctx, b.x, b.y, b.radius * 0.55);
      ctx.fill();
    }
    for (const b of state.ebullets) {
      if (!b.active) continue;
      ctx.fillStyle = PALETTE.ebullet;
      circle(ctx, b.x, b.y, b.radius);
      ctx.fill();
      ctx.fillStyle = '#f3e8ff';
      circle(ctx, b.x, b.y, b.radius * 0.45);
      ctx.fill();
    }
  }

  function drawFx(state) {
    for (const p of state.particles) {
      if (!p.active) continue;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      circle(ctx, p.x, p.y, p.size);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const f of state.floaters) {
      if (!f.active) continue;
      ctx.globalAlpha = Math.max(0, Math.min(1, f.life));
      text(f.text, f.x, f.y, 20, f.color, 'center', 800);
    }
    ctx.globalAlpha = 1;
  }

  function drawHearts(state) {
    const p = state.player;
    for (let i = 0; i < p.maxHp; i += 1) {
      const x = FIELD.width - 40 - i * 34;
      const y = 34;
      ctx.fillStyle = i < p.hp ? PALETTE.heart : 'rgba(255,107,129,0.22)';
      heartPath(ctx, x, y, 11);
      ctx.fill();
    }
  }

  function drawHud(state, best) {
    text(`SCORE ${state.score}`, 28, 30, 26, PALETTE.text, 'left', 800);
    text(`BEST ${Math.max(best, state.score)}`, 28, 58, 15, PALETTE.muted, 'left', 600);
    text(`WAVE ${state.wave}`, FIELD.width / 2, 30, 26, PALETTE.banner, 'center', 800);
    text(state.waveState === 'upgrade' ? 'CHOOSE AN UPGRADE' : `KILLS ${state.kills}`, FIELD.width / 2, 58, 15, PALETTE.muted, 'center', 600);
    drawHearts(state);
    if (state.player.starTimer > 0) {
      text(`DOUBLE DAMAGE ${Math.ceil(state.player.starTimer)}s`, FIELD.width - 40, 66, 15, PALETTE.star, 'right', 700);
    }
    if (state.boss) {
      const w = 420;
      const x = (FIELD.width - w) / 2;
      const y = 76;
      text('EMBER KING', FIELD.width / 2, y - 12, 14, '#ff8fa3', 'center', 800);
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(x, y, w, 10);
      ctx.fillStyle = '#ff2e63';
      ctx.fillRect(x, y, (w * state.boss.hp) / state.boss.maxHp, 10);
    }
    if (state.banner.timer > 0) {
      const a = Math.min(1, state.banner.timer);
      ctx.globalAlpha = a;
      text(state.banner.text, FIELD.width / 2, 200, 54, PALETTE.banner, 'center', 900);
      if (state.banner.sub) text(state.banner.sub, FIELD.width / 2, 244, 20, PALETTE.text, 'center', 600);
      ctx.globalAlpha = 1;
    }
  }

  function drawAim(state, aim) {
    if (!aim) return;
    ctx.strokeStyle = 'rgba(238,241,245,0.5)';
    ctx.lineWidth = 2;
    circle(ctx, aim.x, aim.y, 11);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(aim.x - 16, aim.y);
    ctx.lineTo(aim.x - 6, aim.y);
    ctx.moveTo(aim.x + 6, aim.y);
    ctx.lineTo(aim.x + 16, aim.y);
    ctx.moveTo(aim.x, aim.y - 16);
    ctx.lineTo(aim.x, aim.y - 6);
    ctx.moveTo(aim.x, aim.y + 6);
    ctx.lineTo(aim.x, aim.y + 16);
    ctx.stroke();
  }

  function drawTitle(state, best) {
    ctx.fillStyle = 'rgba(13, 11, 30, 0.55)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('EMBERFALL', FIELD.width / 2, 190, 96, '#ffb347', 'center', 900);
    text('ARENA', FIELD.width / 2, 268, 96, '#ff5a5a', 'center', 900);
    text('Hold the arena. Survive 5 waves. Slay the Ember King.', FIELD.width / 2, 340, 22, PALETTE.text, 'center', 600);
    text('WASD / ARROWS move  •  MOUSE aims  •  HOLD CLICK or SPACE to shoot', FIELD.width / 2, 396, 19, PALETTE.muted, 'center', 600);
    text('P pause  •  M mute  •  Pick an upgrade between waves (1 / 2 / 3 or click)', FIELD.width / 2, 426, 19, PALETTE.muted, 'center', 600);
    if (best > 0) text(`BEST SCORE ${best}`, FIELD.width / 2, 478, 22, PALETTE.banner, 'center', 800);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    text('CLICK OR PRESS SPACE TO START', FIELD.width / 2, 556, 28, '#ffffff', 'center', 800);
    ctx.globalAlpha = 1;
  }

  function drawUpgrade(state) {
    ctx.fillStyle = 'rgba(13, 11, 30, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text(`WAVE ${state.wave} CLEARED`, FIELD.width / 2, 130, 44, PALETTE.banner, 'center', 900);
    text('Choose one upgrade to carry into the next wave', FIELD.width / 2, 176, 20, PALETTE.text, 'center', 600);
    const cards = state.choices ?? [];
    const rects = upgradeCardRects(cards.length);
    cards.forEach((card, i) => {
      const { x, y, w, h } = rects[i];
      panel(x, y, w, h);
      text(`[${i + 1}]`, x + w / 2, y + 42, 20, PALETTE.muted, 'center', 700);
      text(card.title, x + w / 2, y + 92, 26, PALETTE.text, 'center', 800);
      text(card.blurb, x + w / 2, y + 140, 19, PALETTE.banner, 'center', 600);
      text('click or press ' + (i + 1), x + w / 2, y + 178, 15, PALETTE.muted, 'center', 600);
    });
    text(`SCORE ${state.score}   •   WAVE ${state.wave + 1} NEXT`, FIELD.width / 2, 540, 20, PALETTE.muted, 'center', 600);
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(13, 11, 30, 0.66)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('PAUSED', FIELD.width / 2, 320, 64, PALETTE.text, 'center', 900);
    text('Press P or click to keep fighting', FIELD.width / 2, 386, 20, PALETTE.muted, 'center', 600);
  }

  function drawOver(state, best) {
    ctx.fillStyle = 'rgba(13, 11, 30, 0.72)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('GAME OVER', FIELD.width / 2, 210, 72, PALETTE.danger, 'center', 900);
    text('The embers fade… this time.', FIELD.width / 2, 272, 20, PALETTE.muted, 'center', 600);
    panel(FIELD.width / 2 - 240, 320, 480, 170);
    text(`SCORE  ${state.score}`, FIELD.width / 2, 352, 26, PALETTE.text, 'center', 800);
    text(`WAVE REACHED  ${state.wave}      KILLS  ${state.kills}`, FIELD.width / 2, 396, 20, PALETTE.text, 'center', 600);
    const isBest = state.score >= best && state.score > 0;
    text(isBest ? `NEW BEST!  ${best}` : `BEST  ${best}`, FIELD.width / 2, 440, 22, isBest ? PALETTE.banner : PALETTE.muted, 'center', 800);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    text('PRESS SPACE OR CLICK TO PLAY AGAIN', FIELD.width / 2, 560, 26, '#ffffff', 'center', 800);
    ctx.globalAlpha = 1;
  }

  function drawWin(state, best) {
    ctx.fillStyle = 'rgba(13, 11, 30, 0.6)';
    ctx.fillRect(0, 0, FIELD.width, FIELD.height);
    text('VICTORY!', FIELD.width / 2, 180, 84, PALETTE.banner, 'center', 900);
    text('The Ember King is slain. You are the Champion of the Arena.', FIELD.width / 2, 248, 22, PALETTE.text, 'center', 600);
    panel(FIELD.width / 2 - 240, 300, 480, 170);
    text(`SCORE  ${state.score}`, FIELD.width / 2, 332, 26, PALETTE.text, 'center', 800);
    text(`WAVES CLEARED  ${VICTORY_WAVE}      KILLS  ${state.kills}`, FIELD.width / 2, 376, 20, PALETTE.text, 'center', 600);
    const isBest = state.score >= best && state.score > 0;
    text(isBest ? `NEW BEST!  ${best}` : `BEST  ${best}`, FIELD.width / 2, 420, 22, isBest ? PALETTE.banner : PALETTE.muted, 'center', 800);
    const pulse = 0.65 + 0.35 * Math.sin(state.time * 3);
    ctx.globalAlpha = pulse;
    text('SPACE — KEEP FIGHTING (ENDLESS)      R — PLAY AGAIN', FIELD.width / 2, 540, 24, '#ffffff', 'center', 800);
    ctx.globalAlpha = 1;
  }

  function draw(state, screen, best, aim) {
    fit();
    ctx.save();
    ctx.translate(state.shakeX, state.shakeY);
    drawArena(state);
    drawPickups(state);
    drawEnemies(state);
    drawPlayer(state);
    drawShots(state);
    drawFx(state);
    ctx.restore();
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_UPGRADE) drawAim(state, aim);
    if (screen !== SCREEN_TITLE) drawHud(state, best);
    if (screen === SCREEN_TITLE) drawTitle(state, best);
    else if (screen === SCREEN_UPGRADE) drawUpgrade(state);
    else if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state, best);
    else if (screen === SCREEN_WIN) drawWin(state, best);
  }

  return { draw };
}
