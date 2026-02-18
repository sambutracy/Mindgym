
import React, { useState, useEffect } from 'react';
import { audioService } from '../services/audioService';
import { getDeepReasoningHint, speakHint, generateCipherMessage, getDailyISO } from '../services/geminiService';
import confetti from 'canvas-confetti';

interface CipherGameProps {
  onComplete: () => void;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const STORAGE_KEY_PREFIX = 'mindgym-cipher';

export const CipherGame: React.FC<CipherGameProps> = ({ onComplete }) => {
  const [originalMessage, setOriginalMessage] = useState("");
  const [encryptedMessage, setEncryptedMessage] = useState("");
  const [cipherMap, setCipherMap] = useState<Record<string, string>>({});
  const [userMapping, setUserMapping] = useState<Record<string, string>>({});
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [frequencies, setFrequencies] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setMode] = useState<'daily' | 'practice'>('daily');

  const getStorageKey = () => `${STORAGE_KEY_PREFIX}-${mode === 'daily' ? getDailyISO() : 'practice'}`;

  useEffect(() => {
    const key = getStorageKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const { msg, enc, map, userMap } = JSON.parse(saved);
        setOriginalMessage(msg);
        setEncryptedMessage(enc);
        setCipherMap(map);
        setUserMapping(userMap);
        calculateFrequencies(enc);
        setIsLoading(false);
      } catch (e) {
        initGame();
      }
    } else {
      initGame();
    }
  }, [mode]);

  const initGame = async () => {
    setIsLoading(true);
    const seed = mode === 'daily' ? getDailyISO() : Math.random().toString();
    const msg = await generateCipherMessage(seed);
    const shuffled = [...ALPHABET].sort(() => Math.random() - 0.5);
    const map: Record<string, string> = {};
    ALPHABET.forEach((char, i) => {
      map[char] = shuffled[i];
    });

    const enc = msg.toUpperCase().split("").map((c: string) => ALPHABET.includes(c) ? map[c] : c).join("");
    
    setOriginalMessage(msg.toUpperCase());
    setEncryptedMessage(enc);
    setCipherMap(map);
    setUserMapping({});
    calculateFrequencies(enc);
    localStorage.removeItem(getStorageKey());
    setIsLoading(false);
  };

  const calculateFrequencies = (text: string) => {
    const counts: Record<string, number> = {};
    const chars = text.split("").filter(c => ALPHABET.includes(c));
    chars.forEach(c => counts[c] = (counts[c] || 0) + 1);
    setFrequencies(counts);
  };

  useEffect(() => {
    if (originalMessage) {
      localStorage.setItem(getStorageKey(), JSON.stringify({
        msg: originalMessage,
        enc: encryptedMessage,
        map: cipherMap,
        userMap: userMapping
      }));
      checkWin();
    }
  }, [userMapping]);

  const toggleMode = () => {
    setMode(prev => prev === 'daily' ? 'practice' : 'daily');
  };

  const checkWin = () => {
    const currentDecoded = encryptedMessage.split("").map(c => {
      if (!ALPHABET.includes(c)) return c;
      return userMapping[c] || "_";
    }).join("");

    if (currentDecoded === originalMessage) {
      audioService.playSuccess();
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      onComplete();
    }
  };

  const assignMapping = (decryptedChar: string) => {
    if (!selectedChar) return;
    audioService.playInput();
    
    // Remove if already assigned to something else
    const newUserMapping = { ...userMapping };
    Object.keys(newUserMapping).forEach(key => {
      if (newUserMapping[key] === decryptedChar) delete newUserMapping[key];
    });

    newUserMapping[selectedChar] = decryptedChar;
    setUserMapping(newUserMapping);
    setSelectedChar(null);
  };

  const getAIHint = async () => {
    audioService.playClick();
    setIsLoadingHint(true);
    const context = {
      clue: "Substitution Cipher analysis.",
      partial: encryptedMessage.split("").map(c => userMapping[c] || c).join(""),
      encrypted: encryptedMessage
    };
    const result = await getDeepReasoningHint(context, 0, 0, 'crossword');
    const final = result.text?.split("FINAL_HINT:")[1]?.trim() || "Analyze the single-letter words or common three-letter combinations.";
    setHint(final);
    setIsLoadingHint(false);
    speakHint(final);
  };

  const clearMapping = (char: string) => {
    const newUserMapping = { ...userMapping };
    delete newUserMapping[char];
    setUserMapping(newUserMapping);
  };

  if (isLoading) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-6">
        <div className="w-12 h-12 border-4 border-slate-900 border-t-indigo-600 rounded-full animate-spin" />
        <p className="serif text-2xl font-black italic">Encrypting Transmission...</p>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fadeIn py-4 pb-20">
      <header className="border-b-4 border-slate-900 pb-8 flex justify-between items-end">
        <div>
          <h2 className="serif text-6xl font-black italic tracking-tighter">Cryptic Ledger</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">
            Protocol: {mode === 'daily' ? `DAILY_SYNC_${getDailyISO()}` : 'PRACTICE_MODE'}
          </p>
        </div>
        <button onClick={toggleMode} className="text-[10px] font-black underline uppercase hover:text-indigo-600">
           {mode === 'daily' ? 'Switch to Practice' : 'Switch to Daily'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Ledger View */}
        <div className="lg:col-span-8 space-y-8">
          <div className="border-4 border-slate-900 p-10 bg-white shadow-[12px_12px_0px_#0f172a] relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-[0.05] pointer-events-none">
                <span className="serif text-9xl font-black">§</span>
             </div>
             <div className="flex flex-wrap gap-x-4 gap-y-8 leading-none">
               {encryptedMessage.split(" ").map((word, wIdx) => (
                 <div key={wIdx} className="flex gap-1">
                   {word.split("").map((char, cIdx) => {
                     const isLetter = ALPHABET.includes(char);
                     const decoded = userMapping[char];
                     const isSelected = selectedChar === char;
                     return (
                       <div 
                        key={cIdx} 
                        onClick={() => isLetter && setSelectedChar(char)}
                        className={`flex flex-col items-center gap-1 group cursor-pointer ${!isLetter ? 'cursor-default' : ''}`}
                       >
                         <div className={`w-8 h-10 flex items-center justify-center text-3xl font-black border-b-2 transition-all ${isSelected ? 'border-indigo-600 text-indigo-600' : 'border-slate-300 group-hover:border-slate-900'}`}>
                           {isLetter ? char : char}
                         </div>
                         <div className={`text-xs font-bold ${decoded ? 'text-indigo-600' : 'text-slate-300 italic'}`}>
                           {isLetter ? (decoded || "_") : ""}
                         </div>
                       </div>
                     );
                   })}
                 </div>
               ))}
             </div>
          </div>

          <div className="border-4 border-slate-900 bg-[#f5f2e8] p-8 shadow-[8px_8px_0px_#0f172a]">
             <div className="flex items-center justify-between mb-4 border-b border-slate-900 pb-2">
               <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Frequency Analysis Table</span>
               <span className="text-[9px] italic text-slate-400">Archival sorted by incidence</span>
             </div>
             <div className="flex flex-wrap gap-2">
               {ALPHABET.map(char => {
                 const count = frequencies[char] || 0;
                 if (count === 0) return null;
                 const maxCount = Math.max(...(Object.values(frequencies) as number[]));
                 const height = (count / maxCount) * 40;
                 return (
                   <div key={char} className="flex flex-col items-center gap-1">
                     <div className="w-6 bg-slate-200 relative flex items-end h-12 overflow-hidden">
                        <div className="w-full bg-slate-900 transition-all duration-1000" style={{ height: `${height}px` }} />
                     </div>
                     <span className="text-[10px] font-black">{char}</span>
                   </div>
                 );
               })}
             </div>
          </div>
        </div>

        {/* Decoder Sidebar */}
        <div className="lg:col-span-4 space-y-6">
          <div className="border-4 border-slate-900 bg-white p-6 shadow-[8px_8px_0px_#0f172a]">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-6 border-b border-slate-200 pb-2">Substitution Mapping</h3>
            {selectedChar ? (
              <div className="space-y-6 animate-fadeIn">
                <div className="text-center p-4 bg-indigo-50 border-2 border-indigo-200">
                  <p className="text-[10px] font-black uppercase text-indigo-400 mb-1">Mapping Character</p>
                  <span className="serif text-5xl font-black text-indigo-600">{selectedChar}</span>
                </div>
                <div className="grid grid-cols-6 gap-2">
                  {ALPHABET.map(char => (
                    <button
                      key={char}
                      onClick={() => assignMapping(char)}
                      className="w-full h-10 flex items-center justify-center font-black text-xs border border-slate-200 hover:bg-slate-900 hover:text-white transition-all"
                    >
                      {char}
                    </button>
                  ))}
                </div>
                <button 
                  onClick={() => clearMapping(selectedChar)}
                  className="w-full py-2 text-[9px] font-black text-red-500 border border-red-200 hover:bg-red-50 uppercase"
                >
                  Clear Node Mapping
                </button>
              </div>
            ) : (
              <div className="py-20 text-center opacity-20">
                <span className="serif text-6xl">🔏</span>
                <p className="text-[10px] font-black uppercase mt-4">Select an encrypted node to map.</p>
              </div>
            )}
          </div>

          <div className="border-2 border-slate-900 p-6 bg-[#f5f2e8]">
             <div className="flex justify-between items-center mb-4">
               <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Archival Analyst</span>
               <button 
                 onClick={getAIHint} 
                 disabled={isLoadingHint}
                 className="text-[9px] font-black bg-slate-900 text-white px-3 py-1 rounded hover:bg-indigo-600 disabled:opacity-30"
               >
                 {isLoadingHint ? 'ANALYIZING...' : 'CONSULT'}
               </button>
             </div>
             <p className="serif text-sm italic text-slate-800 leading-snug">
               {hint || "The Gemini 3 Reasoning Core is monitoring the ledger pattern."}
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};
