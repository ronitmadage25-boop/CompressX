// lib/cloudinary/config.ts
// Cloudinary configuration for serverless file storage

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary with environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

// Validate configuration
export function validateCloudinaryConfig(): boolean {
  const { cloud_name, api_key, api_secret } = cloudinary.config();
  
  if (!cloud_name || !api_key || !api_secret) {
    console.error('[Cloudinary] Missing configuration. Please set environment variables:');
    console.error('- CLOUDINARY_CLOUD_NAME');
    console.error('- CLOUDINARY_API_KEY');
    console.error('- CLOUDINARY_API_SECRET');
    return false;
  }
  
  return true;
}

export default cloudinary;
