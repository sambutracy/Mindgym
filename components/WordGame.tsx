
import React, { useState, useEffect } from 'react';
import { getDailyWordHint, generateSecretWord, getDailyISO } from '../services/geminiService';
import { audioService } from '../services/audioService';
import confetti from 'canvas-confetti';

interface WordGameProps {
  onComplete: () => void;
}

const STORAGE_KEY_PREFIX = 'mindgym-word';

export const WordGame: React.FC<WordGameProps> = ({ onComplete }) => {
  const [targetWord, setTargetWord] = useState("");
  const [guesses, setGuesses] = useState<string[]>([]);
  const [currentGuess, setCurrentGuess] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [mode, setMode] = useState<'daily' | 'practice'>('daily');

  const getStorageKey = () => `${STORAGE_KEY_PREFIX}-${mode === 'daily' ? getDailyISO() : 'practice'}`;

  const initGame = async () => {
    setIsInitializing(true);
    const seed = mode === 'daily' ? getDailyISO() : Math.random().toString();
    const word = await generateSecretWord(seed);
    setTargetWord(word);
    setGuesses([]);
    setCurrentGuess("");
    setIsGameOver(false);
    setHint(null);
    localStorage.removeItem(getStorageKey());
    setIsInitializing(false);
  };

  useEffect(() => {
    // Check for saved state first
    const key = getStorageKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const { target, guesses: sGuesses, isGameOver: sIsGameOver } = JSON.parse(saved);
        setTargetWord(target);
        setGuesses(sGuesses);
        setIsGameOver(sIsGameOver);
        setIsInitializing(false);
      } catch (e) {
        initGame();
      }
    } else {
      initGame();
    }
  }, [mode]);

  useEffect(() => {
    if (!isInitializing && targetWord) {
      localStorage.setItem(getStorageKey(), JSON.stringify({
        target: targetWord,
        guesses,
        isGameOver
      }));
    }
  }, [guesses, isGameOver, targetWord, isInitializing]);

  const toggleMode = () => {
    setMode(prev => prev === 'daily' ? 'practice' : 'daily');
  };

  const triggerCelebration = () => {
    audioService.playSuccess();
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#0f172a', '#4f46e5', '#f5f2e8']
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentGuess.length !== 5 || isGameOver) return;

    const guessUpper = currentGuess.toUpperCase();
    const newGuesses = [...guesses, guessUpper];
    setGuesses(newGuesses);
    setCurrentGuess("");

    if (guessUpper === targetWord) {
      setIsGameOver(true);
      triggerCelebration();
      onComplete();
    } else {
      audioService.playTick();
      if (newGuesses.length >= 6) {
        setIsGameOver(true);
        audioService.playError();
      }
    }
  };

  const handleInputChange = (val: string) => {
    const cleanVal = val.toUpperCase().replace(/[^A-Z]/g, "");
    if (cleanVal.length > currentGuess.length) {
      audioService.playInput();
    }
    setCurrentGuess(cleanVal);
  };

  const getAIHint = async () => {
    if (guesses.length === 0) return;
    audioService.playClick();
    setIsLoadingHint(true);
    const lastGuess = guesses[guesses.length - 1];
    const text = await getDailyWordHint(targetWord, lastGuess);
    setHint(text);
    setIsLoadingHint(false);
  };

  const getCharStyle = (guess: string, index: number) => {
    const char = guess[index];
    if (char === targetWord[index]) return 'bg-slate-900 text-white border-slate-900';
    if (targetWord.includes(char)) return 'bg-indigo-600 text-white border-indigo-600';
    return 'bg-slate-200 text-slate-400 border-slate-300';
  };

  if (isInitializing) {
     return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-6">
        <div className="w-12 h-12 border-4 border-slate-900 border-t-indigo-600 rounded-full animate-spin" />
        <p className="serif text-2xl font-black italic">Generating Lexical Seed...</p>
      </div>
     );
  }

  return (
    <div className="space-y-12 max-w-xl mx-auto animate-fadeIn py-4 pb-20">
      <header className="border-b-4 border-slate-900 pb-8 text-center flex flex-col items-center">
        <h2 className="serif text-5xl font-black italic tracking-tighter">Semantic Decrypt</h2>
        <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2 mb-4">
          {mode === 'daily' ? `DAILY_PROTOCOL_${getDailyISO()}` : 'PRACTICE_MODE'}
        </p>
        <button onClick={toggleMode} className="text-[10px] font-black underline uppercase hover:text-indigo-600">
           {mode === 'daily' ? 'Switch to Practice' : 'Switch to Daily'}
        </button>
      </header>

      <div className="space-y-4">
        {guesses.map((guess, i) => (
          <div key={i} className="flex gap-3 justify-center">
            {guess.split('').map((char, j) => (
              <div key={j} className={`w-14 h-14 flex items-center justify-center text-3xl font-black border-2 transition-all duration-500 shadow-[4px_4px_0px_rgba(0,0,0,0.1)] ${getCharStyle(guess, j)}`}>
                {char}
              </div>
            ))}
          </div>
        ))}
        {guesses.length < 6 && !isGameOver && (
          <div className="flex gap-3 justify-center">
            {Array(5).fill(null).map((_, i) => (
              <div key={i} className={`w-14 h-14 flex items-center justify-center text-3xl font-black border-2 border-slate-900 bg-white shadow-[4px_4px_0px_#0f172a]`}>
                {currentGuess[i] || ""}
              </div>
            ))}
          </div>
        )}
      </div>

      {!isGameOver ? (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 max-w-xs mx-auto">
          <input
            type="text"
            maxLength={5}
            value={currentGuess}
            onChange={(e) => handleInputChange(e.target.value)}
            placeholder="TYPE WORD"
            className="w-full px-4 py-5 text-center text-4xl font-black tracking-[0.2em] bg-white border-4 border-slate-900 focus:ring-4 focus:ring-indigo-500/20 outline-none transition-all shadow-[8px_8px_0px_#0f172a]"
            autoFocus
          />
          <button 
            type="submit"
            disabled={currentGuess.length < 5}
            className="w-full py-5 bg-slate-900 text-white font-black text-sm uppercase tracking-[0.3em] hover:bg-indigo-600 disabled:opacity-30 transition-all shadow-[8px_8px_0px_rgba(0,0,0,0.1)] active:translate-y-1"
          >
            Verify Protocol
          </button>
        </form>
      ) : (
        <div className="border-4 border-slate-900 bg-white p-10 text-center shadow-[12px_12px_0px_#0f172a] animate-fadeIn">
          <p className="serif text-4xl font-black mb-4 italic text-slate-900">
            {guesses.includes(targetWord) ? "CRACKED! 🎉" : "REDACTED."}
          </p>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-6">
            THE TARGET SEED WAS <span className="text-indigo-600 underline">{targetWord}</span>
          </p>
          <button 
             onClick={initGame}
             className="bg-slate-900 text-white px-8 py-3 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 transition-colors"
          >
            Next Challenge →
          </button>
        </div>
      )}

      <div className="border-4 border-slate-900 bg-[#f5f2e8] p-8 shadow-[8px_8px_0px_#0f172a] relative">
        <div className="flex items-center justify-between mb-6 border-b border-slate-900 pb-2">
          <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-[0.4em]">
            Editorial Nudge
          </h4>
          <button 
            onClick={getAIHint}
            disabled={guesses.length === 0 || isLoadingHint || isGameOver}
            className="text-[10px] font-black underline uppercase hover:text-indigo-600 disabled:opacity-20 transition-all"
          >
            {isLoadingHint ? 'ANALYIZING...' : 'CONSULT GAZETTE'}
          </button>
        </div>
        <p className="serif text-xl italic text-slate-700 leading-relaxed min-h-[60px]">
          {hint || (guesses.length === 0 ? "Submit a guess to trigger archival analysis." : "Archives awaiting your query.")}
        </p>
      </div>
    </div>
  );
};
