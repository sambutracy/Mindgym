
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import { createPcmBlob, decodeAudio, decodeAudioData } from '../services/geminiService';
import { audioService } from '../services/audioService';

interface LiveMentorProps {
  onClose: () => void;
  activeContext: string;
}

export const LiveMentor: React.FC<LiveMentorProps> = ({ onClose, activeContext }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcription, setTranscription] = useState("");
  
  const audioContextInRef = useRef<AudioContext | null>(null);
  const audioContextOutRef = useRef<AudioContext | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  useEffect(() => {
    connectToLive();
    return () => disconnect();
  }, []);

  const connectToLive = async () => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    audioContextInRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
    audioContextOutRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const sessionPromise = ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      callbacks: {
        onopen: () => {
          setIsConnected(true);
          audioService.playSuccess();
          
          const source = audioContextInRef.current!.createMediaStreamSource(stream);
          const processor = audioContextInRef.current!.createScriptProcessor(4096, 1, 1);
          
          processor.onaudioprocess = (e) => {
            const inputData = e.inputBuffer.getChannelData(0);
            const pcmBlob = createPcmBlob(inputData);
            sessionPromise.then(session => {
              session.sendRealtimeInput({ media: pcmBlob });
            });
          };
          
          source.connect(processor);
          processor.connect(audioContextInRef.current!.destination);
        },
        onmessage: async (message: LiveServerMessage) => {
          if (message.serverContent?.outputTranscription) {
            setTranscription(prev => prev + message.serverContent!.outputTranscription!.text);
          }

          const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
          if (base64Audio) {
            setIsSpeaking(true);
            const ctx = audioContextOutRef.current!;
            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
            
            const buffer = await decodeAudioData(decodeAudio(base64Audio), ctx, 24000, 1);
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            
            source.addEventListener('ended', () => {
              sourcesRef.current.delete(source);
              if (sourcesRef.current.size === 0) setIsSpeaking(false);
            });

            source.start(nextStartTimeRef.current);
            nextStartTimeRef.current += buffer.duration;
            sourcesRef.current.add(source);
          }

          if (message.serverContent?.interrupted) {
            sourcesRef.current.forEach(s => s.stop());
            sourcesRef.current.clear();
            nextStartTimeRef.current = 0;
            setIsSpeaking(false);
          }

          if (message.serverContent?.turnComplete) {
            setTranscription("");
          }
        },
        onerror: (e) => console.error("Live API Error:", e),
        onclose: () => setIsConnected(false),
      },
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
        },
        systemInstruction: `You are the Editor-in-Chief of the MindGym Gazette. Your tone is like a 1920s newspaper editor—sharp, encouraging, and highly intelligent. You are helping the user with ${activeContext}. Give strategic advice and mental models, but don't just give the answer away. Keep responses punchy and archival.`,
        outputAudioTranscription: {},
      }
    });

    sessionRef.current = sessionPromise;
  };

  const disconnect = () => {
    sessionRef.current?.then((s: any) => s.close());
    audioContextInRef.current?.close();
    audioContextOutRef.current?.close();
  };

  return (
    <motion.div 
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="fixed top-0 right-0 bottom-0 z-[200] w-full md:w-96 bg-[#f5f2e8]/95 backdrop-blur-xl border-l-8 border-slate-900 shadow-[-20px_0px_50px_rgba(0,0,0,0.2)] flex flex-col"
    >
      {/* Background Texture Overlay */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/stardust.png')]" />

      <header className="p-8 border-b-2 border-slate-900 relative z-10">
         <div className="flex justify-between items-start mb-4">
            <span className="bg-slate-900 text-white px-3 py-1 text-[8px] font-black uppercase tracking-widest">Live Consult</span>
            <button 
              onClick={onClose}
              className="text-slate-900 font-black hover:text-red-600 transition-colors text-[10px] uppercase border-b border-slate-900"
            >
              [ Terminate ]
            </button>
         </div>
         <h2 className="serif text-4xl font-black italic text-slate-900 leading-none">The Editor's Office</h2>
         <p className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-500 mt-2">Active Protocol: {activeContext}</p>
      </header>

      <main className="flex-1 overflow-y-auto p-8 space-y-8 relative z-10 custom-scrollbar">
        {/* Visualizer Dock */}
        <div className="flex flex-col items-center">
          <div className="relative flex items-center justify-center w-40 h-40 border-4 border-slate-900 bg-white rounded-full overflow-hidden shadow-lg">
             <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/pinstripe.png')] opacity-10" />
             
             <div className="flex items-end gap-1 h-20">
                {Array.from({ length: 8 }).map((_, i) => (
                  <motion.div
                    key={i}
                    animate={{ 
                      height: isSpeaking || isConnected ? [10, Math.random() * 50 + 10, 10] : 5
                    }}
                    transition={{ 
                      duration: 0.5, 
                      repeat: Infinity, 
                      ease: "easeInOut",
                      delay: i * 0.05
                    }}
                    className={`w-1.5 ${isSpeaking ? 'bg-indigo-600' : 'bg-slate-900'}`}
                  />
                ))}
             </div>
             <div className="absolute inset-0 border-[8px] border-[#f5f2e8] rounded-full pointer-events-none" />
          </div>
          
          <div className="mt-6 text-center space-y-2">
            <div className="flex items-center justify-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
              <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">
                {isConnected ? 'Sync Established' : 'Establishing Line...'}
              </span>
            </div>
            <p className="serif text-lg italic text-slate-800 leading-tight">
              {isSpeaking ? "The Editor is formulating a response..." : isConnected ? "Awaiting your inquiry, Correspondent." : "Stand by for intercept..."}
            </p>
          </div>
        </div>

        {/* Live Transcription Feed */}
        <div className="space-y-4">
          <h3 className="text-[9px] font-black uppercase tracking-widest text-indigo-600 border-b border-slate-200 pb-1">Real-time Intercept</h3>
          <div className="min-h-[100px] bg-white/50 p-4 border border-slate-200 rounded italic text-sm text-slate-700 leading-relaxed font-medium">
            {transcription || "..."}
          </div>
        </div>

        {/* Editorial Memo */}
        <div className="bg-slate-900 text-white p-6 shadow-xl">
           <p className="text-[8px] font-black uppercase tracking-widest text-indigo-400 mb-2">Protocol Note</p>
           <p className="text-[10px] italic leading-relaxed opacity-90">
             "Don't just look for patterns; look for the architecture behind them. If the logic fails, re-examine the foundation."
           </p>
        </div>
      </main>

      <footer className="p-8 border-t-2 border-slate-900 bg-slate-50/50 backdrop-blur-md relative z-10">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Response Latency</p>
            <p className="serif text-xl font-black italic">~120MS</p>
          </div>
          <div className="text-right">
            <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Signal Status</p>
            <p className="text-[10px] font-black uppercase text-emerald-600">Secure Intercept</p>
          </div>
        </div>
      </footer>
    </motion.div>
  );
};
