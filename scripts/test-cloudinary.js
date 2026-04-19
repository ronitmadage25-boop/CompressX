#!/usr/bin/env node
/**
 * Test script to verify Cloudinary configuration
 * Run: node scripts/test-cloudinary.js
 */

require('dotenv').config({ path: '.env.local' });

const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
const apiKey = process.env.CLOUDINARY_API_KEY;
const apiSecret = process.env.CLOUDINARY_API_SECRET;

console.log('\n🔍 Checking Cloudinary Configuration...\n');

let hasErrors = false;

// Check Cloud Name
if (!cloudName) {
  console.log('❌ CLOUDINARY_CLOUD_NAME is missing');
  hasErrors = true;
} else if (cloudName === 'your_cloud_name_here') {
  console.log('⚠️  CLOUDINARY_CLOUD_NAME is still set to placeholder value');
  hasErrors = true;
} else {
  console.log('✅ CLOUDINARY_CLOUD_NAME:', cloudName);
}

// Check API Key
if (!apiKey) {
  console.log('❌ CLOUDINARY_API_KEY is missing');
  hasErrors = true;
} else if (apiKey === 'your_api_key_here') {
  console.log('⚠️  CLOUDINARY_API_KEY is still set to placeholder value');
  hasErrors = true;
} else {
  console.log('✅ CLOUDINARY_API_KEY:', apiKey.substring(0, 8) + '...');
}

// Check API Secret
if (!apiSecret) {
  console.log('❌ CLOUDINARY_API_SECRET is missing');
  hasErrors = true;
} else if (apiSecret === 'your_api_secret_here') {
  console.log('⚠️  CLOUDINARY_API_SECRET is still set to placeholder value');
  hasErrors = true;
} else {
  console.log('✅ CLOUDINARY_API_SECRET:', apiSecret.substring(0, 8) + '...');
}

console.log('');

if (hasErrors) {
  console.log('❌ Configuration incomplete!\n');
  console.log('📝 Next steps:');
  console.log('1. Create a Cloudinary account: https://cloudinary.com/users/register/free');
  console.log('2. Get your credentials: https://cloudinary.com/console');
  console.log('3. Create .env.local file with your credentials');
  console.log('4. Run this script again to verify\n');
  process.exit(1);
} else {
  console.log('✅ All Cloudinary environment variables are configured!\n');
  console.log('🚀 You can now:');
  console.log('1. Run: npm run dev');
  console.log('2. Test: curl http://localhost:3000/api/compress-cloudinary');
  console.log('3. Deploy: vercel --prod\n');
  process.exit(0);
}
