#!/usr/bin/env node

/**
 * Generate PWA icons from SVG
 * Run: node scripts/generate-pwa-icons.js
 * 
 * This script requires sharp to be installed
 * Install with: npm install sharp
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('⚠️  sharp not installed. Using fallback method.');
  console.log('Install with: npm install sharp');
  console.log('\nFor now, please manually convert the SVG logo to PNG:');
  console.log('1. Open public/logo.svg in a browser');
  console.log('2. Right-click → Save as PNG');
  console.log('3. Save as logo-192.png and logo-512.png');
  process.exit(0);
}

const publicDir = path.join(__dirname, '../public');
const svgPath = path.join(publicDir, 'logo.svg');

// Sizes to generate
const sizes = [
  { size: 192, name: 'logo-192.png' },
  { size: 512, name: 'logo-512.png' },
  { size: 192, name: 'logo-192-maskable.png' },
  { size: 512, name: 'logo-512-maskable.png' },
];

async function generateIcons() {
  try {
    if (!fs.existsSync(svgPath)) {
      console.error('❌ SVG file not found:', svgPath);
      process.exit(1);
    }

    console.log('🎨 Generating PWA icons...');

    for (const { size, name } of sizes) {
      const outputPath = path.join(publicDir, name);
      
      await sharp(svgPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 2, g: 4, b: 7, alpha: 1 }
        })
        .png()
        .toFile(outputPath);

      console.log(`✅ Generated ${name} (${size}x${size})`);
    }

    console.log('\n✨ PWA icons generated successfully!');
  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

generateIcons();
