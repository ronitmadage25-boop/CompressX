'use client';

import { motion } from 'framer-motion';

export default function GlowingMoon() {
  return (
    <div className="moon-container">
      {/* Subtle orbiting particles */}
      <motion.div 
        className="moon-orbit-ring"
        animate={{ rotate: 360 }}
        transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
      >
        <div className="orbit-particle p1" />
        <div className="orbit-particle p2" />
      </motion.div>
      
      {/* The Moon Body */}
      <motion.div 
        className="moon-wrapper"
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 2, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="moon-body">
          {/* Detailed CSS-only Texture */}
          <div className="moon-crater c1" />
          <div className="moon-crater c2" />
          <div className="moon-crater c3" />
          <div className="moon-crater c4" />
          <div className="moon-highlight" />
          <div className="moon-shadow" />
        </div>
        
        {/* Glow layers */}
        <div className="moon-glow moon-glow-1" />
        <div className="moon-glow moon-glow-2" />
        <div className="moon-glow moon-glow-3" />
      </motion.div>
    </div>
  );
}
