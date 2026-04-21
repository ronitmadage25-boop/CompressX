'use client';
// components/features/PDFPageEditor.tsx
// PDF Page Editor — thumbnails via canvas (PDF.js CDN), delete selected pages

import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Trash2, Download, RefreshCw, FileText, X } from 'lucide-react';

declare global {
  interface Window {
    pdfjsLib?: any;
  }
}

interface PageThumb {
  index: number;    // 0-based
  dataUrl: string;
  selected: boolean;
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

export default function PDFPageEditor() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pages, setPages] = useState<PageThumb[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const [result, setResult] = useState<{ url: string; name: string; remaining: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedPages = pages.filter(p => p.selected);

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
        thumbs.push({ index: i - 1, dataUrl, selected: false });
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

  const togglePage = (index: number) => {
    setPages(prev => prev.map(p => p.index === index ? { ...p, selected: !p.selected } : p));
  };

  const selectAll = () => setPages(prev => prev.map(p => ({ ...p, selected: true })));
  const deselectAll = () => setPages(prev => prev.map(p => ({ ...p, selected: false })));

  const handleDelete = async () => {
    if (!file || selectedPages.length === 0) return;
    if (selectedPages.length >= pages.length) {
      setError('Cannot delete all pages');
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('pagesToDelete', JSON.stringify(selectedPages.map(p => p.index)));

      const res = await fetch('/api/pdf-pages', { method: 'POST', body: formData });
      const data = await res.json();

      if (!data.success) throw new Error(data.error ?? 'Failed to process PDF');

      setResult({ url: data.downloadUrl, name: data.fileName, remaining: data.remainingPages });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete pages');
    } finally {
      setIsDeleting(false);
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
    setIsDeleting(false);
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
        <div className="feature-card-icon" style={{ background: 'rgba(244, 63, 94, 0.2)', border: '1px solid #f43f5e' }}>
          <FileText size={18} style={{ color: '#f43f5e' }} />
        </div>
        <div>
          <div className="feature-card-title text-gradient-glow">PDF Page Editor</div>
          <div className="feature-card-sub">Select and remove pages</div>
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
              PDF Updated
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--muted)', marginBottom: '1rem' }}>
              {result.remaining} pages remaining · {result.name}
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
                  Drop a PDF to edit pages
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', marginTop: '0.25rem', opacity: 0.6 }}>
                  Click thumbnails to mark for deletion
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
                <div style={{ display: 'flex', gap: '0.35rem' }}>
                  <button onClick={selectedPages.length === pages.length ? deselectAll : selectAll}
                    className="feature-btn feature-btn-ghost" style={{ fontSize: '0.58rem', padding: '0.2rem 0.5rem' }}>
                    {selectedPages.length === pages.length ? 'None' : 'All'}
                  </button>
                  <button onClick={reset}
                    className="feature-btn feature-btn-ghost" style={{ fontSize: '0.58rem', padding: '0.2rem 0.5rem' }}>
                    ✕
                  </button>
                </div>
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

            {/* Page thumbnails grid */}
            {pages.length > 0 && (
              <div className="pdf-page-grid">
                {pages.map(page => (
                  <motion.div
                    key={page.index}
                    whileHover={{ scale: 1.05, y: -2 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => togglePage(page.index)}
                    className={`pdf-page-thumb ${page.selected ? 'selected' : ''}`}
                  >
                    <img src={page.dataUrl} alt={`Page ${page.index + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px', display: 'block' }} />
                    <div className="pdf-page-num">{page.index + 1}</div>
                    {page.selected && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="pdf-page-delete-mark"
                      >
                        <X size={12} />
                      </motion.div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {error && <div className="feature-error" style={{ marginTop: '0.5rem' }}>{error}</div>}

            {/* Delete button */}
            {pages.length > 0 && !isLoading && (
              <motion.button
                whileHover={selectedPages.length > 0 && !isDeleting ? { scale: 1.01 } : {}}
                onClick={handleDelete}
                disabled={selectedPages.length === 0 || isDeleting}
                className={`btn-cosmic w-full bg-rose-500/80 shadow-rose-500/20 ${selectedPages.length === 0 ? 'opacity-50 grayscale' : ''}`}
                style={{ marginTop: '0.75rem' }}
              >
                {isDeleting ? (
                  <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8 }}><RefreshCw size={14} /></motion.div> Processing…</>
                ) : (
                  <><Trash2 size={14} /> Delete {selectedPages.length > 0 ? `${selectedPages.length} Page${selectedPages.length !== 1 ? 's' : ''}` : 'Selected Pages'}</>
                )}
              </motion.button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
