// lib/cloudinary/upload.ts
// Cloudinary upload utilities for serverless file handling

import cloudinary, { validateCloudinaryConfig } from './config';
import { Readable } from 'stream';

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  format: string;
  resource_type: string;
  bytes: number;
  width?: number;
  height?: number;
  pages?: number;
}

/**
 * Upload a buffer to Cloudinary
 * @param buffer File buffer
 * @param options Upload options
 * @returns Cloudinary upload result
 */
export async function uploadToCloudinary(
  buffer: Buffer,
  options: {
    folder?: string;
    resource_type?: 'image' | 'raw' | 'video' | 'auto';
    public_id?: string;
    format?: string;
  } = {}
): Promise<CloudinaryUploadResult> {
  // Validate configuration
  if (!validateCloudinaryConfig()) {
    throw new Error('Cloudinary configuration is missing or invalid');
  }

  console.log('[Cloudinary] Uploading file...', {
    size: buffer.length,
    folder: options.folder,
    resource_type: options.resource_type,
  });

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || 'compressx',
        resource_type: options.resource_type || 'auto',
        public_id: options.public_id,
        format: options.format,
        use_filename: false,
        unique_filename: true,
      },
      (error, result) => {
        if (error) {
          console.error('[Cloudinary] Upload failed:', error);
          reject(error);
        } else if (result) {
          console.log('[Cloudinary] Upload successful:', {
            public_id: result.public_id,
            secure_url: result.secure_url,
            bytes: result.bytes,
          });
          resolve(result as CloudinaryUploadResult);
        } else {
          reject(new Error('Upload failed: No result returned'));
        }
      }
    );

    // Convert buffer to stream and pipe to Cloudinary
    const readableStream = Readable.from(buffer);
    readableStream.pipe(uploadStream);
  });
}

/**
 * Download a file from Cloudinary URL as buffer
 * @param url Cloudinary secure URL
 * @returns File buffer
 */
export async function downloadFromCloudinary(url: string): Promise<Buffer> {
  console.log('[Cloudinary] Downloading file from:', url);

  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  console.log('[Cloudinary] Download successful, size:', buffer.length);
  
  return buffer;
}

/**
 * Delete a file from Cloudinary
 * @param publicId Cloudinary public ID
 * @param resourceType Resource type (image, raw, video)
 */
export async function deleteFromCloudinary(
  publicId: string,
  resourceType: 'image' | 'raw' | 'video' = 'raw'
): Promise<void> {
  if (!validateCloudinaryConfig()) {
    throw new Error('Cloudinary configuration is missing or invalid');
  }

  console.log('[Cloudinary] Deleting file:', publicId);

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    console.log('[Cloudinary] File deleted successfully');
  } catch (error) {
    console.error('[Cloudinary] Delete failed:', error);
    // Don't throw - deletion failures shouldn't break the flow
  }
}

/**
 * Get Cloudinary resource type from MIME type
 */
export function getCloudinaryResourceType(mimeType: string): 'image' | 'raw' | 'video' {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'raw';
}
