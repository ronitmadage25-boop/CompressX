// lib/compression/officeCompressor.ts
// Production DOCX/PPTX compression: JSZip repack + XML minification + embedded image resampling

import JSZip from 'jszip';
import sharp from 'sharp';
import fs from 'fs/promises';
import { CompressionOptions } from '@/types';

export interface OfficeCompressionResult {
  outputPath: string;
  compressedSize: number;
  iterations: number;
  imagesResampled: number;
  xmlFilesMinified: number;
  mediaFilesStripped: number;
  metadata: {
    fileType: 'docx' | 'pptx';
    entryCount: number;
    mediaCount: number;
  };
}

export interface OfficeCompressionProgress {
  phase: 'load' | 'analyze' | 'xml' | 'images' | 'repack' | 'quality-loop';
  progress: number;
  filesProcessed?: number;
  totalFiles?: number;
  detail?: string;
}

// Minify XML: collapse whitespace between tags, remove XML comments, normalize attributes
function minifyXML(xml: string): string {
  return xml
    .replace(/<!--[\s\S]*?-->/g, '')          // strip comments
    .replace(/>\s+</g, '><')                   // collapse whitespace between tags
    .replace(/\s{2,}/g, ' ')                   // collapse multiple spaces
    .replace(/\s*=\s*/g, '=')                  // normalize attr spacing
    .replace(/\n|\r/g, '')                     // remove newlines
    .trim();
}

// Determine if a ZIP entry is an image we can resample
function isResampleableImage(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ['jpg', 'jpeg', 'png', 'bmp', 'tif', 'tiff'].includes(ext);
}

// Determine if a file should be stripped entirely (thumbnails, previews, signatures)
function shouldStrip(name: string, options: CompressionOptions): boolean {
  if (!options.stripThumbnails) return false;
  const lower = name.toLowerCase();
  return (
    lower.includes('thumbnail') ||
    lower.includes('docprops/thumbnail') ||
    lower === 'docprops/thumbnail.jpeg' ||
    lower === 'docprops/thumbnail.png' ||
    lower.includes('/_rels/.rels') === false && lower.includes('previewimage')
  );
}

// Determine if media file should be stripped (videos, audio in slides — if option set)
function isHeavyMedia(name: string): boolean {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return ['wmv', 'avi', 'mov', 'mp4', 'mp3', 'wav', 'wma'].includes(ext);
}

/**
 * Compresses DOCX/PPTX to target size.
 * Strategy:
 *   1. Load ZIP, inventory all entries
 *   2. Minify all XML/relationship files
 *   3. Strip thumbnails and heavy media (optional)
 *   4. Binary-search JPEG quality for embedded images via Sharp
 *   5. Repack with DEFLATE level 9
 *   6. If still over target, lower image quality further
 */
export async function compressOfficeToTarget(
  inputPath: string,
  outputPath: string,
  targetBytes: number,
  fileType: 'docx' | 'pptx',
  options: CompressionOptions = {},
  onProgress?: (p: OfficeCompressionProgress) => void
): Promise<OfficeCompressionResult> {
  const TOLERANCE = 0.05;
  const MAX_ITERATIONS = 12;

  onProgress?.({ phase: 'load', progress: 5 });

  const inputBuffer = await fs.readFile(inputPath);

  // Add timeout protection for JSZip loading
  let sourceZip;
  try {
    const loadPromise = JSZip.loadAsync(inputBuffer);
    const timeoutPromise = new Promise<JSZip>((_, reject) => {
      setTimeout(() => reject(new Error('Office document loading timeout')), 15000);
    });

    sourceZip = await Promise.race([loadPromise, timeoutPromise]);
  } catch (error) {
    console.error('[OfficeCompressor] Failed to load Office document:', error);
    throw new Error(`Failed to load Office document: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Inventory
  const allEntries = Object.keys(sourceZip.files).filter(n => !sourceZip.files[n].dir);
  const xmlEntries = allEntries.filter(n => n.endsWith('.xml') || n.endsWith('.rels'));
  const mediaEntries = allEntries.filter(n => n.startsWith('word/media/') || n.startsWith('ppt/media/') || n.startsWith('xl/media/'));
  const imageEntries = mediaEntries.filter(isResampleableImage);

  onProgress?.({ phase: 'analyze', progress: 10, totalFiles: allEntries.length });

  let imagesResampled = 0;
  let xmlFilesMinified = 0;
  let mediaFilesStripped = 0;

  // ─── Load raw data for all entries ──────────────────────────────────────────
  const entryData = new Map<string, Buffer>();
  let loaded = 0;

  for (const name of allEntries) {
    if (shouldStrip(name, options)) {
      mediaFilesStripped++;
      continue;
    }
    if (options.stripMedia && isHeavyMedia(name) && !name.endsWith('.xml')) {
      mediaFilesStripped++;
      continue;
    }
    const data = await sourceZip.files[name].async('nodebuffer');
    entryData.set(name, data);
    loaded++;
    if (loaded % 10 === 0) {
      onProgress?.({ phase: 'analyze', progress: 10 + Math.round((loaded / allEntries.length) * 10), filesProcessed: loaded, totalFiles: allEntries.length });
    }
  }

  // ─── Phase: Minify XML ───────────────────────────────────────────────────────
  onProgress?.({ phase: 'xml', progress: 22 });
  let xmlDone = 0;

  for (const name of xmlEntries) {
    const buf = entryData.get(name);
    if (!buf) continue;
    try {
      const xmlStr = buf.toString('utf-8');
      const minified = minifyXML(xmlStr);
      entryData.set(name, Buffer.from(minified, 'utf-8'));
      xmlFilesMinified++;
    } catch { /* keep original */ }
    xmlDone++;
    if (xmlDone % 5 === 0) {
      onProgress?.({ phase: 'xml', progress: 22 + Math.round((xmlDone / xmlEntries.length) * 15), filesProcessed: xmlDone, totalFiles: xmlEntries.length });
    }
  }

  // ─── Phase: Binary-search image quality ─────────────────────────────────────
  let bestOutput: Buffer | null = null;
  let bestSize = Infinity;
  let bestQuality = 70;
  let iterations = 0;

  const pack = async (imageQuality: number): Promise<Buffer> => {
    const zip = new JSZip();

    for (const [name, data] of Array.from(entryData.entries())) {
      if (isResampleableImage(name)) {
        try {
          let compressed: Buffer;
          const ext = name.split('.').pop()?.toLowerCase() ?? '';

          // Add timeout protection for Sharp operations
          let compressionPromise: Promise<Buffer>;

          if (ext === 'png') {
            compressionPromise = sharp(data)
              .png({ compressionLevel: 9, palette: imageQuality < 50, quality: imageQuality })
              .toBuffer();
          } else {
            compressionPromise = sharp(data)
              .jpeg({ quality: imageQuality, mozjpeg: true, progressive: true })
              .toBuffer();
          }

          const timeoutPromise = new Promise<Buffer>((_, reject) => {
            setTimeout(() => reject(new Error('Office image compression timeout')), 15000);
          });

          compressed = await Promise.race([compressionPromise, timeoutPromise]);
          zip.file(name, compressed, { compression: 'DEFLATE', compressionOptions: { level: 9 } });
          imagesResampled++;
        } catch (error) {
          console.warn('[OfficeCompressor] Failed to compress image:', name, error);
          zip.file(name, data, { compression: 'DEFLATE', compressionOptions: { level: 9 } });
        }
      } else {
        zip.file(name, data, { compression: 'DEFLATE', compressionOptions: { level: 9 } });
      }
    }

    return zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });
  };

  // Reset counter per iteration
  let qLo = 5, qHi = 90;

  onProgress?.({ phase: 'quality-loop', progress: 40, detail: 'Starting quality binary search' });

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const quality = Math.round((qLo + qHi) / 2);
    imagesResampled = 0; // reset count

    const progress = 40 + Math.round((iter / MAX_ITERATIONS) * 50);
    onProgress?.({ phase: 'quality-loop', progress, detail: `Image quality: ${quality}%` });

    const output = await pack(quality);
    const size = output.length;
    iterations++;

    const diff = Math.abs(size - targetBytes) / targetBytes;

    if (size <= targetBytes * (1 + TOLERANCE)) {
      if (bestSize === Infinity || size > bestSize) {
        bestSize = size;
        bestQuality = quality;
        bestOutput = output;
      }
    }

    if (size > targetBytes) qHi = quality - 1;
    else qLo = quality + 1;

    if (Math.abs(qHi - qLo) <= 1) break;
    if (diff < TOLERANCE) break;
  }

  // Fallback
  if (!bestOutput) {
    imagesResampled = 0;
    bestOutput = await pack(1);
    bestSize = bestOutput.length;
    bestQuality = 1;
  }

  onProgress?.({ phase: 'repack', progress: 97 });

  await fs.writeFile(outputPath, bestOutput);

  return {
    outputPath,
    compressedSize: bestSize,
    iterations,
    imagesResampled,
    xmlFilesMinified,
    mediaFilesStripped,
    metadata: {
      fileType,
      entryCount: allEntries.length,
      mediaCount: mediaEntries.length,
    },
  };
}
