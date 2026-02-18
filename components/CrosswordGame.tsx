
import React, { useState, useEffect, useCallback } from 'react';
import { audioService } from '../services/audioService';
import { getDeepReasoningHint, speakHint, generateCrosswordPuzzle, getDailyISO } from '../services/geminiService';
import confetti from 'canvas-confetti';

interface CrosswordGameProps {
  onComplete: () => void;
}

interface Clue {
  number: number;
  direction: 'across' | 'down';
  text: string;
  answer: string;
  row: number;
  col: number;
}

const GRID_SIZE = 12;

export const CrosswordGame: React.FC<CrosswordGameProps> = ({ onComplete }) => {
  const [grid, setGrid] = useState<string[][]>(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('#')));
  const [userGrid, setUserGrid] = useState<string[][]>(Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('')));
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(null);
  const [direction, setDirection] = useState<'across' | 'down'>('across');
  const [clues, setClues] = useState<Clue[]>([]);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [isLoadingPuzzle, setIsLoadingPuzzle] = useState(true);
  const [hint, setHint] = useState<{ thinking: string; final: string } | null>(null);
  const [mode, setMode] = useState<'daily' | 'practice'>('daily');

  const getStorageKey = () => `mindgym-crossword-${mode === 'daily' ? getDailyISO() : 'practice'}`;

  const initGame = async () => {
    setIsLoadingPuzzle(true);
    setHint(null);
    const seed = mode === 'daily' ? getDailyISO() : Math.random().toString();
    const newClues = await generateCrosswordPuzzle('Medium', seed);
    
    if (newClues) {
      setClues(newClues);
      
      const newGrid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill('#'));
      const newUserGrid = Array(GRID_SIZE).fill(null).map(() => Array(GRID_SIZE).fill(''));
      
      newClues.forEach((clue: Clue) => {
        for (let i = 0; i < clue.answer.length; i++) {
          const r = clue.direction === 'across' ? clue.row : clue.row + i;
          const c = clue.direction === 'across' ? clue.col + i : clue.col;
          if (r < GRID_SIZE && c < GRID_SIZE) newGrid[r][c] = ''; 
        }
      });
      
      setGrid(newGrid);
      setUserGrid(newUserGrid);
      // Clear old random storage if switching
      localStorage.removeItem(getStorageKey());
    }
    setIsLoadingPuzzle(false);
  };

  useEffect(() => {
    const key = getStorageKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const { grid: sGrid, clues: sClues, userGrid: sUserGrid } = JSON.parse(saved);
        setGrid(sGrid);
        setClues(sClues);
        setUserGrid(sUserGrid);
        setIsLoadingPuzzle(false);
      } catch (e) {
        initGame();
      }
    } else {
      initGame();
    }
  }, [mode]);

  useEffect(() => {
    if (clues.length > 0) {
      localStorage.setItem(getStorageKey(), JSON.stringify({ grid, clues, userGrid }));
    }
  }, [userGrid, clues, grid]);

  const toggleMode = () => {
    setMode(prev => prev === 'daily' ? 'practice' : 'daily');
  };

  const getActiveClue = useCallback(() => {
    if (!selectedCell) return null;
    const [r, c] = selectedCell;
    return clues.find(clue => {
      if (clue.direction !== direction) return false;
      return (
        clue.direction === 'across' 
          ? r === clue.row && c >= clue.col && c < clue.col + clue.answer.length
          : c === clue.col && r >= clue.row && r < clue.row + clue.answer.length
      );
    });
  }, [selectedCell, direction, clues]);

  const moveCursor = (step: number) => {
    if (!selectedCell) return;
    const [r, c] = selectedCell;
    let nextR = r, nextC = c;
    
    let iterations = 0;
    while (iterations < (GRID_SIZE * GRID_SIZE)) {
      if (direction === 'across') nextC += step;
      else nextR += step;

      if (nextR < 0 || nextR >= GRID_SIZE || nextC < 0 || nextC >= GRID_SIZE) break;
      
      if (grid[nextR][nextC] !== '#') {
        setSelectedCell([nextR, nextC]);
        return;
      }
      iterations++;
    }
  };

  const handleCellClick = (r: number, c: number) => {
    if (grid[r][c] === '#') return;
    audioService.playInput();
    if (selectedCell && selectedCell[0] === r && selectedCell[1] === c) {
      setDirection(prev => prev === 'across' ? 'down' : 'across');
    } else {
      setSelectedCell([r, c]);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedCell) return;
    const [r, c] = selectedCell;

    if (e.key === 'Backspace') {
      const newUserGrid = [...userGrid.map(row => [...row])];
      const wasEmpty = newUserGrid[r][c] === '';
      newUserGrid[r][c] = '';
      setUserGrid(newUserGrid);
      if (wasEmpty) {
        moveCursor(-1);
      }
      return;
    }

    if (e.key === 'ArrowRight') { setDirection('across'); moveCursor(1); return; }
    if (e.key === 'ArrowLeft') { setDirection('across'); moveCursor(-1); return; }
    if (e.key === 'ArrowDown') { setDirection('down'); moveCursor(1); return; }
    if (e.key === 'ArrowUp') { setDirection('down'); moveCursor(-1); return; }
    if (e.key === 'Tab') { 
        e.preventDefault();
        setDirection(prev => prev === 'across' ? 'down' : 'across');
        return;
    }

    if (e.key.length === 1 && e.key.match(/[a-z]/i)) {
      const char = e.key.toUpperCase();
      const newUserGrid = [...userGrid.map(row => [...row])];
      newUserGrid[r][c] = char;
      setUserGrid(newUserGrid);
      moveCursor(1);
      checkWin(newUserGrid);
    }
  };

  const checkWin = (currentGrid: string[][]) => {
    const isWin = clues.every(clue => {
      for (let i = 0; i < clue.answer.length; i++) {
        const r = clue.direction === 'across' ? clue.row : clue.row + i;
        const c = clue.direction === 'across' ? clue.col + i : clue.col;
        if (currentGrid[r][c] !== clue.answer[i]) return false;
      }
      return true;
    });

    if (isWin) {
      audioService.playSuccess();
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
      localStorage.removeItem(getStorageKey());
      onComplete();
    }
  };

  const getAIHint = async () => {
    const activeClue = getActiveClue();
    if (!activeClue) return;
    
    setIsLoadingHint(true);
    audioService.playClick();
    
    let partial = '';
    for (let i = 0; i < activeClue.answer.length; i++) {
      const r = activeClue.direction === 'across' ? activeClue.row : activeClue.row + i;
      const c = activeClue.direction === 'across' ? activeClue.col + i : activeClue.col;
      partial += userGrid[r][c] || '_';
    }

    const result = await getDeepReasoningHint({ clue: activeClue.text, partial }, 0, 0, 'crossword');
    const thinking = result.text?.split("FINAL_HINT:")[0].replace("THINKING_PROCESS:", "").trim() || "";
    const final = result.text?.split("FINAL_HINT:")[1]?.trim() || "Think about the synonym logic.";
    
    setHint({ thinking, final });
    setIsLoadingHint(false);
    speakHint(final);
  };

  const activeClue = getActiveClue();

  if (isLoadingPuzzle) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-6">
        <div className="w-12 h-12 border-4 border-slate-900 border-t-indigo-600 rounded-full animate-spin" />
        <p className="serif text-2xl font-black italic">Constructing Neural Grid...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-12 animate-fadeIn pb-20">
      <div className="flex-1 space-y-6">
        <header className="flex justify-between items-end">
          <div>
            <h2 className="text-4xl font-black text-white italic tracking-tighter uppercase">Neural Crossword</h2>
            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-1">Linguistic Synapse Test 04 // Powered by Gemini 3 Pro</p>
          </div>
          <button onClick={toggleMode} className="text-[10px] font-black underline uppercase text-indigo-400 hover:text-white">
            {mode === 'daily' ? 'Switch to Practice (Random)' : 'Switch to Daily Challenge'}
          </button>
        </header>

        <div className="bg-slate-900 p-4 rounded-[2.5rem] border border-white/5 shadow-2xl relative overflow-hidden group outline-none focus:ring-2 focus:ring-indigo-500/50" tabIndex={0} onKeyDown={handleKeyDown}>
          <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
          <div className="grid grid-cols-12 gap-1 aspect-square">
            {grid.map((row, r) => row.map((cell, c) => {
              const isSelected = selectedCell?.[0] === r && selectedCell?.[1] === c;
              const isBlack = cell === '#';
              
              let isHighlighted = false;
              if (activeClue && !isBlack) {
                if (activeClue.direction === 'across') {
                  isHighlighted = r === activeClue.row && c >= activeClue.col && c < activeClue.col + activeClue.answer.length;
                } else {
                  isHighlighted = c === activeClue.col && r >= activeClue.row && r < activeClue.row + activeClue.answer.length;
                }
              }

              return (
                <div
                  key={`${r}-${c}`}
                  onClick={() => handleCellClick(r, c)}
                  className={`
                    relative flex items-center justify-center text-sm md:text-lg font-black rounded-sm md:rounded-lg transition-all duration-300 cursor-pointer
                    ${isBlack ? 'bg-slate-950 shadow-inner' : 'bg-white/5 border border-white/5'}
                    ${isSelected ? 'bg-indigo-600 text-white shadow-[0_0_20px_rgba(79,70,229,0.5)] z-10 scale-105' : ''}
                    ${isHighlighted && !isSelected ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' : ''}
                    ${!isBlack && !isSelected && !isHighlighted ? 'hover:bg-white/10 text-slate-300' : ''}
                  `}
                >
                  {userGrid[r][c]}
                  {clues.map(clue => (clue.row === r && clue.col === c) ? (
                    <span key={clue.number + clue.direction} className="absolute top-0 left-0.5 text-[6px] md:text-[8px] opacity-40 font-black tracking-tighter">{clue.number}</span>
                  ) : null)}
                </div>
              );
            }))}
          </div>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-3xl p-6 backdrop-blur-xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-2">
            <span className="bg-indigo-500 text-[10px] font-black px-3 py-1 rounded-full text-white uppercase tracking-wider">{direction}</span>
            <span className="text-indigo-400 font-bold text-xl tracking-tighter">#{activeClue?.number || '?'}</span>
          </div>
          <p className="text-xl font-medium text-white italic leading-relaxed">
            {activeClue?.text || "Select a cell to begin pattern recognition."}
          </p>
        </div>
      </div>

      <div className="w-full lg:w-96 space-y-6">
        <div className="bg-slate-900 rounded-[2.5rem] border border-white/5 p-8 h-full flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
             <div className="text-8xl">✏️</div>
          </div>
          
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mb-8">
            {mode === 'daily' ? `DAILY_SYNC_${getDailyISO()}` : 'PRACTICE_MODE'}
          </h3>

          <div className="flex-1 space-y-8 overflow-y-auto max-h-[400px] pr-4 custom-scrollbar">
            <div>
              <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.2em] mb-4 border-b border-indigo-500/10 pb-2">Across Domains</h4>
              <div className="space-y-4">
                {clues.filter(c => c.direction === 'across').map(clue => (
                  <div 
                    key={clue.number + 'a'} 
                    onClick={() => { setSelectedCell([clue.row, clue.col]); setDirection('across'); }}
                    className={`text-sm cursor-pointer transition-all ${activeClue?.number === clue.number && direction === 'across' ? 'text-white font-bold translate-x-1' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <span className="font-black mr-2 opacity-30">{clue.number}.</span> {clue.text}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.2em] mb-4 border-b border-emerald-500/10 pb-2">Down Domains</h4>
              <div className="space-y-4">
                {clues.filter(c => c.direction === 'down').map(clue => (
                  <div 
                    key={clue.number + 'd'} 
                    onClick={() => { setSelectedCell([clue.row, clue.col]); setDirection('down'); }}
                    className={`text-sm cursor-pointer transition-all ${activeClue?.number === clue.number && direction === 'down' ? 'text-white font-bold translate-x-1' : 'text-slate-500 hover:text-slate-300'}`}
                  >
                    <span className="font-black mr-2 opacity-30">{clue.number}.</span> {clue.text}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/5">
             <div className="bg-indigo-500/10 rounded-3xl p-6 border border-indigo-500/20 shadow-inner">
                <div className="flex items-center justify-between mb-4">
                   <h5 className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em] flex items-center gap-2">
                     <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span> Oracle Reasoning
                   </h5>
                   <button 
                    onClick={getAIHint}
                    disabled={isLoadingHint || !activeClue}
                    className="text-[9px] font-black text-white bg-indigo-600 px-4 py-1.5 rounded-full hover:bg-indigo-500 disabled:opacity-20 transition-all shadow-lg shadow-indigo-500/20"
                   >
                     {isLoadingHint ? 'DECRYPTING...' : 'QUERY ORACLE'}
                   </button>
                </div>
                
                <div className="font-mono text-[10px] leading-tight space-y-4 max-h-40 overflow-y-auto custom-scrollbar">
                  {hint?.thinking && (
                    <div className="border-l-2 border-indigo-500/30 pl-3 opacity-50 text-indigo-200 italic">
                      {hint.thinking.split('\n').map((line, i) => <p key={i}>&gt; {line}</p>)}
                    </div>
                  )}
                  <p className="text-sm font-bold text-white leading-relaxed">
                    {isLoadingHint ? "Synthesizing deep linguistic pattern (Thinking 32k)..." : (hint?.final || "Select a node to enable semantic reasoning.")}
                  </p>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
