'use client';
// components/features/PDFWatermark.tsx
// PDF Watermark Tool — add custom text watermark to all pages

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Download, RefreshCw, Droplet, X } from 'lucide-react';
import { PDFDocument, rgb } from 'pdf-lib';

export default function PDFWatermark() {
  const [file, setFile] = useState<File | null>(null);
  const [watermarkText, setWatermarkText] = useState('COMPRESSX');
  const [textColor, setTextColor] = useState('#00ffb3');
  const [opacity, setOpacity] = useState(0.3);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setWatermarkText('COMPRESSX');
    setTextColor('#00ffb3');
    setOpacity(0.3);
    setResult(null);
    setError(null);
    setIsProcessing(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleFile = useCallback((f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && f.type !== 'application/pdf') {
      setError('Only PDF files are supported');
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  }, []);

  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return { r: 0, g: 255, b: 179 };
    return {
      r: parseInt(result[1], 16) / 255,
      g: parseInt(result[2], 16) / 255,
      b: parseInt(result[3], 16) / 255,
    };
  };

  const applyWatermark = async () => {
    if (!file) {
      setError('Please upload a PDF');
      return;
    }
    if (!watermarkText.trim()) {
      setError('Watermark text is required');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      const { r, g, b } = hexToRgb(textColor);

      for (const page of pages) {
        const { width, height } = page.getSize();
        
        // Draw watermark diagonally across the page
        page.drawText(watermarkText, {
          x: width / 2 - 100,
          y: height / 2,
          size: 60,
          color: rgb(r, g, b),
          opacity: opacity,
        });
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const newName = file.name.replace(/\.pdf$/i, '_watermarked.pdf');

      setResult({ url, name: newName });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply watermark');
    } finally {
      setIsProcessing(false);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  return (
    <div className="feature-card glass-card">
      {/* Header */}
      <div className="feature-card-header">
        <div className="feature-card-icon" style={{ background: 'rgba(255, 193, 7, 0.2)', border: '1px solid #ffc107' }}>
          <Droplet size={18} style={{ color: '#ffc107' }} />
        </div>
        <div>
          <div className="feature-card-title text-gradient-glow">PDF Watermark</div>
          <div className="feature-card-sub">Add custom text watermark</div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {result ? (
          <motion.div
            key="result"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="feature-result"
          >
            <div style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>✅</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.25rem' }}>
              Watermark Applied
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--muted)', marginBottom: '1rem' }}>
              {result.name}
            </div>
            <div className="flex gap-2">
              <motion.button whileHover={{ scale: 1.02 }} onClick={download} className="btn-cosmic w-full text-xs">
                <Download size={14} /> Download PDF
              </motion.button>
              <button onClick={reset} className="feature-btn feature-btn-ghost text-xs">New</button>
            </div>
          </motion.div>
        ) : !file ? (
          <motion.div
            key="upload"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div
              className={`converter-dropzone ${isDragging ? 'dragging' : ''}`}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept=".pdf"
                style={{ display: 'none' }}
                onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
                <Upload size={20} style={{ margin: '0 auto 0.5rem', opacity: 0.6, color: '#ffc107' }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
                  Drop a PDF to watermark
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', marginTop: '0.25rem', opacity: 0.6 }}>
                  Customize text & color
                </div>
              </div>
            </div>
            {error && <div className="feature-error">{error}</div>}
          </motion.div>
        ) : (
          <motion.div key="process" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.8rem' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--muted)' }}>
                {file.name.length > 25 ? file.name.slice(0, 25) + '…' : file.name}
              </div>
              <button 
                onClick={reset}
                style={{ background: 'transparent', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '0.8rem' }}
              >✕</button>
            </div>

            {/* Watermark Text Input */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>
                Watermark Text
              </label>
              <input 
                type="text" 
                value={watermarkText}
                onChange={e => setWatermarkText(e.target.value)}
                placeholder="COMPRESSX"
                className="input-field"
                style={{ 
                  width: '100%', 
                  background: 'rgba(0,0,0,0.2)', 
                  border: '1px solid rgba(255,255,255,0.1)', 
                  color: '#fff', 
                  padding: '0.5rem', 
                  borderRadius: '6px',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.75rem',
                  outline: 'none'
                }} 
              />
            </div>

            {/* Color Picker */}
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>
                Text Color
              </label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="color" 
                  value={textColor}
                  onChange={e => setTextColor(e.target.value)}
                  style={{ 
                    width: '40px', 
                    height: '32px', 
                    border: 'none', 
                    borderRadius: '6px',
                    cursor: 'pointer'
                  }} 
                />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--muted)' }}>
                  {textColor}
                </span>
              </div>
            </div>

            {/* Opacity Slider */}
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>
                <span>Opacity</span>
                <span>{Math.round(opacity * 100)}%</span>
              </label>
              <input 
                type="range" 
                min="0.1" 
                max="1" 
                step="0.05"
                value={opacity}
                onChange={e => setOpacity(parseFloat(e.target.value))}
                style={{ 
                  width: '100%', 
                  cursor: 'pointer'
                }} 
              />
            </div>

            {error && <div className="feature-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <motion.button
              whileHover={watermarkText.trim() && !isProcessing ? { scale: 1.01 } : {}}
              onClick={applyWatermark}
              disabled={!watermarkText.trim() || isProcessing}
              className={`btn-cosmic w-full ${!watermarkText.trim() ? 'opacity-50 grayscale' : ''}`}
            >
              {isProcessing ? (
                <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8 }}><RefreshCw size={14} /></motion.div> Applying…</>
              ) : (
                <><Droplet size={14} /> Apply Watermark</>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
