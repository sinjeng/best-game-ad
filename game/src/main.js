// Boot and the game loop. The world advances on a fixed 1/60 s step with leftover real time
// carried across frames, so the game plays the same speed on any display and a long frame can
// never fast-forward the fight. Screens: title -> play -> upgrade between waves -> victory at
// wave 5 (or endless) or game over, with pause and mute on top. Best score lives in
// localStorage and is only ever read at boot and written when beaten.
import { BEST_KEY, STEP } from './config.js';
import { createAudio } from './audio.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_PICK_1, ACTION_PICK_2, ACTION_PICK_3, ACTION_RESTART, createInput } from './input.js';
import { createRandom } from './random.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_UPGRADE, SCREEN_WIN, upgradeCardRects } from './render.js';
import { stageShot } from './shots.js';
import { createWorld, EVENT_HIT, EVENT_KILL, EVENT_OVER, EVENT_PICKUP, EVENT_UPGRADE, EVENT_WAVE_CLEAR, EVENT_WIN } from './world.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seed = Number(params.get('seed') ?? '1');
const random = createRandom(seed);
const world = createWorld(random);
const renderer = createRenderer(canvas);
const input = createInput(canvas);
const audio = createAudio();

let best = 0;
try {
  best = Number(window.localStorage.getItem(BEST_KEY) ?? '0') || 0;
} catch {
  best = 0;
}

function saveBest() {
  if (world.state.score <= best) return;
  best = world.state.score;
  try {
    window.localStorage.setItem(BEST_KEY, String(best));
  } catch {
    // A private window may refuse storage; the score still shows for this run.
  }
}

function announce(message) {
  if (status) status.textContent = message;
}

function react(events) {
  if (events & EVENT_KILL) audio.kill();
  if (events & EVENT_HIT) audio.hit();
  if (events & EVENT_PICKUP) audio.pickup();
  if (events & EVENT_WAVE_CLEAR) audio.wave();
}

function runShot(name) {
  const scene = stageShot(name, world);
  renderer.draw(world.state, scene.screen, scene.best, null);
  renderer.draw(world.state, scene.screen, scene.best, null);
  window.__shotReady = true;
  document.title = `Emberfall Arena — shot:${name}`;
}

function runGame() {
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let last = performance.now();

  // Read-only handle for automated play-testing; the game never writes through it.
  window.__emberfall = {
    world,
    get screen() {
      return screen;
    },
  };

  function startRun() {
    audio.unlock();
    world.startRun();
    screen = SCREEN_PLAY;
    announce('Wave 1. Survive the arena.');
  }

  function frame(now) {
    const delta = Math.min(0.25, (now - last) / 1000);
    last = now;
    accumulator += delta;
    let actions = input.takeActions();
    let clicks = input.takeClicks();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off' : 'Sound on');
    }
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) startRun();
      else if (actions & ACTION_PAUSE) {
        // Esc on the title does nothing; it is not a pause.
      }
    } else if (screen === SCREEN_PLAY) {
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PAUSED;
        announce('Paused. Press P to keep fighting.');
      }
    } else if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Back in the fight.');
      }
    } else if (screen === SCREEN_UPGRADE) {
      let pick = -1;
      if (actions & ACTION_PICK_1) pick = 0;
      else if (actions & ACTION_PICK_2) pick = 1;
      else if (actions & ACTION_PICK_3) pick = 2;
      if (pick === -1) {
        for (const click of clicks) {
          const rects = upgradeCardRects(world.state.choices?.length ?? 0);
          rects.forEach((r, i) => {
            if (click.x >= r.x && click.x <= r.x + r.w && click.y >= r.y && click.y <= r.y + r.h) pick = i;
          });
        }
      }
      if (pick >= 0 && world.chooseUpgrade(pick)) {
        audio.upgrade();
        screen = SCREEN_PLAY;
        announce(`Wave ${world.state.wave}.`);
      }
    } else if (screen === SCREEN_OVER) {
      if (actions & (ACTION_CONFIRM | ACTION_RESTART)) startRun();
    } else if (screen === SCREEN_WIN) {
      if (actions & ACTION_RESTART) startRun();
      else if (actions & ACTION_CONFIRM) {
        world.continueEndless();
        screen = SCREEN_PLAY;
        announce('Endless mode. How far can you go?');
      }
    }
    // Drain one-shot queues every frame even when no screen consumed them, so a key pressed
    // on one screen never fires on the next.
    actions = 0;
    clicks = [];

    if (screen === SCREEN_TITLE) {
      while (accumulator >= STEP) {
        world.step(STEP, null);
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP) {
        const events = world.step(STEP, {
          move: input.move(),
          aim: input.aim(),
          firing: input.firing(),
        });
        accumulator -= STEP;
        react(events);
        if (events & EVENT_UPGRADE) {
          screen = SCREEN_UPGRADE;
          announce('Wave cleared. Choose an upgrade.');
          break;
        }
        if (events & EVENT_WIN) {
          saveBest();
          audio.win();
          screen = SCREEN_WIN;
          announce('Victory! The Ember King is slain.');
          break;
        }
        if (events & EVENT_OVER) {
          saveBest();
          audio.over();
          screen = SCREEN_OVER;
          announce('Game over. Press Space to play again.');
          break;
        }
      }
    } else if (screen === SCREEN_PAUSED) {
      // Frozen solid: throw away accumulated time so resuming does not fast-forward.
      accumulator = 0;
    } else {
      // Upgrade, victory and game over hold the fight still; only particles and floaters move.
      // step() returns early for those wave states, so passing null here never runs the demo.
      while (accumulator >= STEP) {
        world.step(STEP, null);
        accumulator -= STEP;
      }
    }
    renderer.draw(world.state, screen, best, input.aim());
    requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused. Press P to keep fighting.');
    }
  });

  announce('Emberfall Arena. Click or press Space to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
