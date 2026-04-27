/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        mezo: {
          primary: "#F7931A", // Bitcoin Orange
          secondary: "#1E1E1E", // Dark Gray
          background: "#050505", // Deep Black
          card: "#0F0F0F", // Card Background
          border: "#262626", // Subdued Border
          accent: "#4A90E2", // Soft Blue Accent
          success: "#10B981", // Emerald
          warning: "#F59E0B", // Amber
          danger: "#EF4444", // Red
          muted: "#A3A3A3", // Muted Text
        },
        glass: {
          light: "rgba(255, 255, 255, 0.03)",
          medium: "rgba(255, 255, 255, 0.06)",
          heavy: "rgba(255, 255, 255, 0.1)",
        },
      },
      fontFamily: {
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', 'sans-serif'],
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "gradient-conic": "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
        "mezo-gradient": "linear-gradient(135deg, #F7931A 0%, #E65100 100%)",
        "dark-gradient": "linear-gradient(to bottom, #0F0F0F 0%, #050505 100%)",
        "glass-gradient": "linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0) 100%)",
      },
      boxShadow: {
        glow: "0 0 20px rgba(247, 147, 26, 0.15)",
        "glow-lg": "0 0 40px rgba(247, 147, 26, 0.2)",
        "glow-accent": "0 0 20px rgba(74, 144, 226, 0.15)",
        card: "0 4px 20px rgba(0, 0, 0, 0.5)",
      },
      animation: {
        "pulse-slow": "pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2.5s linear infinite",
        float: "float 6s ease-in-out infinite",
        "spin-slow": "spin 8s linear infinite",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-15px)" },
        },
      },
    },
  },
  plugins: [],
};
