'use client';

import { motion } from 'framer-motion';
import { Download } from 'lucide-react';

interface InstallButtonProps {
  canInstall: boolean;
  isInstalled: boolean;
  onClick: () => void;
}

export default function InstallButton({ canInstall, isInstalled, onClick }: InstallButtonProps) {
  if (!canInstall || isInstalled) return null;

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="relative px-3 py-2 rounded-lg bg-gradient-to-r from-cyan-500/20 to-cyan-600/20 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 hover:text-cyan-200 font-semibold text-sm flex items-center gap-2 transition-all hover:shadow-lg hover:shadow-cyan-500/30"
    >
      {/* Glow animation */}
      <motion.div
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute inset-0 rounded-lg bg-gradient-to-r from-cyan-500/10 to-cyan-600/10 blur-sm"
      />

      {/* Content */}
      <div className="relative flex items-center gap-2">
        <Download size={16} />
        <span>Install</span>
      </div>
    </motion.button>
  );
}
