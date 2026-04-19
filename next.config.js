/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: [
      'pdf-lib',
      'jszip',
    ],
  },

  // CORS headers for API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type' },
        ],
      },
    ];
  },

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Let Vercel handle Sharp automatically
      // Don't externalize Sharp - let it be bundled
    }

    return config;
  },
};

module.exports = nextConfig;
