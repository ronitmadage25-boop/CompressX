'use client';
// components/compression/ResultCard.tsx

import { motion } from 'framer-motion';
import { Download, TrendingDown, Repeat2, CheckCircle2, RotateCcw } from 'lucide-react';
import { CloudinaryCompressionResult, CloudinaryCompressionJob } from '@/hooks/useCompressionCloudinary';

interface ResultCardProps {
  result: CloudinaryCompressionResult;
  job: CloudinaryCompressionJob;
  onDownload: () => void;
  onReset: () => void;
}

function formatBytes(b: number): string {
  if (!b || b <= 0) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ResultCard({ result, job, onDownload, onReset }: ResultCardProps) {
  const ratio = Math.min(100, Math.max(0, result.compressionRatio));
  const compRatio = (result.compressedSize / result.originalSize) * 100;
  const withinTarget = result.compressedSize <= job.targetSize * 1.05;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(0,255,179,0.03)',
        border: '1px solid rgba(0,255,179,0.2)',
        boxShadow: '0 0 40px rgba(0,255,179,0.06)',
      }}
    >
      {/* Success header */}
      <div className="px-5 pt-5 pb-3 flex items-center gap-3">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 300, delay: 0.1 }}
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(0,255,179,0.15)', border: '1px solid rgba(0,255,179,0.3)' }}
        >
          <CheckCircle2 className="w-5 h-5" style={{ color: 'var(--neon)' }} />
        </motion.div>
        <div>
          <div className="font-bold" style={{ fontFamily: 'var(--font-display)', fontSize: '1rem' }}>
            Compression Complete
          </div>
          <div className="text-xs mt-0.5" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            {withinTarget ? '✓ Within target range' : '⚠ Best achievable result'} · {result.iterations} iterations
          </div>
        </div>
      </div>

      {/* Size comparison bar */}
      <div className="px-5 pb-4">
        <div className="rounded-xl p-4" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex justify-between text-xs mb-2.5" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            <span>Original</span>
            <span>Compressed</span>
          </div>

          {/* Stacked bars */}
          <div className="relative h-3 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,0,110,0.25)' }}>
            <motion.div
              initial={{ width: '100%' }}
              animate={{ width: `${compRatio}%` }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
              className="absolute left-0 top-0 h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--neon), var(--neon2))', boxShadow: '0 0 12px var(--neon)' }}
            />
            {/* Target marker */}
            <div
              className="absolute top-0 h-full w-0.5"
              style={{
                left: `${(job.targetSize / result.originalSize) * 100}%`,
                background: 'rgba(255,255,255,0.6)',
                boxShadow: '0 0 4px white',
              }}
            />
          </div>

          <div className="flex justify-between text-xs" style={{ fontFamily: 'var(--font-mono)' }}>
            <span style={{ color: 'var(--neon3)' }}>{formatBytes(result.originalSize)}</span>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.6rem' }}>▲ target: {formatBytes(job.targetSize)}</span>
            <span style={{ color: 'var(--neon)' }}>{formatBytes(result.compressedSize)}</span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="px-5 pb-4 grid grid-cols-2 gap-2">
        {[
          { label: 'Saved', value: formatBytes(result.originalSize - result.compressedSize), color: 'var(--neon)', icon: TrendingDown },
          { label: 'Ratio', value: `${ratio.toFixed(1)}%`, color: 'var(--neon)', icon: TrendingDown },
        ].map(({ label, value, color, icon: Icon }) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-xl p-3 text-center"
            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <Icon className="w-3.5 h-3.5 mx-auto mb-1.5" style={{ color }} />
            <div className="text-xs mb-0.5" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '0.58rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{label}</div>
            <div className="font-bold" style={{ color, fontFamily: 'var(--font-display)', fontSize: '1rem' }}>{value}</div>
          </motion.div>
        ))}
      </div>

      {/* Iteration detail */}
      <div className="px-5 pb-4">
        <div className="rounded-xl px-3 py-2.5 flex items-center gap-3" style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.05)' }}>
          <Repeat2 className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--neon2)' }} />
          <div className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
            <span style={{ color: 'var(--text)' }}>{result.iterations}</span> binary-search iterations ·{' '}
            <span style={{ color: 'var(--text)' }}>{formatBytes(result.compressedSize)}</span> achieved vs{' '}
            <span style={{ color: 'var(--neon)' }}>{formatBytes(job.targetSize)}</span> target
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 flex gap-2.5">
        <motion.button
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={onDownload}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all"
          style={{
            background: 'linear-gradient(135deg, var(--neon), var(--neon2))',
            color: '#030508',
            fontFamily: 'var(--font-display)',
            boxShadow: '0 4px 20px rgba(0,255,179,0.3)',
          }}
        >
          <Download className="w-4 h-4" />
          Download
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={onReset}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm transition-all"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
            color: 'var(--muted)',
            fontFamily: 'var(--font-body)',
          }}
        >
          <RotateCcw className="w-4 h-4" />
          New
        </motion.button>
      </div>
    </motion.div>
  );
}
