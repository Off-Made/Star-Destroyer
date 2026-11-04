/**
 * Pixel art ORIGINALE di Star Destroyer (nessun ritaglio da giochi esistenti).
 *
 * Formato: ogni sprite 16×16 è descritto da 16 mezze righe di 8 caratteri (metà
 * sinistra); la metà destra è lo specchio → simmetria garantita. '.' = trasparente,
 * le altre lettere sono indici della PALETTE in config.ts. Gli sprite guardano IN ALTO.
 */

export type HalfSprite = readonly string[];

/** Caccia del giocatore: freccia bianco/ciano con alette rosse. */
export const SHIP: HalfSprite = [
  '........',
  '.......W',
  '.......W',
  '......WC',
  '......WC',
  '.....WBC',
  '..R..WBC',
  '..R.WWBC',
  '..WWWBBC',
  '.WWBWWBC',
  '.WWBBWWW',
  'WWW.BBWW',
  'WW...BW.',
  'W.....W.',
  '......R.',
  '........',
];

/** Mite (nemico base): disco a guscio con antenne. Due frame. */
export const MITE: readonly HalfSprite[] = [[
  '........',
  '...Y....',
  '....Y...',
  '.....TTT',
  '...TTCCC',
  '..TTCWWC',
  '..TCCWNC',
  '.TTCCCCC',
  '.T.TTCCC',
  '.T..TTTT',
  '....T.T.',
  '...T..T.',
  '........',
  '........',
  '........',
  '........',
], [
  '........',
  '........',
  '..Y.Y...',
  '.....TTT',
  '...TTCCC',
  '..TTCWWC',
  '..TCCWNC',
  '.TTCCCCC',
  'T..TTCCC',
  'T...TTTT',
  '....T..T',
  '....T..T',
  '........',
  '........',
  '........',
  '........',
]];

/** Raider (nemico medio): cuneo con ali a lama. Due frame. */
export const RAIDER: readonly HalfSprite[] = [[
  '........',
  '.......M',
  '......MO',
  'M.....MO',
  'MM...MOY',
  'MOM..MOY',
  'MOOM.MWY',
  '.MOOMMWW',
  '..MOOMMM',
  '..MMOOMM',
  '...MMOOM',
  '....MMO.',
  '.....M..',
  '........',
  '........',
  '........',
], [
  '........',
  '.......M',
  '......MO',
  '......MO',
  '..M..MOY',
  '.MOM.MOY',
  '.MOOMMWY',
  '..MOOMWW',
  '..MOOMMM',
  '...MOOMM',
  '...MMOOM',
  '....MMO.',
  '.....M..',
  '........',
  '........',
  '........',
]];

/** Warden (comandante): corazza esagonale con nucleo rosso. Due frame. */
export const WARDEN: readonly HalfSprite[] = [[
  '........',
  '....G...',
  '...G.GGG',
  '..GYGYYY',
  '.GYYGGGG',
  '.GYGRRGW',
  'GYYGRRGW',
  'GYGGGGGG',
  'GYG.GYYY',
  'GG..GYGG',
  'G...GYG.',
  'G....GG.',
  '.....G..',
  '........',
  '........',
  '........',
], [
  '........',
  '....G...',
  '...G.GGG',
  '..GYGYYY',
  '..GYGGGG',
  '.GYGRRGW',
  '.GYGRRGW',
  'GYGGGGGG',
  'GYG.GYYY',
  'G...GYGG',
  'G...GYG.',
  '.....GG.',
  '.....G..',
  '........',
  '........',
  '........',
]];

/** Rimappature di colore (stessa forma, palette diversa). */
export const RECOLOR = {
  /** Comandante colpito una volta: oro → viola. */
  wardenHurt: { G: 'P', Y: 'V', R: 'C' } as Record<string, string>,
  /** Nave catturata / ostile: bianco/ciano → rosso/arancio. */
  captive: { W: 'R', C: 'O', B: 'M' } as Record<string, string>,
};

/** Badge degli stage (8×16 per 1 e 5; 16×16 per gli altri). Disegni originali. */
export const BADGES: Record<number, readonly string[]> = {
  1: [
    '........', '.W......', '.WRR....', '.WRRRR..', '.WRRRRR.', '.WRRR...', '.WR.....', '.W......',
    '.W......', '.W......', '.W......', '.W......', '.W......', 'WWW.....', '........', '........',
  ],
  5: [
    '........', '.W......', '.WYYYY..', '.WYOOYY.', '.WYOOOY.', '.WYYYY..', '.WY.....', '.W......',
    '.W......', '.W......', '.W......', '.W......', '.W......', 'WWW.....', '........', '........',
  ],
  // i badge larghi sono descritti come mezze righe (specchiati)
  10: ['........', '.......C', '......CB', '.....CBB', '....CBBW', '...CBBBW', '..CBBBWW', '...CBBBW', '....CBBW', '.....CBB', '......CB', '.......C', '........', '........', '........', '........'],
  20: ['........', '.......Y', '.......Y', '......YO', 'YYYYYYOO', '.YOOOOOO', '..YOOOWW', '...YOOWW', '...YOOOO', '..YOO.YO', '..YO...Y', '.Y......', '........', '........', '........', '........'],
  30: ['........', '.......M', '......MM', '.....MPM', '....MP.M', '...MP..M', '.......M', '.......M', '......MM', '.....MPM', '....MP.M', '...MP..M', '........', '........', '........', '........'],
  50: ['........', '.Y.....Y', '.YY...YY', '.YOY.YOY', '.YOOYOOY', '.YOOOOOY', '.YOOROOR', '.YOOOOOO', '.YYYYYYY', '........', '........', '........', '........', '........', '........', '........'],
};
