'use client';
// components/theme/ThemeToggle.tsx
// Premium animated theme toggle with sun/moon icons

import { motion } from 'framer-motion';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export default function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = theme === 'dark';

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="theme-toggle" style={{ opacity: 0 }}>
        <div className="theme-toggle-track" />
        <div className="theme-toggle-knob">
          <div className="theme-toggle-icon">
            <Moon className="w-3.5 h-3.5" style={{ color: 'var(--neon)' }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.button
      onClick={toggleTheme}
      className="theme-toggle"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Toggle theme"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Background track */}
      <motion.div 
        className="theme-toggle-track"
        animate={{
          background: isDark 
            ? 'linear-gradient(135deg, rgba(0,255,179,0.15), rgba(0,184,255,0.15))'
            : 'linear-gradient(135deg, rgba(255,179,0,0.15), rgba(255,140,0,0.15))'
        }}
        transition={{ duration: 0.3 }}
      />

      {/* Sliding knob */}
      <motion.div
        className="theme-toggle-knob"
        animate={{
          x: isDark ? 0 : 24,
          rotate: isDark ? 0 : 180,
        }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 25,
        }}
      >
        {/* Icon container with morph animation */}
        <motion.div
          className="theme-toggle-icon"
          animate={{
            scale: [1, 1.2, 1],
            rotate: isDark ? 0 : 180,
          }}
          transition={{ duration: 0.3 }}
        >
          {isDark ? (
            <Moon className="w-3.5 h-3.5" style={{ color: 'var(--neon)' }} />
          ) : (
            <Sun className="w-3.5 h-3.5" style={{ color: '#ff8c00' }} />
          )}
        </motion.div>

        {/* Glow effect */}
        <motion.div
          className="theme-toggle-glow"
          animate={{
            opacity: [0.5, 1, 0.5],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>

      {/* Sparkle particles on toggle */}
      <motion.div
        className="theme-toggle-sparkle"
        animate={{
          opacity: [0, 1, 0],
          scale: [0.5, 1.5, 0.5],
        }}
        transition={{
          duration: 0.6,
          ease: 'easeOut',
        }}
      />
    </motion.button>
  );
}
