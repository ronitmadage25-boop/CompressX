// lib/compression/orchestrator.ts
// Routes compression jobs to the correct engine, manages temp files, emits SSE progress
// Vercel-compatible version with proper temp directory handling

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { CompressionJob, CompressionOptions, CompressionResult, SupportedFileType } from '@/types';
import { compressImageToTarget } from './imageCompressor';
import { compressPDFToTarget } from './pdfCompressor';
import { compressOfficeToTarget } from './officeCompressor';

// Use /tmp for Vercel serverless compatibility
export const UPLOAD_DIR = '/tmp/compressx/uploads';
export const OUTPUT_DIR = '/tmp/compressx/outputs';

export async function ensureDirs() {
  try {
    console.log('[Orchestrator] Ensuring directories exist:', { UPLOAD_DIR, OUTPUT_DIR });
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    console.log('[Orchestrator] Directories created successfully');
  } catch (error) {
    console.error('[Orchestrator] Directory creation failed:', error);
    // Don't throw here, let the caller handle it
  }
}

export function detectFileType(mimeType: string, fileName: string): SupportedFileType {
  if (mimeType.startsWith('image/')) return 'image';
  // Video compression disabled for Vercel compatibility (no FFmpeg)
  // if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) return 'pdf';
  if (mimeType.includes('wordprocessingml') || fileName.endsWith('.docx')) return 'docx';
  if (mimeType.includes('presentationml') || fileName.endsWith('.pptx')) return 'pptx';

  // Reject video files since FFmpeg is not available on Vercel
  if (mimeType.startsWith('video/')) {
    throw new Error('Video compression is not available in the serverless environment. Please use image, PDF, or Office documents.');
  }

  throw new Error(`Unsupported file type: ${mimeType}`);
}

export function getOutputExtension(fileType: SupportedFileType, options?: CompressionOptions): string {
  switch (fileType) {
    case 'image': return '.' + (options?.imageFormat ?? 'jpg');
    case 'pdf': return '.pdf';
    case 'docx': return '.docx';
    case 'pptx': return '.pptx';
    // Video removed for Vercel compatibility
    default: return '.bin';
  }
}

export type ProgressCallback = (
  status: string,
  progress: number,
  detail?: string
) => void;

export async function runCompression(
  inputPath: string,
  fileType: SupportedFileType,
  mimeType: string,
  targetBytes: number,
  options: CompressionOptions = {},
  onProgress?: ProgressCallback
): Promise<CompressionResult> {
  console.log('[Orchestrator] Starting compression:', { inputPath, fileType, mimeType, targetBytes });

  try {
    await ensureDirs();
  } catch (error) {
    console.error('[Orchestrator] Failed to ensure directories:', error);
    throw new Error(`Failed to create temp directories: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  const jobId = uuidv4();
  const ext = getOutputExtension(fileType, options);
  const outputPath = path.join(OUTPUT_DIR, `${jobId}${ext}`);
  const startTime = Date.now();

  console.log('[Orchestrator] Paths:', { inputPath, outputPath });

  let originalStat;
  try {
    originalStat = await fs.stat(inputPath);
  } catch (error) {
    console.error('[Orchestrator] Failed to stat input file:', error);
    throw new Error(`Input file not accessible: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  const originalSize = originalStat.size;
  console.log('[Orchestrator] Original file size:', originalSize);

  let compressedSize = 0;
  let iterations = 0;

  try {
    console.log('[Orchestrator] Processing file type:', fileType);

    // Add overall timeout protection for the entire compression process
    let compressionPromise: Promise<any>;

    switch (fileType) {
      case 'image': {
        console.log('[Orchestrator] Starting image compression');
        onProgress?.('analyzing', 8, 'Reading image metadata');
        compressionPromise = compressImageToTarget(inputPath, outputPath, targetBytes, options, (p) => {
          onProgress?.(
            p.phase === 'metadata' ? 'analyzing' :
              p.phase === 'quality-search' ? 'compressing' :
                p.phase === 'scale-search' ? 'optimizing' : 'finalizing',
            p.progress,
            p.phase === 'quality-search' ? `Quality: ${p.quality ?? 0}, Size: ${formatBytes(p.currentSize)}` :
              p.phase === 'scale-search' ? `Scale: ${Math.round((p.scale ?? 1) * 100)}%, Q: ${p.quality ?? 0}` : ''
          );
        });
        break;
      }

      case 'pdf': {
        console.log('[Orchestrator] Starting PDF compression');
        onProgress?.('analyzing', 8, 'Loading PDF document');
        compressionPromise = compressPDFToTarget(inputPath, outputPath, targetBytes, options, (p) => {
          onProgress?.(
            p.phase === 'load' || p.phase === 'analyze' ? 'analyzing' :
              p.phase === 'images' || p.phase === 'quality-loop' ? 'compressing' :
                p.phase === 'rebuild' ? 'optimizing' : 'finalizing',
            p.progress,
            p.detail ?? `Pages: ${p.totalPages ?? 0}, Images: ${p.imagesFound ?? 0}`
          );
        });
        break;
      }

      case 'docx':
      case 'pptx': {
        console.log('[Orchestrator] Starting Office compression');
        onProgress?.('analyzing', 8, 'Unpacking Office document');
        compressionPromise = compressOfficeToTarget(inputPath, outputPath, targetBytes, fileType, options, (p) => {
          onProgress?.(
            p.phase === 'load' || p.phase === 'analyze' ? 'analyzing' :
              p.phase === 'xml' ? 'compressing' :
                p.phase === 'images' || p.phase === 'quality-loop' ? 'optimizing' : 'finalizing',
            p.progress,
            p.detail ?? `Files: ${p.filesProcessed ?? 0}/${p.totalFiles ?? 0}`
          );
        });
        break;
      }

      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }

    // Add overall timeout for the compression process (4 minutes for Vercel)
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Compression process timeout - operation took too long')), 240000);
    });

    const result = await Promise.race([compressionPromise, timeoutPromise]);
    compressedSize = result.compressedSize;
    iterations = result.iterations;
    console.log('[Orchestrator] Compression completed:', { compressedSize, iterations });

  } catch (err: unknown) {
    console.error('[Orchestrator] Compression failed:', err);
    console.error('[Orchestrator] Error details:', err instanceof Error ? err.stack : 'No stack trace');
    await fs.unlink(outputPath).catch(() => { });
    throw err;
  }

  const timeTakenMs = Date.now() - startTime;
  const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

  return {
    jobId,
    success: true,
    originalSize,
    compressedSize,
    compressionRatio,
    iterations,
    timeTakenMs,
    downloadUrl: `/api/download/${jobId}${ext}`,
    metadata: { outputPath },
  };
}

function formatBytes(b: number): string {
  if (b < 1024) return b + 'B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + 'KB';
  return (b / (1024 * 1024)).toFixed(2) + 'MB';
}
