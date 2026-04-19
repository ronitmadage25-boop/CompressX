'use client';

import { useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Download, RefreshCw, Lock, Unlock } from 'lucide-react';
import { encryptPDF } from '@pdfsmaller/pdf-encrypt';
import { decryptPDF } from '@pdfsmaller/pdf-decrypt';
import { PDFDocument } from 'pdf-lib';

type Mode = 'lock' | 'unlock';

export default function PDFLockUnlock() {
  const [mode, setMode] = useState<Mode>('lock');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{ url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setFile(null);
    setPassword('');
    setResult(null);
    setError(null);
    setIsProcessing(false);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleModeSwitch = (newMode: Mode) => {
    if (mode === newMode) return;
    setMode(newMode);
    reset();
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
    setPassword('');
  }, []);

  const processFile = async () => {
    if (!file) {
      setError('Please upload a file');
      return;
    }
    if (!password.trim()) {
      setError('Password is required');
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      let outputBytes: Uint8Array;
      const enteredPassword = password;

      if (mode === 'lock') {
        outputBytes = await encryptPDF(uint8Array, password, { algorithm: 'AES-256' });
      } else {
        const enteredPassword = password;
        console.log("Entered Password:", enteredPassword);

        try {
          outputBytes = await decryptPDF(uint8Array, enteredPassword);
        } catch (error: any) {
          console.error(error);
          throw new Error("Unable to unlock this PDF. This tool supports only PDFs locked using CompressX.");
        }
      }

      const blob = new Blob([outputBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const suffix = mode === 'lock' ? '_locked' : '_unlocked';
      const newName = file.name.replace(/\.pdf$/i, `${suffix}.pdf`);

      setResult({ url, name: newName });
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${mode} PDF`);
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
    <div className="feature-card" style={{ height: '100%', position: 'relative' }}>
      {/* Header */}
      <div className="feature-card-header">
        <div 
          className="feature-card-icon" 
          style={{ 
            background: 'linear-gradient(135deg,rgba(0,255,150,0.2),rgba(0,150,255,0.1))', 
            border: '1px solid rgba(0,255,150,0.3)' 
          }}
        >
          {mode === 'lock' ? <Lock size={18} style={{ color: '#00ff96' }} /> : <Unlock size={18} style={{ color: '#00ff96' }} />}
        </div>
        <div>
          <div className="feature-card-title">PDF Security</div>
          <div className="feature-card-sub">Lock or unlock PDFs safely</div>
        </div>
      </div>

      {/* Mode Tabs */}
      {!result && (
        <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', background: 'rgba(255,255,255,0.03)', padding: '0.25rem', borderRadius: '8px' }}>
          <button
            onClick={() => handleModeSwitch('lock')}
            style={{
              flex: 1,
              padding: '0.35rem',
              fontSize: '0.65rem',
              fontFamily: 'var(--font-mono)',
              borderRadius: '6px',
              border: 'none',
              background: mode === 'lock' ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: mode === 'lock' ? '#fff' : 'var(--muted)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Lock PDF
          </button>
          <button
            onClick={() => handleModeSwitch('unlock')}
            style={{
              flex: 1,
              padding: '0.35rem',
              fontSize: '0.65rem',
              fontFamily: 'var(--font-mono)',
              borderRadius: '6px',
              border: 'none',
              background: mode === 'unlock' ? 'rgba(255,255,255,0.1)' : 'transparent',
              color: mode === 'unlock' ? '#fff' : 'var(--muted)',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Unlock PDF
          </button>
        </div>
      )}

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
              {mode === 'lock' ? 'PDF Secured' : 'PDF Unlocked'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.62rem', color: 'var(--muted)', marginBottom: '1rem' }}>
              {result.name}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <motion.button whileHover={{ scale: 1.02 }} onClick={download} className="feature-btn feature-btn-primary" style={{ flex: 1, background: 'linear-gradient(135deg,rgba(0,255,150,0.8),rgba(0,180,255,0.8))' }}>
                <Download size={14} /> Download PDF
              </motion.button>
              <button onClick={reset} className="feature-btn feature-btn-ghost">New</button>
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
                <Upload size={20} style={{ margin: '0 auto 0.5rem', opacity: 0.6, color: '#00ff96' }} />
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.65rem' }}>
                  Drop a PDF to {mode}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.58rem', marginTop: '0.25rem', opacity: 0.6 }}>
                  100% secure, processed locally
                </div>
                {mode === 'unlock' && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.5rem', marginTop: '0.4rem', color: '#ffcc00', opacity: 0.8 }}>
                    This feature works only for PDFs locked using CompressX
                  </div>
                )}
              </div>
            </div>
            {error && <div className="feature-error" style={{ marginTop: '0.5rem' }}>{error}</div>}
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

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: '0.6rem', color: 'var(--muted)', marginBottom: '0.4rem' }}>
                {mode === 'lock' ? 'Set Password' : 'Enter Password to Unlock'}
              </label>
              <input 
                type="text" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="********"
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

            {error && <div className="feature-error" style={{ marginBottom: '1rem' }}>{error}</div>}

            <motion.button
              whileHover={password.trim() && !isProcessing ? { scale: 1.02 } : {}}
              onClick={processFile}
              disabled={!password.trim() || isProcessing}
              className="feature-btn"
              style={{
                width: '100%',
                background: password.trim()
                  ? 'linear-gradient(135deg,rgba(0,255,150,0.8),rgba(0,180,255,0.8))'
                  : 'rgba(255,255,255,0.05)',
                color: password.trim() ? '#fff' : 'var(--muted)',
                border: 'none',
                boxShadow: password.trim() ? '0 4px 16px rgba(0,255,150,0.3)' : 'none',
              }}
            >
              {isProcessing ? (
                <><motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8 }}><RefreshCw size={14} /></motion.div> Processing…</>
              ) : (
                <>{mode === 'lock' ? <Lock size={14} /> : <Unlock size={14} />} {mode === 'lock' ? 'Apply Lock' : 'Remove Password'}</>
              )}
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
