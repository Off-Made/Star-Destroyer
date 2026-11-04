/**
 * Jingle ORIGINALI di Star Destroyer (composti per questo progetto).
 * Notazione: "NOTA[ottava]/durata" separati da spazi; durata 1,2,4,8,16 (frazioni di
 * semiminima… intera), punto finale = puntata. R = pausa. Es.: "C5/8 D#5/4. R/16".
 */
import type { Music } from '../game/game';

export type Wave = 'pulse25' | 'pulse12' | 'square' | 'triangle';
export interface Voice { wave: Wave; gain: number; notes: string; }
export interface Track { bpm: number; voices: Voice[]; }

export const TRACKS: Record<Music, Track> = {
  start: {
    bpm: 150,
    voices: [
      { wave: 'pulse25', gain: 0.22, notes: 'G4/8 C5/8 D#5/8 G5/4 F5/8 D#5/8 D5/8 D#5/4. C5/8 D5/8 D#5/8 F5/8 G5/8 A#5/8 C6/2 R/8 G5/16 C6/16 D#6/4' },
      { wave: 'square', gain: 0.1, notes: 'D#4/8 G4/8 C5/8 D#5/4 D5/8 C5/8 A#4/8 C5/4. G4/8 A#4/8 C5/8 D5/8 D#5/8 F5/8 G5/2 R/8 D#5/16 G5/16 C6/4' },
      { wave: 'triangle', gain: 0.32, notes: 'C3/4 C3/4 G2/4 G2/4 G#2/4 G#2/4 A#2/4 A#2/4 C3/4 G2/4 C3/4 G3/8 C3/4' },
    ],
  },
  stageStart: {
    bpm: 160,
    voices: [
      { wave: 'pulse25', gain: 0.2, notes: 'C5/16 D#5/16 G5/16 C6/8 R/16 A#5/16 C6/4' },
      { wave: 'triangle', gain: 0.3, notes: 'C3/8 G3/8 C4/4' },
    ],
  },
  capture: {
    bpm: 120,
    voices: [
      { wave: 'pulse25', gain: 0.2, notes: 'G5/8 F#5/8 F5/8 E5/8 D#5/4 D5/4 C#5/8 C5/8 B4/2' },
      { wave: 'pulse12', gain: 0.08, notes: 'D#5/8 D5/8 C#5/8 C5/8 B4/4 A#4/4 A4/8 G#4/8 G4/2' },
      { wave: 'triangle', gain: 0.3, notes: 'G2/2 F2/2 D#2/2 D2/2' },
    ],
  },
  rescue: {
    bpm: 150,
    voices: [
      { wave: 'pulse25', gain: 0.2, notes: 'C5/16 E5/16 G5/16 C6/16 E6/8 R/16 D6/16 E6/16 G6/4' },
      { wave: 'triangle', gain: 0.3, notes: 'C3/8 G3/8 C4/4 E4/4' },
    ],
  },
  bonusStart: {
    bpm: 150,
    voices: [
      { wave: 'pulse25', gain: 0.2, notes: 'E5/16 G5/16 A5/16 B5/16 D6/8 B5/8 A5/8 G5/8 A5/8 B5/4 E6/4' },
      { wave: 'square', gain: 0.08, notes: 'B4/16 D5/16 E5/16 G5/16 B5/8 G5/8 E5/8 D5/8 E5/8 G5/4 B5/4' },
      { wave: 'triangle', gain: 0.3, notes: 'E3/8 B2/8 E3/8 B2/8 A2/8 E3/8 B2/4 E3/4' },
    ],
  },
  bonusEnd: {
    bpm: 150,
    voices: [
      { wave: 'pulse25', gain: 0.2, notes: 'D5/16 F#5/16 A5/16 D6/4 A5/8 D6/4' },
      { wave: 'triangle', gain: 0.3, notes: 'D3/8 A2/8 D3/4 D3/4' },
    ],
  },
  perfect: {
    bpm: 140,
    voices: [
      { wave: 'pulse25', gain: 0.22, notes: 'C5/16 C5/16 C5/16 G5/8. E5/16 G5/16 C6/4 R/16 B5/16 C6/16 D6/16 E6/2' },
      { wave: 'square', gain: 0.08, notes: 'G4/16 G4/16 G4/16 E5/8. C5/16 E5/16 G5/4 R/16 G5/16 G5/16 B5/16 C6/2' },
      { wave: 'triangle', gain: 0.3, notes: 'C3/4 C3/8. C3/16 E3/4 G3/4 C4/2' },
    ],
  },
  gameOver: {
    bpm: 96,
    voices: [
      { wave: 'pulse25', gain: 0.2, notes: 'A4/4 G4/4 F4/4 E4/8 D4/8 C4/2' },
      { wave: 'triangle', gain: 0.3, notes: 'A2/2 F2/2 C2/2 C2/4' },
    ],
  },
  hiScore: {
    bpm: 150,
    voices: [
      { wave: 'pulse25', gain: 0.2, notes: 'G5/8 E5/8 C5/8 E5/8 G5/8 C6/4 B5/8 A5/8 G5/8 A5/8 B5/8 C6/2' },
      { wave: 'pulse12', gain: 0.08, notes: 'E5/8 C5/8 G4/8 C5/8 E5/8 G5/4 G5/8 F5/8 E5/8 F5/8 G5/8 E5/2' },
      { wave: 'triangle', gain: 0.3, notes: 'C3/4 G2/4 C3/4 E3/4 F3/4 G3/4 C3/2' },
    ],
  },
};

const NOTE_INDEX: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

/** "A4" → 440 Hz. Restituisce 0 per la pausa. */
export function noteFreq(n: string): number {
  if (n === 'R') return 0;
  const m = /^([A-G]#?)(\d)$/.exec(n);
  if (!m) throw new Error('nota non valida: ' + n);
  const midi = (Number(m[2]) + 1) * 12 + NOTE_INDEX[m[1]];
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export interface ParsedNote { f: number; beats: number; }

/** Converte una voce in note con durata in semiminime (beat). */
export function parseVoice(s: string): ParsedNote[] {
  return s.trim().split(/\s+/).map((tok) => {
    const [n, d] = tok.split('/');
    const dotted = d.endsWith('.');
    const div = Number(dotted ? d.slice(0, -1) : d);
    const beats = (4 / div) * (dotted ? 1.5 : 1);
    return { f: noteFreq(n), beats };
  });
}

export function trackSeconds(t: Track): number {
  let max = 0;
  for (const v of t.voices) {
    const beats = parseVoice(v.notes).reduce((a, n) => a + n.beats, 0);
    max = Math.max(max, (beats * 60) / t.bpm);
  }
  return max;
}
