// app/api/compress-cloudinary/route.ts
// Pure in-memory compression endpoint — NO Cloudinary required
// Accepts file + targetBytes via FormData, returns compressed file as base64 data URL

import { NextRequest, NextResponse } from 'next/server';
import { compressImageBuffer, compressPDFBuffer, compressOfficeBuffer } from '@/lib/compression/bufferCompressor';
import { CompressionOptions, SupportedFileType } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max
export const runtime = 'nodejs';

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

function detectFileType(mimeType: string, fileName: string): SupportedFileType {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) return 'pdf';
  if (mimeType.includes('wordprocessingml') || fileName.endsWith('.docx')) return 'docx';
  if (mimeType.includes('presentationml') || fileName.endsWith('.pptx')) return 'pptx';
  throw new Error(`Unsupported file type: ${mimeType}`);
}

function getOutputMimeType(fileType: SupportedFileType, options: CompressionOptions): string {
  switch (fileType) {
    case 'image': {
      const fmt = options.imageFormat ?? 'jpeg';
      if (fmt === 'webp') return 'image/webp';
      if (fmt === 'png') return 'image/png';
      return 'image/jpeg';
    }
    case 'pdf': return 'application/pdf';
    case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    default: return 'application/octet-stream';
  }
}

function getOutputExtension(fileType: SupportedFileType, options: CompressionOptions): string {
  switch (fileType) {
    case 'image': return options.imageFormat === 'webp' ? 'webp' : options.imageFormat === 'png' ? 'png' : 'jpg';
    case 'pdf': return 'pdf';
    case 'docx': return 'docx';
    case 'pptx': return 'pptx';
    default: return 'bin';
  }
}

// Health check
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    runtime: 'nodejs',
    engine: 'in-memory (no Cloudinary)',
    maxFileSize: MAX_FILE_SIZE,
  });
}

export async function POST(request: NextRequest) {
  console.log('[Compress API] POST received — in-memory compression engine');

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const targetBytesStr = formData.get('targetBytes') as string | null;
    const optionsStr = formData.get('options') as string | null;

    // — Validate inputs —
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!targetBytesStr) {
      return NextResponse.json({ error: 'Target size not specified' }, { status: 400 });
    }

    const targetBytes = parseInt(targetBytesStr, 10);
    if (isNaN(targetBytes) || targetBytes <= 0) {
      return NextResponse.json({ error: 'Invalid target size' }, { status: 400 });
    }

    console.log('[Compress API] File:', file.name, 'Size:', file.size, 'Target:', targetBytes);

    // — File size validation —
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 413 }
      );
    }

    if (targetBytes >= file.size) {
      return NextResponse.json(
        { error: `Target size (${targetBytes} bytes) must be smaller than original (${file.size} bytes)` },
        { status: 400 }
      );
    }

    if (targetBytes < 1024) {
      return NextResponse.json({ error: 'Target size too small. Minimum is 1 KB.' }, { status: 400 });
    }

    // — Normalize MIME type from extension —
    let mimeType = file.type;
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (ext === 'pptx') mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    if (ext === 'pdf') mimeType = 'application/pdf';

    if (!ALLOWED_MIME_TYPES.has(mimeType) && !mimeType.startsWith('image/')) {
      return NextResponse.json(
        { error: `File type not supported: ${mimeType}` },
        { status: 415 }
      );
    }

    // — Detect file type —
    let fileType: SupportedFileType;
    try {
      fileType = detectFileType(mimeType, file.name);
    } catch (error) {
      return NextResponse.json({ error: (error as Error).message }, { status: 415 });
    }

    // — Parse options —
    const options: CompressionOptions = optionsStr ? JSON.parse(optionsStr) : {};

    // — Read file into buffer —
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const originalSize = fileBuffer.length;

    console.log('[Compress API] Starting in-memory compression for:', fileType);

    // — Compress —
    let compressedBuffer: Buffer;
    let iterations = 0;

    try {
      switch (fileType) {
        case 'image': {
          console.log('[Compress API] Compressing image to target:', targetBytes);
          const result = await compressImageBuffer(
            fileBuffer,
            targetBytes,
            options,
            (progress) => {
              console.log('[Compress API] Image progress:', progress.phase, progress.progress + '%');
            }
          );
          compressedBuffer = result.buffer;
          iterations = result.iterations;
          break;
        }

        case 'pdf': {
          console.log('[Compress API] Compressing PDF to target:', targetBytes);
          const result = await compressPDFBuffer(
            fileBuffer,
            targetBytes,
            options,
            (progress) => {
              console.log('[Compress API] PDF progress:', progress.phase, progress.progress + '%');
            }
          );
          compressedBuffer = result.buffer;
          iterations = result.iterations;
          break;
        }

        case 'docx':
        case 'pptx': {
          console.log('[Compress API] Compressing Office doc to target:', targetBytes);
          const result = await compressOfficeBuffer(
            fileBuffer,
            targetBytes,
            fileType,
            options,
            (progress) => {
              console.log('[Compress API] Office progress:', progress.phase, progress.progress + '%');
            }
          );
          compressedBuffer = result.buffer;
          iterations = result.iterations;
          break;
        }

        default:
          return NextResponse.json({ error: `Unsupported file type: ${fileType}` }, { status: 415 });
      }
    } catch (compressionError) {
      console.error('[Compress API] Compression failed:', compressionError);
      return NextResponse.json(
        { error: `Compression failed: ${compressionError instanceof Error ? compressionError.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    const compressedSize = compressedBuffer.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;

    console.log('[Compress API] Compression complete:', {
      originalSize,
      compressedSize,
      targetBytes,
      iterations,
      compressionRatio: compressionRatio.toFixed(2) + '%',
    });

    // — Encode as base64 data URL for direct client download —
    const outputMime = getOutputMimeType(fileType, options);
    const outputExt = getOutputExtension(fileType, options);
    const base64 = compressedBuffer.toString('base64');
    const dataUrl = `data:${outputMime};base64,${base64}`;

    // Output filename: original name with compressed_ prefix and possibly new extension
    const baseNameNoExt = file.name.replace(/\.[^/.]+$/, '');
    const downloadFileName = `compressed_${baseNameNoExt}.${outputExt}`;

    return NextResponse.json({
      success: true,
      originalSize,
      compressedSize,
      compressionRatio: parseFloat(compressionRatio.toFixed(2)),
      iterations,
      downloadUrl: dataUrl,  // base64 data URL — no external service needed
      publicId: `local_${Date.now()}`,
      fileName: downloadFileName,
      metadata: {
        originalFileName: file.name,
        mimeType: outputMime,
        fileType,
        targetBytes,
        withinTarget: compressedSize <= targetBytes,
      },
    });

  } catch (error: unknown) {
    console.error('[Compress API] Unexpected error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Compression failed',
      },
      { status: 500 }
    );
  }
}
