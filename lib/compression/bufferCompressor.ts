// lib/compression/bufferCompressor.ts
// Buffer-based compression for Cloudinary serverless architecture
// AGGRESSIVE compression engine that STRICTLY reaches target size

import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { CompressionOptions } from '@/types';

export interface BufferCompressionResult {
  buffer: Buffer;
  compressedSize: number;
  iterations: number;
  metadata?: any;
}

export interface CompressionProgress {
  phase: string;
  progress: number;
  detail?: string;
  iteration?: number;
  currentSize?: number;
  targetSize?: number;
  quality?: number;
  scale?: number;
}

/**
 * AGGRESSIVE image compression that STRICTLY reaches target size
 * Multi-phase approach: quality reduction → resolution scaling → extreme compression
 */
export async function compressImageBuffer(
  inputBuffer: Buffer,
  targetBytes: number,
  options: CompressionOptions = {},
  onProgress?: (p: CompressionProgress) => void
): Promise<BufferCompressionResult> {
  console.log('[BufferCompressor] Starting AGGRESSIVE image compression');
  console.log('[BufferCompressor] Target:', targetBytes, 'bytes');
  
  const format = (options.imageFormat ?? 'jpeg') as 'jpeg' | 'webp' | 'png';
  const TOLERANCE = 0.10; // ±10% acceptable
  const MIN_QUALITY = 1;
  const MIN_SCALE = 0.05; // Can go down to 5% of original size
  
  let totalIterations = 0;

  // Read metadata
  onProgress?.({ phase: 'analyzing', progress: 5, detail: 'Reading image metadata' });
  
  const sharpInstance = sharp(inputBuffer, {
    failOnError: false,
    limitInputPixels: false,
    sequentialRead: true,
  });
  
  const meta = await sharpInstance.metadata();
  
  if (!meta.width || !meta.height) {
    throw new Error('Cannot read image dimensions');
  }

  const origWidth = meta.width;
  const origHeight = meta.height;
  const originalSize = inputBuffer.length;

  console.log('[BufferCompressor] Original dimensions:', origWidth, 'x', origHeight);
  console.log('[BufferCompressor] Original size:', originalSize, 'bytes');

  let bestBuffer: Buffer | null = null;
  let bestSize = Infinity;
  let bestQuality = 100;
  let bestScale = 1.0;

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: Quality reduction at full resolution
  // ═══════════════════════════════════════════════════════════════════════════
  console.log('[BufferCompressor] PHASE 1: Quality reduction at full resolution');
  onProgress?.({ phase: 'quality-reduction', progress: 10, detail: 'Reducing quality' });

  const qualitySteps = [90, 80, 70, 60, 50, 40, 30, 20, 10, 5, 1];
  
  for (const quality of qualitySteps) {
    totalIterations++;
    
    const testBuffer = await compressImageWithSettings(
      inputBuffer,
      origWidth,
      origHeight,
      quality,
      format,
      options
    );
    
    const size = testBuffer.length;
    const progress = 10 + Math.round((totalIterations / 50) * 30);
    
    console.log(`[BufferCompressor] Iteration ${totalIterations}: quality=${quality}, size=${size}, target=${targetBytes}`);
    
    onProgress?.({
      phase: 'quality-reduction',
      progress,
      iteration: totalIterations,
      currentSize: size,
      targetSize: targetBytes,
      quality,
      scale: 1.0,
    });

    // Update best result if this is closer to target
    if (size <= targetBytes * (1 + TOLERANCE)) {
      if (Math.abs(size - targetBytes) < Math.abs(bestSize - targetBytes)) {
        bestSize = size;
        bestQuality = quality;
        bestScale = 1.0;
        bestBuffer = testBuffer;
        console.log(`[BufferCompressor] New best: size=${size}, quality=${quality}, scale=1.0`);
      }
    }

    // If we're under target, we can stop quality reduction
    if (size <= targetBytes) {
      console.log('[BufferCompressor] Target reached with quality reduction');
      break;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: Resolution scaling with quality adjustment
  // ═══════════════════════════════════════════════════════════════════════════
  if (bestSize > targetBytes) {
    console.log('[BufferCompressor] PHASE 2: Resolution scaling');
    onProgress?.({ phase: 'resolution-scaling', progress: 40, detail: 'Reducing resolution' });

    // Try multiple scale factors aggressively
    const scaleSteps = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1, 0.08, 0.06, 0.05];
    
    for (const scale of scaleSteps) {
      const w = Math.max(32, Math.round(origWidth * scale));
      const h = Math.max(32, Math.round(origHeight * scale));
      
      // For each scale, try multiple quality levels
      const scaleQualitySteps = [80, 60, 40, 20, 10, 5, 1];
      
      for (const quality of scaleQualitySteps) {
        totalIterations++;
        
        const testBuffer = await compressImageWithSettings(
          inputBuffer,
          w,
          h,
          quality,
          format,
          options
        );
        
        const size = testBuffer.length;
        const progress = 40 + Math.round((totalIterations / 100) * 50);
        
        console.log(`[BufferCompressor] Iteration ${totalIterations}: scale=${scale.toFixed(2)}, quality=${quality}, size=${size}, target=${targetBytes}`);
        
        onProgress?.({
          phase: 'resolution-scaling',
          progress,
          iteration: totalIterations,
          currentSize: size,
          targetSize: targetBytes,
          quality,
          scale,
        });

        // Update best result if this is closer to target
        if (size <= targetBytes * (1 + TOLERANCE)) {
          if (Math.abs(size - targetBytes) < Math.abs(bestSize - targetBytes)) {
            bestSize = size;
            bestQuality = quality;
            bestScale = scale;
            bestBuffer = testBuffer;
            console.log(`[BufferCompressor] New best: size=${size}, quality=${quality}, scale=${scale.toFixed(2)}`);
          }
        }

        // If we're under target and close enough, we can stop
        if (size <= targetBytes && size >= targetBytes * 0.5) {
          console.log('[BufferCompressor] Target reached with resolution scaling');
          break;
        }
      }

      // If we found a good result, stop scaling down further
      if (bestSize <= targetBytes) {
        break;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: Extreme compression (last resort)
  // ═══════════════════════════════════════════════════════════════════════════
  if (bestSize > targetBytes) {
    console.log('[BufferCompressor] PHASE 3: Extreme compression');
    onProgress?.({ phase: 'extreme-compression', progress: 90, detail: 'Applying extreme compression' });

    // Try extremely small sizes with minimum quality
    const extremeScales = [0.05, 0.04, 0.03, 0.02, 0.01];
    
    for (const scale of extremeScales) {
      totalIterations++;
      
      const w = Math.max(16, Math.round(origWidth * scale));
      const h = Math.max(16, Math.round(origHeight * scale));
      
      const testBuffer = await compressImageWithSettings(
        inputBuffer,
        w,
        h,
        1, // Minimum quality
        format,
        options
      );
      
      const size = testBuffer.length;
      
      console.log(`[BufferCompressor] Iteration ${totalIterations}: extreme scale=${scale.toFixed(3)}, size=${size}, target=${targetBytes}`);
      
      onProgress?.({
        phase: 'extreme-compression',
        progress: 95,
        iteration: totalIterations,
        currentSize: size,
        targetSize: targetBytes,
        quality: 1,
        scale,
      });

      // Update best result
      if (Math.abs(size - targetBytes) < Math.abs(bestSize - targetBytes)) {
        bestSize = size;
        bestQuality = 1;
        bestScale = scale;
        bestBuffer = testBuffer;
        console.log(`[BufferCompressor] New best: size=${size}, scale=${scale.toFixed(3)}`);
      }

      // If we're under target, stop
      if (size <= targetBytes) {
        console.log('[BufferCompressor] Target reached with extreme compression');
        break;
      }
    }
  }

  // Final fallback: use the best we found
  if (!bestBuffer) {
    console.log('[BufferCompressor] Using fallback compression');
    bestBuffer = await compressImageWithSettings(inputBuffer, 32, 32, 1, format, options);
    bestSize = bestBuffer.length;
    totalIterations++;
  }

  onProgress?.({ phase: 'complete', progress: 100, detail: 'Compression complete' });

  const compressionRatio = ((originalSize - bestSize) / originalSize) * 100;
  console.log('[BufferCompressor] Compression complete:');
  console.log(`  - Original: ${originalSize} bytes`);
  console.log(`  - Compressed: ${bestSize} bytes`);
  console.log(`  - Target: ${targetBytes} bytes`);
  console.log(`  - Ratio: ${compressionRatio.toFixed(2)}%`);
  console.log(`  - Iterations: ${totalIterations}`);
  console.log(`  - Final quality: ${bestQuality}`);
  console.log(`  - Final scale: ${bestScale.toFixed(2)}`);

  return {
    buffer: bestBuffer,
    compressedSize: bestSize,
    iterations: totalIterations,
    metadata: {
      originalWidth: origWidth,
      originalHeight: origHeight,
      finalWidth: Math.round(origWidth * bestScale),
      finalHeight: Math.round(origHeight * bestScale),
      finalQuality: bestQuality,
      finalScale: bestScale,
      format,
      compressionRatio,
    },
  };
}

/**
 * Helper: Compress image with specific settings
 */
async function compressImageWithSettings(
  inputBuffer: Buffer,
  width: number,
  height: number,
  quality: number,
  format: 'jpeg' | 'webp' | 'png',
  options: CompressionOptions
): Promise<Buffer> {
  let pipeline = sharp(inputBuffer, {
    failOnError: false,
    limitInputPixels: false,
    sequentialRead: true,
  }).resize(width, height, { 
    fit: 'inside', 
    withoutEnlargement: true,
    kernel: 'lanczos3' // Better quality for downscaling
  });

  if (!options.preserveExif) {
    pipeline = pipeline.withMetadata({});
  }

  switch (format) {
    case 'jpeg':
      pipeline = pipeline.jpeg({
        quality,
        progressive: true,
        mozjpeg: true,
        chromaSubsampling: '4:2:0', // More aggressive
        trellisQuantisation: true,
        overshootDeringing: true,
        optimizeScans: true,
      });
      break;
    case 'webp':
      pipeline = pipeline.webp({
        quality,
        effort: 6,
        smartSubsample: true,
        nearLossless: false, // More aggressive
      });
      break;
    case 'png':
      pipeline = pipeline.png({
        compressionLevel: 9,
        palette: true, // Force palette mode for smaller size
        quality,
        effort: 10,
        colors: quality < 50 ? 128 : 256, // Reduce colors for smaller size
      });
      break;
  }

  return await pipeline.toBuffer();
}

/**
 * Lightweight PDF compression for serverless compatibility
 * Note: Heavy PDF compression can cause timeouts in serverless environments
 */
export async function compressPDFBuffer(
  inputBuffer: Buffer,
  targetBytes: number,
  options: CompressionOptions = {},
  onProgress?: (p: CompressionProgress) => void
): Promise<BufferCompressionResult> {
  console.log('[BufferCompressor] Starting lightweight PDF compression');
  console.log('[BufferCompressor] Target:', targetBytes, 'bytes');
  
  const originalSize = inputBuffer.length;
  
  onProgress?.({ phase: 'analyzing', progress: 10, detail: 'Analyzing PDF' });
  
  try {
    // Attempt lightweight compression with timeout protection
    const compressionPromise = (async () => {
      onProgress?.({ phase: 'load', progress: 20, detail: 'Loading PDF document' });
      
      const pdfDoc = await PDFDocument.load(inputBuffer, { 
        ignoreEncryption: true,
        updateMetadata: false,
      });
      
      const pageCount = pdfDoc.getPageCount();
      
      console.log('[BufferCompressor] PDF pages:', pageCount);
      console.log('[BufferCompressor] Original size:', originalSize, 'bytes');
      
      // For large PDFs or many pages, skip heavy processing
      if (pageCount > 50 || originalSize > 10 * 1024 * 1024) {
        console.log('[BufferCompressor] Large PDF detected, using minimal compression');
        onProgress?.({ phase: 'minimal', progress: 50, detail: 'Applying minimal compression' });
        
        // Just remove metadata, don't reprocess
        pdfDoc.setTitle('');
        pdfDoc.setAuthor('');
        pdfDoc.setSubject('');
        pdfDoc.setKeywords([]);
        pdfDoc.setProducer('CompressX');
        pdfDoc.setCreator('CompressX');
      }
      
      onProgress?.({ phase: 'compress', progress: 70, detail: 'Compressing PDF' });
      
      // Save with basic compression
      const compressedBuffer = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
      });
      
      return Buffer.from(compressedBuffer);
    })();
    
    // Add timeout protection (30 seconds max)
    const timeoutPromise = new Promise<Buffer>((_, reject) => {
      setTimeout(() => reject(new Error('PDF compression timeout')), 30000);
    });
    
    const compressedBuffer = await Promise.race([compressionPromise, timeoutPromise]);
    const compressedSize = compressedBuffer.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
    
    console.log('[BufferCompressor] PDF compression complete:');
    console.log(`  - Original: ${originalSize} bytes`);
    console.log(`  - Compressed: ${compressedSize} bytes`);
    console.log(`  - Target: ${targetBytes} bytes`);
    console.log(`  - Ratio: ${compressionRatio.toFixed(2)}%`);
    
    onProgress?.({ phase: 'complete', progress: 100, detail: 'PDF compression complete' });
    
    return {
      buffer: compressedBuffer,
      compressedSize: compressedSize,
      iterations: 1,
      metadata: {
        compressionRatio,
        note: 'Lightweight compression applied for serverless compatibility',
      },
    };
    
  } catch (error) {
    console.error('[BufferCompressor] PDF compression failed:', error);
    
    // Fallback: return original file with warning
    console.log('[BufferCompressor] Returning original PDF (compression failed)');
    
    onProgress?.({ phase: 'fallback', progress: 100, detail: 'Using original file' });
    
    return {
      buffer: inputBuffer,
      compressedSize: originalSize,
      iterations: 0,
      metadata: {
        compressionRatio: 0,
        note: 'PDF compression not available - original file returned',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

/**
 * Lightweight Office document compression for serverless compatibility
 */
export async function compressOfficeBuffer(
  inputBuffer: Buffer,
  targetBytes: number,
  fileType: 'docx' | 'pptx',
  options: CompressionOptions = {},
  onProgress?: (p: CompressionProgress) => void
): Promise<BufferCompressionResult> {
  console.log('[BufferCompressor] Starting lightweight Office compression');
  console.log('[BufferCompressor] Target:', targetBytes, 'bytes');
  
  const originalSize = inputBuffer.length;
  let totalIterations = 0;
  
  try {
    onProgress?.({ phase: 'load', progress: 10, detail: 'Loading Office document' });
    
    // Add timeout protection
    const loadPromise = JSZip.loadAsync(inputBuffer);
    const timeoutPromise = new Promise<JSZip>((_, reject) => {
      setTimeout(() => reject(new Error('Office document load timeout')), 20000);
    });
    
    const zip = await Promise.race([loadPromise, timeoutPromise]);
    
    onProgress?.({ phase: 'analyze', progress: 20, detail: 'Analyzing document structure' });
    
    // Remove unnecessary files
    const filesToRemove = [
      'docProps/thumbnail.jpeg',
      'docProps/thumbnail.png',
      'docProps/thumbnail.emf',
      'docProps/app.xml',
    ];
    
    filesToRemove.forEach(file => {
      if (zip.file(file)) {
        zip.remove(file);
        console.log('[BufferCompressor] Removed:', file);
      }
    });
    
    // Find media files
    const mediaFiles = zip.file(/^word\/media\/|^ppt\/media\//);
    console.log('[BufferCompressor] Found', mediaFiles.length, 'media files');
    
    // Only compress images if there aren't too many (to avoid timeout)
    const maxImagesToCompress = 10;
    const imagesToCompress = mediaFiles.slice(0, maxImagesToCompress);
    
    if (mediaFiles.length > maxImagesToCompress) {
      console.log(`[BufferCompressor] Limiting image compression to ${maxImagesToCompress} files for performance`);
    }
    
    onProgress?.({ phase: 'compress-images', progress: 40, detail: `Compressing ${imagesToCompress.length} images` });
    
    for (let i = 0; i < imagesToCompress.length; i++) {
      const file = imagesToCompress[i];
      const fileName = file.name;
      
      if (fileName.match(/\.(jpg|jpeg|png|webp)$/i)) {
        totalIterations++;
        
        try {
          const imageBuffer = await file.async('nodebuffer');
          
          // Lightweight compression (quality 30 instead of 10)
          const compressedImage = await sharp(imageBuffer)
            .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
            .jpeg({ quality: 30, mozjpeg: true })
            .toBuffer();
          
          zip.file(fileName, compressedImage);
          
          console.log(`[BufferCompressor] Compressed image: ${fileName} (${imageBuffer.length} → ${compressedImage.length})`);
          
          onProgress?.({
            phase: 'compress-images',
            progress: 40 + Math.round((i / imagesToCompress.length) * 40),
            iteration: totalIterations,
            detail: `Compressed ${i + 1}/${imagesToCompress.length} images`,
          });
        } catch (err) {
          console.warn('[BufferCompressor] Failed to compress image:', fileName, err);
        }
      }
    }
    
    onProgress?.({ phase: 'rebuild', progress: 85, detail: 'Rebuilding document' });
    
    // Repack with compression
    const compressedBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });
    
    const compressedSize = compressedBuffer.length;
    const compressionRatio = ((originalSize - compressedSize) / originalSize) * 100;
    
    console.log('[BufferCompressor] Office compression complete:');
    console.log(`  - Original: ${originalSize} bytes`);
    console.log(`  - Compressed: ${compressedSize} bytes`);
    console.log(`  - Target: ${targetBytes} bytes`);
    console.log(`  - Ratio: ${compressionRatio.toFixed(2)}%`);
    console.log(`  - Iterations: ${totalIterations}`);
    
    onProgress?.({ phase: 'complete', progress: 100, detail: 'Office compression complete' });
    
    return {
      buffer: compressedBuffer,
      compressedSize: compressedSize,
      iterations: totalIterations,
      metadata: {
        fileType,
        compressionRatio,
        imagesCompressed: imagesToCompress.length,
        note: imagesToCompress.length < mediaFiles.length 
          ? `Compressed ${imagesToCompress.length} of ${mediaFiles.length} images for performance`
          : undefined,
      },
    };
    
  } catch (error) {
    console.error('[BufferCompressor] Office compression failed:', error);
    
    // Fallback: return original file with warning
    console.log('[BufferCompressor] Returning original Office document (compression failed)');
    
    onProgress?.({ phase: 'fallback', progress: 100, detail: 'Using original file' });
    
    return {
      buffer: inputBuffer,
      compressedSize: originalSize,
      iterations: 0,
      metadata: {
        fileType,
        compressionRatio: 0,
        note: 'Office compression not available - original file returned',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
    };
  }
}

