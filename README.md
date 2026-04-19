# CompressX v2.0 — Production File Compression Platform

> Compress any file to an **exact target size** using iterative binary-search algorithms.

**✨ Now with Cloudinary integration for serverless deployment on Vercel!**

---

## Architecture

### Cloudinary-Based (Serverless - Recommended)

```
compressx/
├── app/
│   ├── api/
│   │   └── compress-cloudinary/     — POST: unified upload + compress + Cloudinary storage
│   ├── layout.tsx                   — Root layout, fonts, theme
│   ├── page.tsx                     — Main dashboard page
│   └── globals.css                  — All design tokens + component styles
│
├── components/
│   ├── compression/
│   │   ├── CompressionPanel.tsx     — Main orchestrator component
│   │   ├── DropZone.tsx             — Drag-and-drop file input with preview
│   │   ├── ProgressPanel.tsx        — Real-time progress visualization
│   │   └── ResultCard.tsx           — Download + stats after compression
│   ├── three/
│   │   └── HeroScene.tsx            — Three.js 3D Earth/Moon scene
│   └── theme/
│       ├── ThemeProvider.tsx        — Dark/light mode context
│       └── ThemeToggle.tsx          — Theme switcher component
│
├── lib/
│   ├── cloudinary/
│   │   ├── config.ts                — Cloudinary SDK configuration
│   │   └── upload.ts                — Upload/download utilities
│   └── compression/
│       ├── bufferCompressor.ts      — Memory-based compression (no disk I/O)
│       ├── imageCompressor.ts       — Sharp: binary-search quality + scale
│       ├── pdfCompressor.ts         — pdf-lib: JPEG resampling in PDF streams
│       └── officeCompressor.ts      — JSZip: XML minify + image quality search
│
├── hooks/
│   └── useCompressionCloudinary.ts  — Full pipeline state: upload→compress→Cloudinary
│
└── types/
    └── index.ts                     — All TypeScript interfaces
```

### Legacy (Local Storage - Deprecated)

The old architecture using `/api/upload`, `/api/compress`, and `/api/download` is deprecated but kept for rollback. See `MIGRATION_COMPLETE.md` for details.

---

## Quick Start

### 1. Install Dependencies

```bash
git clone <repo>
cd compressx
npm install
```

### 2. Set Up Cloudinary

1. **Create account**: https://cloudinary.com/users/register/free
2. **Get credentials**: https://cloudinary.com/console
3. **Create `.env.local`**:

```bash
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

4. **Test configuration**:

```bash
node scripts/test-cloudinary.js
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### 4. Test Compression

```bash
# Health check
curl http://localhost:3000/api/compress-cloudinary

# Expected response:
{
  "status": "ok",
  "cloudinary": "configured",
  "maxFileSize": 104857600
}
```

### 5. Build for Production

```bash
npm run build
npm run start
```

---

## Compression Engines

### Images (Sharp)
- **Strategy:** Binary search on JPEG/WebP quality (1–100)
- **Phase 1:** Full-resolution quality search (up to 24 iterations)
- **Phase 2:** Progressive scale-down (0.9 → 0.1) with nested quality search if needed
- **Tolerance:** ±4% of target bytes
- **Libraries:** `sharp` with `mozjpeg`, progressive encoding, trellis quantization
- **Processing:** Entirely in-memory (no disk I/O)

### PDF (pdf-lib)
- **Strategy:** Binary search on embedded JPEG image quality
- **Finds:** All DCT-encoded image XObjects across all pages
- **Resamples:** Each image via Sharp at the binary-searched quality
- **Re-embeds:** Recompressed images back into the PDF stream
- **Saves:** With `useObjectStreams: true` for cross-reference compression
- **Processing:** Buffer-based (no disk I/O)

### DOCX / PPTX (JSZip + Sharp)
- **Strategy:** Binary search on image quality + full DEFLATE level-9 repack
- **Step 1:** Minify all XML/relationship files (strip comments, collapse whitespace)
- **Step 2:** Strip thumbnail previews (DocProps/Thumbnails)
- **Step 3:** Resample all JPEG/PNG media via Sharp at binary-searched quality
- **Step 4:** Repack entire ZIP with DEFLATE level 9
- **Processing:** Buffer-based (no disk I/O)

### Supported Formats
- ✅ **Images**: JPEG, PNG, WebP, GIF
- ✅ **Documents**: PDF, DOCX, PPTX
- ❌ **Video**: Removed for serverless compatibility (requires FFmpeg)

---

## API Reference

### `POST /api/compress-cloudinary` (Current)

Unified endpoint that handles upload, compression, and Cloudinary storage in a single request.

**Request:** `multipart/form-data`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `file` | File | ✅ Yes | File to compress |
| `targetBytes` | number | ✅ Yes | Target size in bytes |
| `options` | JSON | ❌ No | Compression options |

**Options:**
```typescript
{
  imageFormat?: 'jpeg' | 'webp' | 'png';
  stripThumbnails?: boolean;
  preserveExif?: boolean;
}
```

**Response:**
```json
{
  "success": true,
  "originalSize": 5242880,
  "compressedSize": 512000,
  "compressionRatio": 90.23,
  "iterations": 12,
  "downloadUrl": "https://res.cloudinary.com/...",
  "publicId": "compressx/compressed/...",
  "fileName": "compressed_photo.jpg"
}
```

**Health Check:**
```bash
GET /api/compress-cloudinary

Response:
{
  "status": "ok",
  "cloudinary": "configured",
  "maxFileSize": 104857600
}
```

---

### Legacy Endpoints (Deprecated)

The following endpoints are deprecated but kept for rollback:
- `POST /api/upload` - Use `/api/compress-cloudinary` instead
- `GET /api/compress` - Use `/api/compress-cloudinary` instead
- `GET /api/download/[filename]` - Replaced by Cloudinary CDN URLs

---

## Deployment

### Vercel (Recommended)

CompressX is optimized for Vercel serverless deployment with Cloudinary storage.

**Quick Deploy:**

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Add environment variables
vercel env add CLOUDINARY_CLOUD_NAME
vercel env add CLOUDINARY_API_KEY
vercel env add CLOUDINARY_API_SECRET

# Deploy to production
vercel --prod
```

**Or use Vercel Dashboard:**

1. Import repository at https://vercel.com/new
2. Add environment variables in Settings → Environment Variables
3. Deploy

**Configuration:**

- **Function Timeout**: 300s (requires Vercel Pro for large files)
- **Memory**: 1024 MB (default)
- **Max File Size**: 100 MB (configurable in route.ts)

See `DEPLOYMENT_GUIDE.md` for detailed instructions.

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
ENV NODE_ENV=production
CMD ["npm", "start"]
```

**Environment variables required:**
```bash
docker run -p 3000:3000 \
  -e CLOUDINARY_CLOUD_NAME=your_cloud_name \
  -e CLOUDINARY_API_KEY=your_api_key \
  -e CLOUDINARY_API_SECRET=your_api_secret \
  compressx
```

### VPS / Self-hosted

```bash
# Install dependencies
npm install

# Build
npm run build

# Run with PM2
npm install -g pm2
pm2 start npm --name compressx -- start

# Or run directly
npm start
```

---

## Environment Variables

### Required

```bash
# Cloudinary Configuration (get from https://cloudinary.com/console)
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

### Optional

```bash
# Node environment (set automatically by Vercel)
NODE_ENV=production

# Vercel environment (set automatically by Vercel)
VERCEL_ENV=production
```

## Documentation

- **Setup Guide**: `CLOUDINARY_SETUP.md` - Cloudinary account setup
- **Deployment Guide**: `DEPLOYMENT_GUIDE.md` - Vercel deployment instructions
- **Migration Guide**: `MIGRATION_COMPLETE.md` - Cloudinary migration details

---

## License
MIT
