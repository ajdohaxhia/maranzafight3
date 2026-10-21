import type { Settings } from '../systems/SettingsManager';

export type SfxName =
  | 'punch'
  | 'kick'
  | 'hit'
  | 'heavy'
  | 'dodge'
  | 'special'
  | 'perfect'
  | 'ko'
  | 'ui'
  | 'pickup'
  | 'wave'
  | 'levelComplete'
  | 'gameOver'
  | 'victory'
  | 'bossIntro'
  | 'bossPhase'
  | 'error';

export type MusicTrack = 'menu' | 'level1' | 'level2' | 'level3' | 'level4' | 'level5' | 'boss';

interface TrackConfig {
  bpm: number;
  root: number;
  scale: number[];
}

const TRACKS: Record<MusicTrack, TrackConfig> = {
  menu: { bpm: 92, root: 45, scale: [0, 3, 5, 7, 10, 12] },
  level1: { bpm: 104, root: 45, scale: [0, 3, 5, 7, 10, 12] },
  level2: { bpm: 116, root: 43, scale: [0, 2, 3, 5, 7, 8, 10] },
  level3: { bpm: 124, root: 41, scale: [0, 2, 3, 5, 7, 8, 11] },
  level4: { bpm: 128, root: 44, scale: [0, 3, 5, 6, 7, 10, 12] },
  level5: { bpm: 134, root: 38, scale: [0, 1, 3, 5, 7, 8, 11] },
  boss: { bpm: 132, root: 40, scale: [0, 1, 3, 5, 7, 8, 11] },
};

const midiToFreq = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

type AudioContextCtor = typeof AudioContext;

/**
 * All audio is synthesized at runtime: no samples, no network, no licensing
 * issues. The context is created on the first user gesture to satisfy iOS.
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private settings: Settings | null = null;
  private track: MusicTrack | null = null;
  private pendingTrack: MusicTrack | null = null;
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private nextStepTime = 0;
  private stepIndex = 0;
  private paused = false;
  private unlocked = false;
  available = true;
  unlockError: string | null = null;

  setSettings(settings: Settings): void {
    this.settings = settings;
    this.applyVolumes();
  }

  get isUnlocked(): boolean {
    return this.unlocked && this.ctx?.state === 'running';
  }

  /** Must be called from a user gesture (click/tap/keydown). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => undefined);
      }
      this.unlocked = true;
      if (this.pendingTrack) {
        const pending = this.pendingTrack;
        this.pendingTrack = null;
        this.startMusic(pending, true);
      }
      return;
    }
    try {
      const Ctor: AudioContextCtor | undefined =
        typeof window !== 'undefined'
          ? (window.AudioContext ??
            (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext)
          : undefined;
      if (!Ctor) {
        this.available = false;
        this.unlockError = 'Web Audio non supportato';
        return;
      }
      const ctx = new Ctor();
      const master = ctx.createGain();
      const music = ctx.createGain();
      const sfx = ctx.createGain();
      master.connect(ctx.destination);
      music.connect(master);
      sfx.connect(master);
      const length = Math.floor(ctx.sampleRate * 1.5);
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
      this.master = master;
      this.musicGain = music;
      this.sfxGain = sfx;
      this.noiseBuffer = buffer;
      this.unlocked = true;
      this.applyVolumes();
      ctx.resume().catch(() => undefined);
      if (this.pendingTrack) {
        const pending = this.pendingTrack;
        this.pendingTrack = null;
        this.startMusic(pending, true);
      }
    } catch (error) {
      this.available = false;
      this.unlockError = error instanceof Error ? error.message : 'Audio non disponibile';
    }
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.applyVolumes();
  }

  startMusic(track: MusicTrack, force = false): void {
    if (!this.ctx) {
      this.pendingTrack = track;
      this.track = track;
      return;
    }
    if (!force && this.track === track) return;
    this.track = track;
    this.stepIndex = 0;
    this.nextStepTime = this.ctx.currentTime + 0.08;
    if (!this.scheduler) {
      this.scheduler = setInterval(() => this.schedule(), 25);
    }
    this.applyVolumes();
  }

  stopMusic(): void {
    this.pendingTrack = null;
    this.track = null;
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
    this.setMusicGain(0, 0.15);
  }

  playSfx(name: SfxName): void {
    const ctx = this.ctx;
    const out = this.sfxGain;
    if (!ctx || !out || ctx.state !== 'running') return;
    try {
      switch (name) {
        case 'punch':
          this.noise(0.06, 1600, 0.25, 'highpass');
          this.tone(ctx.currentTime, 180, 0.09, 'sine', 0.22, 55);
          break;
        case 'kick':
          this.noise(0.12, 700, 0.3, 'lowpass');
          this.tone(ctx.currentTime, 120, 0.16, 'sine', 0.3, 42);
          break;
        case 'hit':
          this.noise(0.09, 2400, 0.32, 'highpass');
          this.tone(ctx.currentTime, 240, 0.1, 'square', 0.12, 90);
          this.tone(ctx.currentTime, 1400, 0.06, 'triangle', 0.1, 900);
          break;
        case 'heavy':
          this.noise(0.2, 500, 0.4, 'lowpass');
          this.tone(ctx.currentTime, 95, 0.26, 'sine', 0.42, 32);
          this.tone(ctx.currentTime, 320, 0.12, 'square', 0.1, 80);
          break;
        case 'dodge':
          this.noise(0.18, 900, 0.22, 'bandpass');
          break;
        case 'special':
          this.noise(0.3, 300, 0.35, 'lowpass');
          this.tone(ctx.currentTime, 70, 0.4, 'sine', 0.5, 30);
          this.sweep(120, 900, 0.22, 'sawtooth', 0.16);
          this.tone(ctx.currentTime + 0.14, 880, 0.18, 'triangle', 0.14);
          break;
        case 'perfect':
          this.tone(ctx.currentTime, 880, 0.1, 'triangle', 0.16);
          this.tone(ctx.currentTime + 0.06, 1320, 0.1, 'triangle', 0.14);
          this.tone(ctx.currentTime + 0.12, 1760, 0.18, 'triangle', 0.13);
          break;
        case 'ko':
          this.tone(ctx.currentTime, 330, 0.5, 'sawtooth', 0.18, 45);
          this.noise(0.35, 600, 0.25, 'lowpass');
          break;
        case 'ui':
          this.tone(ctx.currentTime, 620, 0.045, 'square', 0.07);
          this.tone(ctx.currentTime + 0.035, 920, 0.05, 'square', 0.05);
          break;
        case 'pickup':
          this.tone(ctx.currentTime, 520, 0.09, 'triangle', 0.16);
          this.tone(ctx.currentTime + 0.08, 780, 0.14, 'triangle', 0.16);
          break;
        case 'wave':
          this.tone(ctx.currentTime, 330, 0.12, 'square', 0.1);
          this.tone(ctx.currentTime + 0.14, 440, 0.18, 'square', 0.1);
          break;
        case 'levelComplete':
          [523, 659, 784, 1046].forEach((freq, i) => {
            this.tone(ctx.currentTime + i * 0.1, freq, 0.26, 'triangle', 0.16);
          });
          break;
        case 'gameOver':
          [392, 349, 311, 261].forEach((freq, i) => {
            this.tone(ctx.currentTime + i * 0.17, freq, 0.3, 'sawtooth', 0.12);
          });
          break;
        case 'victory':
          [523, 523, 659, 784, 1046, 1318].forEach((freq, i) => {
            this.tone(ctx.currentTime + i * 0.12, freq, 0.35, 'triangle', 0.16);
          });
          break;
        case 'bossIntro':
          this.tone(ctx.currentTime, 55, 1.2, 'sawtooth', 0.32, 30);
          this.tone(ctx.currentTime, 82, 1.0, 'sawtooth', 0.22, 40);
          this.noise(0.8, 400, 0.3, 'lowpass');
          break;
        case 'bossPhase':
          this.tone(ctx.currentTime, 110, 0.5, 'sawtooth', 0.28, 40);
          this.noise(0.4, 800, 0.3, 'lowpass');
          break;
        case 'error':
          this.tone(ctx.currentTime, 150, 0.18, 'square', 0.12);
          this.tone(ctx.currentTime + 0.16, 120, 0.25, 'square', 0.12);
          break;
      }
    } catch {
      /* never let audio break gameplay */
    }
  }

  dispose(): void {
    this.stopMusic();
    if (this.ctx) {
      this.ctx.close().catch(() => undefined);
    }
    this.ctx = null;
    this.master = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.noiseBuffer = null;
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.musicGain || !this.sfxGain || !this.settings) return;
    const now = this.ctx.currentTime;
    const s = this.settings;
    const masterLevel = s.mute ? 0 : Math.pow(s.master / 100, 1.4) * 0.9;
    const musicLevel = Math.pow(s.music / 100, 1.3) * 0.32 * (this.paused ? 0.18 : 1);
    const sfxLevel = Math.pow(s.sfx / 100, 1.25) * 0.65;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(masterLevel, now, 0.05);
    this.musicGain.gain.setTargetAtTime(musicLevel, now, 0.08);
    this.sfxGain.gain.setTargetAtTime(sfxLevel, now, 0.03);
  }

  private setMusicGain(value: number, time: number): void {
    if (!this.ctx || !this.musicGain) return;
    const now = this.ctx.currentTime;
    this.musicGain.gain.cancelScheduledValues(now);
    this.musicGain.gain.setTargetAtTime(value, now, time);
  }

  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.track || !this.musicGain) return;
    if (ctx.state !== 'running') return;
    const cfg = TRACKS[this.track];
    const stepDur = 60 / cfg.bpm / 4;
    let guard = 64;
    while (this.nextStepTime < ctx.currentTime + 0.14 && guard-- > 0) {
      this.scheduleStep(this.track, cfg, this.stepIndex, this.nextStepTime, stepDur);
      this.nextStepTime += stepDur;
      this.stepIndex = (this.stepIndex + 1) % 256;
    }
  }

  /** 16th-note step sequencer. Patterns are original and generated here. */
  private scheduleStep(track: MusicTrack, cfg: TrackConfig, step: number, time: number, stepDur: number): void {
    const bar = Math.floor(step / 16) % 4;
    const s = step % 16;
    const root = cfg.root;
    const degree = cfg.scale[bar % cfg.scale.length] ?? 0;
    const bassNote = root + degree - 12;
    const chord = [0, 3, 7].map((interval) => midiToFreq(root + degree + interval));

    const kickSteps = track === 'boss' ? [0, 3, 4, 8, 11, 12] : track === 'level2' ? [0, 4, 8, 10, 14] : [0, 8, 10];
    const snareSteps = track === 'level2' ? [4, 12, 15] : [4, 12];

    if (kickSteps.includes(s)) this.kick(time, track === 'menu' ? 0.24 : 0.34);
    if (snareSteps.includes(s)) this.snare(time, track === 'menu' ? 0.06 : 0.1);
    if (s % 2 === 1) this.hat(time, 0.025);
    if (track !== 'menu' && s % 8 === 6) this.hat(time, 0.045, true);

    // Bass.
    if (track === 'boss') {
      if (s % 2 === 0) {
        this.musicTone(midiToFreq(bassNote - 12 + (s === 8 ? 3 : 0)), time, stepDur * 0.85, 'sawtooth', 0.14, 180);
      }
    } else if (track === 'level2') {
      if ([0, 2, 6, 8, 11, 14].includes(s)) {
        this.musicTone(midiToFreq(bassNote - 12), time, stepDur * 1.3, 'square', 0.13, 260);
      }
    } else if (track === 'menu') {
      if ([0, 6, 8, 14].includes(s)) {
        this.musicTone(midiToFreq(bassNote - 12), time, stepDur * 2.4, 'triangle', 0.17, 300);
      }
    } else {
      if ([0, 3, 6, 8, 11, 14].includes(s)) {
        this.musicTone(midiToFreq(bassNote - 12), time, stepDur * 1.2, 'square', 0.14, 300);
      }
    }

    // Pad / chord stabs.
    if (s === 0) {
      const padGain = track === 'menu' ? 0.055 : 0.038;
      for (const freq of chord) {
        this.musicTone(freq, time, stepDur * 15, 'triangle', padGain, 1200, 1.2);
      }
    }

    // Arpeggio / lead.
    if (track === 'menu') {
      const arp = [0, 2, 4, 5, 4, 2];
      if ([0, 3, 6, 10, 12, 14].includes(s)) {
        const note = cfg.scale[(s / 2) % cfg.scale.length] ?? 0;
        const freq = midiToFreq(root + 24 + note);
        this.musicTone(freq, time, stepDur * 2.2, 'triangle', 0.055, 2400, 0.8);
      }
      if (s === 8) {
        this.musicTone(midiToFreq(root + 24 + (arp[0] ?? 0)), time, stepDur * 1.5, 'sine', 0.04);
      }
    } else if (s === 0 || s === 6 || s === 10) {
      const note = cfg.scale[(bar * 2 + (s === 10 ? 3 : 0)) % cfg.scale.length] ?? 0;
      this.musicTone(midiToFreq(root + 24 + note), time, stepDur * 1.4, track === 'boss' ? 'sawtooth' : 'square', 0.05, 2600);
    }

    // Boss brass stabs.
    if (track === 'boss' && (s === 0 || s === 8)) {
      for (const freq of chord) {
        this.musicTone(freq * 2, time, stepDur * 3, 'sawtooth', 0.045, 900);
      }
    }
  }

  private kick(time: number, gain: number): void {
    const ctx = this.ctx;
    const out = this.musicGain;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(44, time + 0.12);
    envelope.gain.setValueAtTime(0.001, time);
    envelope.gain.exponentialRampToValueAtTime(gain, time + 0.005);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.22);
    osc.connect(envelope).connect(out);
    osc.start(time);
    osc.stop(time + 0.24);
  }

  private snare(time: number, gain: number): void {
    const ctx = this.ctx;
    const out = this.musicGain;
    if (!ctx || !this.noiseBuffer || !out) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1900;
    filter.Q.value = 0.9;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, time);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + 0.14);
    source.connect(filter).connect(envelope).connect(out);
    source.start(time);
    source.stop(time + 0.15);
  }

  private hat(time: number, gain: number, open = false): void {
    const ctx = this.ctx;
    const out = this.musicGain;
    if (!ctx || !this.noiseBuffer || !out) return;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = 1.6;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7200;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(gain, time);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + (open ? 0.16 : 0.045));
    source.connect(filter).connect(envelope).connect(out);
    source.start(time);
    source.stop(time + (open ? 0.18 : 0.06));
  }

  private musicTone(
    freq: number,
    time: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    cutoff = 4000,
    attack = 0.01,
  ): void {
    const ctx = this.ctx;
    const out = this.musicGain;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.linearRampToValueAtTime(gain, time + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + Math.max(attack + 0.02, duration));
    osc.connect(filter).connect(envelope).connect(out);
    osc.start(time);
    osc.stop(time + duration + 0.05);
  }

  private tone(
    time: number,
    freq: number,
    duration: number,
    type: OscillatorType,
    gain: number,
    endFreq?: number,
  ): void {
    const ctx = this.ctx;
    const out = this.sfxGain;
    if (!ctx || !out) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, time);
    if (endFreq !== undefined) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), time + duration);
    }
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), time + 0.006);
    envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
    osc.connect(envelope).connect(out);
    osc.start(time);
    osc.stop(time + duration + 0.03);
  }

  private sweep(from: number, to: number, duration: number, type: OscillatorType, gain: number): void {
    const ctx = this.ctx;
    const out = this.sfxGain;
    if (!ctx || !out) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(from, now);
    osc.frequency.exponentialRampToValueAtTime(to, now + duration);
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + 0.01);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(envelope).connect(out);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private noise(duration: number, cutoff: number, gain: number, filterType: BiquadFilterType): void {
    const ctx = this.ctx;
    const out = this.sfxGain;
    if (!ctx || !this.noiseBuffer || !out) return;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = cutoff;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(Math.max(0.0002, gain), now);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter).connect(envelope).connect(out);
    source.start(now);
    source.stop(now + duration + 0.02);
  }
}
