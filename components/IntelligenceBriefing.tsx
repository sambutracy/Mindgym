
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchIntelligenceBriefing } from '../services/geminiService';
import { audioService } from '../services/audioService';

interface BriefingData {
  headlines: { title: string; summary: string; source: string }[];
  puzzle: {
    question: string;
    options: string[];
    correctAnswer: string;
    reasoning: string;
  };
  tacticalNote: string;
}

const NewsTicker = ({ headlines }: { headlines: { title: string }[] }) => {
  return (
    <div className="bg-slate-900 text-white py-3 overflow-hidden whitespace-nowrap border-y-2 border-slate-900 relative">
      <div className="absolute left-0 top-0 bottom-0 bg-indigo-600 px-4 flex items-center z-10 font-black text-[10px] uppercase tracking-widest shadow-[4px_0_10px_rgba(0,0,0,0.5)]">
        Live Feed
      </div>
      <div className="animate-marquee flex gap-12 font-black text-[11px] uppercase tracking-[0.2em] pl-24">
        {[...headlines, ...headlines, ...headlines].map((h, i) => (
          <span key={i} className="flex items-center gap-6">
            <span className="text-indigo-400">◆</span>
            {h.title}
          </span>
        ))}
      </div>
    </div>
  );
};

export const IntelligenceBriefing: React.FC = () => {
  const [data, setData] = useState<BriefingData | null>(null);
  const [grounding, setGrounding] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  const loadBriefing = async () => {
    setIsLoading(true);
    setHasError(false);
    setIsRevealed(false);
    setSelectedAnswer(null);
    const result = await fetchIntelligenceBriefing();
    if (result) {
      setData(result.data);
      setGrounding(result.grounding);
    } else {
      setHasError(true);
    }
    setTimeout(() => setIsLoading(false), 800);
  };

  useEffect(() => {
    loadBriefing();
  }, []);

  const handleShare = async (title: string, text: string) => {
    audioService.playClick();
    const shareData = {
      title: `MindGym Intel: ${title}`,
      text: `${text}\n\nRetrieved from MindGym Gazette`,
      url: window.location.href,
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('Share failed:', err);
        }
      }
    } else {
      try {
        await navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}\n${shareData.url}`);
        alert('Intelligence copied to clipboard.');
      } catch (err) {
        console.error('Clipboard copy failed:', err);
      }
    }
  };

  const handleSelect = (ans: string) => {
    if (isRevealed) return;
    audioService.playClick();
    setSelectedAnswer(ans);
  };

  const handleConfirm = () => {
    if (!selectedAnswer) return;
    setIsRevealed(true);
    if (selectedAnswer === data?.puzzle.correctAnswer) {
      audioService.playSuccess();
    } else {
      audioService.playError();
    }
  };

  if (isLoading) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center space-y-8">
        <div className="w-16 h-16 border-4 border-slate-900 border-t-indigo-600 rounded-full animate-spin" />
        <div className="text-center">
          <h3 className="serif text-4xl font-black italic">Fetching Global Signals...</h3>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mt-2">Querying Gemini 3 Real-Time Search</p>
        </div>
      </div>
    );
  }

  if (hasError || !data) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center space-y-8">
        <div className="text-6xl">📡</div>
        <div className="text-center">
          <h3 className="serif text-4xl font-black italic text-red-600">Signal Lost</h3>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mt-4 max-w-md leading-relaxed">
            The encrypted feed from Gemini 3 Pro could not be established. This may be due to high orbital traffic (quota) or network interference.
          </p>
          <button 
            onClick={loadBriefing} 
            className="mt-8 bg-slate-900 text-white px-8 py-4 font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-[4px_4px_0px_#0f172a]"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fadeIn py-4 pb-24 max-w-6xl mx-auto">
      {data && <NewsTicker headlines={data.headlines} />}
      
      <header className="border-b-4 border-slate-900 pb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-1">
        <div className="flex-1">
          <div className="flex items-center gap-4 mb-2">
             <span className="bg-slate-900 text-white px-3 py-1 text-[8px] font-black uppercase tracking-widest">Top Secret</span>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol: Neural-Brief_V3</span>
          </div>
          <h2 className="serif text-5xl md:text-7xl font-black italic tracking-tighter leading-none">The Global Intel Briefing</h2>
        </div>
        <div className="flex gap-4 w-full md:w-auto">
          <button 
            onClick={() => handleShare("Daily Intelligence Briefing", data?.headlines[0].title || "Top Headlines")}
            className="flex-1 md:flex-none border-2 border-slate-900 bg-white text-slate-900 px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all shadow-[4px_4px_0px_#0f172a] active:translate-y-1"
          >
            Propagate Briefing
          </button>
          <button 
            onClick={loadBriefing} 
            className="flex-1 md:flex-none bg-slate-900 text-white px-6 py-3 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-[4px_4px_0px_#4f46e5] active:translate-y-1"
          >
            Refresh Intercept
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-4">
        {/* News Dossier */}
        <div className="lg:col-span-7 space-y-8">
          <div className="newspaper-text text-sm text-slate-800 leading-relaxed font-medium text-justify">
             <p className="first-letter:text-5xl first-letter:font-black first-letter:mr-2 first-letter:float-left mb-6">
                The tactical landscape is shifting toward multi-modal verification. What connects the physical resource to the digital output? Our Reasoning Core has intercepted the following trending patterns across global infrastructure and technological nodes.
             </p>
          </div>

          <div className="space-y-6">
            {data?.headlines.map((h, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, x: -20 }} 
                animate={{ opacity: 1, x: 0 }} 
                transition={{ delay: i * 0.2 }}
                className="border-2 border-slate-900 bg-white p-6 shadow-[8px_8px_0px_rgba(0,0,0,0.05)] relative overflow-hidden group"
              >
                <div className="absolute top-0 right-0 p-2 flex items-center gap-4">
                  <span className="text-[7px] font-black text-slate-300 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">
                    Source: {h.source}
                  </span>
                  <button 
                    onClick={() => handleShare(h.title, h.summary)}
                    className="text-[8px] font-black text-indigo-600 underline uppercase tracking-tighter opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    Share Signal
                  </button>
                </div>
                <h3 className="serif text-2xl font-black mb-2 italic border-b border-slate-100 pb-2 pr-20">{h.title}</h3>
                <p className="text-xs font-bold text-slate-600 italic leading-snug">{h.summary}</p>
                <div className="mt-4 flex items-center gap-2">
                  <span className="w-1 h-1 bg-indigo-600 rounded-full animate-pulse" />
                  <span className="text-[8px] font-black uppercase tracking-tighter text-slate-400">Grounding Engine Verified</span>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="bg-slate-100 p-8 border-l-8 border-slate-900 italic text-sm text-slate-700 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-[0.03] text-8xl font-black serif italic pointer-events-none">"</div>
             "The world moves at a velocity that defies traditional cycles. Look for the unseen logistical bridge." — <span className="font-black">Editor's Memo</span>
          </div>
        </div>

        {/* Correlation Puzzle */}
        <div className="lg:col-span-5 space-y-8">
           <div className="border-4 border-slate-900 bg-white p-8 shadow-[12px_12px_0px_#4f46e5] relative">
              <div className="absolute -top-3 -right-3 bg-indigo-600 text-white w-10 h-10 flex items-center justify-center font-black text-xl border-2 border-slate-900 shadow-lg">
                ?
              </div>
              <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-6 border-b border-slate-200 pb-2 flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-600 rounded-full animate-pulse" />
                Intelligence Assessment
              </h3>
              <p className="serif text-2xl font-black italic mb-8 leading-tight">
                {data?.puzzle.question}
              </p>

              <div className="space-y-3">
                {data?.puzzle.options.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => handleSelect(opt)}
                    className={`w-full p-4 text-left border-2 font-black text-[11px] uppercase tracking-widest transition-all ${
                      selectedAnswer === opt 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-[4px_4px_0px_#4f46e5]' 
                        : 'border-slate-100 hover:border-slate-900 bg-slate-50'
                    } ${isRevealed && opt === data.puzzle.correctAnswer ? 'bg-emerald-600 text-white border-emerald-600' : ''} ${isRevealed && selectedAnswer === opt && opt !== data.puzzle.correctAnswer ? 'bg-red-500 text-white border-red-500' : ''}`}
                  >
                    <div className="flex justify-between items-center">
                      <span>{opt}</span>
                      {selectedAnswer === opt && <span className="text-xs">▶</span>}
                    </div>
                  </button>
                ))}
              </div>

              {!isRevealed ? (
                <button 
                  onClick={handleConfirm}
                  disabled={!selectedAnswer}
                  className="w-full mt-8 py-5 bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.4em] shadow-[4px_4px_0px_#0f172a] disabled:opacity-30 transition-all hover:bg-indigo-700 active:translate-y-1"
                >
                  Verify Correlation
                </button>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="mt-8 pt-8 border-t-2 border-slate-900"
                >
                   <div className="flex justify-between items-center mb-2">
                      <p className="text-[10px] font-black text-indigo-600 uppercase">Tactical Reasoning</p>
                      <button 
                        onClick={() => handleShare("Deduction Results", `Question: ${data?.puzzle.question}\nCorrect Answer: ${data?.puzzle.correctAnswer}`)}
                        className="text-[8px] font-black text-indigo-600 underline uppercase"
                      >
                        Share Findings
                      </button>
                   </div>
                   <p className="text-xs font-bold italic text-slate-700 leading-relaxed border-l-4 border-indigo-200 pl-4">
                     {data?.puzzle.reasoning}
                   </p>
                </motion.div>
              )}
           </div>

           {/* Grounding Attribution */}
           {grounding.length > 0 && (
             <div className="bg-[#f5f2e8] border-2 border-slate-900 p-6 shadow-[6px_6px_0px_rgba(0,0,0,0.1)]">
                <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-slate-400 rounded-full" />
                  Verification Sources
                </h4>
                <div className="flex flex-col gap-2">
                  {grounding.map((chunk, i) => {
                    const uri = chunk.web?.uri;
                    const title = chunk.web?.title || "Signal Fragment";
                    if (!uri) return null;
                    return (
                      <a key={i} href={uri} target="_blank" rel="noopener noreferrer" 
                         className="text-[10px] font-mono font-bold text-slate-600 hover:text-indigo-600 transition-colors border-b border-transparent hover:border-indigo-600 inline-block w-fit">
                        [{i+1}] {title} ↗
                      </a>
                    );
                  })}
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
