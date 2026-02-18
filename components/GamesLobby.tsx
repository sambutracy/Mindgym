
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { audioService } from '../services/audioService';

interface GamesLobbyProps {
  onSelect: (tab: any) => void;
}

const gameCards = [
  { id: 'gazette', title: 'The Intel Briefing', desc: 'Real-time global signal correlation. Identify the hidden bridge between headlines.', icon: '📰', difficulty: 'EASY', skill: 'SYNTHESIS' },
  { id: 'geographic', title: 'The Correspondent', desc: 'Identify locations based on archival dispatches and silhouettes.', icon: '🗺️', difficulty: 'EASY', skill: 'GEO-COGNITION' },
  { id: 'cipher', title: 'Cryptic Ledger', desc: 'Identify patterns in frequency to decrypt the ledger.', icon: '📜', difficulty: 'MED', skill: 'LINGUISTIC' },
  { id: 'deduction', title: 'Deduction Grid', desc: 'Cross-reference facts to reveal the hidden matrix.', icon: '⚖️', difficulty: 'HARD', skill: 'DEDUCTION' },
  { id: 'spatial', title: 'Spatial Logic', desc: 'Master towers in 3D coordinate space.', icon: '💎', difficulty: 'HARD', skill: 'SPATIAL' },
  { id: 'sudoku', title: 'Neural Sudoku', desc: 'Reasoning at the edge of numerical logic.', icon: '🧩', difficulty: 'MED', skill: 'PATTERN' },
  { id: 'word', title: 'Semantic Decrypt', desc: 'Decrypt daily focus words via linguistics.', icon: '📖', difficulty: 'EASY', skill: 'LANGUAGE' },
  { id: 'crossword', title: 'Neural Crossword', desc: 'Classical synonyms meet modern AI.', icon: '✏️', difficulty: 'MED', skill: 'LANGUAGE' }
];

const GAMES_PER_PAGE = 4;
const PAGE_TITLES = ["The Front Page", "The Intelligence Annex", "The Cultural Review", "The Classifieds"];

export const GamesLobby: React.FC<GamesLobbyProps> = ({ onSelect }) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [direction, setDirection] = useState(0); // 1 for forward, -1 for back
  const shouldReduceMotion = useReducedMotion();

  const totalPages = Math.ceil(gameCards.length / GAMES_PER_PAGE);
  const pagedGames = useMemo(() => {
    const pages = [];
    for (let i = 0; i < gameCards.length; i += GAMES_PER_PAGE) {
      pages.push(gameCards.slice(i, i + GAMES_PER_PAGE));
    }
    return pages;
  }, []);

  const paginate = (newDirection: number) => {
    const nextPage = currentPage + newDirection;
    if (nextPage >= 0 && nextPage < totalPages) {
      audioService.playClick();
      setDirection(newDirection);
      setCurrentPage(nextPage);
    }
  };

  // Animation variants for the "Newspaper Flip"
  const variants = {
    enter: (direction: number) => ({
      rotateY: direction > 0 ? 90 : -90,
      opacity: 0,
      x: direction > 0 ? 100 : -100,
      scale: 0.9,
    }),
    center: {
      rotateY: 0,
      opacity: 1,
      x: 0,
      scale: 1,
      transition: {
        duration: shouldReduceMotion ? 0.2 : 0.6,
        type: 'spring',
        stiffness: 120,
        damping: 20
      }
    },
    exit: (direction: number) => ({
      rotateY: direction > 0 ? -90 : 90,
      opacity: 0,
      x: direction > 0 ? -100 : 100,
      scale: 0.9,
      transition: {
        duration: shouldReduceMotion ? 0.2 : 0.5
      }
    })
  };

  return (
    <div className="flex flex-col min-h-full perspective-[2000px] space-y-4 py-2 justify-center">
      <header className="border-b-4 border-slate-900 pb-4 flex justify-between items-end shrink-0">
        <div>
          <div className="flex items-center gap-4 mb-1">
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-400">Section: {PAGE_TITLES[currentPage] || "Archives"}</span>
            <span className="h-[1px] w-24 bg-slate-200" />
          </div>
          <h2 className="serif text-5xl md:text-7xl font-black text-slate-900 tracking-tighter italic leading-none">
            The Daily <span className="text-indigo-600">Gazette</span>
          </h2>
        </div>
        <div className="text-right hidden md:block">
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Edition Index</p>
          <div className="flex gap-1 justify-end">
            {Array.from({ length: totalPages }).map((_, i) => (
              <div key={i} className={`h-1.5 w-6 ${i === currentPage ? 'bg-indigo-600' : 'bg-slate-200'}`} />
            ))}
          </div>
        </div>
      </header>

      <div className="flex-1 relative flex flex-col justify-center">
        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={currentPage}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(e, { offset, velocity }) => {
              const swipe = offset.x;
              if (swipe < -100 || velocity.x < -500) paginate(1);
              else if (swipe > 100 || velocity.x > 500) paginate(-1);
            }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full cursor-grab active:cursor-grabbing origin-center"
          >
            {/* Spine Shadow Effect */}
            <div className="absolute inset-y-0 left-1/2 w-32 -translate-x-1/2 pointer-events-none z-10 opacity-10 bg-gradient-to-r from-transparent via-black to-transparent hidden md:block" />

            {pagedGames[currentPage].map((game, idx) => (
              <motion.div
                key={game.id}
                whileHover={{ scale: 1.01, rotate: idx % 2 === 0 ? 0.5 : -0.5 }}
                onClick={() => {
                  audioService.playClick();
                  onSelect(game.id as any);
                }}
                className="border-2 border-slate-900 bg-[#f5f2e8] p-6 flex flex-col justify-between min-h-[260px] shadow-[6px_6px_0px_#0f172a] hover:shadow-[10px_10px_0px_#4f46e5] transition-all relative group overflow-hidden"
              >
                {/* News Print Texture Overlay */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                
                <div className="flex justify-between items-start relative z-10">
                   <span className="serif text-5xl group-hover:scale-110 transition-transform">{game.icon}</span>
                   <div className="text-right">
                     <span className="block text-[9px] font-black border-2 border-slate-900 px-2 py-0.5 uppercase mb-1 bg-white">{game.difficulty}</span>
                     <span className="block text-[8px] font-bold text-indigo-600 tracking-widest">{game.skill}</span>
                   </div>
                </div>
                
                <div className="relative z-10 mt-4">
                  <h3 className="serif text-3xl font-black italic text-slate-900 mb-2 border-b border-slate-200 pb-2">{game.title}</h3>
                  <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed text-justify line-clamp-3">
                    {game.desc}
                  </p>
                </div>
                
                <div className="relative z-10 text-[9px] font-black underline uppercase tracking-tighter mt-4 flex items-center justify-between">
                  <span>Enter Protocol →</span>
                  <span className="text-slate-300 font-mono tracking-widest">REF: {game.id.toUpperCase()}</span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </AnimatePresence>
      </div>

      <footer className="pt-6 border-t-2 border-slate-900 flex flex-col md:flex-row justify-between items-center gap-6 shrink-0">
        <div className="flex gap-4">
          <button 
            onClick={() => paginate(-1)}
            disabled={currentPage === 0}
            className="group flex items-center gap-3 bg-white border-2 border-slate-900 px-5 py-2.5 font-black text-[10px] uppercase tracking-widest disabled:opacity-20 hover:bg-slate-900 hover:text-white transition-all shadow-[3px_3px_0px_#0f172a]"
          >
            <span className="group-hover:-translate-x-1 transition-transform">←</span> Prev
          </button>
          <button 
            onClick={() => paginate(1)}
            disabled={currentPage === totalPages - 1}
            className="group flex items-center gap-3 bg-white border-2 border-slate-900 px-5 py-2.5 font-black text-[10px] uppercase tracking-widest disabled:opacity-20 hover:bg-slate-900 hover:text-white transition-all shadow-[3px_3px_0px_#0f172a]"
          >
            Next <span className="group-hover:translate-x-1 transition-transform">→</span>
          </button>
        </div>

        <div className="text-center md:text-right hidden sm:block">
           <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Navigation Guidance</p>
           <p className="text-[9px] italic font-bold text-slate-600">
             "Flick the page or use controls to browse archives."
           </p>
        </div>
      </footer>
    </div>
  );
};
