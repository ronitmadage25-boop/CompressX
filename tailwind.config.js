/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          DEFAULT: '#00ffb3',
          2: '#00b8ff',
          3: '#ff006e',
        },
        bg: {
          DEFAULT: '#020407',
          2: '#070b10',
        },
      },
      fontFamily: {
        display: ['Syne', 'Cabinet Grotesk', 'sans-serif'],
        body: ['Cabinet Grotesk', 'system-ui', 'sans-serif'],
        mono: ['DM Mono', 'Fira Code', 'monospace'],
      },
      borderRadius: {
        card: '24px',
        xl2: '20px',
      },
      animation: {
        'float': 'blobFloat 14s ease-in-out infinite alternate',
        'scan': 'scanlineMove 7s linear infinite',
        'pulse-neon': 'sessionPulse 2s ease-in-out infinite',
      },
      backdropBlur: {
        '4xl': '60px',
      },
      boxShadow: {
        neon: '0 0 40px rgba(0,255,179,0.15)',
        'neon-sm': '0 0 12px rgba(0,255,179,0.25)',
        card: '0 24px 80px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};
