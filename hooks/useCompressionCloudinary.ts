// hooks/useCompressionCloudinary.ts
// In-memory compression hook — no Cloudinary, pure server-side Sharp/pdf-lib compression

import { useState, useRef, useCallback } from 'react';
import { CompressionOptions } from '@/types';

export interface CloudinaryCompressionJob {
  id: string;
  fileName: string;
  originalSize: number;
  targetSize: number;
  status: 'uploading' | 'compressing' | 'complete' | 'error';
  progress: number;
  createdAt: Date;
  error?: string;
}

export interface CloudinaryCompressionResult {
  success: boolean;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  iterations: number;
  downloadUrl: string;   // base64 data URL or Cloudinary URL
  publicId: string;
  fileName: string;
  withinTarget?: boolean;
}

export interface UseCompressionCloudinaryReturn {
  job: CloudinaryCompressionJob | null;
  result: CloudinaryCompressionResult | null;
  isProcessing: boolean;
  compressFile: (file: File, targetBytes: number, options?: CompressionOptions) => Promise<void>;
  reset: () => void;
  cancel: () => void;
  downloadResult: () => void;
}

export function useCompressionCloudinary(): UseCompressionCloudinaryReturn {
  const [job, setJob] = useState<CloudinaryCompressionJob | null>(null);
  const [result, setResult] = useState<CloudinaryCompressionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const resultRef = useRef<CloudinaryCompressionResult | null>(null);

  const compressFile = useCallback(async (
    file: File,
    targetBytes: number,
    options: CompressionOptions = {}
  ): Promise<void> => {
    console.log('[Compression] Starting in-memory compression:', {
      fileName: file.name,
      size: file.size,
      targetBytes,
    });

    abortControllerRef.current = new AbortController();

    const newJob: CloudinaryCompressionJob = {
      id: `job_${Date.now()}`,
      fileName: file.name,
      originalSize: file.size,
      targetSize: targetBytes,
      status: 'uploading',
      progress: 10,
      createdAt: new Date(),
    };

    setJob(newJob);
    setResult(null);
    resultRef.current = null;
    setIsProcessing(true);

    try {
      // Build multipart form
      const formData = new FormData();
      formData.append('file', file);
      formData.append('targetBytes', targetBytes.toString());
      if (Object.keys(options).length > 0) {
        formData.append('options', JSON.stringify(options));
      }

      // Show "compressing" state while waiting for response
      setJob(prev => prev ? { ...prev, status: 'compressing', progress: 30 } : null);

      // POST to in-memory compression endpoint
      const response = await fetch('/api/compress-cloudinary', {
        method: 'POST',
        body: formData,
        signal: abortControllerRef.current.signal,
      });

      // Simulate progress during long compression
      const progressInterval = setInterval(() => {
        setJob(prev => {
          if (!prev || prev.status !== 'compressing') return prev;
          const nextProgress = Math.min(prev.progress + Math.random() * 5, 88);
          return { ...prev, progress: Math.round(nextProgress) };
        });
      }, 800);

      let data: any;
      try {
        if (!response.ok) {
          clearInterval(progressInterval);
          const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }
        data = await response.json();
      } finally {
        clearInterval(progressInterval);
      }

      if (!data.success) {
        throw new Error(data.error || 'Compression failed');
      }

      console.log('[Compression] Complete:', {
        original: data.originalSize,
        compressed: data.compressedSize,
        target: targetBytes,
        ratio: data.compressionRatio,
        withinTarget: data.metadata?.withinTarget,
      });

      const compressionResult: CloudinaryCompressionResult = {
        success: data.success,
        originalSize: data.originalSize,
        compressedSize: data.compressedSize,
        compressionRatio: data.compressionRatio,
        iterations: data.iterations,
        downloadUrl: data.downloadUrl,
        publicId: data.publicId,
        fileName: data.fileName,
        withinTarget: data.metadata?.withinTarget,
      };

      resultRef.current = compressionResult;
      setResult(compressionResult);
      setJob(prev => prev ? { ...prev, status: 'complete', progress: 100 } : null);
      setIsProcessing(false);

    } catch (error: unknown) {
      console.error('[Compression] Error:', error);

      if (error instanceof Error && error.name === 'AbortError') {
        setJob(prev => prev ? { ...prev, status: 'error', progress: 0, error: 'Cancelled by user' } : null);
      } else {
        const errorMessage = error instanceof Error ? error.message : 'Compression failed';
        setJob(prev => prev ? { ...prev, status: 'error', progress: 0, error: errorMessage } : null);
      }

      setIsProcessing(false);
      throw error;
    }
  }, []);

  const reset = useCallback(() => {
    setJob(null);
    setResult(null);
    resultRef.current = null;
    setIsProcessing(false);
    abortControllerRef.current = null;
  }, []);

  const cancel = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      console.log('[Compression] Cancelled');
    }
    setIsProcessing(false);
    setJob(prev => prev ? { ...prev, status: 'error', progress: 0, error: 'Cancelled by user' } : null);
  }, []);

  const downloadResult = useCallback(() => {
    const r = resultRef.current ?? result;
    if (!r?.downloadUrl) {
      console.warn('[Compression] No download URL available');
      return;
    }

    console.log('[Compression] Downloading file:', r.fileName);

    const a = document.createElement('a');
    a.href = r.downloadUrl;
    a.download = r.fileName;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();

    setTimeout(() => {
      document.body.removeChild(a);
    }, 100);
  }, [result]);

  return {
    job,
    result,
    isProcessing,
    compressFile,
    reset,
    cancel,
    downloadResult,
  };
}
