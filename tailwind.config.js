/** @type {import('tailwindcss').Config} */
export default {
  content: ["./*.html", "./src/**/*.{js,html}"],
  theme: {
    extend: {
      colors: {
        primary: "#0466C8",
        accent: "#00B7FF",
        navy: "#0F1B2D",
        "navy-soft": "#17273D",
        secondary: "#0F1B2D",
        background: "#F5F7FB",
        surface: "#FFFFFF",
        heading: "#13203A",
        body: "#3E4B5C",
        ink: "#FFFFFF",
        "ink-muted": "#9DABC2",
        line: "#E4E9F0",
        muted: "#3E4B5C",
      },
      boxShadow: {
        glow: "0 0 24px rgba(0,183,255,0.35)",
        "glow-sm": "0 0 12px rgba(0,183,255,0.35)",
        "glow-lg": "0 0 48px rgba(0,183,255,0.35)",
        card: "0 1px 2px rgba(16,33,64,0.04), 0 8px 24px rgba(16,33,64,0.06)",
        "card-hover": "0 2px 4px rgba(16,33,64,0.06), 0 16px 40px rgba(16,33,64,0.10)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Plus Jakarta Sans'", "Inter", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "grid-lines":
          "linear-gradient(rgba(0,183,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(0,183,255,0.07) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "40px 40px",
      },
      keyframes: {
        pulseGlow: {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
        dash: {
          to: { strokeDashoffset: "0" },
        },
        fadeUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "pulse-glow": "pulseGlow 2.4s ease-in-out infinite",
        dash: "dash 1.8s ease-out forwards",
        "fade-up": "fadeUp 0.7s ease-out forwards",
      },
    },
  },
  plugins: [],
};
