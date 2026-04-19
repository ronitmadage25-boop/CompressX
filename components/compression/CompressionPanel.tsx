'use client';
// components/compression/CompressionPanel.tsx
// Main compression card — upload → configure → compress → result

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap } from 'lucide-react';
import DropZone from './DropZone';
import ProgressPanel from './ProgressPanel';
import ResultCard from './ResultCard';
import { useCompressionCloudinary } from '@/hooks/useCompressionCloudinary';
import { CompressionOptions } from '@/types';

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

const PRESETS = [
  { label: '100 KB', bytes: 100 * 1024 },
  { label: '500 KB', bytes: 500 * 1024 },
  { label: '1 MB', bytes: 1 * 1024 * 1024 },
  { label: '2 MB', bytes: 2 * 1024 * 1024 },
  { label: '5 MB', bytes: 5 * 1024 * 1024 },
  { label: '10 MB', bytes: 10 * 1024 * 1024 },
];

export default function CompressionPanel({ onJobComplete }: { onJobComplete?: () => void }) {
  const { job, result, isProcessing, compressFile, reset, cancel, downloadResult } = useCompressionCloudinary();

  const [file, setFile] = useState<File | null>(null);
  const [targetVal, setTargetVal] = useState('');
  const [unit, setUnit] = useState<'kb' | 'mb'>('kb');
  const [compressionError, setCompressionError] = useState<string | null>(null);
  const [options] = useState<CompressionOptions>({ stripThumbnails: true });

  const targetBytes = (() => {
    const v = parseFloat(targetVal);
    if (!v || v <= 0) return 0;
    return unit === 'mb' ? v * 1024 * 1024 : v * 1024;
  })();

  const canCompress =
    !!file &&
    targetBytes > 0 &&
    file.size > targetBytes &&
    !isProcessing;

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setCompressionError(null);
  }, []);

  const handleClear = useCallback(() => {
    setFile(null);
    setCompressionError(null);
    reset();
  }, [reset]);

  const handleReset = useCallback(() => {
    setFile(null);
    setCompressionError(null);
    reset();
  }, [reset]);

  const handleCompress = useCallback(async () => {
    if (!file || !canCompress) return;
    
    setCompressionError(null);
    
    try {
      await compressFile(file, targetBytes, options);
      onJobComplete?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Compression failed. Please try again.';
      setCompressionError(errorMessage);
    }
  }, [file, canCompress, compressFile, targetBytes, options, onJobComplete]);

  const showResult = !!result && result.success;
  const showProgress = isProcessing && !showResult;
  const showError = job?.status === 'error' && job.error;

  return (
    <div className="space-y-4">
      {/* Drop zone — hide when processing or done */}
      <AnimatePresence>
        {!showProgress && !showResult && (
          <motion.div
            key="dropzone"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, height: 0 }}
          >
            <DropZone
              file={file}
              onFile={handleFile}
              onClear={handleClear}
              disabled={isProcessing}
            />

            {compressionError && (
              <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,0,110,0.08)', border: '1px solid rgba(255,0,110,0.25)', color: 'var(--neon3)', fontFamily: 'var(--font-mono)' }}>
                ⚠ {compressionError}
              </div>
            )}

            {showError && (
              <div className="mt-2 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(255,0,110,0.08)', border: '1px solid rgba(255,0,110,0.25)', color: 'var(--neon3)', fontFamily: 'var(--font-mono)' }}>
                ⚠ {job.error}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Target size section — show when file selected */}
      <AnimatePresence>
        {file && !showProgress && !showResult && (
          <motion.div
            key="target"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-3"
          >
            {/* Separator */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
              <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em' }}>SET TARGET SIZE</span>
              <div className="flex-1 h-px" style={{ background: 'rgba(255,255,255,0.06)' }} />
            </div>

            {/* Input row */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <input
                  type="number"
                  value={targetVal}
                  onChange={e => setTargetVal(e.target.value)}
                  placeholder="500"
                  min="1"
                  className="w-full rounded-xl px-4 py-3 text-2xl font-bold outline-none transition-all"
                  style={{
                    background: 'rgba(0,0,0,0.35)',
                    border: targetBytes > 0 && file && targetBytes >= file.size
                      ? '1px solid rgba(255,0,110,0.5)'
                      : targetBytes > 0
                        ? '1px solid rgba(0,255,179,0.35)'
                        : '1px solid rgba(255,255,255,0.1)',
                    color: 'var(--text)',
                    fontFamily: 'var(--font-display)',
                    boxShadow: targetBytes > 0 ? '0 0 0 3px rgba(0,255,179,0.07)' : 'none',
                  }}
                />
                {targetBytes > 0 && file && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs" style={{ color: targetBytes >= file.size ? 'var(--neon3)' : 'var(--neon)', fontFamily: 'var(--font-mono)' }}>
                    {targetBytes >= file.size ? '> original' : formatBytes(targetBytes)}
                  </div>
                )}
              </div>

              <select
                value={unit}
                onChange={e => setUnit(e.target.value as 'kb' | 'mb')}
                className="rounded-xl px-4 py-3 font-medium text-sm outline-none cursor-pointer"
                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', fontFamily: 'var(--font-mono)', minWidth: '5rem' }}
              >
                <option value="kb">KB</option>
                <option value="mb">MB</option>
              </select>
            </div>

            {/* Validation message */}
            {targetBytes > 0 && file && targetBytes >= file.size && (
              <p className="text-xs" style={{ color: 'var(--neon3)', fontFamily: 'var(--font-mono)' }}>
                ⚠ Target must be smaller than the original ({formatBytes(file.size)})
              </p>
            )}

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.filter(p => !file || p.bytes < file.size).map(p => (
                <button
                  key={p.label}
                  onClick={() => {
                    const [v, u] = p.label.split(' ');
                    setTargetVal(v);
                    setUnit(u.toLowerCase() as 'kb' | 'mb');
                  }}
                  className="text-xs px-2.5 py-1 rounded-lg transition-all hover:scale-105"
                  style={{
                    background: targetBytes === p.bytes ? 'rgba(0,255,179,0.12)' : 'rgba(255,255,255,0.04)',
                    border: targetBytes === p.bytes ? '1px solid rgba(0,255,179,0.4)' : '1px solid rgba(255,255,255,0.08)',
                    color: targetBytes === p.bytes ? 'var(--neon)' : 'var(--muted)',
                    fontFamily: 'var(--font-mono)',
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* Compress button */}
            <motion.button
              whileHover={canCompress ? { scale: 1.015, y: -2 } : {}}
              whileTap={canCompress ? { scale: 0.99 } : {}}
              onClick={handleCompress}
              disabled={!canCompress}
              className="w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2.5 transition-all relative overflow-hidden"
              style={{
                background: canCompress ? 'linear-gradient(135deg, var(--neon), var(--neon2))' : 'rgba(255,255,255,0.07)',
                color: canCompress ? '#030508' : 'rgba(255,255,255,0.2)',
                fontFamily: 'var(--font-display)',
                fontSize: '0.95rem',
                letterSpacing: '0.01em',
                boxShadow: canCompress ? '0 6px 24px rgba(0,255,179,0.3)' : 'none',
                cursor: canCompress ? 'pointer' : 'not-allowed',
              }}
            >
              {canCompress && (
                <motion.div
                  className="absolute inset-0 opacity-20"
                  animate={{ x: ['-100%', '100%'] }}
                  transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  style={{ background: 'linear-gradient(90deg, transparent, white, transparent)' }}
                />
              )}
              <Zap className="w-4 h-4 relative z-10" />
              <span className="relative z-10">Compress to {targetBytes > 0 ? formatBytes(targetBytes) : 'target'}</span>
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Progress panel */}
      <AnimatePresence>
        {showProgress && job && (
          <ProgressPanel key="progress" job={job} onCancel={cancel} />
        )}
      </AnimatePresence>

      {/* Result card */}
      <AnimatePresence>
        {showResult && result && job && (
          <ResultCard
            key="result"
            result={result}
            job={job}
            onDownload={downloadResult}
            onReset={handleReset}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
