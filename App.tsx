
import React, { useState, useEffect, Suspense, lazy } from 'react';
import { Layout } from './components/Layout';
import { GamesLobby } from './components/GamesLobby';
import { LandingPage } from './components/LandingPage';
import { GameStats, NeuralSculpture, Difficulty } from './types';
import { generateNeuralSculpture } from './services/geminiService';

// Lazy load heavy game components to improve initial load time
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const SudokuGame = lazy(() => import('./components/SudokuGame').then(m => ({ default: m.SudokuGame })));
const WordGame = lazy(() => import('./components/WordGame').then(m => ({ default: m.WordGame })));
const SpatialLogic = lazy(() => import('./components/SpatialLogic').then(m => ({ default: m.SpatialLogic })));
const CrosswordGame = lazy(() => import('./components/CrosswordGame').then(m => ({ default: m.CrosswordGame })));
const DeductionGrid = lazy(() => import('./components/DeductionGrid').then(m => ({ default: m.DeductionGrid })));
const CipherGame = lazy(() => import('./components/CipherGame').then(m => ({ default: m.CipherGame })));
const GeographicGame = lazy(() => import('./components/GeographicGame').then(m => ({ default: m.GeographicGame })));
const IntelligenceBriefing = lazy(() => import('./components/IntelligenceBriefing').then(m => ({ default: m.IntelligenceBriefing })));
const VisionHunt = lazy(() => import('./components/VisionHunt').then(m => ({ default: m.VisionHunt })));

const LoadingSpinner = () => (
  <div className="h-full w-full flex flex-col items-center justify-center space-y-6 animate-fadeIn">
    <div className="w-12 h-12 border-4 border-slate-900 border-t-indigo-600 rounded-full animate-spin" />
    <p className="serif text-xl font-black italic text-slate-400">Loading Module...</p>
  </div>
);

const App: React.FC = () => {
  const [showLanding, setShowLanding] = useState(() => {
    const saved = localStorage.getItem('mindgym-v3-landing-seen');
    return saved !== 'true';
  });
  
  const [activeTab, setActiveTab] = useState<'games' | 'dashboard' | 'vision' | 'sudoku' | 'word' | 'spatial' | 'crossword' | 'deduction' | 'cipher' | 'geographic' | 'gazette'>(() => {
    const saved = localStorage.getItem('mindgym-v3-active-tab');
    return (saved as any) || 'games';
  });

  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const saved = localStorage.getItem('mindgym-v3-difficulty');
    return (saved as Difficulty) || 'Medium';
  });

  const [stats, setStats] = useState<GameStats>(() => {
    const saved = localStorage.getItem('mindgym-v3-stats');
    if (!saved) return {
      gamesPlayed: 0,
      streak: 0,
      lastPlayedDate: null,
      aptitudeScore: 740,
      sculptures: []
    };
    try {
      const parsed = JSON.parse(saved);
      if (parsed.sculptures && parsed.sculptures.length > 5) parsed.sculptures = parsed.sculptures.slice(0, 5);
      return parsed;
    } catch (e) { return { gamesPlayed: 0, streak: 0, lastPlayedDate: null, aptitudeScore: 740, sculptures: [] }; }
  });

  useEffect(() => {
    try { localStorage.setItem('mindgym-v3-stats', JSON.stringify(stats)); } catch (e) {}
  }, [stats]);

  useEffect(() => {
    localStorage.setItem('mindgym-v3-active-tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('mindgym-v3-difficulty', difficulty);
  }, [difficulty]);

  const handleStart = (tab?: string) => {
    setShowLanding(false);
    localStorage.setItem('mindgym-v3-landing-seen', 'true');
    if (tab) setActiveTab(tab as any);
  };

  const handleHomeClick = () => {
    setShowLanding(true);
    localStorage.setItem('mindgym-v3-landing-seen', 'false');
  };

  const handleGameComplete = async (gameType: string) => {
    const today = new Date().toDateString();
    setStats(prev => ({
      ...prev,
      gamesPlayed: prev.gamesPlayed + 1,
      aptitudeScore: prev.aptitudeScore + (difficulty === 'Hard' ? 20 : difficulty === 'Medium' ? 10 : 5),
      streak: prev.lastPlayedDate === today ? prev.streak : prev.streak + 1,
      lastPlayedDate: today
    }));

    try {
      const base64 = await generateNeuralSculpture(stats.aptitudeScore, gameType);
      if (base64) {
        const newSculpture: NeuralSculpture = {
          id: Date.now().toString(),
          url: `data:image/png;base64,${base64}`,
          prompt: `Neural artifact for ${gameType} mastery`,
          date: new Date().toISOString(),
          tier: stats.aptitudeScore > 900 ? 'Obsidian' : 'Gold'
        };
        setStats(prev => ({
          ...prev,
          sculptures: [newSculpture, ...prev.sculptures].slice(0, 5)
        }));
      }
    } catch (e) {}
  };

  if (showLanding) return <LandingPage onStart={handleStart} />;

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      streak={stats.streak} 
      onHomeClick={handleHomeClick}
      difficulty={difficulty}
      setDifficulty={setDifficulty}
    >
      <Suspense fallback={<LoadingSpinner />}>
        {activeTab === 'games' && <GamesLobby onSelect={setActiveTab} />}
        {activeTab === 'dashboard' && <Dashboard stats={stats} />}
        {activeTab === 'gazette' && <IntelligenceBriefing />}
        {activeTab === 'vision' && <VisionHunt onComplete={() => handleGameComplete('Field Ops')} />}
        {activeTab === 'sudoku' && <SudokuGame difficulty={difficulty} onComplete={() => handleGameComplete('Sudoku')} />}
        {activeTab === 'word' && <WordGame onComplete={() => handleGameComplete('Linguistics')} />}
        {activeTab === 'spatial' && <SpatialLogic difficulty={difficulty} onComplete={() => handleGameComplete('Spatial')} />}
        {activeTab === 'crossword' && <CrosswordGame onComplete={() => handleGameComplete('Crossword')} />}
        {activeTab === 'deduction' && <DeductionGrid difficulty={difficulty} onComplete={() => handleGameComplete('Deduction')} />}
        {activeTab === 'cipher' && <CipherGame onComplete={() => handleGameComplete('Cipher')} />}
        {activeTab === 'geographic' && <GeographicGame difficulty={difficulty} onComplete={() => handleGameComplete('Geographic')} />}
      </Suspense>
    </Layout>
  );
};

export default App;
