/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Plus Jakarta Sans",
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "JetBrains Mono",
          "ui-monospace",
          "SFMono-Regular",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      colors: {
        // Primary product accent — refined indigo/violet SaaS palette
        brand: {
          50: "rgba(99, 102, 241, 0.08)",
          100: "rgba(99, 102, 241, 0.14)",
          200: "rgba(99, 102, 241, 0.22)",
          300: "#a5b4fc",
          400: "#818cf8",
          500: "#6366f1",
          600: "#4f46e5",
          700: "#4338ca",
          800: "#3730a3",
          900: "#312e81",
          950: "#1e1b4b",
        },
        // Secondary accent for gradients + highlights
        accent: {
          50: "rgba(168, 85, 247, 0.08)",
          100: "rgba(168, 85, 247, 0.15)",
          200: "rgba(168, 85, 247, 0.25)",
          300: "#d8b4fe",
          400: "#c084fc",
          500: "#a855f7",
          600: "#9333ea",
          700: "#7e22ce",
          800: "#6b21a8",
          900: "#581c87",
        },
        // Premium Neutral Charcoal Palette (Linear / Stripe / Vercel dark theme)
        ink: {
          50: "#111215",    // deepest wells / inputs / recessed areas
          100: "#16171A",   // standard card surface
          200: "#232529",   // refined hairline borders
          300: "#32353C",   // hover borders / active dividers
          400: "#71717A",   // tertiary text / placeholders / subtle captions
          500: "#A1A1AA",   // muted secondary text (highly readable)
          600: "#D4D4D8",   // regular body text
          700: "#E4E4E7",   // prominent body text
          800: "#F4F4F5",   // headings / bright titles
          900: "#FAFAFA",   // high-contrast headers
          950: "#FFFFFF",   // pure white highlights
        },
        // Explicit dark tokens for modern fintech design
        dark: {
          bg: "#0C0D0E",          // neutral near-black canvas
          sidebar: "#111215",     // subtly differentiated sidebar
          card: "#16171A",        // cards: elevated, tactile, neutral
          cardElevated: "#1C1D21",// modal / floating card / popover
          well: "#111214",        // recessed inputs / table headers
          border: "#232529",      // refined low-contrast borders
          borderSubtle: "rgba(255, 255, 255, 0.05)",
          borderHover: "#33363D", // hover state border
          hover: "#1E2024",       // subtle hover tint
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #4f46e5 0%, #4338ca 100%)",
        "brand-gradient-soft":
          "linear-gradient(135deg, rgba(79,70,229,0.12) 0%, rgba(99,102,241,0.06) 100%)",
        "grid-pattern":
          "linear-gradient(to right, rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        "grid-32": "32px 32px",
      },
      boxShadow: {
        "2xs": "0 1px 2px 0 rgba(0, 0, 0, 0.35)",
        xs: "0 1px 2px 0 rgba(0, 0, 0, 0.4)",
        card: "0 1px 2px 0 rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.05)",
        "card-hover":
          "0 4px 12px -2px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.08)",
        soft: "0 4px 16px -2px rgba(0, 0, 0, 0.5)",
        pop: "0 20px 40px -10px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(255, 255, 255, 0.08)",
        glow: "0 0 0 1px rgba(99, 102, 241, 0.35), 0 2px 8px -2px rgba(99, 102, 241, 0.2)",
        "glow-sm": "0 1px 3px 0 rgba(0, 0, 0, 0.4)",
        "glow-emerald": "0 0 0 1px rgba(16, 185, 129, 0.3)",
        subtle: "0 1px 2px 0 rgba(0, 0, 0, 0.4)",
        "inner-line": "inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
      },
      borderRadius: {
        "2xl": "0.75rem",
        "3xl": "1.25rem",
        "4xl": "1.75rem",
      },
      keyframes: {
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(14px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        "slide-in": {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "pulse-ring": {
          "0%": { transform: "scale(0.8)", opacity: "0.7" },
          "80%, 100%": { transform: "scale(2)", opacity: "0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.25s cubic-bezier(0.22,1,0.36,1) both",
        "fade-up": "fade-up 0.4s cubic-bezier(0.22,1,0.36,1) both",
        "scale-in": "scale-in 0.2s cubic-bezier(0.22,1,0.36,1) both",
        "slide-in": "slide-in 0.25s cubic-bezier(0.22,1,0.36,1) both",
        shimmer: "shimmer 1.6s infinite",
        float: "float 6s ease-in-out infinite",
        "pulse-ring": "pulse-ring 2s cubic-bezier(0.4,0,0.6,1) infinite",
      },
    },
  },
  plugins: [],
};
