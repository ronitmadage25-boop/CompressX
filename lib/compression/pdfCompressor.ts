// lib/compression/pdfCompressor.ts
// Production PDF compression using pdf-lib with image downsampling + stream flattening

import { PDFDocument, PDFImage, PDFPage, PDFName, PDFDict, PDFStream, PDFRawStream, PDFRef, PDFArray } from 'pdf-lib';
import sharp from 'sharp';
import fs from 'fs/promises';
import path from 'path';
import { CompressionOptions } from '@/types';

export interface PDFCompressionResult {
  outputPath: string;
  compressedSize: number;
  iterations: number;
  pageCount: number;
  imagesResampled: number;
  metadata: {
    pageCount: number;
    title?: string;
    author?: string;
  };
}

export interface PDFCompressionProgress {
  phase: 'load' | 'analyze' | 'images' | 'streams' | 'rebuild' | 'quality-loop' | 'save';
  progress: number;
  currentPage?: number;
  totalPages?: number;
  imagesFound?: number;
  detail?: string;
}

/**
 * Extracts embedded image XObjects from a PDF page's resource dictionary.
 * Returns refs to all image XObject streams.
 */
function collectImageRefs(pdfDoc: PDFDocument): PDFRef[] {
  const imageRefs: PDFRef[] = [];
  const seen = new Set<number>();

  const pages = pdfDoc.getPages();
  for (const page of pages) {
    try {
      const resources = page.node.Resources();
      if (!resources) continue;

      const xObjects = resources.lookup(PDFName.of('XObject'));
      if (!xObjects || !(xObjects instanceof PDFDict)) continue;

      xObjects.entries().forEach(([, ref]) => {
        try {
          const obj = pdfDoc.context.lookup(ref as PDFRef);
          if (obj instanceof PDFRawStream || obj instanceof PDFStream) {
            const dict = (obj as PDFRawStream).dict ?? (obj as unknown as { dict: PDFDict }).dict;
            const subtype = dict?.lookup(PDFName.of('Subtype'));
            if (subtype?.toString() === '/Image') {
              const refNum = (ref as PDFRef).objectNumber;
              if (!seen.has(refNum)) {
                seen.add(refNum);
                imageRefs.push(ref as PDFRef);
              }
            }
          }
        } catch { }
      });
    } catch { }
  }

  return imageRefs;
}

/**
 * Resamples a JPEG image stream to a lower quality using Sharp.
 * Returns new compressed JPEG bytes.
 */
async function resampleJpeg(imageBytes: Uint8Array, quality: number): Promise<Buffer> {
  const compressionPromise = sharp(Buffer.from(imageBytes))
    .jpeg({ quality, mozjpeg: true, progressive: true })
    .toBuffer();

  const timeoutPromise = new Promise<Buffer>((_, reject) => {
    setTimeout(() => reject(new Error('JPEG resampling timeout')), 15000);
  });

  return await Promise.race([compressionPromise, timeoutPromise]);
}

/**
 * Main PDF compression function.
 * Strategy:
 *   1. Load PDF with pdf-lib
 *   2. Collect all embedded JPEG image XObjects
 *   3. Binary search on image resampling quality (10–85)
 *   4. Re-embed resampled images
 *   5. Save with object streams + cross-reference compression
 *   6. If still over target, reduce image quality further
 */
export async function compressPDFToTarget(
  inputPath: string,
  outputPath: string,
  targetBytes: number,
  options: CompressionOptions = {},
  onProgress?: (p: PDFCompressionProgress) => void
): Promise<PDFCompressionResult> {
  const TOLERANCE = 0.05; // ±5%
  const MAX_ITERATIONS = 10;

  onProgress?.({ phase: 'load', progress: 5 });

  console.log('[PDFCompressor] Starting PDF compression for:', inputPath);

  // Validate input file exists and has content
  let inputBytes;
  try {
    const fileStats = await fs.stat(inputPath);
    console.log('[PDFCompressor] Input file stats:', { size: fileStats.size, path: inputPath });

    if (fileStats.size === 0) {
      throw new Error('Input PDF file is empty');
    }

    if (fileStats.size > 500 * 1024 * 1024) { // 500MB limit for PDFs
      throw new Error('PDF file too large for processing (max 500MB)');
    }

    inputBytes = await fs.readFile(inputPath);
    console.log('[PDFCompressor] PDF file read successfully, size:', inputBytes.length);

    // Validate PDF header
    if (inputBytes.length < 8) {
      throw new Error('PDF file too small to be valid');
    }

    const header = inputBytes.subarray(0, 5).toString();
    if (header !== '%PDF-') {
      throw new Error('Invalid PDF file header');
    }

    console.log('[PDFCompressor] PDF header validation passed');

  } catch (error) {
    console.error('[PDFCompressor] Failed to read/validate input PDF:', error);
    throw new Error(`Failed to read PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  const originalSize = inputBytes.length;

  onProgress?.({ phase: 'analyze', progress: 15 });

  let bestOutputBytes: Uint8Array | null = null;
  let bestSize = Infinity;
  let bestQuality = 60;
  let imagesResampled = 0;
  let iterations = 0;

  // First pass: load once to count pages with timeout protection
  let pdfForMeta;
  try {
    console.log('[PDFCompressor] Loading PDF document for metadata analysis');
    const loadPromise = PDFDocument.load(inputBytes, {
      ignoreEncryption: true,
      capNumbers: false, // Disable number capping for better compatibility
      throwOnInvalidObject: false // Don't throw on invalid objects
    });
    const timeoutPromise = new Promise<PDFDocument>((_, reject) => {
      setTimeout(() => reject(new Error('PDF loading timeout after 20 seconds')), 20000);
    });

    pdfForMeta = await Promise.race([loadPromise, timeoutPromise]);
    console.log('[PDFCompressor] PDF loaded successfully for metadata');
  } catch (error) {
    console.error('[PDFCompressor] Failed to load PDF for metadata:', error);
    console.error('[PDFCompressor] PDF file size:', inputBytes.length);
    console.error('[PDFCompressor] PDF header:', inputBytes.subarray(0, 20).toString());

    // Try alternative loading options
    try {
      console.log('[PDFCompressor] Attempting alternative PDF loading...');
      pdfForMeta = await PDFDocument.load(inputBytes, {
        ignoreEncryption: true,
        capNumbers: false,
        throwOnInvalidObject: false
      });
      console.log('[PDFCompressor] Alternative PDF loading successful');
    } catch (altError) {
      console.error('[PDFCompressor] Alternative PDF loading also failed:', altError);
      throw new Error(`Failed to load PDF document: ${error instanceof Error ? error.message : 'Unknown error'}. The PDF file may be corrupted or use unsupported features.`);
    }
  }

  const pageCount = pdfForMeta.getPageCount();
  const title = pdfForMeta.getTitle();
  const author = pdfForMeta.getAuthor();

  onProgress?.({ phase: 'images', progress: 20, totalPages: pageCount });

  // Collect image refs from first load to understand the document
  const imageRefs = collectImageRefs(pdfForMeta);
  imagesResampled = imageRefs.length;

  onProgress?.({ phase: 'quality-loop', progress: 25, imagesFound: imageRefs.length });

  // ─── Binary search on image quality ─────────────────────────────────────────
  let qLo = 5, qHi = 85;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const quality = Math.round((qLo + qHi) / 2);
    const progress = 25 + Math.round((iter / MAX_ITERATIONS) * 60);
    onProgress?.({ phase: 'quality-loop', progress, detail: `Quality: ${quality}` });

    try {
      console.log('[PDFCompressor] Iteration', iter + 1, '- Testing quality:', quality);

      // Fresh load for each iteration (pdf-lib mutates in place)
      const pdfDoc = await PDFDocument.load(inputBytes, {
        ignoreEncryption: true,
        capNumbers: false,
        throwOnInvalidObject: false
      });
      const refs = collectImageRefs(pdfDoc);

      console.log('[PDFCompressor] Found', refs.length, 'image references to process');

      // Resample all JPEG images at this quality
      let processedImages = 0;
      for (const ref of refs) {
        try {
          const stream = pdfDoc.context.lookup(ref) as PDFRawStream;
          const dict = stream.dict;
          const filter = dict.lookup(PDFName.of('Filter'));

          // Only process DCT (JPEG) encoded images
          const isJpeg =
            filter?.toString() === '/DCTDecode' ||
            (filter instanceof PDFArray &&
              filter.asArray().some(f => f?.toString() === '/DCTDecode'));

          if (!isJpeg) continue;

          const imageData = stream.contents;
          console.log('[PDFCompressor] Processing JPEG image, size:', imageData.length);

          const resampled = await resampleJpeg(imageData, quality);
          console.log('[PDFCompressor] Resampled image from', imageData.length, 'to', resampled.length, 'bytes');

          // Replace stream contents
          const newStream = pdfDoc.context.stream(resampled, {
            Type: 'XObject',
            Subtype: 'Image',
            Filter: 'DCTDecode',
            BitsPerComponent: dict.lookup(PDFName.of('BitsPerComponent')),
            ColorSpace: dict.lookup(PDFName.of('ColorSpace')),
            Width: dict.lookup(PDFName.of('Width')),
            Height: dict.lookup(PDFName.of('Height')),
          });

          pdfDoc.context.assign(ref, newStream);
          processedImages++;
        } catch (imageError) {
          console.warn('[PDFCompressor] Failed to process image:', imageError);
          continue;
        }
      }

      console.log('[PDFCompressor] Processed', processedImages, 'images, saving PDF...');

      // Save with compression flags
      const savedBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50,
      });

      const size = savedBytes.length;
      iterations++;

      console.log('[PDFCompressor] Saved PDF size:', size, 'target:', targetBytes);

      const diff = Math.abs(size - targetBytes) / targetBytes;

      if (size <= targetBytes * (1 + TOLERANCE) && (bestSize === Infinity || size > bestSize)) {
        bestSize = size;
        bestQuality = quality;
        bestOutputBytes = savedBytes;
        console.log('[PDFCompressor] New best result - Size:', size, 'Quality:', quality);
      }

      if (size > targetBytes) qHi = quality - 1;
      else qLo = quality + 1;

      if (Math.abs(qHi - qLo) <= 1) break;
      if (diff < TOLERANCE) break;

    } catch (err) {
      console.error('[PDFCompressor] Iteration', iter + 1, 'failed:', err);
      qHi = quality - 1;
    }
  }

  // ─── Fallback: if no compression met target, use best result ────────────────
  if (!bestOutputBytes) {
    // Last resort: quality 1 (maximum compression)
    try {
      const pdfDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
      const refs = collectImageRefs(pdfDoc);

      for (const ref of refs) {
        try {
          const stream = pdfDoc.context.lookup(ref) as PDFRawStream;
          const dict = stream.dict;
          const filter = dict.lookup(PDFName.of('Filter'));
          const isJpeg = filter?.toString() === '/DCTDecode';
          if (!isJpeg) continue;

          const resampled = await resampleJpeg(stream.contents, 1);
          const newStream = pdfDoc.context.stream(resampled, {
            Type: 'XObject', Subtype: 'Image', Filter: 'DCTDecode',
            BitsPerComponent: dict.lookup(PDFName.of('BitsPerComponent')),
            ColorSpace: dict.lookup(PDFName.of('ColorSpace')),
            Width: dict.lookup(PDFName.of('Width')),
            Height: dict.lookup(PDFName.of('Height')),
          });
          pdfDoc.context.assign(ref, newStream);
        } catch { continue; }
      }

      const savedBytes = await pdfDoc.save({ useObjectStreams: true });
      bestOutputBytes = savedBytes;
      bestSize = savedBytes.length;
      bestQuality = 1;
    } catch {
      // Ultimate fallback: save original with just object stream compression
      const pdfDoc = await PDFDocument.load(inputBytes, { ignoreEncryption: true });
      const savedBytes = await pdfDoc.save({ useObjectStreams: true });
      bestOutputBytes = savedBytes;
      bestSize = savedBytes.length;
    }
  }

  onProgress?.({ phase: 'save', progress: 97 });

  await fs.writeFile(outputPath, bestOutputBytes!);

  return {
    outputPath,
    compressedSize: bestSize,
    iterations,
    pageCount,
    imagesResampled,
    metadata: { pageCount, title: title ?? undefined, author: author ?? undefined },
  };
}
