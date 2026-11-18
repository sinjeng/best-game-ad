// Synthesised sound effects through WebAudio: no audio files, nothing fetched. Every effect
// is a short oscillator or noise burst built on first use; until the player presses a key or
// clicks, the context stays locked and every call is a silent no-op, so headless runs and the
// screenshot scenes never touch audio.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  function ensure() {
    if (context) return context;
    try {
      const Ctor = window.AudioContext ?? window.webkitAudioContext;
      if (!Ctor) return null;
      context = new Ctor();
      master = context.createGain();
      master.gain.value = 0.22;
      master.connect(context.destination);
    } catch {
      context = null;
    }
    return context;
  }

  /** Call from the first key or pointer gesture: browsers only allow sound after one. */
  function unlock() {
    const ctx = ensure();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function tone(freq, endFreq, seconds, type, volume, when = 0) {
    const ctx = ensure();
    if (!ctx || muted || !master) return;
    try {
      const start = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, start);
      if (endFreq !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFreq), start + seconds);
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
      osc.connect(gain);
      gain.connect(master);
      osc.start(start);
      osc.stop(start + seconds + 0.02);
    } catch {
      // Sound is garnish: a failure here must never break the game.
    }
  }

  function noise(seconds, volume, lowpass) {
    const ctx = ensure();
    if (!ctx || muted || !master) return;
    try {
      const start = ctx.currentTime;
      const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = lowpass;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(volume, start);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      source.start(start);
    } catch {
      // Sound is garnish.
    }
  }

  return {
    unlock,
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    shoot() {
      tone(720, 240, 0.08, 'square', 0.12);
    },
    hit() {
      noise(0.12, 0.25, 900);
      tone(160, 60, 0.14, 'sawtooth', 0.16);
    },
    kill() {
      tone(420, 90, 0.16, 'triangle', 0.2);
      noise(0.1, 0.14, 1600);
    },
    pickup() {
      tone(660, 660, 0.07, 'sine', 0.18);
      tone(990, 990, 0.1, 'sine', 0.18, 0.06);
    },
    heart() {
      tone(520, 780, 0.16, 'sine', 0.2);
    },
    wave() {
      tone(262, 262, 0.14, 'triangle', 0.2);
      tone(392, 392, 0.14, 'triangle', 0.2, 0.1);
      tone(523, 523, 0.22, 'triangle', 0.2, 0.2);
    },
    upgrade() {
      tone(523, 523, 0.09, 'sine', 0.2);
      tone(659, 659, 0.09, 'sine', 0.2, 0.08);
      tone(784, 784, 0.16, 'sine', 0.2, 0.16);
    },
    over() {
      tone(392, 392, 0.22, 'sawtooth', 0.16);
      tone(311, 311, 0.22, 'sawtooth', 0.16, 0.2);
      tone(233, 110, 0.5, 'sawtooth', 0.16, 0.4);
    },
    win() {
      [523, 659, 784, 1047].forEach((freq, i) => tone(freq, freq, 0.18, 'triangle', 0.2, i * 0.11));
    },
  };
}
