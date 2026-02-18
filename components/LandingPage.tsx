
import React, { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree, ThreeElements } from '@react-three/fiber';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { PerspectiveCamera, Html } from '@react-three/drei';
import { audioService } from '../services/audioService';

const vertexShader = `
  varying vec2 vUv;
  varying float vDistortion;
  uniform float uTime;
  uniform vec2 uMouse;

  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float snoise(vec3 v){ 
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 =   v - i + dot(i, C.xxx) ;
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;
    i = mod(i, 289.0 ); 
    vec4 p = permute( permute( permute( 
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
    float n_ = 1.0/7.0;
    vec3  ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    vec3 g0 = vec3(a0.xy,h.x);
    vec3 g1 = vec3(a0.zw,h.y);
    vec3 g2 = vec3(a1.xy,h.z);
    vec3 g3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(g0,g0), dot(g1,g1), dot(g2, g2), dot(g3,g3)));
    g0 *= norm.x;
    g1 *= norm.y;
    g2 *= norm.z;
    g3 *= norm.w;
    vec4 n = max(vec4(0.0), 0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)));
    n = n*n;
    n = n*n;
    return 40.0 * dot(n, vec4(dot(g0,x0), dot(g1,x1), dot(g2,x2), dot(g3,x3)));
  }

  void main() {
    vUv = uv;
    float noise = snoise(vec3(position.xy * 0.5, uTime * 0.15));
    float distToMouse = distance(uv, uMouse);
    float mousePulse = smoothstep(0.5, 0.0, distToMouse) * 0.1;
    vDistortion = noise + mousePulse;
    vec3 pos = position + normal * vDistortion * 1.2;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const fragmentShader = `
  varying vec2 vUv;
  varying float vDistortion;
  uniform float uTime;

  float random(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  void main() {
    vec3 inkColor = vec3(0.05, 0.05, 0.08); 
    vec3 paperColor = vec3(0.85, 0.82, 0.78); 
    vec3 mixedColor = mix(inkColor, paperColor, vDistortion * 0.4 + 0.6);
    float grain = random(vUv * fract(uTime)) * 0.12;
    mixedColor -= grain;
    gl_FragColor = vec4(mixedColor, 1.0);
  }
`;

const GamePlacecard = ({ index, title, desc, icon, z, onClick }: any) => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const [hovered, setHovered] = useState(false);

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.position.z = THREE.MathUtils.lerp(meshRef.current.position.z, z, 0.1);
      meshRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.5 + index) * 0.05;
      meshRef.current.rotation.x = Math.cos(state.clock.elapsedTime * 0.3 + index) * 0.02;
    }
  });

  return (
    <mesh 
      ref={meshRef} 
      position={[Math.sin(index) * 2.5, Math.cos(index) * 2, -5]} 
      onPointerOver={() => setHovered(true)} 
      onPointerOut={() => setHovered(false)}
      onClick={onClick}
    >
      <planeGeometry args={[2.5, 3.5]} />
      <meshBasicMaterial color={hovered ? "#ffffff" : "#f5f2e8"} transparent opacity={0.9} />
      <Html transform distanceFactor={3} position={[0, 0, 0.01]} pointerEvents="none">
        <div className={`w-64 h-80 p-6 flex flex-col justify-between border-2 border-slate-900 bg-[#f5f2e8] text-slate-900 shadow-2xl transition-all group overflow-hidden ${hovered ? 'scale-105' : 'scale-100'}`}>
          <div className="space-y-2">
            <div className="flex justify-between items-start border-b border-slate-900 pb-2">
              <span className="font-black text-[10px] uppercase tracking-tighter">Protocol No. {index + 1}</span>
              <span className="font-black text-[10px] uppercase">Active</span>
            </div>
            <h3 className="serif text-3xl font-black leading-none mt-2">{title}</h3>
            <p className="text-[10px] leading-tight font-medium mt-2 text-justify line-clamp-4">{desc}</p>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-4xl">{icon}</span>
            <div className="text-[10px] font-black underline cursor-pointer hover:text-indigo-600 transition-colors">READ MORE</div>
          </div>
        </div>
      </Html>
    </mesh>
  );
};

const FluidInk = () => {
  const meshRef = useRef<THREE.Mesh>(null!);
  const { mouse } = useThree();
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uMouse: { value: new THREE.Vector2(0, 0) }
  }), []);

  useFrame((state) => {
    if (meshRef.current) {
      (meshRef.current.material as THREE.ShaderMaterial).uniforms.uTime.value = state.clock.getElapsedTime();
      (meshRef.current.material as THREE.ShaderMaterial).uniforms.uMouse.value.set((mouse.x + 1) / 2, (mouse.y + 1) / 2);
    }
  });

  return (
    <mesh ref={meshRef} scale={3}>
      <sphereGeometry args={[2, 64, 64]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        side={THREE.DoubleSide}
        transparent
      />
    </mesh>
  );
};

const games = [
  { title: "Deduction Grid", desc: "PROTOCOL: The 1984 Census Inference. Cross-reference facts to reveal the hidden matrix of archival records.", icon: "⚖️" },
  { title: "Cryptic Ledger", desc: "EXTRA EXTRA: Intelligence reports suggest encrypted ledgers are leaking. Use frequency analysis to break the substitution cipher.", icon: "📜" },
  { title: "Spatial Logic", desc: "BREAKING: Local architect builds mental towers in 3D space. Experts say the geometric recall core is functioning at peak capacity.", icon: "💎" },
  { title: "Neural Sudoku", desc: "EDITORIAL: Number sequences decoded by advanced reasoning. The Gemini 3 Pro reasoning model provides deep analysis on every move.", icon: "🧩" },
  { title: "Semantic Decrypt", desc: "REDACTED: The power of words rediscovered. Linguistics meet logic in this daily decryption challenge. Can you solve the pattern?", icon: "📖" },
  { title: "Neural Crossword", desc: "CROSSWORD SPECIAL: Classical mechanics meet futuristic insights. A game of synonyms, metaphors, and sharp thinking.", icon: "✏️" }
];

interface LandingPageProps {
  onStart: (tab?: string) => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onStart }) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const exhibitsRef = useRef<HTMLDivElement>(null);
  const catalogRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % games.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    audioService.playClick();
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const mapTitleToTab = (title: string) => {
    if (title.includes("Deduction")) return "deduction";
    if (title.includes("Cryptic")) return "cipher";
    if (title.includes("Spatial")) return "spatial";
    if (title.includes("Sudoku")) return "sudoku";
    if (title.includes("Semantic")) return "word";
    if (title.includes("Crossword")) return "crossword";
    return undefined;
  };

  return (
    <div 
      ref={scrollContainerRef}
      className="fixed inset-0 z-[100] bg-[#ebe7e0] overflow-y-auto flex flex-col scroll-smooth custom-scrollbar"
    >
      {/* Background Layer (Static in view) */}
      <div className="fixed inset-0 pointer-events-none opacity-20 z-0">
        <Canvas dpr={[1, 2]} gl={{ powerPreference: "high-performance", antialias: false }}>
          <PerspectiveCamera makeDefault position={[0, 0, 5]} />
          <ambientLight intensity={0.5} />
          <FluidInk />
        </Canvas>
      </div>

      {/* Floating Header */}
      <div className="relative z-50 border-b-4 border-slate-900 bg-[#ebe7e0]/90 backdrop-blur-sm p-4 flex justify-between items-center sticky top-0 shadow-sm">
        <div className="flex flex-col">
          <span className="font-black text-[10px] uppercase tracking-[0.3em]">Volume 03 // No. 12</span>
          <span className="font-black text-[10px] uppercase tracking-[0.3em]">{new Date().toDateString()}</span>
        </div>
        <div 
          className="serif text-3xl md:text-5xl font-black italic tracking-tighter text-slate-900 cursor-pointer"
          onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          MindGym Gazette
        </div>
        <div className="text-right">
          <span className="font-black text-[10px] uppercase tracking-[0.3em]">Weather: Neural Clear</span>
          <br/>
          <span className="font-black text-[10px] uppercase tracking-[0.3em]">Price: Two Cents Of Logic</span>
        </div>
      </div>

      {/* 1. Intro Section */}
      <section className="relative z-10 min-h-screen p-6 md:p-12 flex flex-col border-b-4 border-slate-900 bg-[#ebe7e0]">
        <div className="flex-1 grid md:grid-cols-12 gap-12">
          <div className="md:col-span-8 space-y-8">
            <motion.h1 
              initial={{ y: 50, opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }}
              className="serif text-7xl md:text-[12rem] font-black leading-[0.8] tracking-tighter text-slate-900 border-b-2 border-slate-900 pb-4"
            >
              THINK <br/> <span className="italic text-indigo-600">HARDER.</span>
            </motion.h1>
            <div className="newspaper-text text-slate-700 font-medium max-w-4xl">
              <p className="mb-4 first-letter:text-5xl first-letter:font-black first-letter:mr-2 first-letter:float-left first-letter:text-slate-900">
                In an era dominated by artificial intelligence, the human capacity for critical thinking faces its greatest challenge. MindGym serves as a cognitive sanctuary—a laboratory designed to stimulate the dormant synapses of the modern brain. Using advanced multimodal reasoning from Gemini 3 Pro, we provide tools that not only test your logic but teach it back to you.
              </p>
              <p>
                Our daily challenges range from the spatial complexities of geometric recall to the linguistic riddles of semantic decryption. Each move is analyzed by our Reasoning Core, providing deep analysis on every move. This is more than a game; it is a resistance against cognitive entropy.
              </p>
            </div>
          </div>
          
          <div className="md:col-span-4 flex flex-col justify-between items-end text-right border-l-0 md:border-l border-slate-300 pl-0 md:pl-8 space-y-12 md:space-y-0 pb-12">
             <div className="space-y-4">
                <div className="w-16 h-1 bg-slate-900 ml-auto" />
                <h2 className="serif text-4xl font-black italic text-slate-900">Breaking: Neural Growth Detected</h2>
                <p className="text-[12px] font-bold text-slate-500 uppercase">Study shows logic games increase focus by 40% in adults.</p>
             </div>
             
             <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => scrollToSection(exhibitsRef)}
              className="bg-slate-900 text-white px-12 py-6 font-black text-sm uppercase tracking-[0.4em] rounded-full shadow-2xl"
             >
               Explore Gallery
             </motion.button>
          </div>
        </div>

        {/* Scroll Indicator */}
        <motion.div 
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 cursor-pointer"
          onClick={() => scrollToSection(exhibitsRef)}
        >
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Scroll Down</span>
          <div className="w-1 h-8 bg-slate-300 rounded-full overflow-hidden">
            <motion.div 
              animate={{ y: [-32, 32] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
              className="w-full h-full bg-indigo-600"
            />
          </div>
        </motion.div>
      </section>

      {/* 2. Exhibits Section (The "3D Gallery") */}
      <section ref={exhibitsRef} className="relative z-10 min-h-screen p-6 md:p-12 flex flex-col items-center justify-center bg-[#f5f2e8] border-b-4 border-slate-900">
        <div className="absolute inset-0 z-0 opacity-40">
           <Canvas dpr={[1, 2]} gl={{ powerPreference: "default" }}>
             <PerspectiveCamera makeDefault position={[0, 0, 5]} />
             <ambientLight intensity={0.5} />
             {games.map((game, i) => (
                <GamePlacecard 
                  key={i} 
                  index={i} 
                  {...game} 
                  z={i === activeIndex ? 2 : -2}
                  onClick={() => onStart(mapTitleToTab(game.title))}
                />
              ))}
           </Canvas>
        </div>

        <div className="relative z-10 text-center mb-12 bg-white/60 backdrop-blur-md p-10 border-4 border-slate-900 shadow-[12px_12px_0px_#0f172a] max-w-3xl">
           <span className="font-black text-[12px] uppercase tracking-[0.5em] text-indigo-600 mb-2 block">CURATED EXHIBIT</span>
           <h2 className="serif text-5xl md:text-7xl font-black text-slate-900 mb-6 italic tracking-tighter">Interactive Domains</h2>
           <p className="serif text-xl md:text-2xl italic text-slate-800 transition-all duration-500 leading-relaxed">
             "{games[activeIndex].desc}"
           </p>
        </div>

        <div className="relative z-10 mt-6 flex gap-4">
           {games.map((_, i) => (
             <button 
               key={i} 
               onClick={() => {
                 audioService.playClick();
                 setActiveIndex(i);
               }}
               className={`w-3 h-3 rounded-full border border-slate-900 transition-all ${i === activeIndex ? 'bg-slate-900 w-12' : 'bg-transparent hover:bg-slate-200'}`}
             />
           ))}
        </div>

        <div className="relative z-10 mt-12 flex flex-col md:flex-row gap-6">
          <button 
           onClick={() => onStart()}
           className="group flex items-center gap-4 text-white font-black uppercase tracking-[0.5em] hover:tracking-[0.6em] transition-all bg-slate-900 border-4 border-slate-900 px-10 py-5 rounded-full shadow-[8px_8px_0px_#4f46e5]"
          >
            Launch Edition <span className="text-2xl">→</span>
          </button>
          <button 
           onClick={() => scrollToSection(catalogRef)}
           className="group flex items-center gap-4 text-slate-900 font-black uppercase tracking-[0.4em] hover:bg-slate-900 hover:text-white transition-all bg-white border-4 border-slate-900 px-10 py-5 rounded-full"
          >
            Full Catalog ↓
          </button>
        </div>
      </section>

      {/* 3. Catalog Section (Traditional Scrolling Grid) */}
      <section ref={catalogRef} className="relative z-10 min-h-screen p-6 md:p-12 flex flex-col bg-[#ebe7e0] border-b-4 border-slate-900 pb-24">
         <header className="mb-12 border-b-2 border-slate-900 pb-6">
            <h2 className="serif text-5xl font-black italic text-slate-900">The Intelligence Catalog</h2>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">A complete index of daily cognitive protocols available in this edition.</p>
         </header>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {games.map((game, i) => (
              <motion.div
                key={i}
                whileHover={{ y: -5 }}
                onClick={() => onStart(mapTitleToTab(game.title))}
                className="bg-white border-2 border-slate-900 p-8 flex flex-col justify-between min-h-[350px] shadow-[8px_8px_0px_#0f172a] hover:shadow-[12px_12px_0px_#4f46e5] cursor-pointer transition-all relative group overflow-hidden"
              >
                {/* Subtle Paper Texture */}
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/paper-fibers.png')]" />
                
                <div className="relative z-10">
                  <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-4">
                    <span className="text-5xl group-hover:scale-110 transition-transform">{game.icon}</span>
                    <span className="text-[10px] font-black border-2 border-slate-900 px-2 py-1 uppercase">Protocol {i+1}</span>
                  </div>
                  <h3 className="serif text-3xl font-black italic text-slate-900 mb-4">{game.title}</h3>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest leading-relaxed text-justify line-clamp-4">
                    {game.desc}
                  </p>
                </div>

                <div className="relative z-10 mt-8 pt-6 border-t border-slate-100 flex items-center justify-between text-[10px] font-black uppercase tracking-tighter">
                   <span className="group-hover:text-indigo-600 transition-colors">Initialize Reconnaissance →</span>
                   <span className="opacity-20">REF_{game.title.split(' ')[0].toUpperCase()}</span>
                </div>
              </motion.div>
            ))}
         </div>

         <div className="mt-20 text-center space-y-8">
            <p className="serif text-2xl italic text-slate-600">"The greatest engine of change is a mind that refuses to be static."</p>
            <button 
              onClick={() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-900 transition-colors"
            >
              ↑ Back to Top
            </button>
         </div>
      </section>

      {/* Footer Ticker (Fixed Bottom) */}
      <div className="fixed bottom-0 left-0 right-0 z-[110] bg-slate-900 text-[#ebe7e0] py-4 px-6 flex items-center overflow-hidden whitespace-nowrap shadow-[0_-5px_10px_rgba(0,0,0,0.2)]">
        <div className="animate-marquee flex gap-12 font-black text-[10px] uppercase tracking-[0.2em]">
          {[1,2,3].map(i => (
            <React.Fragment key={i}>
              <span>• GEMINI 3 PRO REASONING ACTIVE</span>
              <span>• NEW DAILY PUZZLE DEPLOYED</span>
              <span>• CRITICAL THINKING INDEX UP 1.2%</span>
              <span>• SPATIAL CORE OPTIMIZED</span>
              <span>• LOGIC IS THE NEW CURRENCY</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
};
