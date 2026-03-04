import { useState, useEffect, useRef, useCallback } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

// ─── Utility ────────────────────────────────────────────────────────────────
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const lerp = (a, b, t) => a + (b - a) * t;

// ─── Particle Field (Three.js) ───────────────────────────────────────────────
function ParticleField() {
  const meshRef = useRef();
  const count = 1800;

  const [positions, colors] = (() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const palette = [
      [0.6, 0.0, 1.0],
      [0.0, 0.9, 1.0],
      [1.0, 0.1, 0.6],
      [0.4, 0.0, 0.8],
    ];
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 30;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 20;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 15;
      const c = palette[Math.floor(Math.random() * palette.length)];
      col[i * 3] = c[0];
      col[i * 3 + 1] = c[1];
      col[i * 3 + 2] = c[2];
    }
    return [pos, col];
  })();

  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const t = clock.getElapsedTime();
    meshRef.current.rotation.y = t * 0.04;
    meshRef.current.rotation.x = Math.sin(t * 0.02) * 0.1;
    const pos = meshRef.current.geometry.attributes.position.array;
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 1] += Math.sin(t * 0.5 + i * 0.01) * 0.002;
    }
    meshRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={meshRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.85}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function FloatingGrid() {
  const ref = useRef();
  useFrame(({ clock }) => {
    if (!ref.current) return;
    ref.current.position.y = -4 + Math.sin(clock.getElapsedTime() * 0.3) * 0.3;
    ref.current.material.opacity = 0.08 + Math.sin(clock.getElapsedTime() * 0.5) * 0.03;
  });
  return (
    <gridHelper ref={ref} args={[40, 40, "#7c00ff", "#00e5ff"]} position={[0, -4, 0]}>
      <meshBasicMaterial attach="material" transparent opacity={0.1} />
    </gridHelper>
  );
}

function Scene({ mouse }) {
  const { camera } = useThree();
  useFrame(() => {
    camera.position.x = lerp(camera.position.x, mouse.x * 1.5, 0.05);
    camera.position.y = lerp(camera.position.y, mouse.y * 0.8, 0.05);
    camera.lookAt(0, 0, 0);
  });
  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[5, 5, 5]} color="#7c00ff" intensity={2} />
      <pointLight position={[-5, -3, 2]} color="#00e5ff" intensity={2} />
      <ParticleField />
      <FloatingGrid />
    </>
  );
}

// ─── Hooks ───────────────────────────────────────────────────────────────────
function useMouse() {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const h = (e) => setMouse({
      x: (e.clientX / window.innerWidth - 0.5) * 2,
      y: -(e.clientY / window.innerHeight - 0.5) * 2,
    });
    window.addEventListener("mousemove", h, { passive: true });
    return () => window.removeEventListener("mousemove", h);
  }, []);
  return mouse;
}

function useInView(threshold = 0.15) {
  const ref = useRef();
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) setInView(true);
    }, { threshold });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, [threshold]);
  return [ref, inView];
}

function useCounter(target, inView, duration = 2000) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!inView) return;
    let start = null;
    const step = (ts) => {
      if (!start) start = ts;
      const p = Math.min((ts - start) / duration, 1);
      setVal(Math.floor(p * p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [inView, target, duration]);
  return val;
}

// ─── Tilt Card ───────────────────────────────────────────────────────────────
function TiltCard({ children, className = "" }) {
  const ref = useRef();
  const anim = useRef({ rx: 0, ry: 0 });

  const onMove = useCallback((e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    anim.current = { rx: -y * 18, ry: x * 18 };
  }, []);

  const onLeave = useCallback(() => { anim.current = { rx: 0, ry: 0 }; }, []);

  useEffect(() => {
    let id;
    const loop = () => {
      const el = ref.current;
      if (el) {
        const cur = {
          rx: parseFloat(el.dataset.rx || 0),
          ry: parseFloat(el.dataset.ry || 0),
        };
        const nx = lerp(cur.rx, anim.current.rx, 0.1);
        const ny = lerp(cur.ry, anim.current.ry, 0.1);
        el.dataset.rx = nx;
        el.dataset.ry = ny;
        el.style.transform = `perspective(800px) rotateX(${nx}deg) rotateY(${ny}deg) scale(${Math.abs(nx) + Math.abs(ny) > 0.5 ? 1.04 : 1})`;
      }
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      className={className}
      style={{ transformStyle: "preserve-3d", willChange: "transform", transition: "box-shadow .3s" }}
    >
      {children}
    </div>
  );
}

// ─── Glow Text ───────────────────────────────────────────────────────────────
function GlowText({ children, color = "#c026d3", className = "" }) {
  return (
    <span
      className={className}
      style={{ color, textShadow: `0 0 20px ${color}99, 0 0 60px ${color}55, 0 0 100px ${color}33` }}
    >
      {children}
    </span>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────
function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const h = () => setScrolled(window.scrollY > 60);
    window.addEventListener("scroll", h, { passive: true });
    return () => window.removeEventListener("scroll", h);
  }, []);

  return (
    <nav
      style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(2,2,10,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(20px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(124,0,255,0.25)" : "none",
        transition: "all .5s ease",
        padding: "1rem 2.5rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <HexLogo />
        <span style={{
          fontFamily: "'Orbitron', monospace", fontWeight: 900, fontSize: "1.1rem",
          background: "linear-gradient(90deg,#c026d3,#00e5ff)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          letterSpacing: "0.05em",
        }}>NOVAFORGE</span>
      </div>
      <div style={{ display: "flex", gap: "2rem" }}>
        {["Games", "About", "Community"].map(l => (
          <a key={l} href={`#${l.toLowerCase()}`} style={{
            fontFamily: "'Rajdhani', sans-serif", fontWeight: 600, fontSize: "0.85rem",
            color: "#94a3b8", textDecoration: "none", letterSpacing: "0.1em",
            textTransform: "uppercase", transition: "color .3s",
          }}
            onMouseEnter={e => e.target.style.color = "#00e5ff"}
            onMouseLeave={e => e.target.style.color = "#94a3b8"}
          >{l}</a>
        ))}
      </div>
      <button style={{
        fontFamily: "'Orbitron', monospace", fontSize: "0.7rem", fontWeight: 700,
        padding: "0.5rem 1.2rem", background: "transparent",
        border: "1px solid #7c00ff", color: "#c026d3",
        cursor: "pointer", letterSpacing: "0.1em", textTransform: "uppercase",
        transition: "all .3s",
        clipPath: "polygon(8px 0%,100% 0%,100% calc(100% - 8px),calc(100% - 8px) 100%,0% 100%,0% 8px)",
      }}
        onMouseEnter={e => { e.target.style.background = "#7c00ff22"; e.target.style.color = "#fff"; e.target.style.boxShadow = "0 0 20px #7c00ff88"; }}
        onMouseLeave={e => { e.target.style.background = "transparent"; e.target.style.color = "#c026d3"; e.target.style.boxShadow = "none"; }}
      >Play Now</button>
    </nav>
  );
}

function HexLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32">
      <polygon points="16,2 28,9 28,23 16,30 4,23 4,9" fill="none" stroke="#7c00ff" strokeWidth="1.5" />
      <polygon points="16,7 24,11.5 24,20.5 16,25 8,20.5 8,11.5" fill="#7c00ff22" stroke="#00e5ff" strokeWidth="0.8" />
      <text x="16" y="20" textAnchor="middle" fill="#c026d3" fontSize="10" fontFamily="Orbitron" fontWeight="900">N</text>
    </svg>
  );
}

// ─── Hero ─────────────────────────────────────────────────────────────────────
function Hero({ mouse }) {
  const [reveal, setReveal] = useState(false);
  useEffect(() => { setTimeout(() => setReveal(true), 300); }, []);

  return (
    <section style={{ position: "relative", height: "100vh", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {/* 3D Canvas */}
      <div style={{ position: "absolute", inset: 0 }}>
        <Canvas camera={{ position: [0, 0, 8], fov: 60 }}>
          <Scene mouse={mouse} />
        </Canvas>
      </div>

      {/* Radial glow backdrop */}
      <div style={{
        position: "absolute", inset: 0,
        background: "radial-gradient(ellipse 70% 60% at 50% 50%, rgba(124,0,255,0.18) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />

      {/* Scan lines */}
      <div style={{
        position: "absolute", inset: 0, pointerEvents: "none",
        backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,229,255,0.015) 2px, rgba(0,229,255,0.015) 4px)",
      }} />

      {/* Content */}
      <div style={{
        position: "relative", textAlign: "center", padding: "0 2rem",
        transform: `translate(${mouse.x * -12}px, ${mouse.y * -8}px)`,
        transition: "transform 0.1s ease-out",
      }}>
        {/* Pre-title */}
        <div style={{
          opacity: reveal ? 1 : 0, transform: reveal ? "none" : "translateY(20px)",
          transition: "all .8s ease .2s",
          display: "inline-flex", alignItems: "center", gap: "0.6rem",
          marginBottom: "1.5rem",
          background: "rgba(124,0,255,0.12)", border: "1px solid rgba(0,229,255,0.25)",
          padding: "0.3rem 1rem", borderRadius: "2px",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00e5ff", boxShadow: "0 0 8px #00e5ff", display: "block", animation: "pulse 2s infinite" }} />
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.7rem", letterSpacing: "0.25em", color: "#00e5ff", textTransform: "uppercase" }}>Indie Studio — Est. 2024</span>
        </div>

        {/* Main headline */}
        <h1 style={{
          fontFamily: "'Orbitron', monospace", fontWeight: 900,
          fontSize: "clamp(2.8rem, 8vw, 7rem)", lineHeight: 1.05,
          margin: "0 0 1.5rem",
          opacity: reveal ? 1 : 0, transform: reveal ? "none" : "translateY(40px)",
          transition: "all 1s ease .4s",
        }}>
          <span style={{ display: "block", color: "#fff", letterSpacing: "-0.02em" }}>FORGE THE</span>
          <GlowText color="#c026d3" className="" style={{ display: "block" }}>
            <span style={{
              display: "block",
              background: "linear-gradient(90deg, #c026d3, #7c00ff, #00e5ff)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              filter: "drop-shadow(0 0 30px rgba(192,38,211,0.6))",
            }}>FUTURE</span>
          </GlowText>
          <span style={{ display: "block", color: "#e2e8f0", letterSpacing: "-0.02em" }}>OF GAMES</span>
        </h1>

        {/* Subtitle */}
        <p style={{
          fontFamily: "'Rajdhani', sans-serif", fontSize: "clamp(0.9rem, 2.5vw, 1.15rem)",
          color: "#94a3b8", maxWidth: 540, margin: "0 auto 2.5rem",
          lineHeight: 1.7, letterSpacing: "0.05em",
          opacity: reveal ? 1 : 0, transform: reveal ? "none" : "translateY(20px)",
          transition: "all .9s ease .7s",
        }}>
          We build worlds that challenge reality — immersive cyberpunk experiences crafted with passion, code, and relentless innovation.
        </p>

        {/* CTAs */}
        <div style={{
          display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap",
          opacity: reveal ? 1 : 0, transform: reveal ? "none" : "translateY(20px)",
          transition: "all .9s ease 1s",
        }}>
          <PrimaryButton>Explore Our Games</PrimaryButton>
          <SecondaryButton>Watch Trailer</SecondaryButton>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: "absolute", bottom: -120, left: "50%", transform: "translateX(-50%)",
          display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem",
          opacity: reveal ? 0.6 : 0, transition: "opacity 1s ease 1.5s",
        }}>
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.65rem", letterSpacing: "0.2em", color: "#64748b", textTransform: "uppercase" }}>Scroll</span>
          <div style={{ width: 1, height: 40, background: "linear-gradient(to bottom, #7c00ff, transparent)", animation: "scrollPulse 2s infinite" }} />
        </div>
      </div>
    </section>
  );
}

function PrimaryButton({ children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: "'Orbitron', monospace", fontSize: "0.75rem", fontWeight: 700,
        padding: "0.9rem 2.2rem", cursor: "pointer", letterSpacing: "0.12em",
        textTransform: "uppercase", border: "none", color: "#fff",
        background: hover
          ? "linear-gradient(135deg,#9d00ff,#c026d3,#00e5ff)"
          : "linear-gradient(135deg,#7c00ff,#a21caf)",
        boxShadow: hover ? "0 0 40px rgba(124,0,255,0.7), 0 0 80px rgba(192,38,211,0.4)" : "0 0 20px rgba(124,0,255,0.4)",
        transform: hover ? "translateY(-3px) scale(1.03)" : "none",
        transition: "all .3s ease",
        clipPath: "polygon(10px 0%,100% 0%,100% calc(100% - 10px),calc(100% - 10px) 100%,0% 100%,0% 10px)",
      }}
    >{children}</button>
  );
}

function SecondaryButton({ children }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        fontFamily: "'Orbitron', monospace", fontSize: "0.75rem", fontWeight: 700,
        padding: "0.9rem 2.2rem", cursor: "pointer", letterSpacing: "0.12em",
        textTransform: "uppercase", color: hover ? "#fff" : "#00e5ff",
        background: hover ? "rgba(0,229,255,0.1)" : "transparent",
        border: "1px solid rgba(0,229,255,0.5)",
        boxShadow: hover ? "0 0 30px rgba(0,229,255,0.4), inset 0 0 30px rgba(0,229,255,0.05)" : "none",
        transform: hover ? "translateY(-3px)" : "none",
        transition: "all .3s ease",
        clipPath: "polygon(10px 0%,100% 0%,100% calc(100% - 10px),calc(100% - 10px) 100%,0% 100%,0% 10px)",
      }}
    >▶ {children}</button>
  );
}

// ─── Games Section ────────────────────────────────────────────────────────────
const GAMES = [
  {
    title: "NEON ABYSS II",
    genre: "Roguelite · Action",
    desc: "Descend into a neon-drenched underworld. Guns. Gods. Chaos. The abyss calls.",
    status: "AVAILABLE NOW",
    statusColor: "#00e5ff",
    accent: "#00e5ff",
    rating: "9.1",
    gradient: "linear-gradient(135deg,rgba(0,229,255,0.15),rgba(0,100,150,0.05))",
    border: "rgba(0,229,255,0.3)",
    emoji: "🌊",
  },
  {
    title: "VOID PROTOCOL",
    genre: "Tactical · Stealth",
    desc: "Infiltrate megacorporations. Hack reality. Every mission rewrites the code.",
    status: "EARLY ACCESS",
    statusColor: "#c026d3",
    accent: "#c026d3",
    rating: "8.7",
    gradient: "linear-gradient(135deg,rgba(192,38,211,0.15),rgba(80,0,100,0.05))",
    border: "rgba(192,38,211,0.3)",
    emoji: "⚡",
  },
  {
    title: "SYNTHWAVE RIDER",
    genre: "Racing · Rhythm",
    desc: "Race at the speed of sound on highways of light. Feel every beat.",
    status: "COMING SOON",
    statusColor: "#f59e0b",
    accent: "#f59e0b",
    rating: "—",
    gradient: "linear-gradient(135deg,rgba(245,158,11,0.15),rgba(120,60,0,0.05))",
    border: "rgba(245,158,11,0.3)",
    emoji: "🏎",
  },
  {
    title: "CHRONO BREACH",
    genre: "RPG · Strategy",
    desc: "Time fractures. Factions wage war across centuries. Choose your era.",
    status: "AVAILABLE NOW",
    statusColor: "#00e5ff",
    accent: "#7c00ff",
    rating: "9.4",
    gradient: "linear-gradient(135deg,rgba(124,0,255,0.15),rgba(40,0,120,0.05))",
    border: "rgba(124,0,255,0.3)",
    emoji: "⏱",
  },
  {
    title: "GHOST MATRIX",
    genre: "Horror · Survival",
    desc: "The simulation is breaking. Entities bleed through. You are not safe.",
    status: "AVAILABLE NOW",
    statusColor: "#00e5ff",
    accent: "#ef4444",
    rating: "8.9",
    gradient: "linear-gradient(135deg,rgba(239,68,68,0.12),rgba(80,0,0,0.05))",
    border: "rgba(239,68,68,0.3)",
    emoji: "👁",
  },
  {
    title: "NOVA UPRISING",
    genre: "Shooter · Co-op",
    desc: "4-player co-op against a galaxy-class threat. Forge your squad. Fight together.",
    status: "IN DEVELOPMENT",
    statusColor: "#94a3b8",
    accent: "#c026d3",
    rating: "—",
    gradient: "linear-gradient(135deg,rgba(192,38,211,0.1),rgba(0,0,60,0.05))",
    border: "rgba(192,38,211,0.2)",
    emoji: "🚀",
  },
];

function GameCard({ game, index, inView }) {
  const [hover, setHover] = useState(false);
  const delay = index * 0.12;

  return (
    <TiltCard
      className=""
      style={{}}
    >
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "translateY(0)" : "translateY(50px)",
          transition: `opacity .7s ease ${delay}s, transform .7s ease ${delay}s`,
          background: game.gradient,
          backdropFilter: "blur(16px)",
          border: `1px solid ${hover ? game.border : "rgba(255,255,255,0.05)"}`,
          borderRadius: "2px",
          padding: "1.8rem",
          cursor: "pointer",
          position: "relative",
          overflow: "hidden",
          boxShadow: hover ? `0 0 40px ${game.accent}33, 0 20px 60px rgba(0,0,0,0.5)` : "0 4px 20px rgba(0,0,0,0.4)",
          transition: `all .35s ease, opacity .7s ease ${delay}s, transform .7s ease ${delay}s`,
          minHeight: 240,
        }}
      >
        {/* Corner accent */}
        <div style={{ position: "absolute", top: 0, right: 0, width: 60, height: 60, overflow: "hidden" }}>
          <div style={{
            position: "absolute", top: -1, right: -1,
            width: 0, height: 0,
            borderStyle: "solid", borderWidth: "0 60px 60px 0",
            borderColor: `transparent ${game.accent}33 transparent transparent`,
          }} />
        </div>

        {/* Top row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <span style={{ fontSize: "2rem" }}>{game.emoji}</span>
          <span style={{
            fontFamily: "'Rajdhani',sans-serif", fontSize: "0.65rem", fontWeight: 700,
            letterSpacing: "0.15em", textTransform: "uppercase",
            color: game.statusColor, padding: "0.2rem 0.6rem",
            border: `1px solid ${game.statusColor}55`,
            background: `${game.statusColor}11`,
          }}>{game.status}</span>
        </div>

        <h3 style={{
          fontFamily: "'Orbitron', monospace", fontSize: "1rem", fontWeight: 900,
          color: "#fff", letterSpacing: "0.05em", marginBottom: "0.3rem",
          textShadow: hover ? `0 0 20px ${game.accent}` : "none",
          transition: "text-shadow .3s",
        }}>{game.title}</h3>

        <p style={{
          fontFamily: "'Rajdhani', sans-serif", fontSize: "0.7rem",
          color: game.accent, letterSpacing: "0.15em", textTransform: "uppercase",
          marginBottom: "0.8rem", fontWeight: 600,
        }}>{game.genre}</p>

        <p style={{
          fontFamily: "'Rajdhani', sans-serif", fontSize: "0.88rem",
          color: "#94a3b8", lineHeight: 1.6, marginBottom: "1.2rem",
        }}>{game.desc}</p>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{
            fontFamily: "'Orbitron', monospace", fontSize: "1.2rem", fontWeight: 900,
            color: game.rating !== "—" ? game.accent : "#475569",
            textShadow: game.rating !== "—" ? `0 0 20px ${game.accent}99` : "none",
          }}>{game.rating !== "—" ? `★ ${game.rating}` : "TBA"}</span>
          <button style={{
            fontFamily: "'Rajdhani', sans-serif", fontSize: "0.75rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            color: game.accent, background: "transparent",
            border: `1px solid ${game.accent}66`, padding: "0.35rem 0.9rem",
            cursor: "pointer", transition: "all .3s",
          }}
            onMouseEnter={e => { e.target.style.background = `${game.accent}22`; e.target.style.boxShadow = `0 0 15px ${game.accent}55`; }}
            onMouseLeave={e => { e.target.style.background = "transparent"; e.target.style.boxShadow = "none"; }}
          >View →</button>
        </div>

        {/* Glow line bottom */}
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 1,
          background: `linear-gradient(90deg, transparent, ${game.accent}, transparent)`,
          opacity: hover ? 1 : 0, transition: "opacity .3s",
        }} />
      </div>
    </TiltCard>
  );
}

function GamesSection() {
  const [ref, inView] = useInView(0.1);
  return (
    <section id="games" ref={ref} style={{ padding: "8rem 2.5rem", position: "relative" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <SectionLabel label="Our Titles" />
        <SectionTitle inView={inView}>
          <span style={{ color: "#fff" }}>Featured </span>
          <GlowText color="#00e5ff">Games</GlowText>
        </SectionTitle>
        <p style={{
          fontFamily: "'Rajdhani',sans-serif", fontSize: "1rem", color: "#64748b",
          maxWidth: 480, margin: "0 0 4rem", lineHeight: 1.7,
          opacity: inView ? 1 : 0, transform: inView ? "none" : "translateY(20px)",
          transition: "all .8s ease .3s",
        }}>
          Each title is a universe unto itself — crafted to push boundaries and immerse players in experiences they won't forget.
        </p>
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: "1.5rem",
        }}>
          {GAMES.map((g, i) => <GameCard key={g.title} game={g} index={i} inView={inView} />)}
        </div>
      </div>
    </section>
  );
}

// ─── About ────────────────────────────────────────────────────────────────────
function StatCounter({ value, suffix = "", label, color, inView }) {
  const count = useCounter(value, inView);
  return (
    <div style={{ textAlign: "center", padding: "1.5rem" }}>
      <div style={{
        fontFamily: "'Orbitron', monospace", fontSize: "2.5rem", fontWeight: 900,
        color, textShadow: `0 0 30px ${color}88`, lineHeight: 1,
      }}>{count}{suffix}</div>
      <div style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.75rem", color: "#64748b", letterSpacing: "0.2em", textTransform: "uppercase", marginTop: "0.5rem" }}>{label}</div>
    </div>
  );
}

function AboutSection() {
  const [ref, inView] = useInView(0.1);
  return (
    <section id="about" ref={ref} style={{ padding: "8rem 2.5rem", position: "relative" }}>
      {/* BG glow */}
      <div style={{
        position: "absolute", top: "50%", left: "60%", transform: "translate(-50%,-50%)",
        width: 600, height: 600, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(124,0,255,0.08) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5rem", alignItems: "center" }}>
          {/* Left */}
          <div style={{
            opacity: inView ? 1 : 0, transform: inView ? "none" : "translateX(-60px)",
            transition: "all .9s ease .2s",
          }}>
            <SectionLabel label="Who We Are" />
            <SectionTitle inView={inView} noAnim>
              <span style={{ color: "#fff" }}>Crafting </span>
              <GlowText color="#c026d3">Worlds</GlowText>
              <br /><span style={{ color: "#fff" }}>From Code</span>
            </SectionTitle>
            <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "1rem", color: "#94a3b8", lineHeight: 1.8, marginBottom: "1.5rem" }}>
              NovaForge Games is a passionate indie studio pushing the boundaries of interactive entertainment. We don't just make games — we engineer emotional experiences that leave permanent marks on players' minds.
            </p>
            <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "1rem", color: "#64748b", lineHeight: 1.8, marginBottom: "2.5rem" }}>
              Founded by a team of industry veterans and daring newcomers, we fuse cutting-edge technology with handcrafted storytelling to create worlds that feel alive.
            </p>
            <PrimaryButton>Meet the Team</PrimaryButton>
          </div>

          {/* Right — illustration + stats */}
          <div style={{
            opacity: inView ? 1 : 0, transform: inView ? "none" : "translateX(60px)",
            transition: "all .9s ease .4s",
          }}>
            {/* Hex illustration */}
            <div style={{
              background: "rgba(124,0,255,0.05)", border: "1px solid rgba(124,0,255,0.2)",
              borderRadius: "2px", padding: "2rem", marginBottom: "2rem",
              position: "relative", overflow: "hidden",
            }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "1rem" }}>
                <HexGrid />
              </div>
              <div style={{
                position: "absolute", inset: 0, pointerEvents: "none",
                background: "radial-gradient(ellipse at center, rgba(124,0,255,0.08) 0%, transparent 70%)",
              }} />
            </div>

            {/* Stats grid */}
            <div style={{
              display: "grid", gridTemplateColumns: "1fr 1fr",
              background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: "2px",
            }}>
              <StatCounter value={6} suffix="+" label="Games Shipped" color="#00e5ff" inView={inView} />
              <StatCounter value={2400000} suffix="+" label="Players Worldwide" color="#c026d3" inView={inView} />
              <StatCounter value={14} suffix="" label="Team Members" color="#7c00ff" inView={inView} />
              <StatCounter value={97} suffix="%" label="Positive Reviews" color="#f59e0b" inView={inView} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HexGrid() {
  const hexes = Array.from({ length: 19 }, (_, i) => i);
  const colors = ["#7c00ff", "#c026d3", "#00e5ff", "#7c00ff44", "#c026d344"];
  return (
    <svg width="280" height="200" viewBox="0 0 280 200" style={{ filter: "drop-shadow(0 0 20px rgba(124,0,255,0.4))" }}>
      {hexes.map((i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const x = 30 + col * 50 + (row % 2) * 25;
        const y = 30 + row * 42;
        const pts = Array.from({ length: 6 }, (_, k) => {
          const a = (k * 60 - 30) * Math.PI / 180;
          return `${x + 20 * Math.cos(a)},${y + 20 * Math.sin(a)}`;
        }).join(" ");
        const c = colors[Math.floor(Math.random() * colors.length)];
        return (
          <g key={i}>
            <polygon points={pts} fill={`${c}22`} stroke={c} strokeWidth="0.8" opacity={0.8 + Math.random() * 0.2}>
              <animate attributeName="opacity" values={`${0.5 + Math.random() * 0.5};${0.2 + Math.random() * 0.3};${0.5 + Math.random() * 0.5}`} dur={`${2 + Math.random() * 3}s`} repeatCount="indefinite" />
            </polygon>
          </g>
        );
      })}
      <text x="140" y="105" textAnchor="middle" fill="#fff" fontSize="12" fontFamily="Orbitron" fontWeight="900" opacity="0.9">NOVAFORGE</text>
    </svg>
  );
}

// ─── Community ────────────────────────────────────────────────────────────────
const COMMUNITY = [
  {
    platform: "Discord",
    handle: "nova-community",
    members: "48K Members",
    desc: "Join our active community. Get dev updates, early access keys, and connect with fellow players.",
    color: "#5865f2",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057.1 18.08.112 18.1.133 18.11a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" />
      </svg>
    ),
  },
  {
    platform: "Twitter / X",
    handle: "@NovaForgeGames",
    members: "120K Followers",
    desc: "Follow us for real-time updates, game reveals, and behind-the-scenes dev content.",
    color: "#00e5ff",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    ),
  },
  {
    platform: "YouTube",
    handle: "NovaForge Games",
    members: "85K Subscribers",
    desc: "Dev diaries, trailers, speedruns, and live coding sessions. Subscribe for weekly drops.",
    color: "#c026d3",
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
      </svg>
    ),
  },
];

function CommunityCard({ item, index, inView }) {
  const [hover, setHover] = useState(false);
  return (
    <TiltCard>
      <div
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          opacity: inView ? 1 : 0,
          transform: inView ? "none" : "translateY(40px)",
          transition: `opacity .7s ease ${index * 0.15}s, transform .7s ease ${index * 0.15}s`,
          padding: "2.5rem",
          background: hover ? `${item.color}12` : "rgba(255,255,255,0.02)",
          border: `1px solid ${hover ? item.color + "44" : "rgba(255,255,255,0.06)"}`,
          borderRadius: "2px",
          cursor: "pointer",
          boxShadow: hover ? `0 0 50px ${item.color}22, 0 20px 60px rgba(0,0,0,0.4)` : "none",
          transition: "all .4s ease",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${item.color}, transparent)`,
          opacity: hover ? 1 : 0, transition: "opacity .3s",
        }} />
        <div style={{ color: item.color, marginBottom: "1.2rem" }}>{item.icon}</div>
        <h3 style={{ fontFamily: "'Orbitron',monospace", fontSize: "1rem", fontWeight: 900, color: "#fff", marginBottom: "0.3rem" }}>{item.platform}</h3>
        <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.75rem", color: item.color, letterSpacing: "0.15em", textTransform: "uppercase", marginBottom: "1rem", fontWeight: 600 }}>{item.members}</p>
        <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.9rem", color: "#64748b", lineHeight: 1.6, marginBottom: "1.5rem" }}>{item.desc}</p>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: "0.4rem",
          fontFamily: "'Rajdhani',sans-serif", fontSize: "0.8rem", fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase", color: item.color,
        }}>
          <span>{item.handle}</span>
          <span style={{ transform: hover ? "translateX(4px)" : "none", transition: "transform .3s" }}>→</span>
        </div>
      </div>
    </TiltCard>
  );
}

function CommunitySection() {
  const [ref, inView] = useInView(0.1);
  return (
    <section id="community" ref={ref} style={{ padding: "8rem 2.5rem", position: "relative" }}>
      <div style={{
        position: "absolute", top: "50%", left: "30%", transform: "translate(-50%,-50%)",
        width: 500, height: 500, borderRadius: "50%",
        background: "radial-gradient(circle, rgba(0,229,255,0.06) 0%, transparent 70%)",
        pointerEvents: "none",
      }} />
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <SectionLabel label="Join the Network" />
        <SectionTitle inView={inView}>
          <span style={{ color: "#fff" }}>Connect With The </span>
          <GlowText color="#00e5ff">Community</GlowText>
        </SectionTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "1.5rem", marginTop: "3rem" }}>
          {COMMUNITY.map((c, i) => <CommunityCard key={c.platform} item={c} index={i} inView={inView} />)}
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{
      position: "relative", padding: "4rem 2.5rem 2.5rem",
      borderTop: "1px solid rgba(124,0,255,0.2)",
      overflow: "hidden",
    }}>
      {/* Animated gradient border */}
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: 1,
        background: "linear-gradient(90deg, transparent, #7c00ff, #c026d3, #00e5ff, #7c00ff, transparent)",
        backgroundSize: "200% 100%",
        animation: "borderSlide 4s linear infinite",
      }} />

      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", gap: "3rem", marginBottom: "3rem" }}>
          {/* Brand */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
              <HexLogo />
              <span style={{
                fontFamily: "'Orbitron', monospace", fontWeight: 900, fontSize: "1.1rem",
                background: "linear-gradient(90deg,#c026d3,#00e5ff)",
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>NOVAFORGE</span>
            </div>
            <p style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.88rem", color: "#475569", lineHeight: 1.7, maxWidth: 260 }}>
              Building the future of interactive entertainment — one universe at a time.
            </p>
          </div>
          {/* Links */}
          {[
            { title: "Studio", links: ["About", "Team", "Careers", "Press Kit"] },
            { title: "Games", links: ["All Titles", "Neon Abyss II", "Void Protocol", "Chrono Breach"] },
            { title: "Connect", links: ["Discord", "Twitter", "YouTube", "Newsletter"] },
          ].map(col => (
            <div key={col.title}>
              <h4 style={{ fontFamily: "'Orbitron',monospace", fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", color: "#7c00ff", marginBottom: "1rem" }}>{col.title}</h4>
              {col.links.map(l => (
                <div key={l} style={{ marginBottom: "0.5rem" }}>
                  <a href="#" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.88rem", color: "#475569", textDecoration: "none", transition: "color .2s" }}
                    onMouseEnter={e => e.target.style.color = "#00e5ff"}
                    onMouseLeave={e => e.target.style.color = "#475569"}
                  >{l}</a>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{
          borderTop: "1px solid rgba(255,255,255,0.05)",
          paddingTop: "1.5rem",
          display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem",
        }}>
          <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.78rem", color: "#334155", letterSpacing: "0.1em" }}>
            © 2024 NovaForge Games. All rights reserved.
          </span>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            {["Privacy", "Terms", "Cookies"].map(l => (
              <a key={l} href="#" style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.75rem", color: "#334155", textDecoration: "none", padding: "0 0.5rem", borderRight: "1px solid #1e293b", transition: "color .2s" }}
                onMouseEnter={e => e.target.style.color = "#7c00ff"}
                onMouseLeave={e => e.target.style.color = "#334155"}
              >{l}</a>
            ))}
          </div>
          <span style={{
            fontFamily: "'Orbitron',monospace", fontSize: "0.6rem", color: "#1e293b", letterSpacing: "0.3em",
          }}>SYSTEM v4.2.1 — ONLINE</span>
        </div>
      </div>
    </footer>
  );
}

// ─── Section Helpers ──────────────────────────────────────────────────────────
function SectionLabel({ label }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", marginBottom: "1rem" }}>
      <div style={{ width: 20, height: 1, background: "#7c00ff" }} />
      <span style={{ fontFamily: "'Rajdhani',sans-serif", fontSize: "0.7rem", letterSpacing: "0.3em", color: "#7c00ff", textTransform: "uppercase", fontWeight: 700 }}>{label}</span>
    </div>
  );
}

function SectionTitle({ children, inView, noAnim }) {
  return (
    <h2 style={{
      fontFamily: "'Orbitron',monospace", fontWeight: 900,
      fontSize: "clamp(2rem,5vw,3.5rem)", lineHeight: 1.1,
      margin: "0 0 1rem",
      opacity: (noAnim || inView) ? 1 : 0,
      transform: (noAnim || inView) ? "none" : "translateY(30px)",
      transition: "all .8s ease .1s",
    }}>{children}</h2>
  );
}

// ─── Global Styles ────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Rajdhani:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { scroll-behavior: smooth; }

  body {
    background: #02020a;
    color: #e2e8f0;
    overflow-x: hidden;
    cursor: crosshair;
  }

  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-track { background: #02020a; }
  ::-webkit-scrollbar-thumb { background: linear-gradient(#7c00ff, #c026d3); border-radius: 2px; }

  @keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.8); }
  }
  @keyframes scrollPulse {
    0% { opacity: 0; transform: scaleY(0); transform-origin: top; }
    50% { opacity: 1; transform: scaleY(1); }
    100% { opacity: 0; transform: scaleY(1); transform-origin: bottom; }
  }
  @keyframes borderSlide {
    0% { background-position: 0% 0%; }
    100% { background-position: 200% 0%; }
  }
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-12px); }
  }
  @keyframes glowPulse {
    0%, 100% { box-shadow: 0 0 20px rgba(124,0,255,0.4); }
    50% { box-shadow: 0 0 50px rgba(124,0,255,0.8), 0 0 100px rgba(192,38,211,0.3); }
  }
`;

// ─── Custom Cursor ────────────────────────────────────────────────────────────
function CustomCursor({ mouse }) {
  const [pos, setPos] = useState({ x: -100, y: -100 });
  const [trail, setTrail] = useState({ x: -100, y: -100 });
  useEffect(() => {
    const h = (e) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h, { passive: true });
    return () => window.removeEventListener("mousemove", h);
  }, []);
  useEffect(() => {
    let id;
    const loop = () => {
      setTrail(prev => ({ x: lerp(prev.x, pos.x, 0.12), y: lerp(prev.y, pos.y, 0.12) }));
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [pos]);
  return (
    <>
      <div style={{ position: "fixed", left: pos.x - 5, top: pos.y - 5, width: 10, height: 10, borderRadius: "50%", background: "#00e5ff", pointerEvents: "none", zIndex: 9999, mixBlendMode: "screen" }} />
      <div style={{ position: "fixed", left: trail.x - 16, top: trail.y - 16, width: 32, height: 32, borderRadius: "50%", border: "1px solid rgba(192,38,211,0.6)", pointerEvents: "none", zIndex: 9998, transition: "none" }} />
    </>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function NovaForgeGames() {
  const mouse = useMouse();

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <CustomCursor mouse={mouse} />
      <Nav />
      <main>
        <Hero mouse={mouse} />
        <GamesSection />
        <AboutSection />
        <CommunitySection />
      </main>
      <Footer />
    </>
  );
}