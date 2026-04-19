'use client';
// components/compression/DropZone.tsx

import { useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileImage, FileVideo, FileText, File, X, CheckCircle2 } from 'lucide-react';

const ACCEPTED_TYPES: Record<string, string> = {
  'image/jpeg': 'JPEG',
  'image/png': 'PNG',
  'image/webp': 'WebP',
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PPTX',
};

const MAX_SIZE = 500 * 1024 * 1024; // 500MB

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(2)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <FileImage className="w-6 h-6" />;
  if (mimeType === 'application/pdf') return <FileText className="w-6 h-6" />;
  return <File className="w-6 h-6" />;
}

function getFileColor(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'var(--neon)';
  if (mimeType === 'application/pdf') return '#f59e0b';
  return 'var(--neon2)';
}

interface DropZoneProps {
  file: File | null;
  onFile: (file: File) => void;
  onClear: () => void;
  disabled?: boolean;
}

export default function DropZone({ file, onFile, onClear, disabled }: DropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const validate = useCallback((f: File): string | null => {
    if (f.size > MAX_SIZE) return `File too large: ${formatBytes(f.size)} — max 500 MB`;
    const ext = f.name.split('.').pop()?.toLowerCase() ?? '';
    const extToMime: Record<string, string> = { docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', pdf: 'application/pdf' };
    const mime = extToMime[ext] ?? f.type;
    if (!ACCEPTED_TYPES[mime] && !f.type.startsWith('image/')) {
      return `Unsupported type: .${ext}`;
    }
    return null;
  }, []);

  const handleFile = useCallback((f: File) => {
    setError(null);
    const err = validate(f);
    if (err) { setError(err); return; }

    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f);
      setImagePreview(url);
    } else {
      setImagePreview(null);
    }

    onFile(f);
  }, [validate, onFile]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const onDragLeave = useCallback(() => setIsDragging(false), []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
    e.target.value = '';
  }, [handleFile]);

  const handleClear = useCallback(() => {
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    setError(null);
    onClear();
  }, [imagePreview, onClear]);

  if (file) {
    return (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl border overflow-hidden"
        style={{ borderColor: 'rgba(0,255,179,0.2)', background: 'rgba(0,255,179,0.04)' }}
      >
        {/* Image preview strip */}
        {imagePreview && (
          <div className="relative h-28 overflow-hidden">
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(3,5,8,0.9))' }} />
          </div>
        )}

        <div className="flex items-center gap-3 p-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: `rgba(${getFileColor(file.type) === 'var(--neon)' ? '0,255,179' : getFileColor(file.type) === 'var(--neon3)' ? '255,0,110' : '0,184,255'},0.15)`, color: getFileColor(file.type) }}
          >
            {getFileIcon(file.type)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate" style={{ fontFamily: 'var(--font-display)' }}>{file.name}</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
                {formatBytes(file.size)}
              </span>
              <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,255,179,0.1)', color: 'var(--neon)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.1em' }}>
                {ACCEPTED_TYPES[file.type] ?? file.name.split('.').pop()?.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <CheckCircle2 className="w-4 h-4" style={{ color: 'var(--neon)' }} />
            {!disabled && (
              <button
                onClick={handleClear}
                className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
                style={{ background: 'rgba(255,0,110,0.1)', border: '1px solid rgba(255,0,110,0.2)', color: 'var(--neon3)' }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="px-4 pb-3 text-xs"
              style={{ color: 'var(--neon3)', fontFamily: 'var(--font-mono)' }}
            >
              ⚠ {error}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <div>
      <motion.div
        animate={{ borderColor: isDragging ? 'rgba(0,255,179,0.7)' : 'rgba(255,255,255,0.1)' }}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className="relative rounded-2xl border-2 border-dashed text-center transition-all cursor-pointer select-none"
        style={{
          padding: '2.8rem 2rem',
          background: isDragging ? 'rgba(0,255,179,0.05)' : 'rgba(0,0,0,0.2)',
          boxShadow: isDragging ? '0 0 40px rgba(0,255,179,0.12), inset 0 0 30px rgba(0,255,179,0.04)' : 'none',
        }}
        whileHover={{ scale: 1.005 }}
        whileTap={{ scale: 0.998 }}
      >
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          accept=".jpg,.jpeg,.png,.webp,.pdf,.docx,.pptx"
          onChange={onInputChange}
          disabled={disabled}
        />

        {/* Animated ring on drag */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-4 rounded-xl"
              style={{ border: '1px solid rgba(0,255,179,0.3)', pointerEvents: 'none' }}
            />
          )}
        </AnimatePresence>

        <motion.div
          animate={{ y: isDragging ? -6 : 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(0,255,179,0.08)', border: '1px solid rgba(0,255,179,0.2)' }}
          >
            <Upload className="w-7 h-7" style={{ color: 'var(--neon)' }} />
          </div>

          <div className="font-bold text-lg mb-1" style={{ fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
            {isDragging ? 'Drop it here' : 'Drop your file'}
          </div>
          <div className="text-sm mb-4" style={{ color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
            or click to browse · max 500 MB
          </div>

          <div className="flex flex-wrap gap-1.5 justify-center">
            {['JPG', 'PNG', 'WebP', 'PDF', 'DOCX', 'PPTX'].map(t => (
              <span
                key={t}
                className="text-xs px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'var(--muted)', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', letterSpacing: '0.1em' }}
              >
                {t}
              </span>
            ))}
          </div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-2 px-3 py-2 rounded-lg text-xs"
            style={{ background: 'rgba(255,0,110,0.08)', border: '1px solid rgba(255,0,110,0.25)', color: 'var(--neon3)', fontFamily: 'var(--font-mono)' }}
          >
            ⚠ {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
