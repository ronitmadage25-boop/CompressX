// app/api/download/[filename]/route.ts
// Streams the compressed output file to the client, then schedules cleanup
// Vercel-optimized version with improved error handling

import { NextRequest, NextResponse } from 'next/server';
import { createReadStream, existsSync } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { OUTPUT_DIR } from '@/lib/compression/orchestrator';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Ensure Node.js runtime for Vercel

const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string } }
) {
  const filename = params.filename;

  // Security: prevent path traversal
  if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return NextResponse.json({ error: 'Invalid filename' }, { status: 400 });
  }

  const filePath = path.join(OUTPUT_DIR, filename);

  if (!existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found or expired' }, { status: 404 });
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const mimeType = MIME_MAP[ext] ?? 'application/octet-stream';

  try {
    const stat = await fs.stat(filePath);

    // Stream file to client with improved error handling
    const fileStream = createReadStream(filePath);

    // Schedule deletion after 3 minutes (reduced for Vercel)
    setTimeout(async () => {
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.log('File cleanup error:', error);
      }
    }, 3 * 60 * 1000); // 3 minutes

    const readableStream = new ReadableStream({
      start(controller) {
        fileStream.on('data', (chunk: string | Buffer) => {
          try {
            // Ensure chunk is a Buffer before enqueuing
            const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
            controller.enqueue(buffer);
          } catch (error) {
            console.error('Stream chunk error:', error);
            controller.error(error);
          }
        });
        
        fileStream.on('end', () => {
          try {
            controller.close();
          } catch (error) {
            console.log('Stream close error:', error);
          }
        });
        
        fileStream.on('error', (err) => {
          console.error('File stream error:', err);
          controller.error(err);
        });
      },
      cancel() {
        try {
          fileStream.destroy();
        } catch (error) {
          console.log('Stream cancel error:', error);
        }
      },
    });

    // Extract extension and create compressx_RM filename
    const downloadName = `compressx_RM.${ext}`;

    return new Response(readableStream, {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': stat.size.toString(),
        'Content-Disposition': `attachment; filename="${downloadName}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Content-Type-Options': 'nosniff',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Failed to download file' }, 
      { status: 500 }
    );
  }
}
