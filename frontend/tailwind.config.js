import typography from '@tailwindcss/typography'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '4xl': '24px',
        '3xl': '20px',
        xl: "12px",
        "2xl": "16px",
        lg: "8px",
      },
      boxShadow: {
        'soft': "0 8px 24px rgba(0,0,0,0.08)",
        'card': "0 4px 12px rgba(0,0,0,0.06)",
        'modal': "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
        'button': "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
      },
      colors: {
        // Zepofy Forest SaaS Theme
        brand: {
          50: "#F8FAFC",   // Very Light
          100: "#F1F5F9",  // Page Background
          200: "#E2E8F0",  // Border
          300: "#DCFCE7",  // Light Green Accent
          400: "#4ADE80",
          500: "#22C55E",  // Primary Green
          600: "#16A34A",  // Accent Green
          DEFAULT: "#22C55E",
          700: "#15803D",
          800: "#1B4332",  // Sidebar Background (Forest Green)
          900: "#0F172A",  // Text Primary
          950: "#0F172A", 
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        green: {
          soft: "#DCFCE7",
          border: "#E2E8F0",
          dark: "#1B4332",
          hover: "#22543D",
        },
        // Professional secondary palette
        slate: {
          50: "#f8fafc",
          100: "#f1f5f9",
          200: "#e2e8f0",
          300: "#cbd5e1",
          400: "#94a3b8",
          500: "#64748b",
          600: "#475569",
          700: "#334155",
          800: "#1e293b",
          900: "#0f172a",
          950: "#020617",
        },
        // Semantic colors
        success: {
          50: "#f0fdf4",
          500: "#22c55e",
          600: "#16a34a",
        },
        error: {
          50: "#fef2f2",
          500: "#ef4444",
          600: "#dc2626",
        },
        warning: {
          50: "#fffbeb",
          500: "#f59e0b",
          600: "#d97706",
        },
        info: {
          50: "#eff6ff",
          500: "#3b82f6",
          600: "#2563eb",
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [typography],
}