// app/layout.tsx

import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import CursorEffect from '@/components/layout/CursorEffect';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-body',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'CompressX — Precision File Compression',
  description: 'Upload any file, set an exact target size in KB or MB, and compress it with production-grade engines. Images, Video, PDF, DOCX, PPTX supported.',
  keywords: ['file compression', 'image compression', 'video compression', 'pdf compression', 'target size'],
  openGraph: {
    title: 'CompressX — Precision File Compression',
    description: 'Compress any file to an exact target size using binary-search algorithms.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${spaceGrotesk.variable}`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#00ffb3" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CompressX" />
        <link rel="apple-touch-icon" href="/logo-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const stored = localStorage.getItem('compressx-theme');
                const theme = stored || 'dark';
                document.documentElement.setAttribute('data-theme', theme);
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          {/* Global custom cursor */}
          <div id="cursor-dot" />
          <CursorEffect />

          {/* Loader overlay */}
          <div id="page-loader">
            <div className="loader-content">
              <div className="loader-logo">CompressX</div>
              <div className="loader-bar-wrap">
                <div className="loader-bar-fill" />
              </div>
              <div className="loader-hint">Initializing compression engine</div>
            </div>
          </div>

          {children}
        </ThemeProvider>

        {/* Loader dismiss script */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('load', function() {
                setTimeout(function() {
                  var loader = document.getElementById('page-loader');
                  if (loader) {
                    loader.style.opacity = '0';
                    loader.style.visibility = 'hidden';
                    setTimeout(function() { loader.remove(); }, 400);
                  }
                }, 90);
              });

              // Register Service Worker
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').then(function(registration) {
                    console.log('[PWA] Service Worker registered:', registration);
                  }).catch(function(error) {
                    console.log('[PWA] Service Worker registration failed:', error);
                  });
                });
              }
            `,
          }}
        />
      </body>
    </html>
  );
}
