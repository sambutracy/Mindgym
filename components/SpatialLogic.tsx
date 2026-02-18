
import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame, ThreeElements } from '@react-three/fiber';
import { Float, Text, OrbitControls, MeshDistortMaterial, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { audioService } from '../services/audioService';
import { getDeepReasoningHint, speakHint, createSeededRNG, getDailyISO } from '../services/geminiService';
import confetti from 'canvas-confetti';
import { Difficulty } from '../types';

declare global {
  namespace JSX {
    interface IntrinsicElements {
      [elemName: string]: any;
    }
  }
}

interface SpatialLogicProps {
  onComplete: () => void;
  difficulty: Difficulty;
}

const STORAGE_KEY_PREFIX = 'mindgym-spatial';

const CubeNode = ({ position, active, onClick, id }: { position: [number, number, number], active: boolean, onClick: (id: number) => void, id: number, key?: React.Key }) => {
  const mesh = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);

  return (
    <mesh
      ref={mesh}
      position={position}
      onClick={(e: any) => {
        e.stopPropagation();
        onClick(id);
      }}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <sphereGeometry args={[0.3, 32, 32]} />
      <meshStandardMaterial 
        color={active ? '#6366f1' : hovered ? '#4f46e5' : '#1e293b'} 
        emissive={active ? '#6366f1' : '#000000'}
        emissiveIntensity={active ? 2 : 0}
        toneMapped={false}
      />
    </mesh>
  );
};

export const SpatialLogic: React.FC<SpatialLogicProps> = ({ onComplete, difficulty }) => {
  const [sequence, setSequence] = useState<number[]>([]);
  const [userSequence, setUserSequence] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isShowing, setIsShowing] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [isLoadingHint, setIsLoadingHint] = useState(false);
  const [currentActive, setCurrentActive] = useState<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [mode, setMode] = useState<'daily' | 'practice'>('daily');

  const nodePositions: [number, number, number][] = [
    [-1, -1, -1], [1, -1, -1], [-1, 1, -1], [1, 1, -1],
    [-1, -1, 1], [1, -1, 1], [-1, 1, 1], [1, 1, 1]
  ];

  const getStorageKey = () => `${STORAGE_KEY_PREFIX}-${mode === 'daily' ? getDailyISO() : 'practice'}`;

  useEffect(() => {
    const key = getStorageKey();
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        const sSeq = JSON.parse(saved);
        setSequence(sSeq);
      } catch (e) {
        localStorage.removeItem(key);
      }
    } else {
        // Init with empty sequence to start
        setSequence([]);
    }
    setIsInitialized(true);
  }, [mode]);

  useEffect(() => {
    if (isInitialized && sequence.length > 0) {
      localStorage.setItem(getStorageKey(), JSON.stringify(sequence));
    }
  }, [sequence, isInitialized]);

  const toggleMode = () => {
    setMode(prev => prev === 'daily' ? 'practice' : 'daily');
    setUserSequence([]);
    setSequence([]);
  };

  const startNewRound = () => {
    let newNum;
    if (mode === 'daily') {
       // Deterministic next number based on seed + sequence length
       const seed = getDailyISO() + sequence.length;
       const rng = createSeededRNG(seed);
       newNum = Math.floor(rng() * 8);
    } else {
       newNum = Math.floor(Math.random() * 8);
    }

    const newSeq = [...sequence, newNum];
    setSequence(newSeq);
    setUserSequence([]);
    showSequence(newSeq);
  };

  const showSequence = async (seq: number[]) => {
    setIsShowing(true);
    const speed = difficulty === 'Easy' ? 800 : difficulty === 'Medium' ? 600 : 400;
    
    for (const id of seq) {
      await new Promise(r => setTimeout(r, speed));
      setCurrentActive(id);
      audioService.playTick();
      await new Promise(r => setTimeout(r, speed * 0.6));
      setCurrentActive(null);
    }
    setIsShowing(false);
    setIsPlaying(true);
  };

  const handleNodeClick = (id: number) => {
    if (!isPlaying || isShowing) return;
    audioService.playInput();
    const newUserSeq = [...userSequence, id];
    setUserSequence(newUserSeq);

    if (id !== sequence[newUserSeq.length - 1]) {
      audioService.playError();
      setIsPlaying(false);
      alert("Sequence mismatch. Cognitive reset required.");
      setSequence([]);
      localStorage.removeItem(getStorageKey());
      return;
    }

    if (newUserSeq.length === sequence.length) {
      setIsPlaying(false);
      audioService.playSuccess();
      confetti({ particleCount: 100, spread: 50, origin: { y: 0.8 } });
      if (sequence.length >= 4) {
        onComplete();
      }
      setTimeout(startNewRound, 1000);
    }
  };

  const getAIHint = async () => {
    setIsLoadingHint(true);
    const result = await getDeepReasoningHint(nodePositions.map((p, i) => sequence.includes(i) ? [1] : [0]), 0, 0, 'spatial');
    const cleanHint = result.text?.split("FINAL_HINT:")[1]?.trim() || "Visualize the corners as a binary coordinate system.";
    setHint(cleanHint);
    setIsLoadingHint(false);
    speakHint(cleanHint);
  };

  const resumeGame = () => {
    setUserSequence([]);
    showSequence(sequence);
  };

  return (
    <div className="space-y-8 animate-fadeIn h-[calc(100vh-160px)] flex flex-col">
      <div className="flex justify-between items-end shrink-0">
        <div>
          <h2 className="text-3xl font-black text-white tracking-tighter italic uppercase">Spatial Logic Core</h2>
          <div className="flex gap-4 items-center mt-1">
             <p className="text-slate-500 font-medium text-xs">
                 Protocol: {mode === 'daily' ? `DAILY_SEQ_${getDailyISO()}` : 'PRACTICE_SEQ'}
             </p>
             <span className="text-[9px] font-black uppercase bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded border border-indigo-500/30">{difficulty}</span>
          </div>
        </div>
        <button onClick={toggleMode} className="text-[10px] font-black underline uppercase hover:text-indigo-400 text-slate-400 transition-colors">
            {mode === 'daily' ? 'Switch to Practice' : 'Switch to Daily'}
        </button>
      </div>

      <div className="flex-1 glass rounded-[3rem] overflow-hidden relative border border-indigo-500/20 shadow-2xl">
        <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }}>
          <PerspectiveCamera makeDefault position={[0, 0, 5]} />
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} intensity={2} />
          <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={2} color="#6366f1" />
          
          <Float speed={1.5} rotationIntensity={0.5} floatIntensity={1}>
            <group rotation={[0, Date.now() * 0.0001, 0]}>
              <mesh scale={[2, 2, 2]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial wireframe color="#4f46e5" transparent opacity={0.1} />
              </mesh>
              {nodePositions.map((pos, i) => (
                <CubeNode 
                  key={i} 
                  id={i} 
                  position={pos} 
                  active={currentActive === i} 
                  onClick={handleNodeClick} 
                />
              ))}
            </group>
          </Float>
          <OrbitControls enableZoom={false} autoRotate={!isPlaying} autoRotateSpeed={0.5} />
        </Canvas>

        {/* HUD Overlay */}
        <div className="absolute inset-0 pointer-events-none p-10 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div className="w-24 h-24 border-t-2 border-l-2 border-indigo-500/30 rounded-tl-3xl" />
            <div className="w-24 h-24 border-t-2 border-r-2 border-indigo-500/30 rounded-tr-3xl" />
          </div>

          <div className="flex justify-center pointer-events-auto gap-4">
            {!isPlaying && sequence.length === 0 && (
              <button 
                onClick={startNewRound}
                className="px-12 py-5 bg-white text-slate-900 font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-[0_0_50px_rgba(255,255,255,0.3)]"
              >
                INITIALIZE CORE
              </button>
            )}
            {!isPlaying && sequence.length > 0 && !isShowing && (
              <button 
                onClick={resumeGame}
                className="px-12 py-5 bg-indigo-600 text-white font-black rounded-2xl hover:scale-105 active:scale-95 transition-all shadow-xl"
              >
                RESUME LEVEL {sequence.length}
              </button>
            )}
            {isPlaying && !isShowing && (
              <div className="bg-indigo-500/20 backdrop-blur-xl border border-indigo-500/30 px-8 py-4 rounded-2xl text-white font-black animate-pulse uppercase tracking-[0.3em] text-xs">
                Awaiting Manual Input: {userSequence.length}/{sequence.length}
              </div>
            )}
            {isShowing && (
              <div className="bg-emerald-500/20 backdrop-blur-xl border border-emerald-500/30 px-8 py-4 rounded-2xl text-white font-black uppercase tracking-[0.3em] text-xs">
                Scanning Neural Pattern...
              </div>
            )}
          </div>

          <div className="flex justify-between items-end">
            <div className="w-24 h-24 border-b-2 border-l-2 border-indigo-500/30 rounded-bl-3xl" />
            <div className="w-24 h-24 border-b-2 border-r-2 border-indigo-500/30 rounded-br-3xl" />
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-white/5 rounded-3xl p-6 relative shrink-0">
         <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold flex items-center gap-2 text-xs uppercase tracking-widest text-indigo-400">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></span> Reasoning Core
              </h3>
              <button 
                onClick={getAIHint} 
                disabled={isLoadingHint}
                className="text-[10px] font-black bg-white text-slate-900 px-4 py-2 rounded-full uppercase hover:bg-slate-200 disabled:opacity-30 transition-all"
              >
                {isLoadingHint ? 'DECODING...' : 'ENHANCE MEMORY'}
              </button>
          </div>
          <p className="text-sm font-medium text-slate-400 italic">
            {hint || "The AI is analyzing the spatial coordinates. Ask for a memory anchor."}
          </p>
      </div>
    </div>
  );
};
