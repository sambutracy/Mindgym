
import React, { useState, useEffect, useCallback } from 'react';
import { audioService } from '../services/audioService';
import { getDeepReasoningHint, speakHint, generateDeductionPuzzle, getDailyISO } from '../services/geminiService';
import confetti from 'canvas-confetti';
import { Difficulty } from '../types';

interface DeductionGridProps {
  onComplete: () => void;
  difficulty: Difficulty;
}

type CellValue = null | 'X' | 'CHECK';

interface PuzzleInstance {
  caseId: string;
  analysts: string[];
  projects: string[];
  levels: string[];
  clues: string[];
  solutions: Record<string, { Project: string; Level: string }>;
}

const STORAGE_KEY_PREFIX = 'mindgym-deduction-puzzle';
const MARKS_KEY_PREFIX = 'mindgym-deduction-marks';

export const DeductionGrid: React.FC<DeductionGridProps> = ({ onComplete, difficulty }) => {
  const [puzzle, setPuzzle] = useState<PuzzleInstance | null>(null);
  const [gridAP, setGridAP] = useState<CellValue[][]>([]);
  const [gridAL, setGridAL] = useState<CellValue[][]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hint, setHint] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [mode, setMode] = useState<'daily' | 'practice'>('daily');

  const getStorageKey = () => `${STORAGE_KEY_PREFIX}-${mode === 'daily' ? getDailyISO() : 'practice'}`;
  const getMarksKey = () => `${MARKS_KEY_PREFIX}-${mode === 'daily' ? getDailyISO() : 'practice'}`;

  const fetchNewCase = useCallback(async () => {
    setIsLoading(true);
    setHint(null);
    const seed = mode === 'daily' ? getDailyISO() : Math.random().toString();
    const newPuzzle = await generateDeductionPuzzle(difficulty, seed);
    
    if (newPuzzle) {
      setPuzzle(newPuzzle);
      // Determine size based on arrays returned, as difficulty changes size
      const size = newPuzzle.analysts.length;
      const empty = () => Array(size).fill(null).map(() => Array(size).fill(null));
      setGridAP(empty());
      setGridAL(empty());
      localStorage.setItem(getStorageKey(), JSON.stringify(newPuzzle));
      localStorage.removeItem(getMarksKey());
    }
    setIsLoading(false);
  }, [difficulty, mode]);

  useEffect(() => {
    const savedPuzzle = localStorage.getItem(getStorageKey());
    const savedMarks = localStorage.getItem(getMarksKey());

    if (savedPuzzle) {
      const p = JSON.parse(savedPuzzle);
      // Simple validation: Easy=3, Medium=4, Hard=5
      const expectedSize = difficulty === 'Easy' ? 3 : difficulty === 'Hard' ? 5 : 4;
      
      if (p.analysts.length !== expectedSize) {
        // Mismatch, fetch new
        fetchNewCase();
        return;
      }

      setPuzzle(p);
      if (savedMarks) {
        const { ap, al } = JSON.parse(savedMarks);
        setGridAP(ap);
        setGridAL(al);
      } else {
        const empty = () => Array(p.analysts.length).fill(null).map(() => Array(p.analysts.length).fill(null));
        setGridAP(empty());
        setGridAL(empty());
      }
      setIsLoading(false);
    } else {
      fetchNewCase();
    }
  }, [fetchNewCase, difficulty, mode]);

  useEffect(() => {
    if (puzzle && gridAP.length > 0) {
      localStorage.setItem(getMarksKey(), JSON.stringify({ ap: gridAP, al: gridAL }));
      checkVictory();
    }
  }, [gridAP, gridAL]);

  const toggleMode = () => {
    setMode(prev => prev === 'daily' ? 'practice' : 'daily');
  };

  const cycleCell = (grid: CellValue[][], r: number, c: number, setter: (g: CellValue[][]) => void) => {
    audioService.playInput();
    const newGrid = grid.map(row => [...row]);
    const current = newGrid[r][c];
    if (current === null) newGrid[r][c] = 'X';
    else if (current === 'X') newGrid[r][c] = 'CHECK';
    else newGrid[r][c] = null;
    setter(newGrid);
  };

  const checkVictory = () => {
    if (!puzzle) return;
    const allCorrect = puzzle.analysts.every((analyst, r) => {
      const sol = puzzle.solutions[analyst];
      if (!sol) return false;
      const correctProjectIdx = puzzle.projects.indexOf(sol.Project);
      const correctLevelIdx = puzzle.levels.indexOf(sol.Level);
      return gridAP[r][correctProjectIdx] === 'CHECK' && gridAL[r][correctLevelIdx] === 'CHECK';
    });

    if (allCorrect) {
      audioService.playSuccess();
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      onComplete();
    }
  };

  const resetProgress = () => {
    if (window.confirm("Clear all marks in the current matrix?")) {
      audioService.playClick();
      const empty = () => Array(puzzle?.analysts.length || 4).fill(null).map(() => Array(puzzle?.analysts.length || 4).fill(null));
      setGridAP(empty());
      setGridAL(empty());
      setHint(null);
      localStorage.removeItem(getMarksKey());
    }
  };

  const getAIHint = async () => {
    if (!puzzle) return;
    audioService.playClick();
    setIsLoadingHint(true);
    const result = await getDeepReasoningHint({ 
      puzzle, 
      userState: { gridAP, gridAL } 
    }, 0, 0, 'deduction');
    const final = result.text?.split("FINAL_HINT:")[1]?.trim() || "Analyze the relationship between levels and specific projects mentioned in the clues.";
    setHint(final);
    setIsLoadingHint(false);
    speakHint(final);
  };

  const getCellStyles = (value: CellValue) => {
    if (value === 'X') return 'text-red-900 bg-red-200';
    if (value === 'CHECK') return 'text-white bg-slate-800';
    return 'bg-slate-100 hover:bg-slate-50 text-slate-900';
  };

  if (isLoading || !puzzle) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-6">
        <div className="w-12 h-12 border-4 border-slate-900 border-t-indigo-600 rounded-full animate-spin" />
        <p className="serif text-2xl font-black italic">Generating {difficulty} Logic Case...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fadeIn py-4 pb-20">
      <header className="border-b-4 border-slate-900 pb-8 flex justify-between items-end flex-wrap gap-4">
        <div>
          <h2 className="serif text-6xl font-black italic tracking-tighter leading-none">Deduction Grid</h2>
          <div className="flex gap-4 items-center mt-2">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
               Protocol: {mode === 'daily' ? `DAILY_CASE_${getDailyISO()}` : 'PRACTICE_CASE'}
            </p>
            <span className="text-[10px] font-black uppercase bg-slate-200 px-2 py-0.5 rounded text-slate-600">{difficulty}</span>
          </div>
        </div>
        <div className="flex gap-4 items-center">
          <button onClick={resetProgress} className="text-[10px] font-black underline uppercase hover:text-red-600 transition-colors">Reset Marks</button>
          <button onClick={toggleMode} className="text-[10px] font-black bg-slate-900 text-white px-4 py-2 uppercase hover:bg-indigo-600 transition-all shadow-[4px_4px_0px_#4f46e5]">
            {mode === 'daily' ? 'Generate Practice Case' : 'Load Daily Case'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 space-y-6">
          <div className="border-4 border-slate-900 p-8 bg-white shadow-[8px_8px_0px_#0f172a]">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-4 border-b border-slate-200 pb-2">Intercepted Case File</h3>
            <div className="space-y-4">
              {puzzle.clues.map((clue, i) => (
                <p key={i} className="text-xs font-bold leading-relaxed text-slate-700 italic border-l-2 border-indigo-200 pl-3">
                  "{clue}"
                </p>
              ))}
            </div>
          </div>

          <div className="border-2 border-slate-900 p-6 bg-[#f5f2e8]">
             <div className="flex justify-between items-center mb-4">
               <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Oracle Reasoning</span>
               <button onClick={getAIHint} disabled={isLoadingHint} className="text-[9px] font-black bg-slate-900 text-white px-3 py-1 rounded uppercase hover:bg-indigo-600">
                 {isLoadingHint ? 'ANALYIZING...' : 'QUERY'}
               </button>
             </div>
             <p className="serif text-sm italic text-slate-800 leading-snug">
               {hint || "Archives stand ready to assist your logical path."}
             </p>
          </div>
        </div>

        <div className="lg:col-span-8 space-y-12 overflow-x-auto pb-8 custom-scrollbar">
          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 text-center">Matrix A: Personnel vs Protocol</h4>
            <div className="inline-block border-4 border-slate-900 bg-slate-900">
              <table className="border-collapse bg-slate-200">
                <thead>
                  <tr>
                    <th className="p-4 border-2 border-slate-900 bg-[#f5f2e8]"></th>
                    {puzzle.projects.map(p => (
                      <th key={p} className="p-4 border-2 border-slate-900 bg-[#f5f2e8] text-[10px] font-black uppercase vertical-lr tracking-tighter w-12">{p}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {puzzle.analysts.map((analyst, r) => (
                    <tr key={analyst}>
                      <td className="p-4 border-2 border-slate-900 bg-[#f5f2e8] text-[10px] font-black uppercase">{analyst}</td>
                      {puzzle.projects.map((_, c) => (
                        <td 
                          key={c} 
                          onClick={() => cycleCell(gridAP, r, c, setGridAP)}
                          className={`w-12 h-12 border-2 border-slate-400 cursor-pointer text-center text-xl font-black transition-colors ${getCellStyles(gridAP[r][c])}`}
                        >
                          {gridAP[r][c] === 'CHECK' ? '✓' : gridAP[r][c] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 text-center">Matrix B: Personnel vs Clearance</h4>
            <div className="inline-block border-4 border-slate-900 bg-slate-900">
              <table className="border-collapse bg-slate-200">
                <thead>
                  <tr>
                    <th className="p-4 border-2 border-slate-900 bg-[#f5f2e8]"></th>
                    {puzzle.levels.map(l => (
                      <th key={l} className="p-4 border-2 border-slate-900 bg-[#f5f2e8] text-[10px] font-black uppercase w-12">{l}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {puzzle.analysts.map((analyst, r) => (
                    <tr key={analyst}>
                      <td className="p-4 border-2 border-slate-900 bg-[#f5f2e8] text-[10px] font-black uppercase">{analyst}</td>
                      {puzzle.levels.map((_, c) => (
                        <td 
                          key={c} 
                          onClick={() => cycleCell(gridAL, r, c, setGridAL)}
                          className={`w-12 h-12 border-2 border-slate-400 cursor-pointer text-center text-xl font-black transition-colors ${getCellStyles(gridAL[r][c])}`}
                        >
                          {gridAL[r][c] === 'CHECK' ? '✓' : gridAL[r][c] || ''}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
