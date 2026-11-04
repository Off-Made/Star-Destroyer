/**
 * Motore audio "chip" in Web Audio: onde pulse/quadra/triangolo + rumore.
 * Implementa SoundSink: il gioco chiede effetti per nome, qui si sintetizzano.
 *
 * Note mobile:
 * - l'AudioContext nasce/si sblocca dentro un gesto utente (TAP TO START);
 * - iOS: un <audio> silenzioso in loop porta la sessione audio in "playback", così
 *   il suono funziona anche con l'interruttore silenzioso attivo; dove disponibile si
 *   usa anche navigator.audioSession.type = 'playback';
 * - al ritorno dal background il contesto viene ripreso (resume()).
 */
import type { SoundSink, Sfx, Music } from '../game/game';
import { TRACKS, parseVoice, ParsedNote, Wave } from './tracks';

type Ctx = AudioContext;

export class AudioEngine implements SoundSink {
  ctx: Ctx | null = null;
  private master!: GainNode;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private noise!: AudioBuffer;
  private waves: Partial<Record<Wave, PeriodicWave>> = {};
  private parsed = new Map<string, ParsedNote[]>();
  private musicNodes: AudioScheduledSourceNode[] = [];
  private beamNodes: AudioScheduledSourceNode[] | null = null;
  private silentEl: HTMLAudioElement | null = null;
  muted = false;
  vibrate = true;

  /** Da chiamare dentro un evento di input utente. */
  unlock() {
    if (!this.ctx) {
      const AC: typeof AudioContext = (window as any).AudioContext || (window as any).webkitAudioContext;
      if (!AC) return;
      try { (navigator as any).audioSession && ((navigator as any).audioSession.type = 'playback'); } catch { /* opzionale */ }
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.build();
    }
    if (this.ctx.state !== 'running') void this.ctx.resume();
    // buffer muto di 1 campione: "sblocca" definitivamente su iOS
    const b = this.ctx.createBufferSource();
    b.buffer = this.ctx.createBuffer(1, 1, 22050);
    b.connect(this.ctx.destination);
    b.start(0);
    this.startSilentLoop();
  }

  resume() { if (this.ctx && this.ctx.state !== 'running') void this.ctx.resume(); }
  suspend() { if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend(); }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.55, this.ctx.currentTime, 0.02);
  }

  private build() {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.55;
    // compressore leggero: volumi bilanciati senza clipping
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4;
    this.master.connect(comp).connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = 0.9; this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = 0.8; this.musicBus.connect(this.master);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    // rumore "a registro" stile chip: valori ±1 a gradini
    let v = 1, lfsr = 0x7fff;
    for (let i = 0; i < len; i++) {
      if (i % 4 === 0) { const bit = (lfsr ^ (lfsr >> 1)) & 1; lfsr = (lfsr >> 1) | (bit << 14); v = lfsr & 1 ? 1 : -1; }
      d[i] = v;
    }
    this.waves.pulse25 = this.pulse(0.25);
    this.waves.pulse12 = this.pulse(0.125);
    for (const [, t] of Object.entries(TRACKS)) for (const v2 of t.voices) if (!this.parsed.has(v2.notes)) this.parsed.set(v2.notes, parseVoice(v2.notes));
  }

  private pulse(duty: number): PeriodicWave {
    const n = 32;
    const re = new Float32Array(n), im = new Float32Array(n);
    for (let k = 1; k < n; k++) im[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty) * 1;
    for (let k = 1; k < n; k++) { re[k] = im[k]; im[k] = 0; }
    return this.ctx!.createPeriodicWave(re, im);
  }

  private startSilentLoop() {
    if (this.silentEl) { void this.silentEl.play().catch(() => {}); return; }
    // WAV PCM 8 bit, 0,5 s di silenzio, generato al volo (nessun file esterno)
    const rate = 8000, n = 4000;
    const buf = new ArrayBuffer(44 + n);
    const dv = new DataView(buf);
    const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, rate, true); dv.setUint32(28, rate, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true);
    w(36, 'data'); dv.setUint32(40, n, true);
    for (let i = 0; i < n; i++) dv.setUint8(44 + i, 128);
    const el = new Audio(URL.createObjectURL(new Blob([buf], { type: 'audio/wav' })));
    el.loop = true;
    el.setAttribute('playsinline', '');
    (el as any).disableRemotePlayback = true;
    this.silentEl = el;
    void el.play().catch(() => {});
  }

  // ── Primitive ──
  private osc(type: Wave | OscillatorType, f: number, t0: number, dur: number, gain: number, f1?: number, bus?: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    if (type === 'pulse25' || type === 'pulse12') o.setPeriodicWave(this.waves[type]!);
    else o.type = type as OscillatorType;
    o.frequency.setValueAtTime(f, t0);
    if (f1 !== undefined) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.004);
    g.gain.setValueAtTime(gain, t0 + Math.max(0.005, dur - 0.03));
    g.gain.linearRampToValueAtTime(0, t0 + dur);
    o.connect(g).connect(bus ?? this.sfxBus);
    o.start(t0); o.stop(t0 + dur + 0.02);
    return o;
  }

  private noiseBurst(t0: number, dur: number, gain: number, filter: BiquadFilterType, f0: number, f1: number, q = 1) {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise; s.loop = true;
    const bf = ctx.createBiquadFilter();
    bf.type = filter; bf.Q.value = q;
    bf.frequency.setValueAtTime(f0, t0);
    bf.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    s.connect(bf).connect(g).connect(this.sfxBus);
    s.start(t0, Math.random() * 0.5); s.stop(t0 + dur + 0.02);
  }

  // ── SoundSink ──
  sfx(id: Sfx) {
    const ctx = this.ctx;
    if (!ctx || this.muted) return;
    const t = ctx.currentTime;
    switch (id) {
      case 'shot':
        this.osc('square', 1500, t, 0.07, 0.12, 320);
        this.osc('triangle', 900, t, 0.05, 0.12, 200);
        break;
      case 'hitMite':
        this.noiseBurst(t, 0.14, 0.5, 'bandpass', 2600, 700, 2);
        this.osc('square', 700, t, 0.1, 0.08, 120);
        break;
      case 'hitRaider':
        this.noiseBurst(t, 0.18, 0.5, 'bandpass', 1600, 400, 2);
        this.osc('pulse25', 520, t, 0.14, 0.1, 90);
        break;
      case 'hitWarden':
        this.osc('triangle', 1250, t, 0.09, 0.3, 1150);
        this.osc('square', 1880, t, 0.06, 0.06, 1700);
        break;
      case 'killWarden':
        this.noiseBurst(t, 0.45, 0.6, 'lowpass', 2500, 200, 1);
        this.osc('square', 330, t, 0.35, 0.12, 40);
        break;
      case 'killRogue':
        this.noiseBurst(t, 0.5, 0.6, 'lowpass', 3000, 160, 1);
        this.osc('pulse25', 600, t, 0.4, 0.12, 60);
        break;
      case 'playerDie':
        this.noiseBurst(t, 1.3, 0.8, 'lowpass', 4000, 120, 0.8);
        this.osc('square', 420, t, 1.0, 0.12, 30);
        this.osc('triangle', 210, t + 0.1, 1.0, 0.2, 25);
        break;
      case 'dive': {
        const o = this.osc('pulse12', 1300, t, 0.45, 0.05, 380);
        const lfo = ctx.createOscillator(); const lg = ctx.createGain();
        lfo.frequency.value = 22; lg.gain.value = 60;
        lfo.connect(lg).connect(o.frequency); lfo.start(t); lfo.stop(t + 0.47);
        break;
      }
      case 'extraLife': {
        const notes = [1047, 1319, 1568, 2093, 1568, 2093];
        notes.forEach((f, i) => this.osc('pulse25', f, t + i * 0.07, 0.07, 0.14));
        break;
      }
      case 'captiveLost':
        this.osc('square', 900, t, 0.5, 0.1, 100);
        this.noiseBurst(t, 0.6, 0.5, 'lowpass', 3000, 200);
        break;
      case 'tick':
        this.osc('square', 2000, t, 0.02, 0.05);
        break;
    }
  }

  music(id: Music) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.stopMusic();
    const tr = TRACKS[id];
    const spb = 60 / tr.bpm;
    const t0 = ctx.currentTime + 0.03;
    for (const v of tr.voices) {
      const notes = this.parsed.get(v.notes) ?? parseVoice(v.notes);
      let t = t0;
      for (const n of notes) {
        const dur = n.beats * spb;
        if (n.f > 0) this.musicNodes.push(this.osc(v.wave, n.f, t, dur * 0.92, v.gain, undefined, this.musicBus));
        t += dur;
      }
    }
  }

  private stopMusic() {
    const now = this.ctx ? this.ctx.currentTime : 0;
    for (const n of this.musicNodes) { try { n.stop(now); } catch { /* già fermo */ } }
    this.musicNodes.length = 0;
  }

  /** Suono continuo del raggio traente (oscillatore modulato). */
  beam(on: boolean) {
    const ctx = this.ctx;
    if (!ctx) return;
    if (on && !this.beamNodes) {
      const t = ctx.currentTime;
      const o = ctx.createOscillator(); o.setPeriodicWave(this.waves.pulse25!); o.frequency.value = 420;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 7;
      const lg = ctx.createGain(); lg.gain.value = 140;
      lfo.connect(lg).connect(o.frequency);
      const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.6;
      const lg2 = ctx.createGain(); lg2.gain.value = 200;
      lfo2.connect(lg2).connect(o.frequency);
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.15);
      o.connect(g).connect(this.sfxBus);
      o.start(t); lfo.start(t); lfo2.start(t);
      this.beamNodes = [o, lfo, lfo2];
    } else if (!on && this.beamNodes) {
      for (const n of this.beamNodes) { try { n.stop(); } catch { /* */ } }
      this.beamNodes = null;
    }
  }

  haptic(ms: number) {
    if (this.vibrate && 'vibrate' in navigator) { try { navigator.vibrate(ms); } catch { /* */ } }
  }

  stopAll() { this.stopMusic(); this.beam(false); }
}
