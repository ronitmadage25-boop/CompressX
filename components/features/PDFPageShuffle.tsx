'use client';
// components/features/PDFPageShuffle.tsx
// PDF Page Shuffle Tool — drag and reorder pages

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Download, RefreshCw, Shuffle, FileText, X, GripVertical } from 'lucide-react';

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

interface PageThumb {
  index: number;
  dataUrl: string;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(2)}MB`;
}

async function loadPdfJs(): Promise<any> {
  if (window.pdfjsLib) return window.pdfjsLib;

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = () => {
      if (window.pdfjsLib) {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        resolve(window.pdfjsLib);
      } else {
        reject(new Error('PDF.js failed to load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load PDF.js'));
    document.head.appendChild(script);
  });
}

async function renderPageThumb(pdfPage: any, scale = 0.3): Promise<string> {
  const viewport = pdfPage.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await pdfPage.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL('image/jpeg', 0.7);
}

export default function PDFPageShuffle() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (f: File) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && f.type !== 'application/pdf') {
      setError('Only PDF files are supported');
      return;
    }

    setFile(f);
    setPages([]);
    setResult(null);
    setError(null);
    setIsLoading(true);
    setLoadProgress(0);

    try {
      const pdfjs = await loadPdfJs();
      const arrayBuffer = await f.arrayBuffer();
      const pdfDoc = await pdfjs.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdfDoc.numPages;

      const thumbs: PageThumb[] = [];
      for (let i = 1; i <= numPages; i++) {
        const page = await pdfDoc.getPage(i);
        const dataUrl = await renderPageThumb(page, 0.25);
        thumbs.push({ index: i - 1, dataUrl });
        setLoadProgress(Math.round((i / numPages) * 100));
        setPages([...thumbs]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PDF');
    } finally {
      setIsLoading(false);
      setLoadProgress(0);
    }
  }, []);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    const newPages = [...pages];
    const draggedPage = newPages[draggedIndex];
    newPages.splice(draggedIndex, 1);
    newPages.splice(targetIndex, 0, draggedPage);
    setDraggedIndex(targetIndex);
    setPages(newPages);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const handleApplyChanges = async () => {
    if (!file || pages.length === 0) return;

    setIsProcessing(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('pageOrder', JSON.stringify(pages.map(p => p.index)));

      const res = await fetch('/api/pdf-pages', { 
        method: 'POST', 
        body: formData,
        signal: AbortSignal.timeout(120000) // 2 minute timeout
      });
      
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      
      const data = await res.json();

      if (!data.success) throw new Error(data.error ?? 'Failed to reorder PDF');

      setResult({ url: data.downloadUrl, name: data.fileName });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reorder pages');
    } finally {
      setIsProcessing(false);
    }
  };

  const download = () => {
    if (!result) return;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = result.name;
    a.click();
  };

  const reset = () => {
    setFile(null);
    setPages([]);
    setResult(null);
    setError(null);
    setIsLoading(false);
    setIsProcessing(false);
    setDraggedIndex(null);
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
        <div className="feature-card-icon" style={{ background: 'rgba(255, 107, 157, 0.2)', border: '1px solid #ff6b9d' }}>
          <Shuffle size={18} style={{ color: '#ff6b9d' }} />
        </div>
        <div>
          <div className="feature-card-title text-gradient-glow">PDF Page Shuffle</div>
          <div className="feature-card-sub">Drag to reorder pages</div>
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
              Pages Reordered
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--muted)', marginBottom: '1rem' }}>
              {pages.length} pages rearranged
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
                <Upload size={20} style={{ margin: '0 auto 0.5rem', opacity: 0.6, color: '#ff6b9d' }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
                  Drop a PDF to shuffle pages
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', marginTop: '0.25rem', opacity: 0.6 }}>
                  Drag thumbnails to reorder
                </div>
              </div>
            </div>
            {error && <div className="feature-error">{error}</div>}
          </motion.div>
        ) : (
          <motion.div key="pages" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {/* File info + controls */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.6rem' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--muted)' }}>
                {file.name.length > 22 ? file.name.slice(0, 22) + '…' : file.name} · {pages.length} pages
              </div>
              {!isLoading && pages.length > 0 && (
                <button onClick={reset}
                  className="feature-btn feature-btn-ghost" style={{ fontSize: '0.58rem', padding: '0.2rem 0.5rem' }}>
                  ✕
                </button>
              )}
            </div>

            {/* Loading progress */}
            {isLoading && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', marginBottom: '0.25rem' }}>
                  <span>Rendering thumbnails…</span>
                  <span>{loadProgress}%</span>
                </div>
                <div style={{ height: '2px', background: 'rgba(255,255,255,0.06)', borderRadius: '99px', overflow: 'hidden' }}>
                  <motion.div
                    animate={{ width: `${loadProgress}%` }}
                    style={{ height: '100%', background: 'linear-gradient(90deg,var(--neon),var(--neon2))', borderRadius: '99px' }}
                  />
                </div>
              </div>
            )}

            {/* Page thumbnails grid with drag-and-drop */}
            {pages.length > 0 && (
              <div className="pdf-page-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {pages.map((page, idx) => (
                  <motion.div
                    key={`${page.index}-${idx}`}
                    layout
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    className="pdf-page-thumb"
                    style={{ 
                      cursor: 'grab',
                      position: 'relative',
                      opacity: draggedIndex === idx ? 0.5 : 1,
                      transition: 'opacity 0.2s ease'
                    }}
                  >
                    <img src={page.dataUrl} alt={`Page ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', display: 'block', pointerEvents: 'none' }} />
                    <div className="pdf-page-num">{idx + 1}</div>
                  </motion.div>
                ))}
              </div>
            )}

            {error && <div className="feature-error" style={{ marginTop: '0.5rem' }}>{error}</div>}

            {/* Apply Changes button */}
            {pages.length > 0 && !isLoading && (
              <motion.button
                whileHover={!isProcessing ? { scale: 1.01 } : {}}
                onClick={handleApplyChanges}
                disabled={isProcessing}
                className="btn-cosmic w-full"
                style={{ marginTop: '0.75rem' }}
              >
                {isProcessing ? (
                  <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8 }}><RefreshCw size={14} /></motion.div> Applying…</>
                ) : (
                  <><Shuffle size={14} /> Apply Changes</>
                )}
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
