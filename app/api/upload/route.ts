// app/api/upload/route.ts
// Handles multipart file uploads, validates file type/size, saves to temp dir
// Vercel-optimized version with improved error handling

import { NextRequest, NextResponse } from 'next/server';
import { writeFile } from 'fs/promises';
import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { UPLOAD_DIR, ensureDirs, detectFileType } from '@/lib/compression/orchestrator';
import { UploadResponse } from '@/types';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs'; // Ensure Node.js runtime for Vercel

const MAX_FILE_SIZE = 100 * 1024 * 1024; // Reduced to 100MB for Vercel compatibility

// Health check endpoint
export async function GET(request: NextRequest) {
  console.log('[Upload API] Health check requested');
  return NextResponse.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    runtime: 'nodejs',
    vercel: process.env.VERCEL_ENV || 'local',
    uploadDir: UPLOAD_DIR,
    maxFileSize: MAX_FILE_SIZE
  });
}

const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  // Video types removed for Vercel compatibility (no FFmpeg)
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/msword',
  'application/vnd.ms-powerpoint',
]);

// Validate image buffer integrity by checking file headers and structure
function validateImageBuffer(buffer: Buffer, mimeType: string): boolean {
  if (buffer.length < 8) {
    console.error('[Upload] Buffer too small for image validation:', buffer.length);
    return false;
  }
  
  try {
    switch (mimeType) {
      case 'image/jpeg':
        // JPEG files start with FF D8 (SOI - Start of Image)
        if (!(buffer[0] === 0xFF && buffer[1] === 0xD8)) {
          console.error('[Upload] Invalid JPEG header - missing SOI marker:', buffer.subarray(0, 4).toString('hex'));
          return false;
        }
        
        // Look for JPEG end marker (FF D9) anywhere in the last 1KB
        // Some JPEGs have metadata after the EOI marker, so we search in a range
        const searchStart = Math.max(0, buffer.length - 1024);
        let hasEOI = false;
        
        for (let i = searchStart; i < buffer.length - 1; i++) {
          if (buffer[i] === 0xFF && buffer[i + 1] === 0xD9) {
            hasEOI = true;
            break;
          }
        }
        
        if (!hasEOI) {
          console.warn('[Upload] JPEG end marker not found in last 1KB - might be corrupted, but allowing upload');
          // Don't fail for missing EOI - let Sharp handle it during compression
        }
        
        console.log('[Upload] JPEG validation passed - SOI found, EOI:', hasEOI ? 'found' : 'not found');
        return true;
        
      case 'image/png':
        // PNG files start with 89 50 4E 47 0D 0A 1A 0A
        const pngHeader = buffer.subarray(0, 8);
        const expectedPngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
        if (!pngHeader.equals(expectedPngHeader)) {
          console.error('[Upload] Invalid PNG header:', pngHeader.toString('hex'));
          return false;
        }
        
        console.log('[Upload] PNG validation passed');
        return true;
               
      case 'image/webp':
        // WebP files start with RIFF....WEBP
        if (buffer.subarray(0, 4).toString() !== 'RIFF') {
          console.error('[Upload] Invalid WebP RIFF header');
          return false;
        }
        if (buffer.subarray(8, 12).toString() !== 'WEBP') {
          console.error('[Upload] Invalid WebP format identifier');
          return false;
        }
        
        console.log('[Upload] WebP validation passed');
        return true;
               
      case 'image/gif':
        // GIF files start with GIF87a or GIF89a
        const gifHeader = buffer.subarray(0, 6).toString();
        if (gifHeader !== 'GIF87a' && gifHeader !== 'GIF89a') {
          console.error('[Upload] Invalid GIF header:', gifHeader);
          return false;
        }
        
        console.log('[Upload] GIF validation passed');
        return true;
        
      default:
        // For other image types, just check if buffer is not empty
        console.log('[Upload] Generic image validation for type:', mimeType);
        return buffer.length > 0;
    }
  } catch (error) {
    console.error('[Upload] Buffer validation error:', error);
    return false;
  }
}

// Validate JPEG structure to catch corruption (simplified for speed)
function validateJPEGStructure(buffer: Buffer): boolean {
  // This function is no longer used - basic SOI validation is sufficient
  // Sharp will handle detailed validation during compression
  return true;
}

// Validate PDF buffer integrity by checking PDF header
function validatePDFBuffer(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;
  
  try {
    // PDF files start with %PDF-
    const header = buffer.subarray(0, 5).toString();
    if (header !== '%PDF-') {
      console.error('[Upload] Invalid PDF header:', header);
      return false;
    }
    
    // Check for PDF version (should be something like %PDF-1.4, %PDF-1.7, etc.)
    const versionPart = buffer.subarray(5, 8).toString();
    const versionRegex = /^\d\.\d$/;
    if (!versionRegex.test(versionPart)) {
      console.error('[Upload] Invalid PDF version:', versionPart);
      return false;
    }
    
    // Look for EOF marker somewhere in the file (%%EOF)
    const fileContent = buffer.toString('binary');
    if (!fileContent.includes('%%EOF')) {
      console.error('[Upload] PDF missing EOF marker');
      return false;
    }
    
    console.log('[Upload] PDF validation passed - Version:', versionPart);
    return true;
    
  } catch (error) {
    console.error('[Upload] PDF validation error:', error);
    return false;
  }
}

export async function POST(request: NextRequest) {
  console.log('[Upload API] Starting file upload processing');
  console.log('[Upload API] Vercel Environment:', process.env.VERCEL_ENV);
  console.log('[Upload API] Node.js Version:', process.version);
  console.log('[Upload API] Request headers:', Object.fromEntries(request.headers.entries()));
  
  try {
    console.log('[Upload API] Ensuring upload directories exist');
    await ensureDirs();
    console.log('[Upload API] Upload directories ready');

    console.log('[Upload API] Parsing form data...');
    const formData = await request.formData();
    console.log('[Upload API] Form data entries:', Array.from(formData.entries()).map(([key, value]) => [key, value instanceof File ? `File: ${value.name} (${value.size} bytes)` : value]));
    
    const file = formData.get('file') as File | null;

    if (!file) {
      console.error('[Upload API] No file provided in form data');
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log('[Upload API] File details:', {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified
    });

    // Validate size (reduced for Vercel)
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / (1024*1024)}MB for serverless deployment` },
        { status: 413 }
      );
    }

    // Validate MIME type (check both Content-Type and file extension)
    let mimeType = file.type;

    // Normalize .docx / .pptx that may come with wrong mime
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (ext === 'pptx') mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    if (ext === 'pdf') mimeType = 'application/pdf';

    // Check for video files and reject them
    if (mimeType.startsWith('video/') || ['mp4', 'mov', 'avi', 'webm', 'mkv', 'flv'].includes(ext)) {
      return NextResponse.json(
        { error: 'Video compression is not available in the serverless environment. Please use images, PDFs, or Office documents.' },
        { status: 415 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(mimeType) && !mimeType.startsWith('image/')) {
      return NextResponse.json(
        { error: `File type not supported: ${mimeType}. Supported: Images, PDF, DOCX, PPTX` },
        { status: 415 }
      );
    }

    // Detect file type (will throw error for unsupported types)
    let fileType;
    try {
      fileType = detectFileType(mimeType, file.name);
    } catch (error) {
      return NextResponse.json(
        { error: (error as Error).message },
        { status: 415 }
      );
    }

    // Save file to temp dir with enhanced buffer handling for Vercel
    const fileId = uuidv4();
    const safeExt = ext || 'bin';
    const fileName = `${fileId}.${safeExt}`;
    const filePath = path.join(UPLOAD_DIR, fileName);

    // Process file buffer
    const processFileBuffer = async () => {
      console.log('[Upload] Processing buffer for:', fileName, 'Size:', file.size);
      
      try {
        // Step 1: Get ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        
        if (!arrayBuffer || arrayBuffer.byteLength === 0) {
          throw new Error('File data is empty');
        }
        
        // Step 2: Convert to Buffer
        const buffer = Buffer.from(arrayBuffer);
        
        if (buffer.length !== file.size) {
          console.warn('[Upload] Size mismatch - Expected:', file.size, 'Got:', buffer.length);
        }
        
        // Step 3: Validate basic image header if applicable
        if (mimeType.startsWith('image/')) {
          const isValid = validateImageBuffer(buffer, mimeType);
          if (!isValid) {
            console.warn('[Upload] Basic image header validation failed - continuing anyway');
          }
        }
        
        // Step 4: Save to disk
        await writeFile(filePath, buffer);
        console.log('[Upload] File written to:', filePath);
        
      } catch (error) {
        console.error('[Upload] Buffer processing failed:', error);
        throw error;
      }
    }; // End of processFileBuffer function

    // Execute file processing with timeout protection
    try {
      const processingPromise = processFileBuffer();
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('File processing timeout after 30 seconds')), 30000);
      });
      
      await Promise.race([processingPromise, timeoutPromise]);
    } catch (error) {
      console.error('[Upload] File processing error:', error);
      console.error('[Upload] Error details:', {
        fileName,
        fileSize: file.size,
        mimeType,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return NextResponse.json(
        { error: `Failed to process uploaded file: ${error instanceof Error ? error.message : 'Unknown error'}` },
        { status: 500 }
      );
    }

    const response: UploadResponse = {
      fileId,
      fileName,
      originalName: file.name,
      size: file.size,
      mimeType,
      fileType,
    };

    return NextResponse.json(response, { status: 200 });

  } catch (error: unknown) {
    console.error('[Upload API]', error);
    return NextResponse.json(
      { error: 'Upload failed: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}
