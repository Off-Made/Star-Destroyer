import { describe, it, expect } from 'vitest';
import { Game, ES, CapState, memoryStorage } from '../../src/game/game';
import { Rng } from '../../src/core/loop';
import { Kind } from '../../src/game/scoring';
import { buildStageWaves, buildBonusWaves } from '../../src/game/stage';
import { ENTRY_PATHS, BONUS_PATHS, samplePath } from '../../src/game/paths';
import { USED_SLOTS, slotKind } from '../../src/game/formation';
import * as C from '../../src/config';

function newGame(seed = 1) {
  const g = new Game(undefined, new Rng(seed), memoryStorage());
  g.startGame('game');
  g.skipToPlay();
  return g;
}

/** Avanza finché tutte le ondate sono entrate (giocatore immobile, non spara). */
function settle(g: Game, max = 4000) {
  for (let i = 0; i < max && !g.wavesDone; i++) g.step();
  return g.wavesDone;
}

const active = (g: Game) => g.enemies.filter((e) => e.active);

describe('struttura degli stage', () => {
  it('5 ondate × 8 = 40 nemici, 4 comandanti / 16 medi / 20 base, caselle uniche', () => {
    for (const k of [0, 1, 2, 3, 4, 7]) {
      const waves = buildStageWaves(k, k >= 2);
      expect(waves.length).toBe(5);
      waves.forEach((w) => expect(w.length).toBe(8));
      const all = waves.flat();
      expect(all.length).toBe(40);
      expect(new Set(all.map((s) => s.slot)).size).toBe(40);
      expect(all.filter((s) => s.kind === Kind.Warden).length).toBe(4);
      expect(all.filter((s) => s.kind === Kind.Raider).length).toBe(16);
      expect(all.filter((s) => s.kind === Kind.Mite).length).toBe(20);
      expect([...all.map((s) => s.slot)].sort((a, b) => a - b)).toEqual([...USED_SLOTS].sort((a, b) => a - b));
      all.forEach((s) => expect(slotKind(s.slot)).toBe(s.kind));
    }
  });

  it('i percorsi di ingresso restano dentro lo schermo', () => {
    for (const path of Object.values(ENTRY_PATHS)) for (const mirror of [false, true]) {
      for (const pt of samplePath(path, mirror, C.ENTRY_SPEED)) {
        expect(pt.x).toBeGreaterThanOrEqual(-24);
        expect(pt.x).toBeLessThanOrEqual(248);
        expect(pt.y).toBeGreaterThanOrEqual(-24);
        expect(pt.y).toBeLessThanOrEqual(270);
      }
    }
  });

  it('lo stage bonus ha 40 nemici in 5 ondate e percorsi validi', () => {
    for (let b = 0; b < 4; b++) {
      const w = buildBonusWaves(b);
      expect(w.flat().length).toBe(40);
      w.forEach((x) => expect(x.length).toBe(8));
    }
    for (const p of BONUS_PATHS) for (const pt of samplePath(p, false, C.ENTRY_SPEED)) {
      expect(pt.x).toBeGreaterThan(-80);
      expect(pt.x).toBeLessThan(304);
    }
  });

  it('dopo gli ingressi tutti i 40 nemici sono in formazione', () => {
    const g = newGame();
    expect(settle(g)).toBe(true);
    for (let i = 0; i < 400; i++) { g.step(); if (active(g).every((e) => e.state === ES.Form)) break; }
    const a = active(g);
    expect(a.length).toBe(40);
  });
});

describe('giocatore', () => {
  it('massimo 2 colpi a schermo con nave singola, 4 con la doppia', () => {
    const g = newGame();
    g.input.fire = true; g.input.autofire = true;
    let max = 0;
    for (let i = 0; i < 120; i++) { g.step(); max = Math.max(max, g.pBullets.filter((b) => b.active).length); }
    expect(max).toBe(2);
    g.dual = true;
    max = 0;
    for (let i = 0; i < 120; i++) { g.step(); max = Math.max(max, g.pBullets.filter((b) => b.active).length); }
    expect(max).toBe(4);
  });

  it('conta i colpi sparati', () => {
    const g = newGame();
    g.input.firePressed = true; g.step();
    expect(g.shots).toBe(1);
    g.dual = true;
    for (let i = 0; i < 60; i++) g.step();
    g.input.firePressed = true; g.step();
    expect(g.shots).toBe(3);
  });

  it('parte con 3 vite e guadagna le vite extra a 20.000 e 70.000', () => {
    const g = newGame();
    expect(g.lives).toBe(C.START_LIVES);
    g.addScore(19990); expect(g.lives).toBe(3);
    g.addScore(10); expect(g.lives).toBe(4);
    g.addScore(50000); expect(g.lives).toBe(5);
    g.addScore(70000); expect(g.lives).toBe(6);
  });
});

describe('controllo col dito (movimento libero)', () => {
  it('la nave segue il trascinamento 1:1 in tutte le direzioni', () => {
    const g = newGame();
    const x0 = g.px, y0 = g.py;
    g.input.drag = -10; g.input.dragY = -30; g.step();
    expect(g.px).toBeCloseTo(x0 - 10);
    expect(g.py).toBeLessThan(y0 - 11); // limitato a DRAG_MAX_STEP per frame…
    for (let i = 0; i < 3; i++) { g.input.dragY = -6; g.step(); }
    expect(g.py).toBeCloseTo(y0 - 12 - 18);
    g.input.drag = 25; g.step();
    expect(g.px).toBeCloseTo(x0 - 10 + C.DRAG_MAX_STEP);
  });

  it('resta dentro il campo di gioco', () => {
    const g = new Game(undefined, new Rng(1), memoryStorage());
    g.startGame('game');
    g.skipToPlay();
    // campo vuoto: si resta nella fase di presentazione dello stage (niente nemici)
    (g as any).setPhase('intro');
    const hold = () => { (g as any).phaseT = 0; };
    for (let i = 0; i < 60; i++) { hold(); g.input.drag = -50; g.input.dragY = -50; g.step(); }
    expect(g.px).toBe(C.PLAYER_MIN_X);
    expect(g.py).toBe(C.PLAYER_MIN_Y);
    for (let i = 0; i < 60; i++) { hold(); g.input.drag = 50; g.input.dragY = 50; g.step(); }
    expect(g.px).toBe(C.PLAYER_MAX_X);
    expect(g.py).toBe(C.PLAYER_MAX_Y);
  });

  it('modalità "sotto il dito": la nave raggiunge il punto toccato', () => {
    const g = newGame();
    for (let i = 0; i < 40; i++) { g.input.absX = 60; g.input.absY = 150; g.step(); }
    expect(g.px).toBeCloseTo(60);
    expect(g.py).toBeCloseTo(150);
  });

  it('con il dito appoggiato spara da sola, dalla posizione della nave', () => {
    const g = newGame();
    g.input.dragY = -12; g.step();
    let shots = 0;
    for (let i = 0; i < 120; i++) { g.input.fire = true; g.input.autofire = true; g.step(); shots = g.shots; }
    expect(shots).toBeGreaterThan(4);
    const b = g.pBullets.find((x) => x.active)!;
    expect(b.y).toBeLessThan(g.py);
  });

  it('volare contro un nemico in formazione è una collisione', () => {
    const g = newGame();
    settle(g);
    for (let k = 0; k < 400 && !active(g).every((e) => e.state === ES.Form); k++) g.step();
    g.attacksOn = false;
    const e = active(g).find((x) => x.kind === Kind.Mite)!;
    g.px = e.x; g.py = e.y + 4;
    const lives = g.lives;
    g.step();
    expect(e.active).toBe(false);
    expect(g.lives).toBe(lives - 1);
  });
});

describe('campo allungato per riempire lo schermo del telefono', () => {
  it('la parte bassa (nave, raggio, uscita nemici) si aggancia al fondo', () => {
    const g = newGame();
    g.setFieldHeight(480);
    expect(g.H).toBe(480);
    expect(g.playerY0).toBe(C.PLAYER_Y + 192);
    expect(g.beamStopY).toBe(C.BEAM_STOP_Y + 192);
    expect(g.exitY).toBe(492);
    // la nave mantiene la distanza dal fondo
    expect(g.py).toBe(C.PLAYER_Y + 192);
    g.setFieldHeight(10000);
    expect(g.H).toBe(C.MAX_FIELD_H);
  });

  it('rispetta le fasce di notch e barra Home', () => {
    const g = newGame();
    g.setFieldHeight(500, 30, 18);
    expect(g.formation.top).toBe(C.FORM_TOP + 30);
    expect(g.minY).toBe(C.PLAYER_MIN_Y + 30);
    expect(g.playerY0).toBe(C.PLAYER_Y + (500 - 18 - 288));
    for (let i = 0; i < 80; i++) { (g as any).setPhase('intro'); g.input.dragY = -50; g.step(); }
    expect(g.py).toBe(g.minY);
  });

  it('una partita su campo alto avanza di stage senza errori', () => {
    const g = new Game(undefined, new Rng(13), memoryStorage());
    g.setFieldHeight(470);
    g.startGame('game');
    g.skipToPlay();
    let maxStage = 1;
    for (let k = 0; k < 60 * 60 * 5; k++) {
      g.input.fire = true; g.input.autofire = true;
      let tx = 112, best = -1;
      for (const e of g.enemies) if (e.active && e.y > best) { best = e.y; tx = e.x; }
      g.input.absX = tx;
      g.step();
      if (g.lives < 2) g.lives = 3;
      for (const b of g.eBullets) if (b.active) expect(b.y).toBeLessThanOrEqual(g.H + 8);
      expect(Number.isFinite(g.py)).toBe(true);
      maxStage = Math.max(maxStage, g.stage);
    }
    expect(maxStage).toBeGreaterThanOrEqual(3);
  });
});

describe('nemici e punteggio in gioco', () => {
  it('comandante: due colpi, il primo cambia stato senza punti', () => {
    const g = newGame();
    settle(g);
    const i = g.enemies.findIndex((e) => e.active && e.kind === Kind.Warden);
    const e = g.enemies[i];
    e.state = ES.Form;
    const before = g.score;
    g.hitEnemy(i);
    expect(e.active).toBe(true);
    expect(e.hp).toBe(1);
    expect(g.score).toBe(before);
    g.hitEnemy(i);
    expect(e.active).toBe(false);
    expect(g.score).toBe(before + 150);
    expect(g.hits).toBe(2);
  });

  it('comandante in tuffo con 0/1/2 scorte vale 400/800/1600', () => {
    for (const [escorts, pts] of [[0, 400], [1, 800], [2, 1600]] as const) {
      const g = newGame(7);
      settle(g);
      for (let k = 0; k < 400 && !active(g).every((e) => e.state === ES.Form); k++) g.step();
      // lascia in formazione solo il numero di raider di riga 1 vicini desiderato
      const wi = g.enemies.findIndex((e) => e.active && e.kind === Kind.Warden && e.slot === 4);
      const raiders = g.enemies.filter((e) => e.active && e.kind === Kind.Raider && e.slot >= 10 && e.slot < 20);
      raiders.forEach((r) => (r.active = false));
      raiders.slice(0, escorts).forEach((r, n) => { r.active = true; r.slot = n === 0 ? 14 : 13; r.state = ES.Form; });
      g.launchDive(wi, true);
      expect(g.enemies[wi].escortsLaunched).toBe(escorts);
      g.enemies[wi].hp = 1;
      const before = g.score;
      g.hitEnemy(wi);
      expect(g.score - before).toBe(pts);
    }
  });

  it('nemico base/medio: 50/80 in formazione, 100/160 in picchiata', () => {
    const g = newGame();
    settle(g);
    const m = g.enemies.findIndex((e) => e.active && e.kind === Kind.Mite);
    g.enemies[m].state = ES.Form;
    let s = g.score; g.hitEnemy(m); expect(g.score - s).toBe(50);
    const r = g.enemies.findIndex((e) => e.active && e.kind === Kind.Raider);
    g.enemies[r].state = ES.Seek;
    s = g.score; g.hitEnemy(r); expect(g.score - s).toBe(160);
  });
});

describe('raggio traente, cattura e liberazione', () => {
  function beamSetup() {
    const g = newGame(3);
    settle(g);
    for (let k = 0; k < 400 && !active(g).every((e) => e.state === ES.Form); k++) g.step();
    g.attacksOn = false; // controlliamo noi gli attacchi
    const wi = g.enemies.findIndex((e) => e.active && e.kind === Kind.Warden);
    g.launchBeam(wi);
    // tieni il giocatore sotto il raggio
    for (let k = 0; k < 600 && g.capState === CapState.None; k++) {
      const w = g.enemies[wi];
      g.input.absX = w.x;
      g.step();
    }
    g.input.absX = NaN;
    return { g, wi };
  }

  it('la nave viene catturata, si perde una vita e finisce in coda al comandante', () => {
    const { g, wi } = beamSetup();
    expect(g.capState).not.toBe(CapState.None);
    expect(g.lives).toBe(C.START_LIVES - 1);
    for (let k = 0; k < 1500 && g.capState !== CapState.Held; k++) g.step();
    expect(g.capState).toBe(CapState.Held);
    expect(g.enemies[wi].holding).toBe(true);
    // il comandante torna in formazione e il gioco passa alla vita successiva
    for (let k = 0; k < 1500 && g.playerPhase !== 'alive'; k++) g.step();
    expect(g.playerPhase).toBe('alive');
    expect(g.enemies[wi].state).toBe(ES.Form);
    expect(g.capY).toBeLessThan(g.enemies[wi].y);
  });

  it('abbattere il comandante in tuffo libera la nave → nave doppia', () => {
    const { g, wi } = beamSetup();
    for (let k = 0; k < 3000 && !(g.playerPhase === 'alive' && g.enemies[wi].state === ES.Form); k++) g.step();
    g.launchDive(wi, false);
    g.step();
    g.enemies[wi].hp = 1;
    g.hitEnemy(wi);
    expect(g.capState).toBe(CapState.Released);
    for (let k = 0; k < 600 && !g.dual; k++) g.step();
    expect(g.dual).toBe(true);
    expect(g.capState).toBe(CapState.None);
  });

  it('colpire la nave catturata in formazione la distrugge', () => {
    const { g, wi } = beamSetup();
    for (let k = 0; k < 3000 && !(g.playerPhase === 'alive' && g.enemies[wi].state === ES.Form); k++) g.step();
    const b = g.pBullets[0];
    b.active = true; b.x = g.capX; b.y = g.capY + 2; b.vy = 0;
    g.step();
    expect(g.capState).toBe(CapState.None);
    expect(g.enemies[wi].holding).toBe(false);
    expect(g.enemies[wi].active).toBe(true);
  });

  it('nave doppia colpita: si perde solo una delle due navi', () => {
    const g = newGame();
    g.dual = true;
    const lives = g.lives;
    g.hitPlayer(1);
    expect(g.dual).toBe(false);
    expect(g.lives).toBe(lives);
    expect(g.playerPhase).toBe('alive');
  });
});

describe('stage bonus', () => {
  it('40 nemici che non sparano; tutti abbattuti → PERFECT 10.000', () => {
    const g = newGame();
    g.stage = 3;
    (g as any).beginStage();
    g.skipToPlay();
    expect(g.bonusStage).toBe(true);
    let spawned = 0;
    const seen = new Set<object>();
    for (let k = 0; k < 6000 && g.phase === 'play'; k++) {
      g.step();
      for (let i = 0; i < g.enemies.length; i++) {
        const e = g.enemies[i];
        if (e.active && e.state === ES.Path && e.y > 0 && e.y < 260 && e.x > 0 && e.x < 224) {
          if (!seen.has(e)) { seen.add(e); spawned++; }
          g.hitEnemy(i);
          seen.delete(e);
        }
      }
      expect(g.eBullets.some((b) => b.active)).toBe(false);
    }
    expect(g.bonusHits).toBe(40);
    expect(g.phase).toBe('bonusResults');
    const before = g.score;
    for (let k = 0; k < 200; k++) g.step();
    expect(g.score - before).toBe(10000);
  });
});

describe('game over, record e home', () => {
  /** Porta una partita a game over perdendo tutte le vite. */
  function loseAll(g: Game) {
    const over = () => (g.phase as string) === 'gameOver';
    for (let life = 0; life < 10 && !over(); life++) {
      for (let k = 0; k < 3000 && g.playerPhase !== 'alive' && !over(); k++) g.step();
      g.hitPlayer(0);
    }
    for (let k = 0; k < 3000 && !over(); k++) g.step();
  }
  const runTo = (g: Game, ph: string) => { for (let k = 0; k < 2000 && g.phase !== ph && g.mode !== 'title'; k++) g.step(); };

  it('si parte dalla home e il record iniziale è 0 se non si è mai giocato', () => {
    const g = new Game(undefined, new Rng(5), memoryStorage());
    expect(g.mode).toBe('title');
    expect(g.hiScore).toBe(0);
    for (let k = 0; k < 5000; k++) g.step(); // la home resta ferma: nessuna partita/demo parte da sola
    expect(g.mode).toBe('title');
  });

  it('nuovo record: salvato e annunciato a fine partita', () => {
    const store = memoryStorage();
    const g = new Game(undefined, new Rng(5), store);
    g.startGame('game'); g.skipToPlay();
    g.addScore(1230);
    expect(g.hiScore).toBe(1230); // l'HUD si aggiorna in tempo reale
    loseAll(g);
    expect(g.phase).toBe('gameOver');
    expect(store.get(C.STORAGE_KEYS.hiScore)).toBe('1230');
    runTo(g, 'record');
    expect(g.phase).toBe('record');
    for (let k = 0; k < C.T.record + 5; k++) g.step();
    expect(g.mode).toBe('title');
    // una nuova istanza (riapertura dell'app) ritrova il record
    expect(new Game(undefined, new Rng(1), store).hiScore).toBe(1230);
  });

  it('nessun messaggio di record se il punteggio non supera il precedente', () => {
    const store = memoryStorage();
    store.set(C.STORAGE_KEYS.hiScore, '5000');
    const g = new Game(undefined, new Rng(5), store);
    expect(g.hiScore).toBe(5000);
    g.startGame('game'); g.skipToPlay();
    g.addScore(4000);
    loseAll(g);
    runTo(g, 'record');
    expect(g.mode).toBe('title');
    expect(g.newHiScore).toBe(false);
    expect(store.get(C.STORAGE_KEYS.hiScore)).toBe('5000');
  });

  it('una partita a 0 punti non è un record', () => {
    const g = new Game(undefined, new Rng(5), memoryStorage());
    g.startGame('game'); g.skipToPlay();
    loseAll(g);
    runTo(g, 'record');
    expect(g.newHiScore).toBe(false);
    expect(g.mode).toBe('title');
  });

  it('una partita completa simulata non lancia eccezioni e avanza di stage', () => {
    const g = newGame(11);
    let maxStage = 1;
    for (let k = 0; k < 60 * 60 * 6; k++) {
      // "giocatore" che spara sempre e si sposta sotto il nemico più basso
      g.input.fire = true; g.input.autofire = true;
      let tx = 112, best = -1;
      for (const e of g.enemies) if (e.active && e.y > best) { best = e.y; tx = e.x; }
      g.input.absX = tx;
      g.step();
      if (g.lives < 2) g.lives = 3; // invulnerabilità "da test"
      maxStage = Math.max(maxStage, g.stage);
    }
    expect(maxStage).toBeGreaterThanOrEqual(3);
  });
});
