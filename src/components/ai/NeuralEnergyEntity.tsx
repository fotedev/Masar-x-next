"use client";


import { motion } from "framer-motion";
import { useLocale } from "next-intl";

interface NeuralEnergyEntityProps {
  className?: string;
}

export function NeuralEnergyEntity({ className = "" }: NeuralEnergyEntityProps) {
  const locale = useLocale();
  const assistantName = locale.toLowerCase().startsWith("ar") ? "زين" : "ZANE";

  return (
    <div className={`relative flex items-center justify-center p-20 sm:p-32 bg-transparent overflow-visible ${className}`}>
      {/* 1. Nindroid Ice-Blue Aura - Absolute Background Layer */}
      <motion.div
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.15, 0.25, 0.15],
        }}
        transition={{
          duration: 6,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="absolute inset-[-300px] sm:inset-[-500px] bg-gradient-to-r from-cyan-400/20 via-blue-500/10 to-transparent rounded-full blur-[120px] pointer-events-none mix-blend-screen z-0"
        style={{ 
          willChange: "transform, opacity",
          width: "160%",
          left: "-30%",
          maskImage: "radial-gradient(circle at center, black 0%, transparent 100%)",
          WebkitMaskImage: "radial-gradient(circle at center, black 0%, transparent 100%)"
        }}
      />

      {/* 2. ZANE Identity: Metallic Shimmer & Hover */}
      <motion.div
        animate={{
          y: [0, -15, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: "easeInOut",
        }}
        className="relative z-10 flex flex-col items-center select-none bg-transparent"
        style={{ willChange: "transform" }}
      >
        <div className="relative group text-center bg-transparent">
          {/* Main "ZANE" Text with Ice-Metallic Shimmer & Clean Glow */}
          <h1 className="text-5xl sm:text-7xl font-black tracking-tighter leading-none bg-transparent"
              style={{ filter: "drop-shadow(0 0 20px rgba(125, 211, 252, 0.2))" }}>
            <span 
              className="inline-block bg-clip-text text-transparent bg-[length:200%_auto] animate-shimmer"
              style={{
                backgroundImage: "linear-gradient(110deg, #f8fafc 40%, #7dd3fc 50%, #f8fafc 60%)",
                backgroundSize: "200% 100%",
                WebkitBackgroundClip: "text",
                willChange: "background-position",
              }}
            >
              {assistantName}
            </span>
          </h1>

          {/* "AI NINDROID" Subtext with Pulse & Letter Spacing Expansion */}
          <motion.div
            animate={{
              letterSpacing: ["0.2em", "0.4em", "0.2em"],
              opacity: [0.6, 0.9, 0.6],
              scale: [0.98, 1.02, 0.98],
            }}
            transition={{
              duration: 4,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className="text-[10px] sm:text-xs font-black uppercase text-slate-400 dark:text-slate-500 mt-2 sm:mt-1 tracking-[0.2em]"
          >
            AI NINDROID
          </motion.div>
        </div>
      </motion.div>

      {/* 3. Removed Ice Crystal Particles (Stray Dot Fix) */}

      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: 100% 0; }
          100% { background-position: -100% 0; }
        }
        .animate-shimmer {
          animation: shimmer 5s linear infinite;
        }
      `}</style>
    </div>
  );
}
