# 🚀 Deployment Checklist

Use this checklist to ensure a smooth deployment of CompressX to Vercel with Cloudinary.

## Pre-Deployment

### 1. Cloudinary Setup
- [ ] Created Cloudinary account at https://cloudinary.com/users/register/free
- [ ] Obtained Cloud Name from dashboard
- [ ] Obtained API Key from dashboard
- [ ] Obtained API Secret from dashboard
- [ ] Saved credentials securely (password manager recommended)

### 2. Local Testing
- [ ] Created `.env.local` file with Cloudinary credentials
- [ ] Ran `node scripts/test-cloudinary.js` - all checks passed
- [ ] Ran `npm run dev` - server started successfully
- [ ] Tested health check: `curl http://localhost:3000/api/compress-cloudinary`
- [ ] Uploaded and compressed a JPEG image - success
- [ ] Uploaded and compressed a PNG image - success
- [ ] Uploaded and compressed a PDF document - success
- [ ] Uploaded and compressed a DOCX document - success
- [ ] Downloaded compressed file from Cloudinary - success
- [ ] Verified dark mode works correctly
- [ ] Verified light mode works correctly
- [ ] Verified theme toggle saves preference

### 3. Build Verification
- [ ] Ran `npm run build` - build succeeded
- [ ] No TypeScript errors
- [ ] No ESLint errors
- [ ] All routes compiled successfully

## Deployment to Vercel

### Option A: Vercel CLI

#### Step 1: Install CLI
```bash
npm i -g vercel
```
- [ ] Vercel CLI installed

#### Step 2: Login
```bash
vercel login
```
- [ ] Logged into Vercel account

#### Step 3: Deploy to Preview
```bash
vercel
```
- [ ] Preview deployment successful
- [ ] Preview URL received

#### Step 4: Add Environment Variables
```bash
vercel env add CLOUDINARY_CLOUD_NAME
vercel env add CLOUDINARY_API_KEY
vercel env add CLOUDINARY_API_SECRET
```
- [ ] All environment variables added
- [ ] Selected: Production, Preview, Development

#### Step 5: Deploy to Production
```bash
vercel --prod
```
- [ ] Production deployment successful
- [ ] Production URL received

### Option B: Vercel Dashboard

#### Step 1: Import Repository
- [ ] Went to https://vercel.com/new
- [ ] Connected GitHub/GitLab/Bitbucket account
- [ ] Selected CompressX repository
- [ ] Clicked "Import"

#### Step 2: Configure Project
- [ ] Framework Preset: Next.js (auto-detected)
- [ ] Root Directory: `./` (default)
- [ ] Build Command: `npm run build` (default)
- [ ] Output Directory: `.next` (default)

#### Step 3: Add Environment Variables
- [ ] Went to Settings → Environment Variables
- [ ] Added `CLOUDINARY_CLOUD_NAME` with value
- [ ] Added `CLOUDINARY_API_KEY` with value
- [ ] Added `CLOUDINARY_API_SECRET` with value
- [ ] Selected: Production, Preview, Development for all

#### Step 4: Deploy
- [ ] Clicked "Deploy"
- [ ] Build started
- [ ] Build completed successfully
- [ ] Deployment URL received

## Post-Deployment Verification

### 1. Health Check
```bash
curl https://your-app.vercel.app/api/compress-cloudinary
```

Expected response:
```json
{
  "status": "ok",
  "cloudinary": "configured",
  "maxFileSize": 104857600,
  "runtime": "nodejs",
  "vercel": "production"
}
```

- [ ] Health check returns "ok"
- [ ] Cloudinary status is "configured"
- [ ] Runtime is "nodejs"

### 2. Functional Testing

#### Image Compression
- [ ] Opened production URL in browser
- [ ] Uploaded JPEG image (< 10MB)
- [ ] Set target size (e.g., 500 KB)
- [ ] Clicked "Compress"
- [ ] Progress bar showed correctly
- [ ] Compression completed
- [ ] Download button appeared
- [ ] Clicked download - file downloaded from Cloudinary
- [ ] Verified compressed file size matches target (±4%)

#### PDF Compression
- [ ] Uploaded PDF document
- [ ] Set target size
- [ ] Compression completed successfully
- [ ] Downloaded compressed PDF
- [ ] Opened PDF - content intact

#### Office Document Compression
- [ ] Uploaded DOCX file
- [ ] Set target size
- [ ] Compression completed successfully
- [ ] Downloaded compressed DOCX
- [ ] Opened in Word/LibreOffice - content intact

### 3. UI/UX Testing
- [ ] Dark mode is default on first visit
- [ ] Theme toggle works (dark ↔ light)
- [ ] Theme preference persists on reload
- [ ] Light mode text is readable (high contrast)
- [ ] 3D Earth scene renders in dark mode
- [ ] 3D Moon scene renders in light mode
- [ ] Animations are smooth
- [ ] Mobile responsive (test on phone)
- [ ] Tablet responsive (test on tablet)

### 4. Error Handling
- [ ] Uploaded file > 100MB - shows error message
- [ ] Set target size > original size - shows validation error
- [ ] Uploaded unsupported file type - shows error message
- [ ] Network error handling works (disconnect during upload)

## Monitoring Setup

### 1. Vercel Analytics
- [ ] Enabled Vercel Analytics in dashboard
- [ ] Verified analytics data is being collected
- [ ] Set up alerts for:
  - [ ] Function errors > 5%
  - [ ] Function duration > 250s
  - [ ] Memory usage > 900MB

### 2. Cloudinary Monitoring
- [ ] Checked Cloudinary dashboard: https://cloudinary.com/console
- [ ] Verified storage usage is tracking
- [ ] Verified bandwidth usage is tracking
- [ ] Verified transformations are counting
- [ ] Set up usage alerts:
  - [ ] Storage > 80% of quota
  - [ ] Bandwidth > 80% of quota
  - [ ] Transformations > 80% of quota

### 3. Error Tracking (Optional)
- [ ] Integrated Sentry/LogRocket/Bugsnag
- [ ] Verified errors are being captured
- [ ] Set up error notifications

## Performance Optimization

### 1. Vercel Configuration
- [ ] Checked function timeout setting (300s for Pro)
- [ ] Checked memory allocation (1024MB default)
- [ ] Verified edge caching is enabled
- [ ] Verified compression is enabled

### 2. Cloudinary Configuration
- [ ] Verified auto-format is enabled
- [ ] Verified auto-quality is enabled
- [ ] Set up folder structure:
  - [ ] `compressx/originals/` (temporary)
  - [ ] `compressx/compressed/` (permanent)
- [ ] Configured auto-deletion for originals (optional)

## Security Checklist

### 1. Environment Variables
- [ ] `.env` is in `.gitignore`
- [ ] `.env.local` is in `.gitignore`
- [ ] No credentials in source code
- [ ] No credentials in commit history
- [ ] Environment variables are set in Vercel dashboard only

### 2. API Security
- [ ] File type validation is active
- [ ] File size limits are enforced (100MB)
- [ ] MIME type checking is enabled
- [ ] No arbitrary code execution vulnerabilities

### 3. Cloudinary Security
- [ ] API credentials are environment variables
- [ ] Upload preset is secure (if using unsigned uploads)
- [ ] Folder permissions are configured
- [ ] Auto-moderation is enabled (optional)

## Documentation

- [ ] Updated README.md with production URL
- [ ] Documented any custom configuration
- [ ] Shared deployment guide with team
- [ ] Created runbook for common issues

## Rollback Plan

### If Deployment Fails

#### Option 1: Revert to Previous Deployment
```bash
# In Vercel dashboard
1. Go to Deployments
2. Find last working deployment
3. Click "..." → "Promote to Production"
```
- [ ] Know how to rollback in Vercel dashboard

#### Option 2: Use Legacy Endpoints
```typescript
// In CompressionPanel.tsx
import { useCompression } from '@/hooks/useCompression'; // Old hook
```
- [ ] Legacy endpoints still exist for rollback
- [ ] Know how to switch back to old hook

### If Cloudinary Issues Occur

#### Check Configuration
```bash
# Verify environment variables
vercel env ls

# Check Cloudinary dashboard
https://cloudinary.com/console
```
- [ ] Know how to check Cloudinary status
- [ ] Have Cloudinary support contact info

## Success Criteria

All items below should be ✅ before considering deployment complete:

- [ ] ✅ Health check returns "configured"
- [ ] ✅ Image compression works end-to-end
- [ ] ✅ PDF compression works end-to-end
- [ ] ✅ Office compression works end-to-end
- [ ] ✅ Downloads work from Cloudinary CDN
- [ ] ✅ Dark/light mode works correctly
- [ ] ✅ Mobile responsive
- [ ] ✅ No console errors
- [ ] ✅ Monitoring is active
- [ ] ✅ Error tracking is configured
- [ ] ✅ Team is notified of deployment

## Post-Launch

### Week 1
- [ ] Monitor error rates daily
- [ ] Monitor Cloudinary usage daily
- [ ] Monitor Vercel function metrics daily
- [ ] Collect user feedback
- [ ] Fix any critical bugs immediately

### Week 2-4
- [ ] Review analytics weekly
- [ ] Optimize slow endpoints
- [ ] Review Cloudinary costs
- [ ] Review Vercel costs
- [ ] Plan feature improvements

### Month 2+
- [ ] Review monthly costs
- [ ] Optimize compression algorithms
- [ ] Add new features based on feedback
- [ ] Scale infrastructure if needed

## Support Contacts

- **Cloudinary Support**: https://support.cloudinary.com
- **Vercel Support**: https://vercel.com/support
- **Next.js Docs**: https://nextjs.org/docs
- **Project Issues**: [Your GitHub Issues URL]

## Notes

Add any deployment-specific notes here:

```
Date: _______________
Deployed by: _______________
Production URL: _______________
Cloudinary Cloud Name: _______________
Vercel Project Name: _______________

Issues encountered:
- 
- 

Resolutions:
- 
- 
```

---

## 🎉 Deployment Complete!

Once all items are checked, your CompressX deployment is complete and production-ready!

**Next Steps:**
1. Share production URL with users
2. Monitor for first 24 hours
3. Collect feedback
4. Iterate and improve

**Congratulations! 🚀**
