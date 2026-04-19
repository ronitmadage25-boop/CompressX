// hooks/useCompression.ts
// Manages the full upload → compress (SSE) → download pipeline with state

import { useState, useRef, useCallback } from 'react';
import {
  CompressionJob,
  CompressionStatus,
  CompressionResult,
  CompressionOptions,
  SupportedFileType,
  UploadResponse,
} from '@/types';
import { v4 as uuidv4 } from 'uuid';

export interface UseCompressionReturn {
  job: CompressionJob | null;
  result: CompressionResult | null;
  isProcessing: boolean;
  upload: (file: File) => Promise<UploadResponse>;
  compress: (
    uploadResponse: UploadResponse,
    targetBytes: number,
    options?: CompressionOptions
  ) => Promise<void>;
  reset: () => void;
  cancel: () => void;
  downloadResult: () => void;
}

const STEPS = [
  { id: 'upload', label: 'Uploading' },
  { id: 'analyzing', label: 'Analyzing' },
  { id: 'compressing', label: 'Compressing' },
  { id: 'optimizing', label: 'Optimizing' },
  { id: 'finalizing', label: 'Finalizing' },
];

function buildJob(
  uploadResponse: UploadResponse,
  targetBytes: number
): CompressionJob {
  return {
    id: uuidv4(),
    fileName: uploadResponse.fileName,
    originalName: uploadResponse.originalName,
    fileType: uploadResponse.fileType,
    mimeType: uploadResponse.mimeType,
    originalSize: uploadResponse.size,
    targetSize: targetBytes,
    status: 'uploading',
    progress: 0,
    createdAt: new Date(),
    steps: STEPS.map(s => ({ ...s, status: 'pending' })),
  };
}

export function useCompression(): UseCompressionReturn {
  const [job, setJob] = useState<CompressionJob | null>(null);
  const [result, setResult] = useState<CompressionResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const resultRef = useRef<CompressionResult | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const updateJob = useCallback((updates: Partial<CompressionJob>) => {
    setJob(prev => prev ? { ...prev, ...updates } : null);
  }, []);

  const setStepStatus = useCallback((statusId: string, stepStatus: 'pending' | 'active' | 'done' | 'error') => {
    setJob(prev => {
      if (!prev) return null;
      const statusOrder = ['uploading', 'analyzing', 'compressing', 'optimizing', 'finalizing'];
      const statusToStepId: Record<string, string> = {
        uploading: 'upload',
        analyzing: 'analyzing',
        compressing: 'compressing',
        optimizing: 'optimizing',
        finalizing: 'finalizing',
      };
      const targetStepId = statusToStepId[statusId] ?? statusId;

      return {
        ...prev,
        steps: prev.steps.map(step => {
          if (step.id === targetStepId) return { ...step, status: stepStatus, startedAt: stepStatus === 'active' ? new Date() : step.startedAt };
          return step;
        }),
      };
    });
  }, []);

  const upload = useCallback(async (file: File): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      console.log('[Upload] Starting upload for file:', file.name, 'Size:', file.size);

      // Add timeout protection for upload
      const uploadPromise = fetch('/api/upload', {
        method: 'POST',
        body: formData
      });

      const timeoutPromise = new Promise<Response>((_, reject) => {
        setTimeout(() => reject(new Error('Upload timeout after 60 seconds')), 60000);
      });

      const res = await Promise.race([uploadPromise, timeoutPromise]);

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Upload failed');
      }

      const result = await res.json() as UploadResponse;
      console.log('[Upload] Upload successful:', result);
      return result;
    } catch (err) {
      console.error('[Upload] Upload failed:', err);
      // Re-throw the error so the UI can display the specific error message
      throw err;
    }
  }, []);

  const compress = useCallback(async (
    uploadResponse: UploadResponse,
    targetBytes: number,
    options: CompressionOptions = {}
  ): Promise<void> => {
    setIsProcessing(true);
    setResult(null);
    resultRef.current = null;

    const newJob = buildJob(uploadResponse, targetBytes);
    setJob(newJob);

    // First, test if the endpoint is accessible with a health check
    try {
      console.log('[Compression] Testing compress endpoint health...');
      const healthCheck = await fetch('/api/compress?health=check', {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      });

      if (!healthCheck.ok) {
        throw new Error(`Compress endpoint not accessible: ${healthCheck.status} ${healthCheck.statusText}`);
      }

      const healthData = await healthCheck.json();
      console.log('[Compression] Health check response:', healthData);

      if (healthData.status !== 'ok') {
        throw new Error('Compress endpoint health check failed');
      }

      console.log('[Compression] Compress endpoint health check passed');
    } catch (error) {
      console.error('[Compression] Compress endpoint health check failed:', error);
      setJob(prev => prev ? {
        ...prev,
        status: 'error',
        error: `Compression service unavailable: ${error instanceof Error ? error.message : 'Unknown error'}`
      } : null);
      setIsProcessing(false);
      return;
    }

    // Start compression job using POST request
    let jobId: string;
    try {
      console.log('[Compression] Starting compression job...');
      const startResponse = await fetch('/api/compress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: uploadResponse.fileId,
          targetBytes,
          mimeType: uploadResponse.mimeType,
          originalName: uploadResponse.originalName,
          options
        })
      });

      if (!startResponse.ok) {
        const errorData = await startResponse.json();
        throw new Error(errorData.error || 'Failed to start compression');
      }

      const startData = await startResponse.json();
      jobId = startData.jobId;
      console.log('[Compression] Job started with ID:', jobId);

    } catch (error) {
      console.error('[Compression] Failed to start compression job:', error);
      setJob(prev => prev ? {
        ...prev,
        status: 'error',
        error: `Failed to start compression: ${error instanceof Error ? error.message : 'Unknown error'}`
      } : null);
      setIsProcessing(false);
      return;
    }

    // Poll for job status
    return new Promise<void>((resolve) => {
      let pollCount = 0;
      const maxPolls = 300; // 5 minutes at 1-second intervals

      const pollStatus = async () => {
        try {
          pollCount++;
          console.log(`[Compression] Polling status (${pollCount}/${maxPolls}) for job:`, jobId);

          const statusResponse = await fetch(`/api/compress?jobId=${jobId}`, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            }
          });

          if (!statusResponse.ok) {
            if (statusResponse.status === 404) {
              throw new Error('Compression job not found or expired');
            }
            throw new Error(`Status check failed: ${statusResponse.status}`);
          }

          const statusData = await statusResponse.json();
          console.log('[Compression] Status update:', statusData);

          // Update job status
          const { status, progress, detail, result, error } = statusData;

          // Map status to UI steps
          const statusToStep: Record<string, string> = {
            starting: 'upload',
            uploading: 'upload',
            analyzing: 'analyzing',
            compressing: 'compressing',
            optimizing: 'optimizing',
            finalizing: 'finalizing',
          };

          const order = ['upload', 'analyzing', 'compressing', 'optimizing', 'finalizing'];
          const currentIdx = order.indexOf(statusToStep[status] ?? status);

          setJob(prev => {
            if (!prev) return null;
            return {
              ...prev,
              status: status as CompressionStatus,
              progress: progress || 0,
              steps: prev.steps.map((step, idx) => {
                if (idx < currentIdx) return { ...step, status: 'done' };
                if (idx === currentIdx) return { ...step, status: 'active', startedAt: step.startedAt ?? new Date() };
                return { ...step, status: 'pending' };
              }),
            };
          });

          // Handle completion
          if (status === 'complete' && result) {
            console.log('[Compression] Compression completed:', result);
            resultRef.current = result;
            setResult(result);

            setJob(prev => prev ? {
              ...prev,
              status: 'complete',
              progress: 100,
              compressedSize: result.compressedSize,
              compressionRatio: result.compressionRatio,
              completedAt: new Date(),
              downloadUrl: result.downloadUrl,
              iterations: result.iterations,
              steps: prev.steps.map(s => ({ ...s, status: 'done' })),
            } : null);

            setIsProcessing(false);
            resolve();
            return;
          }

          // Handle error
          if (status === 'error') {
            console.error('[Compression] Compression failed:', error);
            setJob(prev => prev ? {
              ...prev,
              status: 'error',
              error: error || 'Compression failed',
              steps: prev.steps.map(s => s.status === 'active' ? { ...s, status: 'error' } : s),
            } : null);

            setIsProcessing(false);
            resolve();
            return;
          }

          // Continue polling if job is still running
          if (pollCount < maxPolls) {
            setTimeout(pollStatus, 1000); // Poll every 1 second
          } else {
            // Timeout
            console.error('[Compression] Polling timeout after', maxPolls, 'attempts');
            setJob(prev => prev ? {
              ...prev,
              status: 'error',
              error: 'Compression timeout - operation took too long'
            } : null);
            setIsProcessing(false);
            resolve();
          }

        } catch (pollError) {
          console.error('[Compression] Polling error:', pollError);
          setJob(prev => prev ? {
            ...prev,
            status: 'error',
            error: `Status check failed: ${pollError instanceof Error ? pollError.message : 'Unknown error'}`
          } : null);
          setIsProcessing(false);
          resolve();
        }
      };

      // Start polling
      pollStatus();
    });
  }, []);

  const cancel = useCallback(() => {
    // Note: With polling approach, we can't actually cancel the server-side job
    // but we can stop polling and reset the UI state
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIsProcessing(false);
    setJob(prev => prev ? { ...prev, status: 'error', error: 'Cancelled by user' } : null);
  }, []);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setJob(null);
    setResult(null);
    setIsProcessing(false);
    resultRef.current = null;
  }, []);

  const downloadResult = useCallback(() => {
    const r = resultRef.current ?? result;
    if (!r?.downloadUrl) return;
    const a = document.createElement('a');
    a.href = r.downloadUrl;
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [result]);

  return { job, result, isProcessing, upload, compress, reset, cancel, downloadResult };
}
