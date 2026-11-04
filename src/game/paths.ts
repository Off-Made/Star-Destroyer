/**
 * Traiettorie "a tartaruga": ogni percorso è un punto di partenza + direzione iniziale +
 * una sequenza di segmenti [frame, virata in gradi/frame]. È lo stesso principio dei
 * vecchi hardware arcade (velocità + rotazione), e produce curve, loop e spirali
 * fluide con pochissimi dati. Tutte le curve qui sono disegnate da zero.
 *
 * Coordinate: y verso il basso; heading 0° = destra, 90° = giù, -90° = su.
 */
export interface Path {
  x: number;
  y: number;
  heading: number; // gradi
  segs: readonly number[]; // coppie [frames, turnDegPerFrame]
}

const p = (x: number, y: number, heading: number, segs: number[]): Path => ({ x, y, heading, segs });

/** Ingressi in formazione (lato sinistro; il lato destro si ottiene specchiando). */
export const ENTRY_PATHS = {
  /** Dall'alto: scende, apre un ampio loop verso il bordo e risale verso la griglia. */
  topLoop: p(96, -16, 90, [40, 0, 90, 3]),
  /** Dal basso a sinistra: entra radente e compie un loop e un quarto. */
  bottomLoop: p(-16, 236, -20, [40, 0, 140, -3]),
  /** Variante: discesa a "S" con controcurva (stage avanzati). */
  topSnake: p(56, -16, 80, [30, 0, 30, 2.5, 50, -4, 40, -2]),
  /** Variante: ingresso laterale con giro completo. */
  bottomHook: p(-16, 180, 0, [40, 0, 100, -3.6]),
} as const;

/** Percorsi dello stage bonus: al termine il nemico prosegue dritto fino a uscire. */
export const BONUS_PATHS: readonly Path[] = [
  p(80, -16, 90, [70, 0, 60, -3, 60, 0]),
  p(-16, 200, -20, [44, 0, 120, -3, 60, 0]),
  p(112, -16, 90, [20, 0, 15, 4, 30, -4, 30, 4, 30, -4, 15, 4, 60, 0]),
  p(-16, 100, 10, [50, 0, 60, 2, 60, -4, 60, 0]),
  p(56, -16, 100, [40, 0, 120, -3.2, 60, 0]),
  p(-16, 150, -10, [30, 0, 45, 4, 45, -4, 45, 4, 60, 0]),
];

export const DEG = Math.PI / 180;

/** Stato di avanzamento su un percorso (riutilizzato, nessuna allocazione). */
export interface PathCursor {
  path: Path | null;
  mirror: boolean;
  seg: number;
  t: number;
}

/** Posiziona un'entità all'inizio del percorso. Restituisce la direzione iniziale (rad). */
export function pathStart(c: PathCursor, path: Path, mirror: boolean, out: { x: number; y: number; heading: number }) {
  c.path = path; c.mirror = mirror; c.seg = 0; c.t = 0;
  out.x = mirror ? 224 - path.x : path.x;
  out.y = path.y;
  out.heading = (mirror ? 180 - path.heading : path.heading) * DEG;
}

/**
 * Avanza di un frame. Ritorna false quando i segmenti sono esauriti
 * (l'entità mantiene direzione e velocità correnti).
 */
export function pathStep(c: PathCursor, e: { x: number; y: number; heading: number }, speed: number): boolean {
  const path = c.path;
  if (!path) return false;
  if (c.seg * 2 >= path.segs.length) return false;
  const turn = path.segs[c.seg * 2 + 1] * DEG;
  e.heading += c.mirror ? -turn : turn;
  e.x += Math.cos(e.heading) * speed;
  e.y += Math.sin(e.heading) * speed;
  if (++c.t >= path.segs[c.seg * 2]) { c.seg++; c.t = 0; }
  return true;
}

/** Utility per i test: campiona l'intero percorso. */
export function samplePath(path: Path, mirror: boolean, speed: number): { x: number; y: number }[] {
  const c: PathCursor = { path: null, mirror: false, seg: 0, t: 0 };
  const e = { x: 0, y: 0, heading: 0 };
  pathStart(c, path, mirror, e);
  const out = [{ x: e.x, y: e.y }];
  while (pathStep(c, e, speed)) out.push({ x: e.x, y: e.y });
  return out;
}

/** Ruota `h` verso `target` di al massimo `maxTurn` radianti. */
export function turnToward(h: number, target: number, maxTurn: number): number {
  let d = target - h;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  if (d > maxTurn) d = maxTurn; else if (d < -maxTurn) d = -maxTurn;
  return h + d;
}
