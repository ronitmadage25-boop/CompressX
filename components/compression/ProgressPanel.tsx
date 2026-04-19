'use client';
// components/compression/ProgressPanel.tsx

import { motion } from 'framer-motion';
import { CloudinaryCompressionJob } from '@/hooks/useCompressionCloudinary';
import { Loader2, Activity, Zap } from 'lucide-react';

interface ProgressPanelProps {
  job: CloudinaryCompressionJob;
  onCancel?: () => void;
}

function formatBytes(b: number): string {
  if (!b || b <= 0) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

const STATUS_LABELS: Record<string, string> = {
  uploading: 'Reading File…',
  compressing: 'Compressing File…',
  complete: 'Complete',
  error: 'Failed',
};

export default function ProgressPanel({ job, onCancel }: ProgressPanelProps) {
  const isRunning = job.status !== 'complete' && job.status !== 'error';

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 pb-3">
        <div className="flex items-center gap-2.5">
          {isRunning && (
            <div className="relative w-2 h-2">
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--neon)' }} />
              <motion.div
                animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-full"
                style={{ background: 'var(--neon)' }}
              />
            </div>
          )}
          <span className="text-sm font-semibold" style={{ fontFamily: 'var(--font-display)' }}>
            {STATUS_LABELS[job.status] ?? job.status}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            {job.fileName.length > 22 ? job.fileName.slice(0, 22) + '…' : job.fileName}
          </span>
          {isRunning && onCancel && (
            <button
              onClick={onCancel}
              className="text-xs px-2 py-1 rounded-lg transition-all hover:scale-105"
              style={{ background: 'rgba(255,0,110,0.1)', border: '1px solid rgba(255,0,110,0.2)', color: 'var(--neon3)', fontFamily: 'var(--font-mono)' }}
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-4 pb-3">
        <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          <motion.div
            animate={{ width: `${job.progress}%` }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="absolute left-0 top-0 h-full rounded-full"
            style={{ background: job.status === 'error' ? 'var(--neon3)' : 'linear-gradient(90deg, var(--neon), var(--neon2))', boxShadow: job.status !== 'error' ? '0 0 8px var(--neon)' : 'none' }}
          />
        </div>

        <div className="flex justify-between items-center mt-1.5">
          <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '0.62rem' }}>
            {formatBytes(job.originalSize)} → {formatBytes(job.targetSize)}
          </span>
          <motion.span
            key={job.progress}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-bold text-sm"
            style={{ color: 'var(--neon)', fontFamily: 'var(--font-display)' }}
          >
            {job.progress}%
          </motion.span>
        </div>
      </div>

      {/* Live stats row */}
      {job.status === 'compressing' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mx-4 mb-4 px-3 py-2 rounded-xl flex items-center gap-4"
          style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}
        >
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3" style={{ color: 'var(--neon2)' }} />
            <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>Processing</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Zap className="w-3 h-3" style={{ color: 'var(--neon)' }} />
            <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem' }}>Target</span>
            <span className="text-xs font-bold" style={{ color: 'var(--neon)', fontFamily: 'var(--font-mono)' }}>{formatBytes(job.targetSize)}</span>
          </div>
        </motion.div>
      )}

      {/* Spinner for active processing */}
      {isRunning && (
        <div className="mx-4 mb-4 flex items-center justify-center gap-2 py-3">
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
            <Loader2 className="w-5 h-5" style={{ color: 'var(--neon)' }} />
          </motion.div>
          <span className="text-sm" style={{ color: 'var(--neon)', fontFamily: 'var(--font-mono)' }}>
            {job.status === 'uploading' ? 'Uploading...' : 'Compressing...'}
          </span>
        </div>
      )}

      {/* Error message */}
      {job.status === 'error' && job.error && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mx-4 mb-4 px-3 py-2 rounded-xl"
          style={{ background: 'rgba(255,0,110,0.08)', border: '1px solid rgba(255,0,110,0.2)' }}
        >
          <span className="text-xs" style={{ color: 'var(--neon3)', fontFamily: 'var(--font-mono)' }}>
            ⚠ {job.error}
          </span>
        </motion.div>
      )}
    </motion.div>
  );
}
