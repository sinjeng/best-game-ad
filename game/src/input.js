// Keyboard and pointer input. WASD or arrows steer; the mouse aims and holding it (or Space)
// fires. One-shot presses (start, restart, pause, upgrade picks, mute) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost and never counted
// twice. Clicks are queued with their playfield coordinates for the on-canvas buttons.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_PICK_1 = 4;
export const ACTION_PICK_2 = 8;
export const ACTION_PICK_3 = 16;
export const ACTION_MUTE = 32;
export const ACTION_RESTART = 64;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const RESTART = new Set(['KeyR']);

import { FIELD } from './config.js';

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false, space: false };
  let actions = 0;
  let mouseX = FIELD.width / 2;
  let mouseY = FIELD.height / 2 - 120;
  let mouseHeld = false;
  let clicks = [];

  function toField(event) {
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / FIELD.width, rect.height / FIELD.height);
    const ox = (rect.width - FIELD.width * scale) / 2;
    const oy = (rect.height - FIELD.height * scale) / 2;
    return { x: (event.clientX - rect.left - ox) / scale, y: (event.clientY - rect.top - oy) / scale };
  }

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) keys.up = true;
    else if (DOWN.has(event.code)) keys.down = true;
    else if (LEFT.has(event.code)) keys.left = true;
    else if (RIGHT.has(event.code)) keys.right = true;
    else if (CONFIRM.has(event.code)) {
      keys.space = true;
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (RESTART.has(event.code)) {
      if (!event.repeat) actions |= ACTION_RESTART;
    } else if (event.code === 'Digit1' || event.code === 'Numpad1') {
      if (!event.repeat) actions |= ACTION_PICK_1;
    } else if (event.code === 'Digit2' || event.code === 'Numpad2') {
      if (!event.repeat) actions |= ACTION_PICK_2;
    } else if (event.code === 'Digit3' || event.code === 'Numpad3') {
      if (!event.repeat) actions |= ACTION_PICK_3;
    } else if (event.code === 'KeyM') {
      if (!event.repeat) actions |= ACTION_MUTE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) keys.up = false;
    else if (DOWN.has(event.code)) keys.down = false;
    else if (LEFT.has(event.code)) keys.left = false;
    else if (RIGHT.has(event.code)) keys.right = false;
    else if (CONFIRM.has(event.code)) keys.space = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    keys.up = false;
    keys.down = false;
    keys.left = false;
    keys.right = false;
    keys.space = false;
    mouseHeld = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const p = toField(event);
    mouseX = p.x;
    mouseY = p.y;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const p = toField(event);
    mouseX = p.x;
    mouseY = p.y;
    mouseHeld = true;
    clicks.push(p);
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseHeld = false;
  });

  return {
    /** Normalised steering vector from the held movement keys. */
    move() {
      const x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    /** Where the mouse points, in playfield coordinates. */
    aim() {
      return { x: mouseX, y: mouseY };
    },
    /** True while the mouse is held or Space is down (Space also confirms, which is fine). */
    firing() {
      return mouseHeld || keys.space === true;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    /** Click points since the last call, in playfield coordinates. */
    takeClicks() {
      const taken = clicks;
      clicks = [];
      return taken;
    },
  };
}
