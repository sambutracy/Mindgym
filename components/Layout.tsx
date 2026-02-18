
import React, { useState } from 'react';
import { audioService } from '../services/audioService';
import { LiveMentor } from './LiveMentor';
import { AnimatePresence, motion } from 'framer-motion';
import { Difficulty } from '../types';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: any) => void;
  streak: number;
  onHomeClick?: () => void;
  difficulty: Difficulty;
  setDifficulty: (d: Difficulty) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, activeTab, setActiveTab, streak, onHomeClick, difficulty, setDifficulty }) => {
  const [showLiveConsult, setShowLiveConsult] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(() => {
    const saved = localStorage.getItem('mindgym-v3-compact');
    return saved === 'true';
  });

  const toggleCompact = () => {
    audioService.playClick();
    const nextValue = !isCompact;
    setIsCompact(nextValue);
    localStorage.setItem('mindgym-v3-compact', String(nextValue));
  };

  const cycleDifficulty = () => {
    audioService.playClick();
    const levels: Difficulty[] = ['Easy', 'Medium', 'Hard'];
    const idx = levels.indexOf(difficulty);
    setDifficulty(levels[(idx + 1) % levels.length]);
  };

  const handleNavClick = (tab: any) => {
    audioService.playClick();
    setActiveTab(tab);
    setIsMobileMenuOpen(false);
  };

  const menuItems = [
    { id: 'games', label: 'THE GAZETTE', icon: '📰' },
    { id: 'dashboard', label: 'THE CENSUS', icon: '📈' },
    { id: 'vision', label: 'FIELD OPS', icon: '👁️' },
  ];

  const subItems = [
    { id: 'gazette', label: 'Intel Briefing', icon: '📡', key: 'mindgym-briefing-progress' },
    { id: 'geographic', label: 'The Correspondent', icon: '🗺️', key: 'mindgym-geographic-progress' },
    { id: 'cipher', label: 'Cryptic Ledger', icon: '📜', key: 'mindgym-cipher-progress' },
    { id: 'deduction', label: 'Deduction Grid', icon: '⚖️', key: 'mindgym-deduction-progress' },
    { id: 'sudoku', label: 'Sudoku', icon: '🧩', key: 'mindgym-sudoku-progress' },
    { id: 'word', label: 'Word Decrypt', icon: '📖', key: 'mindgym-word-progress' },
    { id: 'spatial', label: 'Spatial Core', icon: '💎', key: 'mindgym-spatial-progress' },
    { id: 'crossword', label: 'Crossword', icon: '✏️', key: 'mindgym-crossword-progress' },
  ];

  const hasSavedProgress = (key: string) => {
    const saved = localStorage.getItem(key);
    return saved && saved !== '[]' && saved !== '{}' && saved !== '""' && saved !== 'null';
  };

  const getActiveLabel = () => {
    const main = menuItems.find(i => i.id === activeTab);
    if (main) return main.label;
    const sub = subItems.find(i => i.id === activeTab);
    return sub ? sub.label : "Lobby";
  };

  const getDiffColor = () => {
    if (difficulty === 'Easy') return 'text-emerald-600';
    if (difficulty === 'Medium') return 'text-amber-600';
    return 'text-red-600';
  };

  return (
    <div className={`h-[100dvh] w-full flex flex-col md:flex-row bg-[#ebe7e0] text-slate-900 font-medium transition-all duration-300 ${isCompact ? 'text-sm' : ''} overflow-hidden`}>
      <AnimatePresence>
        {showLiveConsult && (
          <LiveMentor 
            onClose={() => setShowLiveConsult(false)} 
            activeContext={getActiveLabel()}
          />
        )}
      </AnimatePresence>

      {/* Mobile Header - Improved with Active Tab Context */}
      <div className="md:hidden bg-[#f5f2e8] border-b-2 border-slate-900 px-5 py-3 flex justify-between items-center z-50 shadow-sm shrink-0">
        <div className="flex flex-col" onClick={onHomeClick}>
          <h1 className="serif text-lg font-black italic leading-none">MindGym</h1>
          <span className="text-[9px] font-black uppercase text-indigo-600 tracking-tighter">
            {getActiveLabel()}
          </span>
        </div>
        <button 
          onClick={() => { audioService.playClick(); setIsMobileMenuOpen(!isMobileMenuOpen); }}
          className="bg-slate-900 text-white p-2 rounded-lg flex items-center justify-center min-w-[40px]"
        >
          {isMobileMenuOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Sidebar Navigation */}
      <nav className={`
        fixed inset-y-0 left-0 z-40 w-72 transform bg-[#f5f2e8] border-r-4 border-slate-900 p-8 flex flex-col justify-between transition-transform duration-300 ease-out
        md:relative md:translate-x-0 md:static ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
        ${isCompact ? 'md:w-60' : 'md:w-72'} 
        shrink-0 overflow-y-auto custom-scrollbar
      `}>
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />

        <div>
          {/* Desktop Logo */}
          <div className="hidden md:block mb-12 cursor-pointer group border-b-2 border-slate-900 pb-6" onClick={onHomeClick}>
            <h1 className="serif text-4xl font-black italic tracking-tighter leading-none mb-1">MindGym</h1>
            <div className="flex justify-between items-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Established 1984</span>
              <span className="text-[10px] font-black uppercase text-indigo-600">Vol. III</span>
            </div>
          </div>

          <div className="space-y-8">
            {/* Live Consult Button */}
            {activeTab !== 'games' && activeTab !== 'dashboard' && activeTab !== 'vision' && (
              <button
                onClick={() => { audioService.playClick(); setShowLiveConsult(true); setIsMobileMenuOpen(false); }}
                className="w-full bg-slate-900 text-white p-4 group relative overflow-hidden shadow-[8px_8px_0px_#4f46e5] active:translate-x-1 active:translate-y-1 active:shadow-none transition-all"
              >
                <div className="relative z-10 flex items-center justify-between">
                  <div className="text-left">
                    <span className="block text-[8px] font-black uppercase tracking-widest opacity-60">Consulting...</span>
                    <span className="text-sm font-black italic serif">Neural Editor</span>
                  </div>
                  <span className="text-2xl animate-pulse">🎙️</span>
                </div>
                <div className="absolute inset-0 bg-indigo-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>
            )}

            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 ml-1">Main Sections</p>
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-2.5 border-2 rounded-md transition-all ${
                    activeTab === item.id 
                      ? 'bg-slate-900 text-[#ebe7e0] border-slate-900 shadow-[3px_3px_0px_#4f46e5]' 
                      : 'border-transparent text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  <span className="text-sm font-black tracking-tight">{item.label}</span>
                  <span className="text-lg opacity-40">{item.icon}</span>
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 ml-1">Logic Protocols</p>
              <div className="grid grid-cols-1 gap-1">
                {subItems.map((item) => {
                  const active = activeTab === item.id;
                  const progress = hasSavedProgress(item.key);
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleNavClick(item.id)}
                      className={`w-full flex items-center justify-between px-4 py-2 transition-all rounded-md ${
                        active
                          ? 'bg-indigo-600/10 text-indigo-700 border-l-4 border-indigo-600 font-bold' 
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <span className="text-[11px] uppercase tracking-wider">{item.label}</span>
                      {progress && !active && (
                        <span className="text-[8px] font-black text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">PAUSED</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="mt-8 pt-6 border-t border-slate-900/10">
           <div className="mb-6 flex justify-between items-start gap-4">
              <div className="flex-1">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Complexity</p>
                <button 
                  onClick={cycleDifficulty}
                  className={`w-full text-[10px] font-black uppercase tracking-widest border border-slate-300 px-3 py-1.5 bg-white rounded shadow-sm hover:border-slate-900 transition-all ${getDiffColor()}`}
                >
                  {difficulty}
                </button>
              </div>
              <div>
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Layout</p>
                <button 
                  onClick={toggleCompact}
                  className="bg-white border border-slate-300 px-2 py-1.5 text-[9px] font-black uppercase tracking-tighter hover:border-slate-900 hover:text-slate-900 transition-all whitespace-nowrap text-slate-500 rounded shadow-sm"
                >
                  {isCompact ? 'Expanded' : 'Compact'}
                </button>
              </div>
           </div>
           <div className="flex justify-between items-end">
             <div>
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Cognitive Streak</p>
               <p className="serif text-3xl font-black italic leading-none">{streak} DAYS</p>
             </div>
             <div className="text-3xl grayscale brightness-50 opacity-20">🗞️</div>
           </div>
        </div>
      </nav>

      {/* Sidebar Overlay */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      <main className={`flex-1 transition-all duration-300 ${isCompact ? 'p-4 md:p-6' : 'p-5 md:p-8'} overflow-y-auto relative custom-scrollbar h-full`}>
        <div className="absolute inset-0 opacity-[0.02] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
        <div className={`mx-auto relative z-10 transition-all duration-300 ${isCompact ? 'max-w-full' : 'max-w-[1400px]'}`}>
          {children}
        </div>
      </main>
    </div>
  );
};
