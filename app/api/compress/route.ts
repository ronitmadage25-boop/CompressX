// app/api/compress/route.ts
// Polling-based compression endpoint optimized for Vercel serverless
// Replaces SSE with status polling for better Vercel compatibility

import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs/promises';
import { UPLOAD_DIR, runCompression, detectFileType } from '@/lib/compression/orchestrator';
import { CompressionOptions } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max
export const runtime = 'nodejs'; // Ensure Node.js runtime for Vercel

// In-memory job status store (for serverless, this resets per function instance)
const jobStatus = new Map<string, {
  status: string;
  progress: number;
  detail?: string;
  result?: any;
  error?: string;
  startTime: number;
}>();

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Cache-Control',
    },
  });
}

export async function GET(request: NextRequest) {
  console.log('[Compress API] GET Request received:', request.url);

  const { searchParams } = request.nextUrl;

  // Health check endpoint
  if (searchParams.get('health') === 'check') {
    console.log('[Compress API] Health check requested');
    return NextResponse.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      runtime: 'nodejs',
      vercel: process.env.VERCEL_ENV || 'local',
      uploadDir: UPLOAD_DIR
    });
  }

  // Status polling endpoint
  const jobId = searchParams.get('jobId');
  if (jobId) {
    console.log('[Compress API] Status poll for job:', jobId);
    const status = jobStatus.get(jobId);

    if (!status) {
      return NextResponse.json({
        error: 'Job not found or expired'
      }, { status: 404 });
    }

    // Clean up completed/failed jobs after 5 minutes
    const age = Date.now() - status.startTime;
    if (age > 300000 && (status.status === 'complete' || status.status === 'error')) {
      jobStatus.delete(jobId);
    }

    return NextResponse.json({
      jobId,
      status: status.status,
      progress: status.progress,
      detail: status.detail,
      result: status.result,
      error: status.error,
      timestamp: new Date().toISOString()
    });
  }

  return NextResponse.json({
    error: 'Invalid request. Use POST to start compression or GET with jobId to check status.'
  }, { status: 400 });
}

export async function POST(request: NextRequest) {
  console.log('[Compress API] POST Request received');
  console.log('[Compress API] User-Agent:', request.headers.get('user-agent'));
  console.log('[Compress API] Vercel Environment:', process.env.VERCEL_ENV);

  try {
    const body = await request.json();
    const { fileId, targetBytes, mimeType, originalName, options = {} } = body;

    console.log('[Compress API] Parameters:', { fileId, targetBytes, mimeType, originalName, options });

    // Validate inputs
    if (!fileId) {
      return NextResponse.json({ error: 'Missing required parameter: fileId' }, { status: 400 });
    }

    if (!targetBytes || targetBytes <= 0) {
      return NextResponse.json({ error: 'Missing or invalid targetBytes parameter' }, { status: 400 });
    }

    // Compression options
    const compressionOptions: CompressionOptions = {
      imageFormat: (options.imageFormat as 'jpeg' | 'webp' | 'png') ?? 'jpeg',
      stripThumbnails: options.stripThumbnails === true,
      stripMedia: options.stripMedia === true,
      preserveExif: options.preserveExif === true,
    };

    console.log('[Compress API] Compression options:', compressionOptions);

    // Find uploaded file
    const ext = originalName.split('.').pop()?.toLowerCase() ?? '';
    const inputPath = path.join(UPLOAD_DIR, `${fileId}.${ext}`);

    try {
      await fs.access(inputPath);
      console.log('[Compress API] Input file found:', inputPath);
    } catch (error) {
      console.log('[Compress API] Input file not found:', inputPath, error);
      return NextResponse.json({ error: 'Uploaded file not found. Please re-upload.' }, { status: 404 });
    }

    // Validate target vs original
    const stat = await fs.stat(inputPath);
    console.log('[Compress API] File stats:', { size: stat.size, targetBytes });

    if (targetBytes >= stat.size) {
      return NextResponse.json({
        error: `Target size (${targetBytes} bytes) must be smaller than original (${stat.size} bytes)`
      }, { status: 400 });
    }

    if (targetBytes < 1024) {
      return NextResponse.json({ error: 'Target size too small. Minimum is 1 KB.' }, { status: 400 });
    }

    // Detect file type
    let fileType;
    try {
      fileType = detectFileType(mimeType, originalName);
      console.log('[Compress API] Detected file type:', fileType);
    } catch (e) {
      console.log('[Compress API] File type detection failed:', e);
      return NextResponse.json({ error: (e as Error).message }, { status: 415 });
    }

    // Generate job ID and initialize status
    const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    jobStatus.set(jobId, {
      status: 'starting',
      progress: 0,
      detail: 'Initializing compression',
      startTime: Date.now()
    });

    console.log('[Compress API] Created job:', jobId);

    // Start compression in background (don't await)
    runCompressionJob(jobId, inputPath, fileType, mimeType, targetBytes, compressionOptions);

    // Return job ID immediately for polling
    return NextResponse.json({
      jobId,
      status: 'starting',
      progress: 0,
      detail: 'Compression job started',
      pollUrl: `/api/compress?jobId=${jobId}`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[Compress API] Error parsing request:', error);
    return NextResponse.json({ error: 'Invalid request format' }, { status: 400 });
  }
}

// Background compression job runner
async function runCompressionJob(
  jobId: string,
  inputPath: string,
  fileType: any,
  mimeType: string,
  targetBytes: number,
  options: CompressionOptions
) {
  const updateStatus = (status: string, progress: number, detail?: string) => {
    console.log('[Compress Job]', jobId, ':', { status, progress, detail });
    const currentStatus = jobStatus.get(jobId);
    if (currentStatus) {
      jobStatus.set(jobId, {
        ...currentStatus,
        status,
        progress,
        detail
      });
    }
  };

  try {
    updateStatus('uploading', 3, 'File received');

    console.log('[Compress Job] Starting compression for:', jobId);
    const result = await runCompression(
      inputPath,
      fileType,
      mimeType,
      targetBytes,
      options,
      (status, progress, detail) => {
        updateStatus(status, progress, detail);
      }
    );

    console.log('[Compress Job] Compression completed for:', jobId, result);

    const currentStatus = jobStatus.get(jobId);
    if (currentStatus) {
      jobStatus.set(jobId, {
        ...currentStatus,
        status: 'complete',
        progress: 100,
        detail: 'Compression completed',
        result
      });
    }

    // Clean up input file
    await fs.unlink(inputPath).catch(() => { });

  } catch (err: unknown) {
    console.error('[Compress Job] Error for:', jobId, err);
    console.error('[Compress Job] Error stack:', err instanceof Error ? err.stack : 'No stack trace');

    await fs.unlink(inputPath).catch(() => { });

    const currentStatus = jobStatus.get(jobId);
    if (currentStatus) {
      const errorMessage = err instanceof Error ? err.message : 'Compression failed';
      jobStatus.set(jobId, {
        ...currentStatus,
        status: 'error',
        error: errorMessage,
        detail: 'Compression failed'
      });
    }
  }
}