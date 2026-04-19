# Cloudinary Setup Guide for CompressX

This guide explains how to set up Cloudinary for production deployment on Vercel.

## Why Cloudinary?

Vercel's serverless functions have limitations:
- **No persistent filesystem**: `/tmp` is ephemeral and limited
- **Memory constraints**: Limited RAM for file processing
- **Execution time limits**: Functions timeout after 10s (Hobby) or 300s (Pro)

Cloudinary solves these issues by providing:
- ✅ **Cloud storage**: No filesystem dependency
- ✅ **Direct URLs**: Files accessible via HTTPS
- ✅ **Automatic cleanup**: Manage storage programmatically
- ✅ **CDN delivery**: Fast global file delivery

## Architecture Overview

### Old Architecture (Local Storage - ❌ Fails on Vercel)
```
1. Upload file → Save to /tmp
2. Read from /tmp → Compress
3. Save compressed to /tmp
4. Download from /tmp
```

### New Architecture (Cloudinary - ✅ Works on Vercel)
```
1. Upload file → Upload to Cloudinary
2. Process in memory (buffer) → Compress
3. Upload compressed → Upload to Cloudinary
4. Return Cloudinary URL → User downloads
```

## Setup Instructions

### 1. Create Cloudinary Account

1. Go to [https://cloudinary.com/users/register/free](https://cloudinary.com/users/register/free)
2. Sign up for a free account (generous free tier)
3. Verify your email

### 2. Get Your Credentials

1. Log in to [Cloudinary Console](https://cloudinary.com/console)
2. On the dashboard, you'll see:
   - **Cloud Name**: `your_cloud_name`
   - **API Key**: `123456789012345`
   - **API Secret**: `abcdefghijklmnopqrstuvwxyz123456`

### 3. Configure Environment Variables

#### Local Development

1. Create a `.env.local` file in your project root:
```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

2. Add `.env.local` to `.gitignore` (should already be there)

#### Vercel Deployment

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add three variables:
   - `CLOUDINARY_CLOUD_NAME` = `your_cloud_name`
   - `CLOUDINARY_API_KEY` = `your_api_key`
   - `CLOUDINARY_API_SECRET` = `your_api_secret`
4. Select environments: **Production**, **Preview**, **Development**
5. Click **Save**

### 4. Test the Setup

#### Health Check
```bash
curl https://your-domain.vercel.app/api/compress-cloudinary
```

Expected response:
```json
{
  "status": "ok",
  "cloudinary": "configured",
  "maxFileSize": 104857600
}
```

#### Test Compression
```bash
curl -X POST https://your-domain.vercel.app/api/compress-cloudinary \
  -F "file=@test-image.jpg" \
  -F "targetBytes=50000"
```

Expected response:
```json
{
  "success": true,
  "originalSize": 150000,
  "compressedSize": 49500,
  "compressionRatio": 67.0,
  "downloadUrl": "https://res.cloudinary.com/...",
  "iterations": 5
}
```

## API Endpoint

### `/api/compress-cloudinary`

**Method**: `POST`

**Content-Type**: `multipart/form-data`

**Parameters**:
- `file` (required): File to compress
- `targetBytes` (required): Target size in bytes
- `options` (optional): JSON string with compression options

**Response**:
```typescript
{
  success: boolean;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  iterations: number;
  downloadUrl: string;  // Cloudinary URL
  publicId: string;     // Cloudinary public ID
  fileName: string;
  metadata: {
    originalFileName: string;
    mimeType: string;
    fileType: string;
    cloudinaryUrl: string;
  };
}
```

## File Structure

```
lib/
├── cloudinary/
│   ├── config.ts          # Cloudinary configuration
│   └── upload.ts          # Upload/download utilities
└── compression/
    └── bufferCompressor.ts # Buffer-based compression

app/api/
└── compress-cloudinary/
    └── route.ts           # Unified upload + compress endpoint
```

## Cloudinary Storage Management

### Folder Structure
```
compressx/
├── originals/     # Original uploaded files (auto-deleted)
└── compressed/    # Compressed files (kept for download)
```

### Automatic Cleanup

Original files are automatically deleted after compression to save storage.

### Manual Cleanup

To delete old compressed files:

```typescript
import { deleteFromCloudinary } from '@/lib/cloudinary/upload';

await deleteFromCloudinary('public_id_here', 'image');
```

## Cloudinary Free Tier Limits

- **Storage**: 25 GB
- **Bandwidth**: 25 GB/month
- **Transformations**: 25,000/month
- **API calls**: Unlimited

For CompressX usage:
- Each compression uses ~2 API calls (upload original + upload compressed)
- Original files are deleted immediately
- Only compressed files count toward storage

**Estimated capacity**: ~12,500 compressions/month on free tier

## Troubleshooting

### Error: "Cloudinary configuration is missing"

**Solution**: Check environment variables are set correctly in Vercel dashboard.

### Error: "Upload failed: Unauthorized"

**Solution**: Verify your API key and secret are correct. Check for extra spaces.

### Error: "File too large"

**Solution**: Cloudinary free tier has a 100MB upload limit. Upgrade plan if needed.

### Slow uploads

**Solution**: Cloudinary uses CDN. First upload may be slow, subsequent operations are fast.

## Production Checklist

- [ ] Cloudinary account created
- [ ] Environment variables set in Vercel
- [ ] Health check returns `"cloudinary": "configured"`
- [ ] Test compression works end-to-end
- [ ] Monitor Cloudinary usage dashboard
- [ ] Set up Cloudinary webhooks (optional)
- [ ] Configure auto-delete policies (optional)

## Monitoring

Monitor your Cloudinary usage:
1. Go to [Cloudinary Console](https://cloudinary.com/console)
2. Check **Dashboard** for usage stats
3. Set up alerts for quota limits

## Upgrade Path

If you exceed free tier limits:

1. **Plus Plan** ($99/month):
   - 100 GB storage
   - 100 GB bandwidth
   - 100,000 transformations

2. **Advanced Plan** ($249/month):
   - 500 GB storage
   - 500 GB bandwidth
   - 500,000 transformations

## Support

- Cloudinary Docs: https://cloudinary.com/documentation
- Cloudinary Support: https://support.cloudinary.com
- CompressX Issues: [Your GitHub repo]

## Security Notes

- ✅ Never commit `.env` files
- ✅ Use environment variables for all credentials
- ✅ Rotate API secrets periodically
- ✅ Use signed URLs for sensitive files (optional)
- ✅ Enable Cloudinary access control (optional)

## Next Steps

1. Deploy to Vercel
2. Test with real files
3. Monitor Cloudinary dashboard
4. Optimize compression settings
5. Add progress tracking (optional)
6. Implement file expiration (optional)
