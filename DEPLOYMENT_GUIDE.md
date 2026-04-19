# CompressX Deployment Guide - Cloudinary + Vercel

Complete guide to deploy CompressX with Cloudinary backend on Vercel.

## Prerequisites

- [x] Node.js 18+ installed
- [x] Vercel account
- [x] Cloudinary account (free tier works)
- [x] Git repository

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

Dependencies are already in `package.json`:
- `cloudinary` - Cloud storage SDK
- `sharp` - Image compression
- `pdf-lib` - PDF compression
- `jszip` - Office document compression

### 2. Set Up Cloudinary

1. **Create Account**: https://cloudinary.com/users/register/free
2. **Get Credentials**: https://cloudinary.com/console
   - Cloud Name
   - API Key
   - API Secret

3. **Create `.env.local`**:
```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### 3. Test Locally

```bash
# Start development server
npm run dev

# Test health check
curl http://localhost:3000/api/compress-cloudinary

# Test compression
curl -X POST http://localhost:3000/api/compress-cloudinary \
  -F "file=@test.jpg" \
  -F "targetBytes=50000"
```

### 4. Deploy to Vercel

#### Option A: Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Deploy
vercel

# Add environment variables
vercel env add CLOUDINARY_CLOUD_NAME
vercel env add CLOUDINARY_API_KEY
vercel env add CLOUDINARY_API_SECRET

# Deploy to production
vercel --prod
```

#### Option B: Vercel Dashboard

1. **Connect Repository**:
   - Go to https://vercel.com/new
   - Import your Git repository
   - Click "Import"

2. **Configure Project**:
   - Framework Preset: **Next.js**
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `.next`

3. **Add Environment Variables**:
   - Go to **Settings** → **Environment Variables**
   - Add:
     - `CLOUDINARY_CLOUD_NAME`
     - `CLOUDINARY_API_KEY`
     - `CLOUDINARY_API_SECRET`
   - Select: **Production**, **Preview**, **Development**

4. **Deploy**:
   - Click "Deploy"
   - Wait for build to complete

### 5. Verify Deployment

```bash
# Health check
curl https://your-app.vercel.app/api/compress-cloudinary

# Expected response:
{
  "status": "ok",
  "cloudinary": "configured",
  "maxFileSize": 104857600
}
```

## Architecture Changes

### What Changed?

| Component | Old (Local) | New (Cloudinary) |
|-----------|-------------|------------------|
| **File Storage** | `/tmp` directory | Cloudinary cloud |
| **Upload Flow** | Save to disk | Upload to cloud |
| **Compression** | Read from disk | Process in memory |
| **Download** | Serve from disk | Cloudinary URL |
| **Cleanup** | Manual deletion | Automatic |

### New File Structure

```
lib/
├── cloudinary/
│   ├── config.ts              # Cloudinary setup
│   └── upload.ts              # Upload/download utilities
└── compression/
    └── bufferCompressor.ts    # Memory-based compression

app/api/
└── compress-cloudinary/
    └── route.ts               # Unified endpoint

hooks/
└── useCompressionCloudinary.ts # Frontend hook
```

### API Endpoints

#### New Endpoint (Use This)
- **`/api/compress-cloudinary`** - Unified upload + compress

#### Old Endpoints (Deprecated)
- ~~`/api/upload`~~ - No longer needed
- ~~`/api/compress`~~ - No longer needed
- ~~`/api/download/[filename]`~~ - Replaced by Cloudinary URLs

## Frontend Integration

### Option 1: Use New Hook (Recommended)

```typescript
import { useCompressionCloudinary } from '@/hooks/useCompressionCloudinary';

function MyComponent() {
  const { compressFile, result, isProcessing, downloadResult } = useCompressionCloudinary();

  const handleCompress = async (file: File, targetBytes: number) => {
    await compressFile(file, targetBytes);
  };

  return (
    <div>
      {isProcessing && <p>Compressing...</p>}
      {result && (
        <button onClick={downloadResult}>
          Download ({result.compressionRatio}% saved)
        </button>
      )}
    </div>
  );
}
```

### Option 2: Direct API Call

```typescript
async function compressFile(file: File, targetBytes: number) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('targetBytes', targetBytes.toString());

  const response = await fetch('/api/compress-cloudinary', {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();
  
  if (result.success) {
    window.open(result.downloadUrl, '_blank');
  }
}
```

## Configuration

### Vercel Settings

**`vercel.json`** (optional):
```json
{
  "functions": {
    "app/api/compress-cloudinary/route.ts": {
      "maxDuration": 300,
      "memory": 1024
    }
  }
}
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `CLOUDINARY_CLOUD_NAME` | ✅ Yes | Your Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | ✅ Yes | Your Cloudinary API key |
| `CLOUDINARY_API_SECRET` | ✅ Yes | Your Cloudinary API secret |

### Cloudinary Folders

Files are organized in Cloudinary:
```
compressx/
├── originals/     # Temporary (auto-deleted)
└── compressed/    # Permanent (for download)
```

## Performance Optimization

### 1. Memory Management

```typescript
// Buffer-based processing (no disk I/O)
const buffer = Buffer.from(await file.arrayBuffer());
const compressed = await compressImageBuffer(buffer, targetBytes);
```

### 2. Parallel Processing

```typescript
// Upload and compress can happen in parallel
const [upload, compressed] = await Promise.all([
  uploadToCloudinary(buffer),
  compressBuffer(buffer, targetBytes)
]);
```

### 3. Cleanup Strategy

```typescript
// Delete original after compression
await deleteFromCloudinary(originalPublicId);
```

## Monitoring

### Cloudinary Dashboard

Monitor usage at: https://cloudinary.com/console

- **Storage**: Check used space
- **Bandwidth**: Monitor downloads
- **Transformations**: Track API calls

### Vercel Analytics

Monitor performance at: https://vercel.com/dashboard

- **Function Duration**: Should be < 300s
- **Memory Usage**: Should be < 1024MB
- **Error Rate**: Should be < 1%

## Troubleshooting

### Issue: "Cloudinary configuration is missing"

**Cause**: Environment variables not set

**Solution**:
```bash
# Check variables in Vercel dashboard
vercel env ls

# Add missing variables
vercel env add CLOUDINARY_CLOUD_NAME
```

### Issue: "File too large"

**Cause**: File exceeds 100MB limit

**Solution**:
- Increase `MAX_FILE_SIZE` in route.ts
- Upgrade Cloudinary plan if needed
- Add client-side validation

### Issue: "Function timeout"

**Cause**: Compression takes > 300s

**Solution**:
- Upgrade to Vercel Pro (300s limit)
- Reduce `MAX_ITERATIONS` in bufferCompressor.ts
- Add progress streaming (advanced)

### Issue: "Out of memory"

**Cause**: Large file processing

**Solution**:
- Increase memory in vercel.json
- Process in chunks (advanced)
- Use Cloudinary transformations

## Cost Estimation

### Cloudinary Free Tier
- **Storage**: 25 GB
- **Bandwidth**: 25 GB/month
- **Transformations**: 25,000/month

**Estimated capacity**: ~12,500 compressions/month

### Vercel Free Tier
- **Bandwidth**: 100 GB/month
- **Function Executions**: 100 GB-hours/month
- **Function Duration**: 10s (Hobby), 300s (Pro)

**Estimated capacity**: ~50,000 compressions/month

### Upgrade Costs

**Cloudinary Plus**: $99/month
- 100 GB storage
- 100 GB bandwidth
- 100,000 transformations

**Vercel Pro**: $20/month
- 1 TB bandwidth
- 1,000 GB-hours
- 300s function duration

## Security

### Best Practices

1. **Never commit credentials**:
```bash
# Add to .gitignore
.env
.env.local
.env.*.local
```

2. **Use environment variables**:
```typescript
// ✅ Good
const apiKey = process.env.CLOUDINARY_API_KEY;

// ❌ Bad
const apiKey = "123456789";
```

3. **Validate file types**:
```typescript
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf'];
if (!ALLOWED_TYPES.includes(file.type)) {
  throw new Error('Invalid file type');
}
```

4. **Limit file sizes**:
```typescript
const MAX_SIZE = 100 * 1024 * 1024; // 100MB
if (file.size > MAX_SIZE) {
  throw new Error('File too large');
}
```

## Rollback Plan

If Cloudinary deployment fails:

1. **Keep old endpoints**: Don't delete `/api/upload` and `/api/compress`
2. **Feature flag**: Use environment variable to switch backends
3. **Gradual migration**: Test with subset of users first

```typescript
const USE_CLOUDINARY = process.env.USE_CLOUDINARY === 'true';

if (USE_CLOUDINARY) {
  await compressWithCloudinary(file);
} else {
  await compressWithLocalStorage(file);
}
```

## Support

- **Cloudinary Docs**: https://cloudinary.com/documentation
- **Vercel Docs**: https://vercel.com/docs
- **Next.js Docs**: https://nextjs.org/docs

## Checklist

- [ ] Cloudinary account created
- [ ] Environment variables configured
- [ ] Local testing passed
- [ ] Deployed to Vercel
- [ ] Health check returns "configured"
- [ ] Test compression works
- [ ] Monitor Cloudinary usage
- [ ] Monitor Vercel analytics
- [ ] Set up error tracking
- [ ] Document API for team

## Next Steps

1. **Add Progress Tracking**: Real-time compression progress
2. **Implement Caching**: Cache compressed files
3. **Add Webhooks**: Cloudinary upload notifications
4. **Batch Processing**: Compress multiple files
5. **Advanced Options**: Custom compression settings
6. **Analytics**: Track compression metrics
