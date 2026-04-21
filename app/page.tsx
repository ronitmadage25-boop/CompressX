'use client';
// app/page.tsx — Main landing + compression dashboard

import { useState, useCallback, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import CompressionPanel from '@/components/compression/CompressionPanel';
import ThemeToggle from '@/components/theme/ThemeToggle';
import PDFLockUnlock from '@/components/features/PDFLockUnlock';
import AISummarizer from '@/components/features/AISummarizer';
import PDFPageEditor from '@/components/features/PDFPageEditor';
import PDFMerge from '@/components/features/PDFMerge';
import PDFWatermark from '@/components/features/PDFWatermark';
import PDFPageShuffle from '@/components/features/PDFPageShuffle';
import InstallPrompt from '@/components/pwa/InstallPrompt';
import InstallButton from '@/components/pwa/InstallButton';
import { usePWAInstall } from '@/hooks/usePWAInstall';


// Dynamic import Three.js scene (SSR disabled)
const HeroScene = dynamic(() => import('@/components/three/HeroScene'), {
  ssr: false,
  loading: () => null,
});

interface SessionStat {
  files: number;
  saved: number; // bytes
  avgRatio: number;
}

export default function HomePage() {
  const [sessionStat, setSessionStat] = useState<SessionStat>({ files: 0, saved: 0, avgRatio: 0 });
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState(0);
  const { showInstallPrompt, isInstalled, canInstall, handleInstall, handleDismiss, triggerInstallPrompt, reportServiceHealth } = usePWAInstall();

  const handleJobComplete = useCallback(() => {
    setSessionStat(prev => ({
      files: prev.files + 1,
      saved: prev.saved,
      avgRatio: prev.avgRatio,
    }));
  }, []);

  // Trigger install prompt on feature interaction
  const handleFeatureClick = useCallback(() => {
    triggerInstallPrompt();
  }, [triggerInstallPrompt]);

  // Report service health when AI errors occur
  const handleServiceHealthChange = useCallback((isHealthy: boolean) => {
    reportServiceHealth(isHealthy);
  }, [reportServiceHealth]);

  return (
    <>
      {/* ── Fixed background ───────────────────────────────────────────────────── */}
      <div className="fixed inset-0 z-0">
        {/* Three.js hero */}
        <HeroScene isCompressing={isCompressing} progress={compressionProgress} />

        {/* Gradient blobs */}
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />

        {/* Noise overlay */}
        <div className="noise" />

        {/* Scanline */}
        <div className="scanline" />
      </div>

      {/* ── Nav ─────────────────────────────────────────────────────────────────── */}
      <header className="nav-bar">
        <div className="nav-inner">
          <div className="nav-logo">
            <span className="logo-cx">CX</span>
            <span className="logo-full">CompressX</span>
          </div>

          <div className="nav-center">
            {sessionStat.files > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="session-badge"
              >
                <span className="session-dot" />
                <span>{sessionStat.files} file{sessionStat.files !== 1 ? 's' : ''} compressed this session</span>
              </motion.div>
            )}
          </div>

          <div className="nav-pill">
            <span className="pill-dot" />
            v2.0 · Production
          </div>

          <InstallButton canInstall={canInstall} isInstalled={isInstalled} onClick={handleInstall} />

          <ThemeToggle />
        </div>
      </header>

      {/* ── Main content ─────────────────────────────────────────────────────────── */}
      <main className="page-main">

        {/* Hero section */}
        <motion.section
          className="hero-section"
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        >


          <div className="relative z-10 pt-16">
            <div className="hero-eyebrow">
            <span className="eyebrow-line" />
            Precision Compression Engine
            <span className="eyebrow-line" />
          </div>

          <h1 className="hero-title">
            Compress to an<br />
            <em className="text-gradient-glow">exact target size</em>
          </h1>

          <p className="hero-sub opacity-80">
            Experience premium compression technology designed to deliver<br className="hero-sub-break" />
            precision, performance, and perfection in every file.
          </p>
          </div>

          <div className="format-tags">
            {['JPG', 'PNG', 'WebP', 'PDF', 'DOCX', 'PPTX'].map(t => (
              <span key={t} className="format-tag">{t}</span>
            ))}
          </div>
        </motion.section>

        {/* ── Compression card ─────────────────────────────────────────────────── */}
        <motion.section
          className="compress-card glass-card"
          initial={{ opacity: 0, y: 60, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1], delay: 0.25 }}
        >
          {/* Card glow top border */}
          <div className="card-top-glow" />

          <div className="card-header">
            <div>
              <h2 className="card-title">Compression Studio</h2>
              <p className="card-sub">Upload → Set target → Download</p>
            </div>
            <div className="card-badge">
              <div className="card-badge-dot" />
              <span>Real-time SSE</span>
            </div>
          </div>

          <CompressionPanel onJobComplete={handleJobComplete} />
        </motion.section>

        {/* ── Features Section ─────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.5 }}
        >
          {/* Section label */}
          <div className="features-eyebrow">
            <span className="eyebrow-line" />
            Powered-Up Tools
            <span className="eyebrow-line" />
          </div>
          <p className="features-sub">Convert, summarize, and edit — all in one premium workspace</p>

          {/* 3-column layout + Bottom panel portal target */}
          <div className="features-container">
            <div className="features-top-row" onClick={handleFeatureClick}>
              <PDFLockUnlock />
              <AISummarizer />
              <PDFPageEditor />
            </div>
            
            {/* New Features Row */}
            <div className="features-top-row" onClick={handleFeatureClick}>
              <PDFMerge />
              <PDFWatermark />
              <PDFPageShuffle />
            </div>
            
            {/* AI Summarizer will inject its results into this container */}
            <div id="ai-summary-portal" className="features-bottom-section"></div>
          </div>
        </motion.section>

        <footer className="page-footer">
          <span>CompressX v2.0</span>
          <span className="footer-dot">·</span>
          <span>All processing runs server-side</span>
          <span className="footer-dot">·</span>
          <span>Files deleted within 5 minutes</span>
        </footer>
      </main>

      {/* PWA Install Prompt */}
      <InstallPrompt isOpen={showInstallPrompt} onInstall={handleInstall} onDismiss={handleDismiss} />
    </>
  );
}
