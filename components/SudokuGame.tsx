
import React, { useState, useEffect, useCallback } from 'react';
import { getDeepReasoningHint, speakHint, getDailyISO, createSeededRNG } from '../services/geminiService';
import { audioService } from '../services/audioService';
import confetti from 'canvas-confetti';
import { Difficulty } from '../types';

interface SudokuGameProps {
  onComplete: () => void;
  difficulty: Difficulty;
}

const STORAGE_KEY_PREFIX = 'mindgym-sudoku';

export const SudokuGame: React.FC<SudokuGameProps> = ({ onComplete, difficulty }) => {
  const [board, setBoard] = useState<(number | null)[][]>(Array(9).fill(null).map(() => Array(9).fill(null)));
  const [solution, setSolution] = useState<number[][]>([]);
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [hint, setHint] = useState<{ thinking: string; final: string } | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [errors, setErrors] = useState<boolean[][]>(Array(9).fill(null).map(() => Array(9).fill(false)));
  const [isInitialized, setIsInitialized] = useState(false);
  const [mode, setMode] = useState<'daily' | 'practice'>('daily');

  const getStorageKey = () => `${STORAGE_KEY_PREFIX}-${mode === 'daily' ? getDailyISO() : 'practice'}`;

  // Helper to shuffle array with seeded RNG
  const shuffle = (array: any[], rng: () => number) => {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  };

  const generateBoard = useCallback(() => {
    audioService.playTick();
    const seed = mode === 'daily' ? getDailyISO() : Math.random().toString();
    const rng = createSeededRNG(seed);
    
    // Base valid solution
    let baseGrid = [
      [5, 3, 4, 6, 7, 8, 9, 1, 2], [6, 7, 2, 1, 9, 5, 3, 4, 8], [1, 9, 8, 3, 4, 2, 5, 6, 7],
      [8, 5, 9, 7, 6, 1, 4, 2, 3], [4, 2, 6, 8, 5, 3, 7, 9, 1], [7, 1, 3, 9, 2, 4, 8, 5, 6],
      [9, 6, 1, 5, 3, 7, 2, 8, 4], [2, 8, 7, 4, 1, 9, 6, 3, 5], [3, 4, 5, 2, 8, 6, 1, 7, 9]
    ];

    // 1. Transpose?
    if (rng() > 0.5) {
       baseGrid = baseGrid[0].map((_, colIndex) => baseGrid.map(row => row[colIndex]));
    }

    // 2. Swap Rows within bands
    for (let b = 0; b < 9; b += 3) {
      if (rng() > 0.5) {
        const rows = [baseGrid[b], baseGrid[b+1], baseGrid[b+2]];
        shuffle(rows, rng);
        baseGrid[b] = rows[0];
        baseGrid[b+1] = rows[1];
        baseGrid[b+2] = rows[2];
      }
    }

    // 3. Swap Columns within bands
    baseGrid = baseGrid[0].map((_, colIndex) => baseGrid.map(row => row[colIndex]));
    for (let b = 0; b < 9; b += 3) {
      if (rng() > 0.5) {
        const rows = [baseGrid[b], baseGrid[b+1], baseGrid[b+2]];
        shuffle(rows, rng);
        baseGrid[b] = rows[0];
        baseGrid[b+1] = rows[1];
        baseGrid[b+2] = rows[2];
      }
    }
    baseGrid = baseGrid[0].map((_, colIndex) => baseGrid.map(row => row[colIndex]));

    // 4. Swap Bands
    const bands = [
      baseGrid.slice(0, 3),
      baseGrid.slice(3, 6),
      baseGrid.slice(6, 9)
    ];
    shuffle(bands, rng);
    baseGrid = [...bands[0], ...bands[1], ...bands[2]];

    // 5. Permute Numbers
    const nums = [1,2,3,4,5,6,7,8,9];
    const permuted = [...nums];
    shuffle(permuted, rng);
    const map = new Map();
    nums.forEach((n, i) => map.set(n, permuted[i]));
    
    baseGrid = baseGrid.map(row => row.map(val => map.get(val)));

    setSolution(baseGrid);
    
    // Create Puzzle Mask
    const cellsToKeep = difficulty === 'Easy' ? 45 : difficulty === 'Medium' ? 35 : 24;
    const indices = Array.from({ length: 81 }, (_, i) => i);
    shuffle(indices, rng);
    const keptIndices = new Set(indices.slice(0, cellsToKeep));

    const puzzle = baseGrid.map((row, r) => row.map((val, c) => {
      const index = r * 9 + c;
      return keptIndices.has(index) ? val : null;
    }));

    setBoard(puzzle);
    setErrors(Array(9).fill(null).map(() => Array(9).fill(false)));
    setHint(null);
  }, [difficulty, mode]);

  useEffect(() => {
    // Check storage for current mode
    const key = getStorageKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const { board: sBoard, solution: sSol, errors: sErr } = JSON.parse(saved);
        setBoard(sBoard);
        setSolution(sSol);
        setErrors(sErr);
        setIsInitialized(true);
      } catch (e) {
        generateBoard();
        setIsInitialized(true);
      }
    } else {
      generateBoard();
      setIsInitialized(true);
    }
  }, [mode, difficulty]); // Re-init when mode changes

  useEffect(() => {
    if (isInitialized && board.some(r => r.some(c => c !== null))) {
       localStorage.setItem(getStorageKey(), JSON.stringify({ board, solution, errors }));
    }
  }, [board, solution, errors, isInitialized]);

  const toggleMode = () => {
    setMode(prev => prev === 'daily' ? 'practice' : 'daily');
    setIsInitialized(false); // Force re-init
  };

  const handleCellClick = (r: number, c: number) => {
    audioService.playInput();
    setSelectedCell([r, c]);
  };

  const handleNumberInput = (num: number) => {
    if (!selectedCell) return;
    const [r, c] = selectedCell;
    const isError = num !== solution[r][c];
    
    if (isError) audioService.playError();
    else audioService.playClick();

    const newBoard = board.map(row => [...row]);
    newBoard[r][c] = num;
    setBoard(newBoard);
    
    const newErrors = errors.map(row => [...row]);
    newErrors[r][c] = isError;
    setErrors(newErrors);

    if (isError) {
      setTimeout(() => {
        setErrors(prev => {
          const updatedErrors = prev.map(row => [...row]);
          updatedErrors[r][c] = false;
          return updatedErrors;
        });
        setBoard(prev => {
          const updatedBoard = prev.map(row => [...row]);
          updatedBoard[r][c] = null;
          return updatedBoard;
        });
      }, 2000);
    }

    if (newBoard.every((row, ri) => row.every((val, ci) => val === solution[ri][ci]))) {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      localStorage.removeItem(getStorageKey());
      onComplete();
    }
  };

  const getHintFromAI = async () => {
    if (!selectedCell) return;
    audioService.playClick();
    setIsLoadingHint(true);
    const result = await getDeepReasoningHint(board, selectedCell[0], selectedCell[1], 'sudoku');
    const thinking = result.text?.split("FINAL_HINT:")[0].replace("THINKING_PROCESS:", "").trim() || "";
    const final = result.text?.split("FINAL_HINT:")[1]?.trim() || "Look closer at the 3x3 grid.";
    setHint({ thinking, final });
    setIsLoadingHint(false);
    speakHint(final);
  };

  return (
    <div className="space-y-10 animate-fadeIn py-4 pb-20">
      <div className="flex justify-between items-end border-b-4 border-slate-900 pb-6">
        <div>
          <h2 className="serif text-5xl font-black italic tracking-tighter">Neural Sudoku</h2>
          <div className="flex gap-4 items-center mt-2">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Protocol: {mode === 'daily' ? `DAILY_SYNC_${getDailyISO()}` : 'PRACTICE_MODE'}</p>
            <span className="text-[10px] font-black uppercase bg-slate-200 px-2 py-0.5 rounded text-slate-600">{difficulty} Mode</span>
          </div>
        </div>
        <button onClick={toggleMode} className="text-[10px] font-black underline uppercase hover:text-indigo-600 transition-colors">
          Switch to {mode === 'daily' ? 'Practice (Random)' : 'Daily Challenge'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        <div className="bg-white p-1 border-4 border-slate-900 shadow-[8px_8px_0px_#0f172a]">
          <div className="grid grid-cols-9 bg-slate-900 gap-[1px]">
            {board.map((row, r) => row.map((val, c) => (
              <div 
                key={`${r}-${c}`}
                onClick={() => handleCellClick(r, c)}
                className={`
                  w-10 h-10 md:w-12 md:h-12 flex items-center justify-center text-xl font-black cursor-pointer transition-all duration-300
                  ${selectedCell?.[0] === r && selectedCell?.[1] === c ? 'bg-indigo-600 text-white' : 'bg-white text-slate-900 hover:bg-[#f5f2e8]'}
                  ${errors[r][c] ? 'text-red-600 bg-red-100' : ''}
                  ${r % 3 === 2 && r !== 8 ? 'mb-1' : ''}
                  ${c % 3 === 2 && c !== 8 ? 'mr-1' : ''}
                `}
              >
                {val || ''}
              </div>
            )))}
          </div>
        </div>

        <div className="flex-1 space-y-8">
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button key={num} onClick={() => handleNumberInput(num)} className="py-5 border-2 border-slate-900 font-black text-2xl hover:bg-slate-900 hover:text-white transition-all active:translate-y-1">{num}</button>
            ))}
          </div>

          <div className="border-4 border-slate-900 p-8 bg-white shadow-inner">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 underline">Reasoning Oracle</h3>
              <button onClick={getHintFromAI} disabled={isLoadingHint || !selectedCell} className="text-[10px] font-black bg-slate-900 text-white px-5 py-2 uppercase hover:bg-indigo-600 disabled:opacity-20 transition-all">
                {isLoadingHint ? 'ANALYIZING...' : 'QUERY HINT'}
              </button>
            </div>
            
            <div className="font-mono text-[10px] leading-relaxed space-y-4">
              {hint?.thinking && (
                <div className="border-l-2 border-slate-300 pl-4 opacity-50 italic">
                  {hint.thinking.split('\n').map((line, i) => <p key={i}>&gt; {line}</p>)}
                </div>
              )}
              <p className="text-sm font-bold italic border-2 border-slate-900 p-4 bg-[#f5f2e8]">
                {isLoadingHint ? "Synthesizing 32k thinking budget..." : (hint?.final || "Select a node for logic injection.")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
