'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Download, X } from 'lucide-react';

interface InstallPromptProps {
  isOpen: boolean;
  onInstall: () => void;
  onDismiss: () => void;
}

export default function InstallPrompt({ isOpen, onInstall, onDismiss }: InstallPromptProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onDismiss}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
          >
            <div className="relative w-full max-w-sm">
              {/* Glow effect */}
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 rounded-2xl blur-xl" />

              {/* Card */}
              <div className="relative bg-gradient-to-br from-slate-900/95 to-slate-950/95 border border-cyan-500/30 rounded-2xl p-6 backdrop-filter backdrop-blur-xl shadow-2xl">
                {/* Close button */}
                <button
                  onClick={onDismiss}
                  className="absolute top-4 right-4 p-1 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} className="text-slate-400 hover:text-white" />
                </button>

                {/* Logo */}
                <div className="flex justify-center mb-4">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="w-16 h-16 bg-gradient-to-br from-cyan-400 to-cyan-600 rounded-2xl flex items-center justify-center shadow-lg shadow-cyan-500/50"
                  >
                    <span className="text-2xl font-bold text-white">CX</span>
                  </motion.div>
                </div>

                {/* Content */}
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Install CompressX</h2>
                  <p className="text-slate-300 text-sm">
                    Get faster access & app-like experience on your device
                  </p>
                </div>

                {/* Features */}
                <div className="space-y-2 mb-6">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>Works offline</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>No ads or bloat</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    <span>Instant launch</span>
                  </div>
                </div>

                {/* Buttons */}
                <div className="space-y-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onInstall}
                    className="w-full py-3 px-4 bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-cyan-500/30 hover:shadow-cyan-500/50"
                  >
                    <Download size={18} />
                    Install App
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={onDismiss}
                    className="w-full py-3 px-4 bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white font-semibold rounded-lg transition-all border border-white/10 hover:border-white/20"
                  >
                    Maybe Later
                  </motion.button>
                </div>

                {/* Footer */}
                <p className="text-xs text-slate-500 text-center mt-4">
                  You can install this app anytime from the menu
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
