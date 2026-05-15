/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      // ── Taste-skill: Inter banned. Use Outfit / Geist / Satoshi / Cabinet Grotesk
      fontFamily: {
        sans: ['"Outfit"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', '"Fira Code"', 'ui-monospace', 'monospace'],
      },
      colors: {
        mezo: {
          primary: "#F7931A",
          secondary: "#1A1A1A",
          // Taste-skill: pure #000000 banned → use off-black
          background: "#0a0a0a",
          card: "#111111",
          border: "#222222",
          accent: "#4A90E2",
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
          muted: "#888888",
        },
        vezo: {
          red: "#FF0040",
          "red-dim": "rgba(255,0,64,0.12)",
          "red-glow": "rgba(255,0,64,0.22)",
        },
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "mezo-gradient": "linear-gradient(135deg, #F7931A 0%, #E65100 100%)",
        "vezo-gradient": "linear-gradient(135deg, #FF0040 0%, #CC0030 100%)",
        "dark-gradient": "linear-gradient(to bottom, #111111 0%, #0a0a0a 100%)",
        // Taste-skill: tint glass gradient with background hue
        "glass-gradient": "linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0) 100%)",
      },
      boxShadow: {
        // Taste-skill: tint shadows to match background hue, not pure black
        // Off-black (0a0a0a) tinted shadow
        card: "0 4px 24px rgba(0,0,0,0.55), 0 1px 0 rgba(255,255,255,0.04) inset",
        "card-hover": "0 12px 40px rgba(0,0,0,0.7), 0 1px 0 rgba(255,255,255,0.06) inset",
        // Diffusion shadow (taste-skill standard)
        diffuse: "0 20px 40px -15px rgba(0,0,0,0.35)",
        // Liquid glass inner border
        "glass-inner": "inset 0 1px 0 rgba(255,255,255,0.08)",
        // Colored glows — accent-hued
        "glow-red": "0 0 28px rgba(255,0,64,0.18), 0 0 0 1px rgba(255,0,64,0.12)",
        "glow-orange": "0 0 24px rgba(247,147,26,0.15)",
        "glow-blue": "0 0 24px rgba(74,144,226,0.15)",
      },
      animation: {
        shimmer: "shimmer 2.4s linear infinite",
        float: "float 7s ease-in-out infinite",
        "pulse-slow": "pulse 5s cubic-bezier(0.4,0,0.6,1) infinite",
        "spin-slow": "spin 9s linear infinite",
        "fade-up": "fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) both",
        "slide-in-right": "slideInRight 0.45s cubic-bezier(0.16,1,0.3,1) both",
      },
      keyframes: {
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        float: {
          "0%,100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-12px)" },
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(18px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideInRight: {
          "0%": { opacity: "0", transform: "translateX(16px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
      },
      // Taste-skill spring: cubic-bezier(0.16, 1, 0.3, 1) for motion intensity 4-7
      transitionTimingFunction: {
        spring: "cubic-bezier(0.16, 1, 0.3, 1)",
        "spring-bounce": "cubic-bezier(0.34, 1.56, 0.64, 1)",
      },
    },
  },
  plugins: [],
};
