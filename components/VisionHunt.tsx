
import React, { useState, useRef, useEffect } from 'react';
import { audioService } from '../services/audioService';
import { analyzeImageFieldOps } from '../services/geminiService';
import confetti from 'canvas-confetti';

interface VisionHuntProps {
  onComplete: () => void;
}

const MISSIONS = [
  "Locate a vessel designed to contain heated liquid (e.g., Mug, Thermos).",
  "Find an object capable of inscribing knowledge (e.g., Pen, Pencil).",
  "Identify a botanical lifeform or synthetic replica (e.g., Plant).",
  "Secure visual confirmation of a photonic emitter (e.g., Lamp, Light).",
  "Intercept a manual input device (e.g., Keyboard, Mouse, Controller)."
];

export const VisionHunt: React.FC<VisionHuntProps> = ({ onComplete }) => {
  const [mission, setMission] = useState(MISSIONS[0]);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<{ status: string; title: string; analysis: string; reasoning: string } | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    startCamera();
    // Randomize mission
    setMission(MISSIONS[Math.floor(Math.random() * MISSIONS.length)]);
    return () => stopCamera();
  }, []);

  const startCamera = async () => {
    try {
      const ms = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      setStream(ms);
      if (videoRef.current) {
        videoRef.current.srcObject = ms;
      }
    } catch (e) {
      alert("Camera access required for Field Operations.");
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const captureAndAnalyze = async () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    audioService.playClick();
    setIsAnalyzing(true);
    setResult(null);

    // Capture frame
    const ctx = canvasRef.current.getContext('2d');
    canvasRef.current.width = videoRef.current.videoWidth;
    canvasRef.current.height = videoRef.current.videoHeight;
    ctx?.drawImage(videoRef.current, 0, 0);
    const base64 = canvasRef.current.toDataURL('image/jpeg', 0.8);

    // Send to Gemini
    const data = await analyzeImageFieldOps(base64, mission);
    setResult(data);
    setIsAnalyzing(false);

    if (data.status === 'VERIFIED') {
      audioService.playSuccess();
      confetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
      onComplete();
    } else {
      audioService.playError();
    }
  };

  return (
    <div className="space-y-8 animate-fadeIn py-4 pb-24 max-w-4xl mx-auto">
      <header className="border-b-4 border-slate-900 pb-8 flex justify-between items-end">
        <div>
           <div className="flex items-center gap-4 mb-2">
             <span className="bg-red-600 text-white px-3 py-1 text-[8px] font-black uppercase tracking-widest animate-pulse">Live Feed</span>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocol: VISUAL_VERIFICATION</span>
          </div>
          <h2 className="serif text-6xl font-black italic tracking-tighter text-slate-900">Field Operations</h2>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
        {/* Camera Feed */}
        <div className="relative border-4 border-slate-900 bg-black shadow-[16px_16px_0px_#0f172a] h-[400px] overflow-hidden group">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
          />
          <canvas ref={canvasRef} className="hidden" />
          
          {/* HUD Overlay */}
          <div className="absolute inset-0 pointer-events-none border-2 border-white/10 m-4">
             <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-red-500" />
             <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-red-500" />
             <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-red-500" />
             <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-red-500" />
             
             <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 border border-red-500/50 rounded-full flex items-center justify-center">
                <div className="w-1 h-1 bg-red-500 rounded-full animate-ping" />
             </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-slate-900/80 backdrop-blur text-white flex justify-between items-center">
             <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-red-400">REC ●</span>
             <button 
               onClick={captureAndAnalyze}
               disabled={isAnalyzing}
               className="bg-white text-slate-900 px-6 py-2 text-[10px] font-black uppercase tracking-widest hover:bg-indigo-500 hover:text-white transition-all disabled:opacity-50"
             >
               {isAnalyzing ? 'TRANSMITTING...' : 'CAPTURE EVIDENCE'}
             </button>
          </div>
        </div>

        {/* Mission Dossier */}
        <div className="space-y-8">
           <div className="bg-[#f5f2e8] border-2 border-slate-900 p-8 shadow-[8px_8px_0px_rgba(0,0,0,0.1)]">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 mb-4 border-b border-indigo-200 pb-2">
                Active Directive
              </h3>
              <p className="serif text-2xl font-black italic text-slate-900 leading-tight">
                "{mission}"
              </p>
              <p className="mt-4 text-[10px] font-bold text-slate-500 uppercase">
                Instructions: Align target in crosshairs. Confirm visual match.
              </p>
           </div>

           {result && (
             <div className={`border-4 p-8 shadow-xl animate-fadeIn ${result.status === 'VERIFIED' ? 'border-emerald-600 bg-emerald-50' : 'border-red-600 bg-red-50'}`}>
                <div className="flex justify-between items-start mb-4">
                  <span className={`text-[10px] font-black uppercase px-2 py-1 text-white ${result.status === 'VERIFIED' ? 'bg-emerald-600' : 'bg-red-600'}`}>
                    {result.status}
                  </span>
                  <span className="text-4xl">{result.status === 'VERIFIED' ? '✅' : '❌'}</span>
                </div>
                <h4 className="serif text-xl font-black italic mb-2">{result.title}</h4>
                <p className="text-xs font-bold text-slate-700 leading-relaxed mb-4">{result.analysis}</p>
                
                {result.reasoning && (
                  <div className="border-t border-slate-200 pt-2">
                    <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Deep Reason:</p>
                    <p className="text-[10px] italic text-slate-600">{result.reasoning}</p>
                  </div>
                )}

                {result.status === 'VERIFIED' && (
                   <button 
                     onClick={() => setMission(MISSIONS[Math.floor(Math.random() * MISSIONS.length)])}
                     className="mt-6 w-full py-3 bg-slate-900 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-colors"
                   >
                     Request Next Target
                   </button>
                )}
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
