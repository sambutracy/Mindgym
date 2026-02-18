
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { audioService } from '../services/audioService';
import { getDeepReasoningHint, speakHint } from '../services/geminiService';
import confetti from 'canvas-confetti';

interface CartogramGameProps {
  onComplete: () => void;
}

interface CartogramPuzzle {
  id: string;
  variable: string;
  options: string[];
  imageUrl: string;
  refImageUrl: string;
  explanation: string;
  difficulty: 'EASY' | 'MED' | 'HARD';
}

const PUZZLES: CartogramPuzzle[] = [
  {
    id: 'world-pop',
    variable: 'Total Population',
    options: ['CO2 Emissions', 'Total Population', 'Land Area', 'GDP per Capita'],
    imageUrl: 'https://images.unsplash.com/photo-1526778548025-fa2f459cd5c1?q=80&w=2066&auto=format&fit=crop', 
    refImageUrl: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?q=80&w=2070&auto=format&fit=crop',
    explanation: 'Notice the extreme inflation of South Asia and East Asia. The geometry here is defined by human density: countries with over a billion residents swell to dominate the global surface area.',
    difficulty: 'EASY'
  },
  {
    id: 'carbon-footprint',
    variable: 'CO2 Emissions',
    options: ['Forest Cover', 'Internet Access', 'CO2 Emissions', 'Agricultural Output'],
    imageUrl: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072&auto=format&fit=crop',
    refImageUrl: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?q=80&w=2070&auto=format&fit=crop',
    explanation: 'The northern hemisphere appears bloated, specifically industrial hubs. The distortion reveals the structural footprint of high-energy economies vs the "thin" geometry of the Global South.',
    difficulty: 'MED'
  },
  {
    id: 'internet-users',
    variable: 'Internet Users',
    options: ['Clean Water Access', 'Internet Users', 'Literacy Rate', 'Cattle Population'],
    imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop',
    refImageUrl: 'https://images.unsplash.com/photo-1521295121783-8a321d551ad2?q=80&w=2070&auto=format&fit=crop',
    explanation: 'This map visualizes the digital divide. Some nations vanish entirely, while digital hubs like the Netherlands and South Korea are significantly larger than their geographic landmass.',
    difficulty: 'HARD'
  }
];

export const CartogramGame: React.FC<CartogramGameProps> = ({ onComplete }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const puzzle = PUZZLES[currentIdx];

  const handleSelect = (option: string) => {
    if (isRevealed) return;
    audioService.playClick();
    setSelectedOption(option);
  };

  const handleSubmit = () => {
    if (!selectedOption) return;
    setIsRevealed(true);
    if (selectedOption === puzzle.variable) {
      audioService.playSuccess();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      onComplete();
    } else {
      audioService.playError();
    }
  };

  const getAIHint = async () => {
    audioService.playClick();
    setIsLoadingHint(true);
    const context = {
      type: 'cartogram',
      id: puzzle.id,
      difficulty: puzzle.difficulty,
      distortions: puzzle.explanation 
    };
    // Fix: getDeepReasoningHint returns an object { text, grounding }. Access .text to use .split().
    const result = await getDeepReasoningHint(context, 0, 0, 'spatial');
    const final = result.text?.split("FINAL_HINT:")[1]?.trim() || "Consider which regions are most 'inflated' relative to their actual landmass.";
    setHint(final);
    setIsLoadingHint(false);
    speakHint(final);
  };

  const nextPuzzle = () => {
    setIsRevealed(false);
    setSelectedOption(null);
    setHint(null);
    setCurrentIdx((prev) => (prev + 1) % PUZZLES.length);
  };

  return (
    <div className="space-y-12 animate-fadeIn py-4 pb-20 max-w-4xl mx-auto">
      <header className="border-b-4 border-slate-900 pb-8 flex justify-between items-end">
        <div>
          <h2 className="serif text-6xl font-black italic tracking-tighter">The Atlas</h2>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2">Protocol: Spatial Distortion Analysis</p>
        </div>
        <div className="text-right">
          <span className="block text-[10px] font-black border-2 border-slate-900 px-3 py-1 uppercase mb-1">{puzzle.difficulty}</span>
          <span className="text-[9px] font-bold text-slate-400 italic">MAP ENGINE: V.3.1-DISTORT</span>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Map Display */}
        <div className="lg:col-span-8 space-y-6">
          <div className="border-4 border-slate-900 bg-[#f5f2e8] p-1 shadow-[16px_16px_0px_#0f172a] relative group overflow-hidden">
            {/* Edge Markers */}
            <div className="absolute top-4 left-4 p-2 bg-slate-900 text-white text-[7px] font-black uppercase tracking-[0.4em] z-30">
              {isRevealed ? "GEO_REFERENCE_MODE" : "DATA_DISTORTION_MATRIX"}
            </div>
            <div className="absolute bottom-4 right-4 p-2 text-slate-900 text-[7px] font-black uppercase tracking-[0.4em] z-30 opacity-40">
              SCAN_COORD: {Math.floor(Math.random()*1000)}/AXIS
            </div>
            
            <div className="relative aspect-[16/10] overflow-hidden border-2 border-slate-900 bg-white">
               {/* Reference Grid Overlay */}
               <div className="absolute inset-0 z-20 pointer-events-none opacity-20" 
                    style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 0)', backgroundSize: '24px 24px' }} />
               <div className="absolute inset-0 z-20 pointer-events-none opacity-[0.05]" 
                    style={{ backgroundImage: 'linear-gradient(#000 1px, transparent 0), linear-gradient(90deg, #000 1px, transparent 0)', backgroundSize: '48px 48px' }} />

               {/* Scanline Effect */}
               <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
                  <motion.div 
                    animate={{ y: ['-100%', '200%'] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="w-full h-1 bg-indigo-500/20 shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                  />
               </div>

               <img 
                 src={isRevealed ? puzzle.refImageUrl : puzzle.imageUrl} 
                 className={`w-full h-full object-cover transition-all duration-700 ease-in-out ${isRevealed ? 'grayscale-0 brightness-100' : 'grayscale brightness-110 contrast-[1.4] saturate-0'}`}
                 alt="Cartogram Data Visualization"
               />

               {/* Blueprint Tint on Reveal */}
               <div className={`absolute inset-0 pointer-events-none transition-opacity duration-1000 ${isRevealed ? 'bg-indigo-900/10 mix-blend-multiply opacity-100' : 'opacity-0'}`} />
            </div>

            <div className="mt-4 p-4 border-t border-slate-200 flex justify-between items-center bg-white/50 backdrop-blur-sm">
              <span className="text-[9px] font-mono text-slate-500 font-bold uppercase tracking-widest">
                Projection: Area-Proportional Cartogram (Gaster-V)
              </span>
              <div className="flex gap-4">
                <span className="text-[9px] font-mono text-slate-400">VAR: HIDDEN</span>
                <span className="text-[9px] font-mono text-slate-400">RES: HIGH_FIDELITY</span>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {isRevealed && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-4 border-slate-900 bg-white p-8 shadow-[8px_8px_0px_#4f46e5]"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-indigo-600 flex items-center justify-center text-white">
                    <span className="text-xl">🔍</span>
                  </div>
                  <h3 className="serif text-3xl font-black italic">Gazette Analysis</h3>
                </div>
                <p className="text-sm font-bold text-slate-700 leading-relaxed mb-6 border-l-4 border-slate-900 pl-6 py-2">
                  {puzzle.explanation}
                </p>
                <button 
                  onClick={nextPuzzle}
                  className="bg-slate-900 text-white px-10 py-4 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all shadow-[4px_4px_0px_#4f46e5] active:translate-y-1"
                >
                  Analyze Next Section →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Deduction Sidebar */}
        <div className="lg:col-span-4 space-y-8">
          <div className="border-4 border-slate-900 bg-white p-8 shadow-[8px_8px_0px_#0f172a]">
             <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-6 border-b border-slate-200 pb-2">Inference Target</h3>
             <p className="text-xs font-bold text-slate-500 mb-8 leading-snug">
               Evaluate the expansion/contraction ratios within the matrix. Which variable dictates this geometry?
             </p>
             
             <div className="space-y-3">
               {puzzle.options.map((opt) => (
                 <button
                   key={opt}
                   onClick={() => handleSelect(opt)}
                   disabled={isRevealed}
                   className={`w-full p-4 text-left border-2 font-black text-[11px] uppercase tracking-widest transition-all ${
                     selectedOption === opt 
                       ? 'bg-slate-900 text-white border-slate-900 scale-[1.02] shadow-lg' 
                       : 'border-slate-100 hover:border-slate-900 bg-slate-50'
                   } ${isRevealed && opt === puzzle.variable ? 'bg-emerald-600 text-white border-emerald-600 ring-4 ring-emerald-100' : ''}`}
                 >
                   <div className="flex justify-between items-center">
                     <span>{opt}</span>
                     {selectedOption === opt && <span className="text-xs">▶</span>}
                   </div>
                 </button>
               ))}
             </div>

             {!isRevealed && (
               <button 
                 onClick={handleSubmit}
                 disabled={!selectedOption}
                 className="w-full mt-8 py-4 bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.4em] shadow-[4px_4px_0px_#0f172a] disabled:opacity-30 hover:bg-indigo-700 transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] active:translate-x-0 active:translate-y-0"
               >
                 Verify Interpretation
               </button>
             )}
          </div>

          <div className="border-2 border-slate-900 p-6 bg-[#f5f2e8]">
             <div className="flex justify-between items-center mb-4">
               <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Oracle Assistance</span>
               <button 
                 onClick={getAIHint} 
                 disabled={isLoadingHint || isRevealed}
                 className="text-[9px] font-black bg-slate-900 text-white px-3 py-1 rounded hover:bg-indigo-600 disabled:opacity-30"
               >
                 {isLoadingHint ? 'DECODING...' : 'QUERY'}
               </button>
             </div>
             <p className="serif text-sm italic text-slate-800 leading-snug">
               {hint || "The Gemini 3 core is standing by to correlate spatial anomalies with known global datasets."}
             </p>
          </div>
        </div>
      </div>
    </div>
  );
};
