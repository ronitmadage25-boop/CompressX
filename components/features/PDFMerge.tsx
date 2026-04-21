'use client';
// components/features/PDFMerge.tsx
// PDF Merge Tool — upload multiple PDFs, reorder, and merge

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Upload, Download, RefreshCw, Combine, X, GripVertical } from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

interface UploadedPDF {
  id: string;
  file: File;
  name: string;
}

function formatBytes(b: number) {
  if (b < 1024) return `${b}B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)}KB`;
  return `${(b / (1024 * 1024)).toFixed(2)}MB`;
}

export default function PDFMerge() {
  const [files, setFiles] = useState<UploadedPDF[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFiles([]);
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

    setError(null);
    const newPDF: UploadedPDF = {
      id: `${Date.now()}-${Math.random()}`,
      file: f,
      name: f.name,
    };

    setFiles(prev => [...prev, newPDF]);
  }, []);

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleMerge = async () => {
    if (files.length < 2) {
      setError('Please upload at least 2 PDFs to merge');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const mergedPdf = await PDFDocument.create();

      for (const pdf of files) {
        const arrayBuffer = await pdf.file.arrayBuffer();
        const srcPdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
        const pages = await mergedPdf.copyPages(srcPdf, srcPdf.getPageIndices());
        pages.forEach(page => mergedPdf.addPage(page));
      }

      const pdfBytes = await mergedPdf.save();
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const newName = `merged_${Date.now()}.pdf`;

      setResult({ url, name: newName });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to merge PDFs');
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
    Array.from(e.dataTransfer.files).forEach(f => handleFile(f));
  }, [handleFile]);

  return (
    <div className="feature-card glass-card">
      {/* Header */}
      <div className="feature-card-header">
        <div className="feature-card-icon" style={{ background: 'rgba(124, 58, 237, 0.2)', border: '1px solid #7c3aed' }}>
          <Combine size={18} style={{ color: '#7c3aed' }} />
        </div>
        <div>
          <div className="feature-card-title text-gradient-glow">PDF Merge</div>
          <div className="feature-card-sub">Combine multiple PDFs</div>
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
              PDFs Merged
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--muted)', marginBottom: '1rem' }}>
              {files.length} files combined
            </div>
            <div className="flex gap-2">
              <motion.button whileHover={{ scale: 1.02 }} onClick={download} className="btn-cosmic w-full text-xs">
                <Download size={14} /> Download PDF
              </motion.button>
              <button onClick={reset} className="feature-btn feature-btn-ghost text-xs">New</button>
            </div>
          </motion.div>
        ) : (
          <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {files.length === 0 ? (
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
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => Array.from(e.target.files || []).forEach(f => handleFile(f))}
                />
                <div style={{ textAlign: 'center', color: 'var(--muted)' }}>
                  <Upload size={20} style={{ margin: '0 auto 0.5rem', opacity: 0.6, color: '#7c3aed' }} />
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
                    Drop PDFs to merge (2+)
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', marginTop: '0.25rem', opacity: 0.6 }}>
                    Drag to reorder files
                  </div>
                </div>
              </div>
            ) : (
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--muted)', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span>{files.length} file{files.length !== 1 ? 's' : ''} selected</span>
                  <button 
                    onClick={() => inputRef.current?.click()}
                    className="feature-btn feature-btn-ghost"
                    style={{ fontSize: '0.58rem', padding: '0.2rem 0.5rem' }}
                  >
                    + Add
                  </button>
                </div>

                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf"
                  multiple
                  style={{ display: 'none' }}
                  onChange={e => Array.from(e.target.files || []).forEach(f => handleFile(f))}
                />

                {/* File list with reorder */}
                <Reorder.Group axis="y" values={files} onReorder={setFiles} style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                  {files.map((pdf, idx) => (
                    <Reorder.Item key={pdf.id} value={pdf} style={{ marginBottom: '0.5rem' }}>
                      <motion.div
                        layout
                        className="pdf-file-item"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.5rem',
                          padding: '0.5rem',
                          background: 'rgba(255,255,255,0.04)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '8px',
                          cursor: 'grab',
                        }}
                      >
                        <GripVertical size={14} style={{ color: 'var(--muted)', opacity: 0.5 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {idx + 1}. {pdf.name.length > 20 ? pdf.name.slice(0, 20) + '…' : pdf.name}
                          </div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.55rem', color: 'var(--muted)' }}>
                            {formatBytes(pdf.file.size)}
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(pdf.id)}
                          className="feature-btn feature-btn-ghost"
                          style={{ padding: '0.25rem', display: 'flex', alignItems: 'center' }}
                        >
                          <X size={14} />
                        </button>
                      </motion.div>
                    </Reorder.Item>
                  ))}
                </Reorder.Group>

                {error && <div className="feature-error" style={{ marginTop: '0.75rem' }}>{error}</div>}

                <motion.button
                  whileHover={files.length >= 2 && !isProcessing ? { scale: 1.01 } : {}}
                  onClick={handleMerge}
                  disabled={files.length < 2 || isProcessing}
                  className={`btn-cosmic w-full ${files.length < 2 ? 'opacity-50 grayscale' : ''}`}
                  style={{ marginTop: '0.75rem' }}
                >
                  {isProcessing ? (
                    <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8 }}><RefreshCw size={14} /></motion.div> Merging…</>
                  ) : (
                    <><Combine size={14} /> Merge {files.length} PDF{files.length !== 1 ? 's' : ''}</>
                  )}
                </motion.button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
