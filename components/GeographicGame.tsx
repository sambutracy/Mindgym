
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas, useFrame, ThreeElements } from '@react-three/fiber';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { audioService } from '../services/audioService';
import { getDeepReasoningHint, speakHint, generateGeographicPuzzle, getDailyISO } from '../services/geminiService';
import confetti from 'canvas-confetti';
import { Difficulty } from '../types';

interface GeographicGameProps {
  onComplete: () => void;
  difficulty: Difficulty;
}

interface VisualMarker {
  label: string;
  x: number;
  y: number;
}

interface GeographicPuzzle {
  location: string;
  clues: string[];
  visualMarkers: VisualMarker[];
  options: string[];
  archiveFact: string;
  imageSearchTerm: string;
  difficulty: string;
  sector?: string;
}

const TopoTerrain = ({ isScanning, seed }: { isScanning: boolean, seed: string }) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  // Generative heightmap logic based on a seed
  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(12, 12, 64, 64);
    const vertices = geo.attributes.position.array as Float32Array;
    const hash = seed.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    
    for (let i = 0; i < vertices.length; i += 3) {
      const x = vertices[i];
      const y = vertices[i + 1];
      // Create interesting topographic noise
      const d1 = Math.sin(x * 0.5 + hash) * Math.cos(y * 0.5 + hash);
      const d2 = Math.sin(x * 0.2 + y * 0.3 + hash * 0.1) * 0.5;
      vertices[i + 2] = d1 + d2;
    }
    geo.computeVertexNormals();
    return geo;
  }, [seed]);

  useFrame((state) => {
    if (!meshRef.current) return;
    const time = state.clock.getElapsedTime();
    // Subtle breathing animation
    meshRef.current.rotation.z = time * 0.05;
    meshRef.current.position.z = Math.sin(time * 0.2) * 0.1;
    
    // Scale pulse on scan
    if (isScanning) {
      const s = 1 + Math.sin(time * 10) * 0.02;
      meshRef.current.scale.set(s, s, s);
    } else {
      meshRef.current.scale.set(1, 1, 1);
    }
  });

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[-Math.PI / 3, 0, 0]}>
      <meshStandardMaterial 
        wireframe 
        color="#4f46e5" 
        emissive="#4f46e5" 
        emissiveIntensity={0.5}
        transparent 
        opacity={0.4} 
      />
    </mesh>
  );
};

// Tactical Hexagon Marker Component
const HexMarker = ({ marker, isVisible }: { marker: VisualMarker, isVisible: boolean, key?: React.Key }) => (
  <AnimatePresence>
    {isVisible && (
      <motion.div 
        initial={{ scale: 0, opacity: 0, rotate: -30 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        className="absolute z-40 pointer-events-none"
        style={{ left: `${marker.x}%`, top: `${marker.y}%` }}
      >
        <div className="relative -translate-x-1/2 -translate-y-1/2">
          {/* Hexagon Shape Pulse */}
          <div 
            className="w-10 h-10 bg-indigo-500/20 animate-ping absolute -inset-0" 
            style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }} 
          />
          <div 
            className="w-10 h-10 border border-indigo-400 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center" 
            style={{ clipPath: 'polygon(25% 0%, 75% 0%, 100% 50%, 75% 100%, 25% 100%, 0% 50%)' }}
          >
            <div className="w-1 h-1 bg-white rounded-full" />
          </div>
          
          {/* Label Card */}
          <div className="absolute left-full ml-4 top-1/2 -translate-y-1/2 whitespace-nowrap">
            <div className="bg-indigo-600 text-white text-[8px] font-black px-3 py-1 uppercase shadow-2xl border-l-4 border-white tracking-widest relative overflow-hidden">
              <div className="absolute inset-0 bg-white/10 -translate-x-full animate-[marquee_2s_linear_infinite]" />
              {marker.label}
            </div>
            <div className="h-[1px] w-4 bg-white/40 absolute right-full top-1/2 -translate-y-1/2" />
          </div>
        </div>
      </motion.div>
    )}
  </AnimatePresence>
);

export const GeographicGame: React.FC<GeographicGameProps> = ({ onComplete, difficulty }) => {
  const [puzzle, setPuzzle] = useState<GeographicPuzzle | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isLoadingPuzzle, setIsLoadingPuzzle] = useState(false);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [groundingLinks, setGroundingLinks] = useState<any[]>([]);
  const [prohibitedList, setProhibitedList] = useState<string[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 50, y: 50 });
  const [revealedMarkers, setRevealedMarkers] = useState<number[]>([]);
  const [mode, setMode] = useState<'daily' | 'practice'>('daily');

  const containerRef = useRef<HTMLDivElement>(null);

  const fetchPuzzle = async () => {
    setIsLoadingPuzzle(true);
    setIsRevealed(false);
    setSelectedOption(null);
    setHint(null);
    setGroundingLinks([]);
    setIsScanning(false);
    setRevealedMarkers([]);
    
    const seed = mode === 'daily' ? getDailyISO() : Math.random().toString();
    const newPuzzle = await generateGeographicPuzzle(740, prohibitedList, difficulty, seed);
    
    if (newPuzzle) {
      setPuzzle(newPuzzle);
      setProhibitedList(prev => [newPuzzle.location, ...prev].slice(0, 5));
    } else {
      // Emergency Fallback
      setPuzzle({
        location: "Budapest, Hungary",
        clues: [
          "Officially created in 1873 through the unification of three separate neighboring cities.",
          "Home to the first electrified underground railway system on the European continent.",
          "Its iconic Neo-Gothic Parliament building was constructed using approximately 40 kg of 24-carat gold."
        ],
        visualMarkers: [
          { label: "Neo-Gothic Spires", x: 30, y: 40 },
          { label: "Danube Riverfront", x: 60, y: 70 },
          { label: "Ashlar Stone Construction", x: 45, y: 20 }
        ],
        options: ["Budapest", "Prague", "Vienna", "Warsaw"],
        archiveFact: "On October 23, 1956, a massive student demonstration sparked the Hungarian Revolution.",
        imageSearchTerm: "Budapest Parliament Building architecture",
        difficulty: "MEDIUM",
        sector: "Eastern Europe"
      });
    }
    setIsLoadingPuzzle(false);
  };

  useEffect(() => {
    fetchPuzzle();
  }, [difficulty, mode]);

  const toggleMode = () => {
    setMode(prev => prev === 'daily' ? 'practice' : 'daily');
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!containerRef.current || isRevealed) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setMousePos({ x, y });

    // Auto-reveal markers if lens passes over them
    if (puzzle) {
      puzzle.visualMarkers.forEach((m, idx) => {
        const dist = Math.sqrt(Math.pow(m.x - x, 2) + Math.pow(m.y - y, 2));
        if (dist < 12 && !revealedMarkers.includes(idx)) {
          setRevealedMarkers(prev => [...prev, idx]);
          audioService.playTick();
        }
      });
    }
  };

  const handleSelect = (option: string) => {
    if (isRevealed || !puzzle) return;
    audioService.playClick();
    setSelectedOption(option);
  };

  const handleSubmit = () => {
    if (!selectedOption || !puzzle) return;
    setIsRevealed(true);
    if (selectedOption === puzzle.location) {
      audioService.playSuccess();
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      onComplete();
    } else {
      audioService.playError();
    }
  };

  const performTacticalScan = async () => {
    if (!puzzle || isRevealed) return;
    setIsLoadingHint(true);
    setIsScanning(true);
    audioService.playTick();
    
    try {
      const result = await getDeepReasoningHint({ 
        clues: puzzle.clues, 
        options: puzzle.options,
        visualTarget: puzzle.imageSearchTerm 
      }, 0, 0, 'geographic');
      
      const final = result.text?.split("FINAL_HINT:")[1]?.trim() || "Grounding analysis complete. Examine the regional architectural motifs for specific structural signatures.";
      setHint(final);
      setGroundingLinks(result.grounding || []);
      speakHint(final);
    } catch (err) {
      setHint("Tactical logic relay interrupted. Scan manually for structural identifiers.");
    } finally {
      setIsLoadingHint(false);
      setIsScanning(false);
    }
  };

  if (isLoadingPuzzle || !puzzle) {
    return (
      <div className="h-[60vh] flex flex-col items-center justify-center space-y-8">
        <div className="relative w-48 h-48">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 10, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border-4 border-dashed border-slate-900 rounded-full opacity-20" />
          <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }} className="absolute inset-4 border-2 border-indigo-600 rounded-full flex items-center justify-center bg-white shadow-xl">
            <span className="text-4xl">🌍</span>
          </motion.div>
        </div>
        <div className="text-center">
          <h3 className="serif text-3xl font-black italic text-slate-900">Synchronizing Intercept...</h3>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mt-2">ALGORITHM: V.2.5_FLASH_STABLE [{difficulty.toUpperCase()}]</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 animate-fadeIn py-4 pb-20 max-w-6xl mx-auto">
      <header className="border-b-4 border-slate-900 pb-8 flex justify-between items-end">
        <div>
          <h2 className="serif text-6xl font-black italic tracking-tighter text-slate-900">The Correspondent</h2>
          <div className="flex gap-4 items-center mt-2">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500">
               Protocol: {mode === 'daily' ? `DAILY_SCAN_${getDailyISO()}` : 'PRACTICE_SCAN'}
            </p>
            <span className="text-[10px] font-black uppercase bg-slate-200 px-2 py-0.5 rounded text-slate-600">{difficulty} Mode</span>
          </div>
        </div>
        <button onClick={toggleMode} className="text-[10px] font-black underline uppercase hover:text-indigo-600">
           {mode === 'daily' ? 'Switch to Practice' : 'Switch to Daily'}
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        {/* Interactive Scouting Console */}
        <div className="lg:col-span-8 space-y-6">
          <div 
            ref={containerRef}
            onMouseMove={handleMouseMove}
            className="border-4 border-slate-900 bg-slate-950 p-1 shadow-[20px_20px_0px_#0f172a] relative group overflow-hidden cursor-crosshair h-[500px]"
          >
            {/* HUD Overlays */}
            <div className="absolute top-6 left-6 flex items-center gap-3 z-40">
              <div className="bg-slate-900 text-white px-2 py-1 text-[8px] font-black uppercase tracking-widest border border-white/20 backdrop-blur-md">
                {isRevealed ? "SAT_LOCKED" : "LIVE_SCAN_01"}
              </div>
              {(isScanning || isLoadingHint) && (
                <div className="bg-indigo-600 text-white px-2 py-1 text-[8px] font-black uppercase tracking-widest animate-pulse">
                  Reasoning Core Active...
                </div>
              )}
            </div>

            <div className="absolute bottom-6 left-6 z-40 pointer-events-none">
              <div className="text-[8px] font-mono font-bold text-indigo-400 bg-slate-900/60 p-2 rounded border border-indigo-500/20 backdrop-blur-sm">
                LENS_COORD: [{mousePos.x.toFixed(0)}, {mousePos.y.toFixed(0)}] <br/>
                NODES_SCAN: {revealedMarkers.length}/{puzzle.visualMarkers.length}
              </div>
            </div>

            {/* Visual Markers (The "Hexagon Part") */}
            {puzzle.visualMarkers.map((m, idx) => (
              <HexMarker key={idx} marker={m} isVisible={revealedMarkers.includes(idx)} />
            ))}

            <div className="absolute inset-0 z-10">
              <Canvas dpr={[1, 2]} shadows camera={{ position: [0, 0, 8], fbs: 120 }}>
                <ambientLight intensity={0.5} />
                <pointLight position={[10, 10, 10]} intensity={1.5} color="#6366f1" />
                <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={2} color="#4f46e5" />
                <TopoTerrain isScanning={isScanning} seed={puzzle.location} />
              </Canvas>
            </div>

            {/* Scanning Scanline */}
            <div className="absolute inset-0 z-30 pointer-events-none">
              <motion.div 
                animate={{ y: ['0%', '100%'] }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                className="w-full h-[1px] bg-indigo-500/30 shadow-[0_0_10px_#4f46e5]"
              />
            </div>

            {/* Triangulation Lens Effect (2D Overlay) */}
            {!isRevealed && (
              <div 
                className="absolute inset-0 z-20 pointer-events-none"
                style={{
                  background: `radial-gradient(circle 120px at ${mousePos.x}% ${mousePos.y}%, transparent 100%, #000 100%)`,
                  opacity: 0.6
                }}
              />
            )}

            <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10 flex justify-between items-center bg-slate-900/40 backdrop-blur-md z-40">
              <div className="flex items-center gap-6">
                <span className="text-[9px] font-mono text-indigo-300 font-bold uppercase tracking-widest">
                  Target: {isRevealed ? puzzle.location : "Triangulating Topographic Signatures..."}
                </span>
              </div>
              <div className="flex gap-4">
                <span className={`text-[9px] font-mono font-bold ${isRevealed ? 'text-emerald-400' : 'text-slate-500'}`}>
                  {isRevealed ? 'SAT_LINK: SECURE' : 'SAT_LINK: RECON'}
                </span>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {isRevealed && (
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-4 border-slate-900 bg-white p-8 shadow-[8px_8px_0px_#4f46e5] relative"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-indigo-600 flex items-center justify-center text-white text-xl">🏛️</div>
                  <h3 className="serif text-3xl font-black italic">Archival Record</h3>
                </div>
                <p className="text-sm font-bold text-slate-700 leading-relaxed mb-6 border-l-4 border-slate-900 pl-6 py-2">
                  {puzzle.archiveFact}
                </p>

                {groundingLinks.length > 0 && (
                   <div className="mb-8 pt-4 border-t border-slate-100">
                      <p className="text-[9px] font-black uppercase tracking-widest text-slate-400 mb-2">Grounding Sources</p>
                      <div className="flex flex-wrap gap-4">
                        {groundingLinks.map((chunk: any, i: number) => {
                          const uri = chunk.web?.uri || chunk.maps?.uri;
                          const title = chunk.web?.title || chunk.maps?.title || "Context";
                          if (!uri) return null;
                          return (
                            <a 
                              key={i} href={uri} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] font-mono font-bold text-indigo-600 underline hover:text-indigo-800"
                            >
                              [{title}] ↗
                            </a>
                          );
                        })}
                      </div>
                   </div>
                )}

                <button 
                  onClick={fetchPuzzle}
                  className="bg-slate-900 text-white px-10 py-4 font-black text-[10px] uppercase tracking-[0.3em] hover:bg-indigo-600 transition-all shadow-[4px_4px_0px_#4f46e5]"
                >
                  Initiate New Scan →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Intelligence Sidepanel */}
        <div className="lg:col-span-4 space-y-8">
          <div className="border-4 border-slate-900 bg-white p-8 shadow-[8px_8px_0px_#0f172a] relative">
             <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                <span className="text-6xl">📮</span>
             </div>
             <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-6 border-b border-slate-200 pb-2">Intercepted Dispatch</h3>
             
             <div className="space-y-4 mb-10">
               {puzzle.clues.map((clue, idx) => (
                 <p key={idx} className="font-mono text-[11px] font-bold text-slate-600 bg-slate-50 p-3 border-l-2 border-indigo-300 uppercase leading-snug">
                   &gt; {clue}
                 </p>
               ))}
             </div>

             <div className="space-y-3">
               {puzzle.options.map((opt) => (
                 <button
                   key={opt}
                   onClick={() => handleSelect(opt)}
                   disabled={isRevealed}
                   className={`w-full p-4 text-left border-2 font-black text-[11px] uppercase tracking-widest transition-all ${
                     selectedOption === opt 
                       ? 'bg-slate-900 text-white border-slate-900 shadow-lg translate-x-1' 
                       : 'border-slate-100 hover:border-slate-900 bg-slate-50'
                   } ${isRevealed && opt === puzzle.location ? 'bg-emerald-600 text-white border-emerald-600' : ''}`}
                 >
                   {opt}
                 </button>
               ))}
             </div>

             {!isRevealed && (
               <button 
                 onClick={handleSubmit}
                 disabled={!selectedOption}
                 className="w-full mt-8 py-4 bg-indigo-600 text-white font-black text-xs uppercase tracking-[0.4em] shadow-[4px_4px_0px_#0f172a] disabled:opacity-30 hover:bg-indigo-700 transition-all"
               >
                 Confirm Triangulation
               </button>
             )}
          </div>

          <div className="border-2 border-slate-900 p-6 bg-[#f5f2e8]">
             <div className="flex justify-between items-center mb-4">
               <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Tactical Scan Matrix</span>
               <button 
                 onClick={performTacticalScan} 
                 disabled={isScanning || isRevealed || isLoadingHint}
                 className="text-[9px] font-black bg-slate-900 text-white px-3 py-1 rounded hover:bg-indigo-600 disabled:opacity-30 transition-all"
               >
                 {isLoadingHint ? 'ANALYIZING...' : 'DEEP_SCAN'}
               </button>
             </div>
             <div className="space-y-4 min-h-[100px]">
                {isLoadingHint ? (
                  <div className="flex flex-col gap-2">
                    <div className="h-2 w-full bg-slate-200 animate-pulse rounded" />
                    <div className="h-2 w-3/4 bg-slate-200 animate-pulse rounded" />
                    <div className="h-2 w-1/2 bg-slate-200 animate-pulse rounded" />
                  </div>
                ) : (
                  <p className="serif text-sm italic text-slate-800 leading-snug">
                    {hint || "The Gemini Core is standing by to correlate topography with archival clues. Use Deep Scan to initiate structural grounding."}
                  </p>
                )}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
