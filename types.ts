
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

export interface NeuralSculpture {
  id: string;
  url: string;
  prompt: string;
  date: string;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Obsidian';
}

export interface GameStats {
  gamesPlayed: number;
  streak: number;
  lastPlayedDate: string | null;
  aptitudeScore: number;
  sculptures: NeuralSculpture[];
}

export interface SudokuCell {
  value: number | null;
  initial: boolean;
  notes: number[];
}

export interface GameHistory {
  date: string;
  score: number;
  gameType: 'Sudoku' | 'Word' | 'Spatial' | 'Deduction' | 'Cipher' | 'Crossword' | 'Geographic';
}
