/**
 * Disegna lo stato del gioco su un canvas a risoluzione logica 224×288.
 * Nessuna allocazione per frame: niente concatenazioni di stringhe, numeri disegnati
 * cifra per cifra, sprite presi da atlas pre-renderizzati.
 */
import * as C from '../config';
import { Game, ES, CapState } from '../game/game';
import { Kind, stageBadges, hitRatio } from '../game/scoring';
import { Atlas, Spr, ROT_STEPS, CELL, FONT_COLORS, FontColor } from './atlas';

const STAR_COUNT = 72;
const STAR_COLORS = ['W', 'C', 'Y', 'R', 'M', 'L', 'B', 'V', 'O', 'T'];

export class Renderer {
  private readonly starX = new Float32Array(STAR_COUNT);
  private readonly starY = new Float32Array(STAR_COUNT);
  private readonly starL = new Uint8Array(STAR_COUNT);
  private readonly starC: string[] = [];
  private readonly starP = new Uint8Array(STAR_COUNT);
  private readonly badgeBuf: number[] = [];
  private readonly colorRow: Record<string, number> = {};
  paused = false;
  startLabel: 'TAP' | 'PUSH' = 'PUSH';

  constructor(private ctx: CanvasRenderingContext2D, private atlas: Atlas) {
    ctx.imageSmoothingEnabled = false;
    let s = 12345;
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < STAR_COUNT; i++) {
      this.starX[i] = Math.floor(rnd() * C.SCREEN_W);
      this.starY[i] = rnd() * C.SCREEN_H;
      this.starL[i] = i % 3;
      this.starC.push(C.PALETTE[STAR_COLORS[Math.floor(rnd() * STAR_COLORS.length)]]);
      this.starP[i] = Math.floor(rnd() * 255);
    }
    FONT_COLORS.forEach((c, i) => (this.colorRow[c] = i));
  }

  render(g: Game) {
    const ctx = this.ctx;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, C.SCREEN_W, C.SCREEN_H);
    this.stars(g);

    if (g.mode === 'title') {
      this.title(g);
      this.hud(g, false);
      return;
    }
    this.beams(g);
    this.enemies(g);
    this.captive(g);
    this.player(g);
    this.bullets(g);
    this.effects(g);
    this.hud(g, true);
    this.messages(g);
    if (g.mode === 'demo') {
      this.textC('DEMO PLAY', 128, 'C');
      if ((g.frame >> 5) & 1) this.textC(this.startLabel === 'TAP' ? 'TAP TO START' : 'PUSH START', 140, 'Y');
    }
  }

  // ── Starfield a 3 strati con scintillio ──
  private stars(g: Game) {
    const ctx = this.ctx;
    const speeds = [0.35, 0.7, 1.3];
    for (let i = 0; i < STAR_COUNT; i++) {
      this.starY[i] += speeds[this.starL[i]] * g.starSpeed;
      if (this.starY[i] >= C.SCREEN_H) { this.starY[i] -= C.SCREEN_H; }
      // scintillio: ogni stella si accende/spegne con il proprio periodo
      if (((g.frame + this.starP[i]) >> (4 + this.starL[i])) % 3 === 0) continue;
      ctx.fillStyle = this.starC[i];
      ctx.fillRect(this.starX[i], this.starY[i] | 0, 1, 1);
    }
  }

  // ── Sprite ──
  private sprite(id: Spr, x: number, y: number, heading: number) {
    // gli sprite sono disegnati verso l'alto (-90°)
    let r = Math.round(((heading + Math.PI / 2) / (Math.PI * 2)) * ROT_STEPS) % ROT_STEPS;
    if (r < 0) r += ROT_STEPS;
    this.ctx.drawImage(this.atlas.sprites, r * CELL, id * CELL, CELL, CELL, Math.round(x - 8), Math.round(y - 8), CELL, CELL);
  }

  private enemies(g: Game) {
    const flap = (g.frame >> 5) & 1;
    for (const e of g.enemies) {
      if (!e.active || e.state === ES.Wait) continue;
      const f = e.state === ES.Form ? flap : (g.frame >> 3) & 1;
      let id: Spr;
      switch (e.kind) {
        case Kind.Mite: id = f ? Spr.Mite1 : Spr.Mite0; break;
        case Kind.Raider: id = f ? Spr.Raider1 : Spr.Raider0; break;
        case Kind.Warden: id = e.hp > 1 ? (f ? Spr.Warden1 : Spr.Warden0) : (f ? Spr.WardenHurt1 : Spr.WardenHurt0); break;
        default: id = Spr.Captive;
      }
      this.sprite(id, e.x, e.y, e.kind === Kind.Rogue ? e.heading - Math.PI : e.heading);
    }
  }

  /** Raggio traente: cono a strisce colorate che scorrono. */
  private beams(g: Game) {
    const ctx = this.ctx;
    const cols = ['C', 'B', 'W', 'P', 'C', 'V'];
    for (const e of g.enemies) {
      if (!e.active || e.state !== ES.Beam || e.beamW <= 0) continue;
      const top = e.y + 9, bottom = C.PLAYER_Y + 9;
      const h = bottom - top;
      for (let d = 0; d < h; d += 2) {
        const hw = e.beamW * (0.25 + 0.75 * (d / h));
        const band = ((d >> 3) + (g.frame >> 2)) % cols.length;
        ctx.fillStyle = C.PALETTE[cols[band]];
        const x0 = Math.round(e.x - hw);
        ctx.fillRect(x0, top + d, Math.round(hw * 2), 1);
      }
    }
  }

  private captive(g: Game) {
    if (g.capState === CapState.None || (g.capState === CapState.Held && g.capHolder < 0)) return;
    const red = g.capState === CapState.Rising || g.capState === CapState.Held;
    const rot = g.capState === CapState.Held ? -Math.PI / 2 + Math.PI : -Math.PI / 2 + g.capRot;
    this.sprite(red ? Spr.Captive : Spr.Ship, g.capX, g.capY, rot);
  }

  private player(g: Game) {
    const p = g.playerPhase;
    if (p !== 'alive' && p !== 'docking' && !(p === 'ready' && g.playerT > 30)) return;
    this.sprite(Spr.Ship, g.px, C.PLAYER_Y, -Math.PI / 2);
    if (g.dual) this.sprite(Spr.Ship, g.px + C.DUAL_OFFSET, C.PLAYER_Y, -Math.PI / 2);
  }

  private bullets(g: Game) {
    const ctx = this.ctx;
    for (const b of g.pBullets) {
      if (!b.active) continue;
      const x = Math.round(b.x), y = Math.round(b.y);
      ctx.fillStyle = C.PALETTE.C; ctx.fillRect(x - 1, y + 1, 3, 5);
      ctx.fillStyle = C.PALETTE.W; ctx.fillRect(x, y - 1, 1, 8);
    }
    for (const b of g.eBullets) {
      if (!b.active) continue;
      const x = Math.round(b.x), y = Math.round(b.y);
      ctx.fillStyle = C.PALETTE.R; ctx.fillRect(x - 1, y - 2, 3, 5);
      ctx.fillStyle = C.PALETTE.Y; ctx.fillRect(x, y - 1, 1, 3);
    }
  }

  private effects(g: Game) {
    for (const f of g.fx) {
      if (!f.active) continue;
      const fr = Math.min(3, Math.floor(f.t / (f.big ? 16 : 6)));
      this.ctx.drawImage(this.atlas.fx, fr * 32, f.big ? 32 : 0, 32, 32, Math.round(f.x - 16), Math.round(f.y - 16), 32, 32);
    }
    for (const p of g.popups) {
      if (!p.active) continue;
      const col: FontColor = p.value >= 1600 ? 'M' : p.value >= 1000 ? 'L' : p.value >= 800 ? 'C' : 'Y';
      this.number(p.value, Math.round(p.x + 12), Math.round(p.y - 4), col, 1);
    }
  }

  // ── HUD ──
  private hud(g: Game, inGame: boolean) {
    const blink = !inGame || g.phase !== 'play' || ((g.frame >> 5) & 1) === 0;
    if (blink) this.text('1UP', 24, 0, 'R');
    this.number(g.score, 64, 8, 'W', 2);
    this.text('HIGH SCORE', 80, 0, 'R');
    this.number(g.hiScore, 144, 8, 'W', 2);
    if (!inGame) return;
    // vite di riserva (in basso a sinistra)
    const reserve = Math.min(g.lives - (g.playerPhase === 'alive' || g.playerPhase === 'docking' ? 1 : 0), 6);
    for (let i = 0; i < reserve; i++) this.sprite(Spr.Ship, 9 + i * 16, C.HUD_BOTTOM_Y + 8, -Math.PI / 2);
    // badge degli stage (in basso a destra)
    const badges = stageBadges(g.stage, this.badgeBuf);
    let x = C.SCREEN_W;
    for (let i = badges.length - 1; i >= 0; i--) {
      const img = this.atlas.badges.get(badges[i])!;
      x -= img.width;
      if (x < 120) break;
      this.ctx.drawImage(img, x, C.HUD_BOTTOM_Y);
    }
  }

  private messages(g: Game) {
    const y = 144;
    switch (g.phase) {
      case 'start': this.textC('PLAYER 1', y, 'C'); break;
      case 'intro':
        if (g.bonusStage) this.textC('BONUS STAGE', y, 'C');
        else { this.text('STAGE', 76, y, 'C'); this.number(g.stage, 76 + 8 * 6 + this.digits(g.stage) * 8, y, 'C', 1); }
        break;
      case 'bonusResults':
        this.text('NUMBER OF HITS', 32, 128, 'C');
        this.number(g.bonusHits, 192, 128, 'W', 1);
        if (g.phaseT > 60) {
          if (g.bonusHits >= g.bonusTotal) {
            if ((g.frame >> 4) & 1) this.textC('PERFECT !', 152, 'R');
            this.text('SPECIAL BONUS', 24, 176, 'Y');
            this.number(10000, 176, 176, 'Y', 1);
            this.text('PTS', 184, 176, 'Y');
          } else {
            this.text('BONUS', 64, 152, 'Y');
            this.number(g.bonusReward, 160, 152, 'Y', 1);
          }
        }
        break;
      case 'gameOver': this.textC('GAME OVER', y, 'C'); break;
      case 'record': this.record(g); break;
      case 'results': {
        this.textC('- RESULTS -', 96, 'R');
        this.text('SHOTS FIRED', 24, 128, 'Y'); this.number(g.shots, 200, 128, 'Y', 1);
        this.text('NUMBER OF HITS', 24, 148, 'Y'); this.number(g.hits, 200, 148, 'Y', 1);
        this.text('HIT-MISS RATIO', 24, 168, 'W');
        const r = hitRatio(g.shots, g.hits);
        const whole = Math.floor(r), dec = Math.round((r - whole) * 10);
        this.number(whole, 168, 168, 'W', 1);
        this.text('.', 168, 168, 'W');
        this.number(dec, 184, 168, 'W', 1);
        this.text('%', 192, 168, 'W');
        break;
      }
    }
    if (g.playerPhase === 'ready' && g.phase !== 'start') this.textC('READY', 164, 'R');
    if (g.captureMsgT > 0) this.textC('SHIP CAPTURED', 124, 'R');
  }

  // ── Home ──
  private title(g: Game) {
    const ctx = this.ctx;
    const logo = this.atlas.logo;
    const t = g.phaseT;
    const ly = Math.max(26, 110 - t * 2);
    ctx.drawImage(logo, Math.floor((C.SCREEN_W - logo.width) / 2), ly);
    if (t < 45) return;
    this.textC('- VALORE NEMICI -', 100, 'C');
    this.text('FORMAZIONE', 56, 114, 'S');
    this.text('ATTACCO', 152, 114, 'S');
    const f = (g.frame >> 5) & 1;
    if (t > 60) this.valueRow(128, f ? Spr.Mite1 : Spr.Mite0, C.SCORE.mite.formation, C.SCORE.mite.diving, false);
    if (t > 75) this.valueRow(146, f ? Spr.Raider1 : Spr.Raider0, C.SCORE.raider.formation, C.SCORE.raider.diving, false);
    if (t > 90) this.valueRow(164, f ? Spr.Warden1 : Spr.Warden0, C.SCORE.warden.formation, C.SCORE.warden.diving[0], true);
    if (t > 105) {
      this.text('VITA EXTRA', 24, 188, 'C');
      this.number(C.EXTRA_LIFE_FIRST, 152, 188, 'Y', 1);
      this.text('-', 152, 188, 'C');
      this.number(C.EXTRA_LIFE_SECOND, 200, 188, 'Y', 1);
    }
    if (t > 120) {
      if (g.hiScore > 0) {
        this.text('RECORD', 48, 204, 'M');
        this.number(g.hiScore, 176, 204, 'W', 1);
      } else this.textC('NESSUN RECORD ANCORA', 204, 'M');
    }
    // START nello stile del logo; l'area cliccabile è un <button> trasparente sopra (fascia y 220-246)
    const word = (g.frame >> 5) & 1 ? this.atlas.startLit : this.atlas.start;
    ctx.drawImage(word, Math.floor((C.SCREEN_W - word.width) / 2), 220);
    if (this.startLabel === 'PUSH' && (g.frame >> 5) & 1) this.textC('O PREMI INVIO', 254, 'Y');
    this.textC('ORIGINAL ARCADE TRIBUTE', 274, 'D');
  }

  /** Schermata di fine partita con nuovo record. */
  private record(g: Game) {
    const ctx = this.ctx;
    ctx.setTransform(2, 0, 0, 2, 0, 0); // testo ×2, nessuna allocazione
    if ((g.frame >> 4) & 1) this.text('NUOVO RECORD!', 4, 52, 'M');
    else this.text('NUOVO RECORD!', 4, 52, 'Y');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    this.textC('COMPLIMENTI !', 140, 'C');
    this.textC('HAI SUPERATO IL RECORD', 164, 'W');
    if (g.recordToBeat > 0) {
      this.text('PRECEDENTE', 24, 180, 'S');
      this.number(g.recordToBeat, 200, 180, 'S', 1);
    }
    this.textC('IL TUO PUNTEGGIO', 204, 'Y');
    const d = this.digits(g.score);
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    this.number(g.score, (C.SCREEN_W + d * 16) / 4, 110, 'W', 1);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  private valueRow(y: number, spr: Spr, a: number, b: number, extra: boolean) {
    this.sprite(spr, 44, y + 3, Math.PI / 2);
    this.number(a, 128, y, 'W', 1);
    this.number(b, 200, y, 'W', 1);
    if (extra) this.text('-1600', 168, y + 10, 'M');
  }

  // ── Testo ──
  text(s: string, x: number, y: number, color: FontColor) {
    const row = (this.colorRow[color] ?? 0) * 8;
    for (let i = 0; i < s.length; i++) {
      const code = s.charCodeAt(i);
      const idx = this.atlas.fontIndex[code];
      if (idx >= 0 && code !== 32) {
        this.ctx.drawImage(this.atlas.font, idx * 8, row, 8, 8, x + i * 8, y, 8, 8);
      }
    }
  }
  textC(s: string, y: number, color: FontColor) { this.text(s, Math.floor((C.SCREEN_W - s.length * 8) / 2), y, color); }

  private digits(n: number) { let d = 1; while (n >= 10) { n = Math.floor(n / 10); d++; } return d; }

  /** Disegna un intero allineato a destra (x = bordo destro), senza allocare stringhe. */
  number(n: number, right: number, y: number, color: FontColor, minDigits: number) {
    const row = (this.colorRow[color] ?? 0) * 8;
    let v = Math.floor(n), i = 0;
    do {
      const d = v % 10;
      const idx = this.atlas.fontIndex[48 + d];
      this.ctx.drawImage(this.atlas.font, idx * 8, row, 8, 8, right - (i + 1) * 8, y, 8, 8);
      v = Math.floor(v / 10);
      i++;
    } while (v > 0 || i < minDigits);
  }
}
