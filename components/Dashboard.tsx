import React, { useState } from 'react';
import { BarChart, Bar, ResponsiveContainer, Cell } from 'recharts';
import { GameStats, NeuralSculpture } from '../types';
import { refineNeuralSculpture } from '../services/geminiService';
import { audioService } from '../services/audioService';

interface DashboardProps {
  stats: GameStats;
}

export const Dashboard: React.FC<DashboardProps> = ({ stats }) => {
  const [selectedSculpture, setSelectedSculpture] = useState<NeuralSculpture | null>(null);
  const [refineText, setRefineText] = useState("");
  const [isRefining, setIsRefining] = useState(false);

  const data = [
    { name: 'M', value: 12 }, { name: 'T', value: 19 }, { name: 'W', value: 15 },
    { name: 'T', value: 22 }, { name: 'F', value: 30 }, { name: 'S', value: 20 }, { name: 'S', value: 25 },
  ];

  const handleRefine = async () => {
    if (!selectedSculpture || !refineText) return;
    setIsRefining(true);
    audioService.playClick();
    const refined = await refineNeuralSculpture(selectedSculpture.url, refineText);
    if (refined) {
      const updated: NeuralSculpture = {
        ...selectedSculpture,
        url: `data:image/png;base64,${refined}`,
        prompt: refineText
      };
      setSelectedSculpture(updated);
      audioService.playSuccess();
    }
    setIsRefining(false);
  };

  return (
    <div className="space-y-12 animate-fadeIn py-4 pb-24">
      <header className="border-b-4 border-slate-900 pb-10 flex justify-between items-end">
        <div>
          <h2 className="serif text-7xl font-black italic text-slate-900 tracking-tighter">The Census</h2>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-[0.4em] mt-2">A Statistical Study of Neural Evolution</p>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-0 border-4 border-slate-900 divide-x-4 divide-slate-900">
        <div className="p-8 bg-white">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Aptitude Index</p>
          <p className="serif text-6xl font-black italic">{stats.aptitudeScore}</p>
        </div>
        <div className="p-8 bg-indigo-600 text-white">
          <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-4">Neural Streak</p>
          <p className="serif text-6xl font-black italic">{stats.streak}D</p>
        </div>
        <div className="p-8 bg-white">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Protocols Ran</p>
          <p className="serif text-6xl font-black italic">{stats.gamesPlayed}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 pt-8">
        <div className="lg:col-span-4 space-y-6">
           <h3 className="serif text-3xl font-black italic border-b-2 border-slate-900 pb-2">Cognitive Pulse</h3>
           <div className="h-48 w-full border-2 border-slate-900 p-4 bg-white shadow-[8px_8px_0px_#0f172a]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <Bar dataKey="value" fill="#cbd5e1">
                  {data.map((_, index) => <Cell key={index} fill={index === 4 ? '#4f46e5' : '#0f172a'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="text-[10px] leading-tight text-justify font-medium text-slate-600">
            Observation: Reasoning usage is increasing efficiency. The Global Briefing sector has seen a 15% increase in cross-variable correlation hits.
          </p>
        </div>

        <div className="lg:col-span-8 space-y-8">
          <div className="flex justify-between items-center border-b-2 border-slate-900 pb-2">
            <h3 className="serif text-3xl font-black italic">Neural Artifacts</h3>
            <span className="text-[9px] font-black uppercase text-slate-400">Creative Autopilot: ON</span>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {stats.sculptures.map((s, i) => (
              <div 
                key={i} 
                onClick={() => setSelectedSculpture(s)}
                className={`aspect-square border-2 p-1 transition-all cursor-pointer ${selectedSculpture?.id === s.id ? 'border-indigo-600 shadow-[4px_4px_0px_#4f46e5]' : 'border-slate-900 hover:scale-105'}`}
              >
                <img src={s.url} alt="Trophy" className="w-full h-full object-cover grayscale" />
              </div>
            ))}
          </div>

          {selectedSculpture && (
            <div className="border-4 border-slate-900 p-8 bg-white shadow-[12px_12px_0px_#0f172a] animate-fadeIn">
               <div className="flex flex-col md:flex-row gap-8">
                  <div className="w-48 h-48 border-2 border-slate-900 shrink-0">
                    <img src={selectedSculpture.url} className="w-full h-full object-cover" />
                  </div>
                  <div className="flex-1 space-y-6">
                     <h4 className="serif text-3xl font-black italic">Refinement Interface</h4>
                     <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Creative Control / localized Paint-to-Edit</p>
                     
                     <div className="flex gap-4">
                        <input 
                          value={refineText} 
                          onChange={(e) => setRefineText(e.target.value)}
                          placeholder="E.g. Add obsidian spikes, modify neon glow to deep amber..."
                          className="flex-1 border-2 border-slate-900 p-4 font-mono text-xs focus:ring-4 focus:ring-indigo-100 outline-none"
                        />
                        <button 
                          onClick={handleRefine}
                          disabled={isRefining || !refineText}
                          className="bg-slate-900 text-white px-8 py-4 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 disabled:opacity-30 transition-all"
                        >
                          {isRefining ? 'EVOLVING...' : 'REFINE ARTIFACT'}
                        </button>
                     </div>
                     <p className="text-[10px] italic text-slate-500">Note: Refinement uses Gemini 3 Pro-Image for hyper-precision multimodal editing.</p>
                  </div>
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
