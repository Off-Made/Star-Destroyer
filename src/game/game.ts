/**
 * Logica di gioco completa, indipendente dal DOM (eseguibile in Node per i test).
 * Avanza a tick fissi di 1/60 s tramite `step()`.
 *
 * Tutte le entità vivono in pool preallocati: nel loop non si crea nessun oggetto.
 */
import * as C from '../config';
import { Rng } from '../core/loop';
import { Formation } from './formation';
import { PathCursor, pathStart, pathStep, turnToward, DEG } from './paths';
import { buildStageWaves, buildBonusWaves, Wave } from './stage';
import {
  Kind, enemyScore, extraLifeThreshold, isBonusStage, normalStagesBefore, bonusStageReward,
} from './scoring';

// ── Tipi pubblici ──────────────────────────────────────────────────────────
export type Sfx =
  | 'shot' | 'hitMite' | 'hitRaider' | 'hitWarden' | 'killWarden' | 'killRogue'
  | 'playerDie' | 'dive' | 'extraLife' | 'captiveLost' | 'tick';
export type Music =
  | 'start' | 'bonusStart' | 'bonusEnd' | 'perfect' | 'capture' | 'rescue'
  | 'gameOver' | 'hiScore' | 'stageStart';

export interface SoundSink {
  sfx(id: Sfx): void;
  music(id: Music): void;
  beam(on: boolean): void;
  haptic(ms: number): void;
  stopAll(): void;
}

export const nullSound: SoundSink = { sfx() {}, music() {}, beam() {}, haptic() {}, stopAll() {} };

/** Input astratto: lo riempie l'host (tastiera, touch, gamepad o IA della demo). */
export interface Input {
  left: boolean;
  right: boolean;
  fire: boolean; // tenuto premuto
  firePressed: boolean; // fronte di salita (consumato dal gioco)
  /** Spostamento relativo richiesto dal drag, in px logici (consumato dal gioco). */
  drag: number;
  /** Posizione X assoluta richiesta (drag assoluto), NaN se assente. */
  absX: number;
  autofire: boolean;
}

export function makeInput(): Input {
  return { left: false, right: false, fire: false, firePressed: false, drag: 0, absX: NaN, autofire: true };
}

export enum ES { Off, Path, Home, Form, Peel, Seek, Loop, Escort, BeamDive, Beam, Exit, Wait }

export class Enemy {
  active = false;
  kind = Kind.Mite;
  state = ES.Off;
  x = 0; y = 0; heading = Math.PI / 2; speed = 0;
  slot = -1;
  hp = 1;
  t = 0;
  side = 1;
  leader = -1;
  escortsLaunched = 0;
  offX = 0;
  willLoop = false;
  looped = false;
  fireY0 = 0; fireY1 = 0; fired = 0; maxShots = 0;
  beamX = 0;
  beamW = 0; // semilarghezza corrente del raggio (render)
  beamHold = false;
  holding = false; // trattiene la nave catturata
  bonus = false;
  wave = 0;
  readonly cur: PathCursor = { path: null, mirror: false, seg: 0, t: 0 };
}

interface Bullet { active: boolean; x: number; y: number; vx: number; vy: number; }
interface Fx { active: boolean; x: number; y: number; t: number; big: boolean; }
interface Popup { active: boolean; x: number; y: number; t: number; value: number; }

export enum CapState { None, Rising, Held, Released, Docking }

export type Mode = 'title' | 'demo' | 'game';
export type Phase = 'start' | 'intro' | 'play' | 'stageClear' | 'bonusResults' | 'gameOver' | 'results' | 'record';
export type PlayerPhase = 'none' | 'alive' | 'exploding' | 'waiting' | 'ready' | 'captured' | 'docking';

const ENEMY_POOL = 44;

export interface Storage { get(k: string): string | null; set(k: string, v: string): void; }
export const memoryStorage = (): Storage => {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
};

export class Game {
  // ── Stato globale ──
  mode: Mode = 'title';
  phase: Phase = 'start';
  phaseT = 0;
  frame = 0;
  stage = 1;
  score = 0;
  hiScore = 0;
  newHiScore = false;
  /** Record valido all'inizio della partita: va superato per un "nuovo record". */
  recordToBeat = 0;
  lives = C.START_LIVES;
  extraGiven = 0;
  shots = 0;
  hits = 0;
  bonusHits = 0;
  bonusTotal = 0;
  bonusReward = 0;
  starSpeed = 1;
  captureMsgT = 0;
  private demoT = 0;

  // ── Giocatore ──
  playerPhase: PlayerPhase = 'none';
  playerT = 0;
  px = C.SCREEN_W / 2;
  dual = false;
  private pendingDrag = 0;
  private fireCd = 0;
  /** Posizione delle esplosioni del giocatore (per la nave doppia). */

  // ── Nave catturata ──
  capState = CapState.None;
  capX = 0; capY = 0; capRot = 0; capT = 0;
  capHolder = -1;

  // ── Pool ──
  readonly enemies: Enemy[] = [];
  readonly pBullets: Bullet[] = [];
  readonly eBullets: Bullet[] = [];
  readonly fx: Fx[] = [];
  readonly popups: Popup[] = [];
  readonly formation = new Formation();

  // ── Ondate ──
  private waves: Wave[] = [];
  waveIdx = 0;
  private waveT = 0;
  private spawnPtr = 0;
  private waveGap = 0;
  wavesDone = false;
  attacksOn = false;
  private attackT = 0;
  private diff = C.difficulty(0);
  bonusStage = false;

  readonly input: Input = makeInput();
  private readonly tmp = { x: 0, y: 0, heading: 0 };

  constructor(
    readonly sound: SoundSink = nullSound,
    readonly rng: Rng = new Rng(1),
    readonly storage: Storage = memoryStorage(),
  ) {
    for (let i = 0; i < ENEMY_POOL; i++) this.enemies.push(new Enemy());
    for (let i = 0; i < C.MAX_PLAYER_BULLETS_DUAL; i++) this.pBullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
    for (let i = 0; i < C.MAX_ENEMY_BULLETS; i++) this.eBullets.push({ active: false, x: 0, y: 0, vx: 0, vy: 0 });
    for (let i = 0; i < 20; i++) this.fx.push({ active: false, x: 0, y: 0, t: 0, big: false });
    for (let i = 0; i < 8; i++) this.popups.push({ active: false, x: 0, y: 0, t: 0, value: 0 });
    this.hiScore = Number(storage.get(C.STORAGE_KEYS.hiScore)) || C.DEFAULT_HISCORE;
    this.formation.reset();
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Avvio / transizioni
  // ════════════════════════════════════════════════════════════════════════

  /** Nuova partita (mode 'game') o demo automatica (mode 'demo'). */
  startGame(mode: 'game' | 'demo' = 'game') {
    this.sound.stopAll();
    this.mode = mode;
    this.demoT = 0;
    this.score = 0;
    this.newHiScore = false;
    this.recordToBeat = this.hiScore;
    this.lives = C.START_LIVES;
    this.extraGiven = 0;
    this.shots = 0;
    this.hits = 0;
    this.stage = 1;
    this.dual = false;
    this.capState = CapState.None;
    this.capHolder = -1;
    this.clearAll();
    this.setPhase('start');
    this.playerPhase = 'none';
    if (mode === 'game') this.sound.music('start');
  }

  toTitle() {
    this.sound.stopAll();
    this.mode = 'title';
    this.phase = 'start';
    this.phaseT = 0;
    this.playerPhase = 'none';
    this.clearAll();
    this.formation.reset();
  }

  private setPhase(p: Phase) { this.phase = p; this.phaseT = 0; }

  private clearAll() {
    for (const e of this.enemies) { e.active = false; e.state = ES.Off; e.holding = false; }
    for (const b of this.pBullets) b.active = false;
    for (const b of this.eBullets) b.active = false;
    for (const f of this.fx) f.active = false;
    for (const p of this.popups) p.active = false;
    this.sound.beam(false);
  }

  private beginStage() {
    this.bonusStage = isBonusStage(this.stage);
    const k = normalStagesBefore(this.stage);
    this.diff = C.difficulty(k);
    this.formation.reset();
    for (const e of this.enemies) {
      // la nave "ostile" e i nemici residui non passano allo stage successivo
      if (e.active) { e.active = false; e.state = ES.Off; }
    }
    if (this.capState !== CapState.Held) this.capState = CapState.None;
    if (this.bonusStage) {
      const bonusIndex = Math.floor((this.stage - C.FIRST_BONUS_STAGE) / C.BONUS_STAGE_EVERY);
      this.waves = buildBonusWaves(bonusIndex);
      this.bonusHits = 0;
      this.bonusTotal = C.BONUS_ENEMIES;
    } else {
      this.waves = buildStageWaves(k, this.diff.pairedEntry);
    }
    // La nave catturata resta al suo comandante anche nello stage successivo:
    // la riassegniamo al primo comandante che arriverà in formazione.
    if (this.capState === CapState.Held) this.capHolder = -2;
    this.waveIdx = 0; this.waveT = 0; this.spawnPtr = 0; this.waveGap = 0;
    this.wavesDone = false;
    this.attacksOn = false;
    this.attackT = this.diff.diveInterval;
    this.setPhase('intro');
    if (this.bonusStage) this.sound.music('bonusStart');
    else if (this.stage > 1) this.sound.music('stageStart');
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Tick
  // ════════════════════════════════════════════════════════════════════════

  step() {
    this.frame++;
    this.phaseT++;
    if (this.mode === 'title') { this.starSpeed = 1; return; }
    if (this.mode === 'demo' && ++this.demoT > C.T.demo && this.phase !== 'results') { this.toTitle(); return; }

    switch (this.phase) {
      case 'start':
        this.starSpeed = 1;
        if (this.phaseT >= (this.mode === 'demo' ? 60 : C.T.gameStart)) {
          this.beginStage();
          this.playerPhase = 'ready';
          this.playerT = 0;
          this.px = C.SCREEN_W / 2;
        }
        break;
      case 'intro':
        this.updatePlayer();
        this.updateBullets();
        if (this.phaseT >= C.T.stageIntro) this.setPhase('play');
        break;
      case 'play':
        this.updateWaves();
        this.updateEnemies();
        this.updatePlayer();
        this.updateCaptive();
        this.updateBullets();
        this.collide();
        this.updateAttacks();
        this.checkStageEnd();
        break;
      case 'stageClear':
        this.updatePlayer();
        this.updateCaptive();
        this.updateBullets();
        if (this.phaseT >= C.T.stageClearDelay && this.playerPhase !== 'docking') {
          this.stage++;
          this.beginStage();
        }
        break;
      case 'bonusResults':
        this.updatePlayer();
        if (this.phaseT === 60) {
          this.bonusReward = bonusStageReward(this.bonusHits, this.bonusTotal);
          this.sound.music(this.bonusHits >= this.bonusTotal ? 'perfect' : 'bonusEnd');
        }
        if (this.phaseT === 150) this.addScore(this.bonusReward);
        if (this.phaseT >= C.T.bonusResults) { this.stage++; this.beginStage(); }
        break;
      case 'gameOver':
        this.updateEnemies();
        this.updateBullets();
        this.starSpeed = Math.max(0, this.starSpeed - 0.01);
        if (this.phaseT >= C.T.gameOver) { this.clearAll(); this.setPhase('results'); }
        break;
      case 'results':
        if (this.phaseT >= C.T.results) {
          if (this.newHiScore && this.mode === 'game') { this.setPhase('record'); this.sound.music('hiScore'); }
          else this.toTitle();
        }
        break;
      case 'record':
        // schermata "NUOVO RECORD": stelle veloci come festeggiamento
        this.starSpeed = 3;
        if (this.phaseT >= C.T.record) this.toTitle();
        break;
    }
    this.formation.step();
    this.updateFx();
    if (this.captureMsgT > 0) this.captureMsgT--;
    this.input.firePressed = false;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Ondate di ingresso
  // ════════════════════════════════════════════════════════════════════════

  private updateWaves() {
    if (this.wavesDone) return;
    const wave = this.waves[this.waveIdx];
    if (this.waveGap > 0) {
      if (--this.waveGap === 0) { this.waveT = 0; this.spawnPtr = 0; }
      return;
    }
    // genera i nemici dell'ondata corrente in base ai ritardi
    while (this.spawnPtr < wave.length && wave[this.spawnPtr].delay <= this.waveT) {
      this.spawn(wave[this.spawnPtr], this.waveIdx);
      this.spawnPtr++;
    }
    this.waveT++;
    if (this.spawnPtr >= wave.length && !this.waveBusy(this.waveIdx)) {
      this.waveIdx++;
      if (this.waveIdx >= this.waves.length) {
        this.wavesDone = true;
        if (!this.bonusStage) { this.formation.startBreathing(); this.attacksOn = true; }
      } else {
        this.waveGap = C.WAVE_GAP;
      }
    }
  }

  /** Un'ondata è "occupata" finché qualcuno dei suoi membri sta ancora entrando. */
  private waveBusy(w: number) {
    for (const e of this.enemies) {
      if (!e.active || e.wave !== w) continue;
      if (e.state === ES.Path || (e.state === ES.Home && !e.bonus && e.t < 400)) return true;
      if (e.bonus) return true;
    }
    return false;
  }

  private spawn(s: Wave[number], wave: number) {
    const e = this.freeEnemy();
    if (!e) return;
    e.active = true;
    e.kind = s.kind;
    e.slot = s.slot;
    e.hp = s.kind === Kind.Warden ? 2 : 1;
    e.bonus = s.slot < 0;
    e.wave = wave;
    e.leader = -1;
    e.holding = false;
    e.speed = C.ENTRY_SPEED;
    e.t = 0;
    e.state = ES.Path;
    pathStart(e.cur, s.path, s.mirror, this.tmp);
    e.x = this.tmp.x + s.dx;
    e.y = this.tmp.y;
    e.heading = this.tmp.heading;
  }

  private freeEnemy(): Enemy | null {
    for (const e of this.enemies) if (!e.active) return e;
    return null;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Nemici
  // ════════════════════════════════════════════════════════════════════════

  private updateEnemies() {
    const f = this.formation;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.active) continue;
      e.t++;
      switch (e.state) {
        case ES.Path:
          if (!pathStep(e.cur, e, e.speed)) {
            if (e.bonus) e.state = ES.Exit;
            else { e.state = ES.Home; e.t = 0; }
          }
          this.entryFire(e);
          break;
        case ES.Home: this.home(e, f.sx[e.slot], f.sy[e.slot]); break;
        case ES.Form:
          e.x = f.sx[e.slot]; e.y = f.sy[e.slot]; e.heading = Math.PI / 2;
          break;
        case ES.Peel:
          e.heading += e.side * C.PEEL_TURN;
          this.move(e);
          if (e.t >= C.PEEL_FRAMES) { e.state = e.kind === Kind.Warden && e.beamHold ? ES.BeamDive : ES.Seek; e.t = 0; }
          break;
        case ES.Seek: this.seek(e, i); break;
        case ES.Loop:
          e.heading += e.side * C.LOOP_TURN;
          this.move(e);
          if (e.t >= 72) { e.state = ES.Seek; e.t = 0; }
          break;
        case ES.Escort: this.escort(e); break;
        case ES.BeamDive: {
          const target = Math.atan2(C.BEAM_STOP_Y - e.y, e.beamX - e.x);
          e.heading = turnToward(e.heading, target, 4 * DEG);
          this.move(e);
          if (e.y >= C.BEAM_STOP_Y) {
            e.y = C.BEAM_STOP_Y; e.state = ES.Beam; e.t = 0; e.heading = Math.PI / 2;
            this.sound.beam(true);
          }
          break;
        }
        case ES.Beam: this.beam(e, i); break;
        case ES.Exit:
          this.move(e);
          if (e.y > C.EXIT_Y || e.y < -24 || e.x < -24 || e.x > C.SCREEN_W + 24) {
            if (e.bonus || this.phase === 'gameOver') { e.active = false; e.state = ES.Off; }
            else this.wrapToTop(e, i);
          }
          break;
        case ES.Wait:
          if (e.t > 120) { // nave ostile: rientra dall'alto e torna all'attacco
            e.state = ES.Seek; e.t = 0; e.y = C.ENTER_Y; e.x = 40 + this.rng.next() * 144;
            e.heading = Math.PI / 2; e.fired = 0; this.scheduleFire(e);
          }
          break;
      }
    }
  }

  private move(e: Enemy) {
    e.x += Math.cos(e.heading) * e.speed;
    e.y += Math.sin(e.heading) * e.speed;
  }

  /** Rientro verso la casella di formazione con virata limitata. */
  private home(e: Enemy, tx: number, ty: number) {
    const dx = tx - e.x, dy = ty - e.y;
    const d = Math.hypot(dx, dy);
    if (d <= e.speed + 0.5) {
      e.x = tx; e.y = ty; e.state = ES.Form; e.heading = Math.PI / 2; e.t = 0;
      this.onArrive(e);
      return;
    }
    const target = Math.atan2(dy, dx);
    if (d < C.HOME_SNAP_DIST || e.t > 240) e.heading = target;
    else e.heading = turnToward(e.heading, target, C.HOME_TURN);
    this.move(e);
  }

  private onArrive(e: Enemy) {
    // Riassegna la nave catturata (portata dallo stage precedente) al primo comandante.
    if (this.capHolder === -2 && e.kind === Kind.Warden) {
      this.capHolder = this.enemies.indexOf(e);
      e.holding = true;
    }
    if (this.playerPhase === 'captured' && e.holding) {
      // il comandante è tornato in formazione con la nave: si passa alla vita successiva
      this.playerPhase = 'waiting';
      this.playerT = 0;
    }
  }

  private seek(e: Enemy, i: number) {
    const tx = this.playerPhase === 'alive' ? this.px : C.SCREEN_W / 2;
    let target = Math.atan2(C.PLAYER_Y + 30 - e.y, tx - e.x);
    const lo = 25 * DEG, hi = 155 * DEG;
    if (target < lo) target = lo; else if (target > hi) target = hi;
    if (e.kind === Kind.Raider) target += Math.sin(e.t * 0.07) * 0.5;
    e.heading = turnToward(e.heading, target, C.SEEK_TURN);
    this.move(e);
    if (e.kind === Kind.Raider && e.willLoop && !e.looped && e.y > 150) {
      e.looped = true; e.state = ES.Loop; e.t = 0;
      e.side = e.x < C.SCREEN_W / 2 ? 1 : -1;
    }
    this.diveFire(e, i);
    if (e.y > C.EXIT_Y) this.wrapToTop(e, i);
  }

  /** Uscito dal fondo: ricompare in alto e torna in formazione. */
  private wrapToTop(e: Enemy, i: number) {
    if (e.kind === Kind.Rogue) { e.state = ES.Wait; e.t = 0; e.y = C.EXIT_Y + 40; return; }
    e.y = C.ENTER_Y;
    e.x = this.formation.sx[e.slot];
    e.heading = Math.PI / 2;
    e.state = ES.Home;
    e.t = 0;
    for (const s of this.enemies) {
      if (s.active && s.state === ES.Escort && s.leader === i) {
        s.state = ES.Home; s.t = 0; s.y = C.ENTER_Y; s.x = this.formation.sx[s.slot]; s.heading = Math.PI / 2;
      }
    }
    if (e.holding && this.capState === CapState.Held) { this.capX = e.x; this.capY = e.y + C.CAPTIVE_OFFSET_Y; }
  }

  private escort(e: Enemy) {
    const l = this.enemies[e.leader];
    if (!l || !l.active || l.state === ES.Form || l.state === ES.Home) { e.state = ES.Seek; e.t = 0; return; }
    const tx = l.x + e.offX, ty = l.y - 2;
    e.x += (tx - e.x) * 0.25;
    e.y += (ty - e.y) * 0.25;
    e.heading = l.heading;
    if (e.t > 40 && e.fired < e.maxShots && e.y >= (e.fired === 0 ? e.fireY0 : e.fireY1)) this.fireAt(e);
  }

  // ── Fuoco nemico ──
  private scheduleFire(e: Enemy) {
    e.maxShots = this.diff.bulletsPerDive;
    e.fireY0 = 70 + this.rng.next() * 60;
    e.fireY1 = e.fireY0 + 20 + this.rng.next() * 40;
    e.fired = 0;
  }

  private diveFire(e: Enemy, i: number) {
    if (e.fired >= e.maxShots) return;
    if (e.y >= (e.fired === 0 ? e.fireY0 : e.fireY1) && e.y < C.PLAYER_Y - 50) {
      this.fireAt(e);
      // il comandante che trattiene una nave fa sparare anche lei
      if (e.holding && this.capState === CapState.Held && this.capHolder === i) this.fireFrom(this.capX, this.capY);
    }
  }

  private entryFire(e: Enemy) {
    if (e.bonus || this.diff.entryFireChance <= 0 || this.playerPhase !== 'alive') return;
    if (e.y > 40 && e.y < 170 && this.rng.chance(this.diff.entryFireChance)) this.fireFrom(e.x, e.y);
  }

  private fireAt(e: Enemy) { e.fired++; this.fireFrom(e.x, e.y + 6); }

  private fireFrom(x: number, y: number) {
    if (this.bonusStage || this.playerPhase !== 'alive') return;
    for (const b of this.eBullets) {
      if (b.active) continue;
      const vy = this.diff.bulletSpeed;
      let vx = ((this.px - x) * vy) / Math.max(40, C.PLAYER_Y - y);
      if (vx > C.ENEMY_BULLET_MAX_VX) vx = C.ENEMY_BULLET_MAX_VX;
      else if (vx < -C.ENEMY_BULLET_MAX_VX) vx = -C.ENEMY_BULLET_MAX_VX;
      b.active = true; b.x = x; b.y = y; b.vx = vx; b.vy = vy;
      return;
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Attacchi (tuffi)
  // ════════════════════════════════════════════════════════════════════════

  private updateAttacks() {
    if (!this.attacksOn || this.playerPhase !== 'alive' || this.capState === CapState.Rising) return;
    if (--this.attackT > 0) return;

    let divers = 0, remaining = 0;
    for (const e of this.enemies) {
      if (!e.active || e.kind === Kind.Rogue) continue;
      remaining++;
      if (e.state !== ES.Form && e.state !== ES.Home) divers++;
    }
    const endgame = remaining <= 6;
    const max = endgame ? remaining : this.diff.maxDivers;
    this.attackT = Math.round(this.diff.diveInterval * (endgame ? 0.4 : this.rng.range(0.6, 1.3)));
    if (divers >= max) return;

    // comandante?
    if (this.rng.chance(this.diff.wardenChance)) {
      const w = this.pickInForm(Kind.Warden);
      if (w >= 0) {
        const canBeam = !this.dual && this.capState === CapState.None && !this.beamActive() && !this.enemies[w].holding;
        if (canBeam && this.rng.chance(0.5)) this.launchBeam(w);
        else this.launchDive(w, true);
        return;
      }
    }
    const k = this.rng.chance(0.5) ? Kind.Raider : Kind.Mite;
    let i = this.pickInForm(k, true);
    if (i < 0) i = this.pickInForm(k === Kind.Raider ? Kind.Mite : Kind.Raider, true);
    if (i < 0) i = this.pickInForm(Kind.Warden);
    if (i >= 0) this.launchDive(i, true);
  }

  /** Sceglie un nemico in formazione del tipo dato; preferisce le colonne esterne. */
  private pickInForm(kind: Kind, preferEdge = false): number {
    let n = 0, minC = 99, maxC = -1;
    for (const e of this.enemies) {
      if (!e.active || e.state !== ES.Form || e.kind !== kind) continue;
      n++;
      const c = e.slot % C.FORM_COLS;
      if (c < minC) minC = c;
      if (c > maxC) maxC = c;
    }
    if (n === 0) return -1;
    const edge = preferEdge && this.rng.chance(0.7);
    const col = this.rng.chance(0.5) ? minC : maxC;
    const candidates = edge ? -1 : this.rng.int(n);
    let idx = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.active || e.state !== ES.Form || e.kind !== kind) continue;
      if (edge) { if (e.slot % C.FORM_COLS === col) return i; }
      else if (idx++ === candidates) return i;
    }
    return -1;
  }

  private beamActive() {
    for (const e of this.enemies) if (e.active && (e.state === ES.Beam || (e.state === ES.BeamDive) || (e.state === ES.Peel && e.beamHold))) return true;
    return false;
  }

  /** Lancia un tuffo d'attacco. Per i comandanti cerca fino a 2 scorte. */
  launchDive(i: number, withEscorts: boolean) {
    const e = this.enemies[i];
    e.state = ES.Peel;
    e.t = 0;
    e.beamHold = false;
    e.side = e.slot % C.FORM_COLS < C.FORM_COLS / 2 ? -1 : 1;
    e.heading = -Math.PI / 2;
    e.speed = this.diff.diveSpeed;
    e.willLoop = e.kind === Kind.Raider && this.rng.chance(this.diff.raiderLoopChance);
    e.looped = false;
    e.escortsLaunched = 0;
    this.scheduleFire(e);
    this.sound.sfx('dive');
    if (e.kind === Kind.Warden && withEscorts) {
      const col = e.slot % C.FORM_COLS;
      const candidates = [col, col - 1, col + 1, col + 2, col - 2];
      for (const c of candidates) {
        if (e.escortsLaunched >= 2) break;
        for (const s of this.enemies) {
          if (!s.active || s.state !== ES.Form || s.kind !== Kind.Raider) continue;
          if (s.slot !== C.FORM_COLS + c) continue; // riga 1
          s.state = ES.Escort; s.t = 0; s.leader = i;
          s.offX = e.escortsLaunched === 0 ? -14 : 14;
          s.speed = e.speed;
          s.side = e.side;
          this.scheduleFire(s);
          e.escortsLaunched++;
          break;
        }
      }
    }
  }

  /** Tuffo del comandante con raggio traente. */
  launchBeam(i: number) {
    const e = this.enemies[i];
    this.launchDive(i, false);
    e.beamHold = true;
    e.maxShots = 0;
    e.beamX = Math.min(200, Math.max(24, this.px));
  }

  private beam(e: Enemy, i: number) {
    const t = e.t;
    const open = C.BEAM_OPEN_FRAMES, hold = C.BEAM_HOLD_FRAMES, close = C.BEAM_CLOSE_FRAMES;
    const capturing = this.capState === CapState.Rising && this.capHolder === i;
    if (capturing) {
      e.beamW = C.BEAM_MAX_HALF_W;
      return; // il raggio resta aperto finché la nave non è risalita
    }
    if (t < open) e.beamW = (t / open) * C.BEAM_MAX_HALF_W;
    else if (t < open + hold) {
      e.beamW = C.BEAM_MAX_HALF_W;
      if (this.playerPhase === 'alive' && !this.dual && this.capState === CapState.None &&
          Math.abs(this.px - e.x) < C.BEAM_CAPTURE_HALF_W) this.capture(i);
    } else if (t < open + hold + close) e.beamW = (1 - (t - open - hold) / close) * C.BEAM_MAX_HALF_W;
    else {
      e.beamW = 0;
      e.beamHold = false;
      this.sound.beam(false);
      if (e.holding) { e.state = ES.Home; e.t = 0; e.speed = C.ENTRY_SPEED; }
      else { e.state = ES.Exit; e.heading = Math.PI / 2; }
    }
  }

  /** La nave del giocatore viene presa dal raggio. */
  capture(holder: number) {
    this.capState = CapState.Rising;
    this.capHolder = holder;
    this.capX = this.px; this.capY = C.PLAYER_Y; this.capRot = 0;
    this.playerPhase = 'captured';
    this.playerT = 0;
    this.lives--;
    this.pendingDrag = 0;
    this.sound.music('capture');
    this.sound.haptic(120);
    for (const b of this.eBullets) b.active = false;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Nave catturata
  // ════════════════════════════════════════════════════════════════════════

  private updateCaptive() {
    const h = this.capHolder >= 0 ? this.enemies[this.capHolder] : null;
    switch (this.capState) {
      case CapState.Rising: {
        if (!h) { this.capState = CapState.None; break; }
        this.capRot += 0.25;
        this.capX += (h.x - this.capX) * 0.1;
        this.capY -= C.CAPTIVE_RISE_SPEED;
        if (this.capY <= h.y + C.CAPTIVE_OFFSET_Y) {
          this.capState = CapState.Held;
          this.capRot = 0;
          h.holding = true;
          this.captureMsgT = C.T.captureMsg;
          h.t = C.BEAM_OPEN_FRAMES + C.BEAM_HOLD_FRAMES; // chiude il raggio
        }
        break;
      }
      case CapState.Held:
        if (h) {
          // "in coda" al comandante: sopra di lui in formazione, dietro di lui in picchiata
          this.capX = h.x - Math.cos(h.heading) * -C.CAPTIVE_OFFSET_Y;
          this.capY = h.y - Math.sin(h.heading) * -C.CAPTIVE_OFFSET_Y;
          this.capRot = 0;
        }
        break;
      case CapState.Released:
        this.capRot += 0.3;
        if (++this.capT >= C.RESCUE_SPIN_FRAMES) {
          this.capState = CapState.Docking;
          this.capRot = 0;
          this.playerPhase = 'docking';
          this.sound.music('rescue');
        }
        break;
      case CapState.Docking: {
        // la nave del giocatore si sposta se non c'è spazio a destra
        const maxX = C.PLAYER_MAX_X - C.DUAL_OFFSET;
        if (this.px > maxX) this.px = Math.max(maxX, this.px - C.PLAYER_SPEED);
        const tx = this.px + C.DUAL_OFFSET, ty = C.PLAYER_Y;
        const dx = tx - this.capX, dy = ty - this.capY;
        const d = Math.hypot(dx, dy);
        if (d <= C.RESCUE_SPEED) {
          this.capState = CapState.None;
          this.dual = true;
          this.playerPhase = 'alive';
          this.capHolder = -1;
        } else {
          this.capX += (dx / d) * C.RESCUE_SPEED;
          this.capY += (dy / d) * C.RESCUE_SPEED;
        }
        break;
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Giocatore
  // ════════════════════════════════════════════════════════════════════════

  private updatePlayer() {
    const inp = this.input;
    switch (this.playerPhase) {
      case 'alive': {
        let dx = 0;
        if (inp.left) dx -= C.PLAYER_SPEED;
        if (inp.right) dx += C.PLAYER_SPEED;
        if (inp.drag !== 0) {
          this.pendingDrag += inp.drag;
          if (this.pendingDrag > C.DRAG_MAX_PENDING) this.pendingDrag = C.DRAG_MAX_PENDING;
          if (this.pendingDrag < -C.DRAG_MAX_PENDING) this.pendingDrag = -C.DRAG_MAX_PENDING;
          inp.drag = 0;
        }
        if (dx === 0 && this.pendingDrag !== 0) {
          dx = Math.max(-C.PLAYER_SPEED, Math.min(C.PLAYER_SPEED, this.pendingDrag));
          this.pendingDrag -= dx;
          if (Math.abs(this.pendingDrag) < 0.01) this.pendingDrag = 0;
        }
        if (dx === 0 && !Number.isNaN(inp.absX)) {
          const d = inp.absX - this.px - (this.dual ? C.DUAL_OFFSET / 2 : 0);
          dx = Math.max(-C.PLAYER_SPEED, Math.min(C.PLAYER_SPEED, d));
        }
        const maxX = C.PLAYER_MAX_X - (this.dual ? C.DUAL_OFFSET : 0);
        this.px = Math.max(C.PLAYER_MIN_X, Math.min(maxX, this.px + dx));
        if (this.px >= maxX || this.px <= C.PLAYER_MIN_X) this.pendingDrag = 0;

        if (this.fireCd > 0) this.fireCd--;
        const wants = inp.firePressed || (inp.fire && inp.autofire);
        if (wants && this.fireCd === 0 && this.phase !== 'bonusResults') this.fire();
        break;
      }
      case 'exploding':
        if (++this.playerT >= C.PLAYER_EXPLODE_FRAMES) { this.playerPhase = 'waiting'; this.playerT = 0; }
        break;
      case 'waiting': {
        this.playerT++;
        if (this.playerT < C.RESPAWN_MIN_WAIT) break;
        if (this.anyDiving() || this.capState === CapState.Rising) break;
        if (this.lives <= 0) { this.gameOver(); break; }
        this.playerPhase = 'ready';
        this.playerT = 0;
        break;
      }
      case 'ready':
        if (++this.playerT >= C.READY_FRAMES) {
          this.playerPhase = 'alive';
          this.px = C.SCREEN_W / 2;
          this.pendingDrag = 0;
          this.input.drag = 0;
        }
        break;
      default: break;
    }
  }

  private fire() {
    const max = this.dual ? C.MAX_PLAYER_BULLETS_DUAL : C.MAX_PLAYER_BULLETS_SINGLE;
    let active = 0;
    for (const b of this.pBullets) if (b.active) active++;
    const need = this.dual ? 2 : 1;
    if (active + need > max) return;
    let placed = 0;
    for (const b of this.pBullets) {
      if (b.active) continue;
      b.active = true;
      b.x = this.px + (placed === 1 ? C.DUAL_OFFSET : 0);
      b.y = C.PLAYER_Y - 8;
      b.vx = 0; b.vy = -C.PLAYER_BULLET_SPEED;
      if (++placed === need) break;
    }
    this.shots += placed;
    this.fireCd = C.FIRE_COOLDOWN;
    this.sound.sfx('shot');
  }

  private anyDiving() {
    for (const e of this.enemies) {
      if (!e.active) continue;
      if (e.state !== ES.Form && e.state !== ES.Off && e.state !== ES.Wait && !(e.state === ES.Home && e.y < 60)) {
        if (e.kind === Kind.Rogue) continue;
        return true;
      }
    }
    return false;
  }

  /** Il giocatore (o una delle due navi) viene colpito. */
  hitPlayer(which: 0 | 1) {
    if (this.playerPhase !== 'alive') return;
    const x = which === 1 ? this.px + C.DUAL_OFFSET : this.px;
    this.spawnFx(x, C.PLAYER_Y, true);
    this.sound.sfx('playerDie');
    this.sound.haptic(250);
    if (this.dual) {
      this.dual = false;
      if (which === 0) this.px += C.DUAL_OFFSET;
      return;
    }
    this.lives--;
    this.playerPhase = 'exploding';
    this.playerT = 0;
    this.pendingDrag = 0;
  }

  /** Salva subito il record (es. se l'app viene chiusa a metà partita). */
  saveRecord() {
    if (this.mode === 'game' && this.newHiScore) this.storage.set(C.STORAGE_KEYS.hiScore, String(this.hiScore));
  }

  private gameOver() {
    this.playerPhase = 'none';
    this.setPhase('gameOver');
    this.sound.beam(false);
    if (this.mode === 'game') {
      this.sound.music('gameOver');
      if (this.newHiScore) {
        this.storage.set(C.STORAGE_KEYS.hiScore, String(this.hiScore));
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Proiettili e collisioni
  // ════════════════════════════════════════════════════════════════════════

  private updateBullets() {
    for (const b of this.pBullets) {
      if (!b.active) continue;
      b.y += b.vy;
      if (b.y < 8) b.active = false;
    }
    for (const b of this.eBullets) {
      if (!b.active) continue;
      b.x += b.vx; b.y += b.vy;
      if (b.y > C.SCREEN_H) b.active = false;
    }
  }

  private collide() {
    // proiettili del giocatore → nemici / nave catturata
    for (const b of this.pBullets) {
      if (!b.active) continue;
      if (this.capState === CapState.Held && Math.abs(b.x - this.capX) < C.ENEMY_HIT_W && Math.abs(b.y - this.capY) < C.ENEMY_HIT_H) {
        b.active = false;
        this.destroyCaptive();
        continue;
      }
      for (let i = 0; i < this.enemies.length; i++) {
        const e = this.enemies[i];
        if (!e.active || e.state === ES.Wait) continue;
        if (Math.abs(b.x - e.x) < C.ENEMY_HIT_W && Math.abs(b.y - e.y) < C.ENEMY_HIT_H) {
          b.active = false;
          this.hitEnemy(i);
          break;
        }
      }
    }
    if (this.playerPhase !== 'alive' || this.bonusStage) return;
    // proiettili nemici → giocatore
    for (const b of this.eBullets) {
      if (!b.active) continue;
      for (let s = 0; s < (this.dual ? 2 : 1); s++) {
        const x = this.px + s * C.DUAL_OFFSET;
        if (Math.abs(b.x - x) < C.PLAYER_HIT_W && Math.abs(b.y - C.PLAYER_Y) < C.PLAYER_HIT_H) {
          b.active = false;
          this.hitPlayer(s as 0 | 1);
          break;
        }
      }
      if (this.playerPhase !== 'alive') return;
    }
    // contatto diretto nemico ↔ giocatore
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (!e.active || e.state === ES.Form || e.state === ES.Wait) continue;
      for (let s = 0; s < (this.dual ? 2 : 1); s++) {
        const x = this.px + s * C.DUAL_OFFSET;
        if (Math.abs(e.x - x) < C.BODY_HIT && Math.abs(e.y - C.PLAYER_Y) < C.BODY_HIT) {
          this.killEnemy(i);
          this.hitPlayer(s as 0 | 1);
          break;
        }
      }
      if (this.playerPhase !== 'alive') return;
    }
  }

  /** Colpo a segno su un nemico (gestisce i 2 colpi del comandante). */
  hitEnemy(i: number) {
    const e = this.enemies[i];
    this.hits++;
    if (e.hp > 1) {
      e.hp--;
      this.sound.sfx('hitWarden');
      return;
    }
    this.killEnemy(i);
  }

  killEnemy(i: number) {
    const e = this.enemies[i];
    const diving = e.state !== ES.Form;
    let pts: number;
    if (e.bonus) {
      pts = C.SCORE.bonusPerKill;
      this.bonusHits++;
    } else {
      pts = enemyScore(e.kind, diving, e.escortsLaunched);
    }
    this.addScore(pts);
    if (!e.bonus && ((e.kind === Kind.Warden && diving) || e.kind === Kind.Rogue)) this.spawnPopup(e.x, e.y, pts);
    this.spawnFx(e.x, e.y, false);
    this.sound.sfx(e.kind === Kind.Mite ? 'hitMite' : e.kind === Kind.Raider ? 'hitRaider' : e.kind === Kind.Rogue ? 'killRogue' : 'killWarden');

    // scorte orfane: proseguono il tuffo da sole
    for (const s of this.enemies) if (s.active && s.state === ES.Escort && s.leader === i) { s.state = ES.Seek; s.t = 0; }

    if (e.state === ES.Beam || e.state === ES.BeamDive) this.sound.beam(false);

    // comandante con la nave catturata
    if (e.holding || (this.capHolder === i && this.capState === CapState.Rising)) {
      const inFormation = e.state === ES.Form;
      if (this.capState === CapState.Rising) {
        // abbattuto mentre la nave risaliva: la nave torna libera e scende ad agganciarsi
        this.releaseCaptive();
      } else if (this.capState === CapState.Held) {
        if (!inFormation && this.playerPhase === 'alive') this.releaseCaptive();
        else this.turnRogue();
      }
    }
    e.holding = false;
    e.active = false;
    e.state = ES.Off;
    e.beamHold = false;
  }

  private releaseCaptive() {
    this.capHolder = -1;
    if (this.playerPhase === 'captured') {
      // comandante abbattuto mentre la nave risaliva: la nave torna subito al giocatore
      this.lives++;
      this.capState = CapState.None;
      this.playerPhase = 'alive';
      this.px = Math.max(C.PLAYER_MIN_X, Math.min(C.PLAYER_MAX_X, this.capX));
      this.sound.beam(false);
      return;
    }
    this.capState = CapState.Released;
    this.capT = 0;
  }

  /** Il comandante che la tratteneva è stato abbattuto in formazione: la nave diventa ostile. */
  private turnRogue() {
    const r = this.freeEnemy();
    this.capState = CapState.None;
    this.capHolder = -1;
    if (!r) return;
    r.active = true; r.kind = Kind.Rogue; r.hp = 1; r.slot = -1; r.bonus = false; r.holding = false;
    r.x = this.capX; r.y = this.capY; r.heading = -Math.PI / 2; r.speed = this.diff.diveSpeed;
    r.state = ES.Peel; r.t = 0; r.side = r.x < C.SCREEN_W / 2 ? -1 : 1; r.beamHold = false;
    r.escortsLaunched = 0; r.willLoop = false; r.leader = -1;
    this.scheduleFire(r);
  }

  private destroyCaptive() {
    this.spawnFx(this.capX, this.capY, true);
    this.sound.sfx('captiveLost');
    this.addScore(C.SCORE.captive);
    this.hits++;
    const h = this.enemies[this.capHolder];
    if (h) h.holding = false;
    this.capState = CapState.None;
    this.capHolder = -1;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  Fine stage / punteggio
  // ════════════════════════════════════════════════════════════════════════

  private checkStageEnd() {
    if (!this.wavesDone) return;
    for (const e of this.enemies) if (e.active && e.kind !== Kind.Rogue) return;
    if (this.playerPhase === 'captured' || this.capState === CapState.Rising) return;
    // la nave ostile, se presente, se ne va con la fine dello stage
    for (const e of this.enemies) if (e.active) { e.active = false; e.state = ES.Off; }
    this.sound.beam(false);
    if (this.bonusStage) this.setPhase('bonusResults');
    else this.setPhase('stageClear');
  }

  addScore(pts: number) {
    if (pts <= 0) return;
    this.score += pts;
    if (this.mode === 'game' && this.score > this.hiScore) this.hiScore = this.score;
    if (this.mode === 'game' && this.score > this.recordToBeat) this.newHiScore = true;
    while (this.score >= extraLifeThreshold(this.extraGiven)) {
      this.extraGiven++;
      this.lives++;
      this.sound.sfx('extraLife');
      this.sound.haptic(60);
    }
  }

  // ── Effetti ──
  private spawnFx(x: number, y: number, big: boolean) {
    for (const f of this.fx) if (!f.active) { f.active = true; f.x = x; f.y = y; f.t = 0; f.big = big; return; }
  }
  private spawnPopup(x: number, y: number, v: number) {
    for (const p of this.popups) if (!p.active) { p.active = true; p.x = x; p.y = y; p.t = 0; p.value = v; return; }
  }
  private updateFx() {
    for (const f of this.fx) if (f.active && ++f.t > (f.big ? 64 : 24)) f.active = false;
    for (const p of this.popups) if (p.active && ++p.t > C.T.scorePopup) p.active = false;
  }

  // ── Interrogazioni utili a renderer/IA/test ──
  activeEnemies(): number {
    let n = 0;
    for (const e of this.enemies) if (e.active) n++;
    return n;
  }
  /** Avanza a "stage in corso" saltando i tempi di presentazione (test). */
  skipToPlay() {
    if (this.phase === 'start') { this.phaseT = 1e6; this.step(); }
    if (this.phase === 'intro') { this.phaseT = 1e6; this.step(); }
    if (this.playerPhase === 'ready') { this.playerT = 1e6; this.step(); }
  }
}
