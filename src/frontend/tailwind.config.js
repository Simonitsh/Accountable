import typography from "@tailwindcss/typography";
import containerQueries from "@tailwindcss/container-queries";
import animate from "tailwindcss-animate";

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: ["index.html", "src/**/*.{js,ts,jsx,tsx,html,css}"],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "oklch(var(--border))",
        input: "oklch(var(--input))",
        ring: "oklch(var(--ring) / <alpha-value>)",
        background: "oklch(var(--background))",
        foreground: "oklch(var(--foreground))",
        primary: {
          DEFAULT: "oklch(var(--primary) / <alpha-value>)",
          foreground: "oklch(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "oklch(var(--secondary) / <alpha-value>)",
          foreground: "oklch(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "oklch(var(--destructive) / <alpha-value>)",
          foreground: "oklch(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "oklch(var(--muted) / <alpha-value>)",
          foreground: "oklch(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "oklch(var(--accent) / <alpha-value>)",
          foreground: "oklch(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "oklch(var(--popover))",
          foreground: "oklch(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "oklch(var(--card))",
          foreground: "oklch(var(--card-foreground))",
        },
        chart: {
          1: "oklch(var(--chart-1))",
          2: "oklch(var(--chart-2))",
          3: "oklch(var(--chart-3))",
          4: "oklch(var(--chart-4))",
          5: "oklch(var(--chart-5))",
        },
        sidebar: {
          DEFAULT: "oklch(var(--sidebar))",
          foreground: "oklch(var(--sidebar-foreground))",
          primary: "oklch(var(--sidebar-primary))",
          "primary-foreground": "oklch(var(--sidebar-primary-foreground))",
          accent: "oklch(var(--sidebar-accent))",
          "accent-foreground": "oklch(var(--sidebar-accent-foreground))",
          border: "oklch(var(--sidebar-border))",
          ring: "oklch(var(--sidebar-ring))",
        },
        /* Professional semantic accent palette */
        "accent-success": "#10b981",
        "accent-skip": "#0369a1",
        "accent-social": "oklch(var(--color-accent-social))",
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        body: ["var(--font-body)", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      boxShadow: {
        xs: "0 1px 2px 0 rgba(0,0,0,0.05)",
        "neu-light": "-4px -4px 10px rgba(255,255,255,0.9), 6px 6px 14px rgba(163,177,198,0.65)",
        "neu-dark": "-4px -4px 10px rgba(255,255,255,0.04), 6px 6px 14px rgba(0,0,0,0.55)",
        "neu-inset-light": "inset 4px 4px 8px rgba(163,177,198,0.55), inset -4px -4px 8px rgba(255,255,255,0.7)",
        "neu-inset-dark": "inset 4px 4px 8px rgba(0,0,0,0.5), inset -4px -4px 8px rgba(255,255,255,0.04)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "trace-border": {
          from: { strokeDashoffset: "var(--trace-perimeter, 1000)" },
          to: { strokeDashoffset: "0" },
        },
        "swipe-reveal": {
          from: { opacity: "0", transform: "scale(0.85)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "card-lock": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(0.975)" },
          "100%": { transform: "scale(1)" },
        },
        "avatar-swatch-pulse": {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(16,185,129,0.0)" },
          "50%": { boxShadow: "0 0 0 3px rgba(16,185,129,0.25)" },
        },
        "goal-chips-out": {
          from: { opacity: "1", transform: "translateY(0) scale(1)" },
          to: { opacity: "0", transform: "translateY(8px) scale(0.96)" },
        },
        "goal-chips-in": {
          from: { opacity: "0", transform: "translateY(-8px) scale(0.96)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "goal-fill-pop": {
          "0%": { transform: "scale(1)" },
          "40%": { transform: "scale(1.015)" },
          "100%": { transform: "scale(1)" },
        },
        /* ── Goal wizard (Bloom & Flow) keyframes ────────────────────────── */
        /* Bloom: a selected category tile expands radially with a gold ring
           halo. Scale 0.94 → 1.06 → 1 with a soft gold box-shadow bloom that
           fades in then settles. Slower (620ms) and softer than card-lock
           (250ms) so it reads as organic growth, not a tactile snap. */
        "goal-wizard-bloom": {
          "0%": {
            transform: "scale(0.94)",
            boxShadow:
              "0 0 0 0 oklch(0.74 0.13 85 / 0), -4px -4px 10px rgba(80,80,85,0.4), 6px 6px 14px rgba(0,0,0,0.7)",
          },
          "55%": {
            transform: "scale(1.06)",
            boxShadow:
              "0 0 0 6px oklch(0.74 0.13 85 / 0.35), 0 0 22px 4px oklch(0.74 0.13 85 / 0.28), -4px -4px 10px rgba(80,80,85,0.4), 6px 6px 14px rgba(0,0,0,0.7)",
          },
          "100%": {
            transform: "scale(1)",
            boxShadow:
              "0 0 0 3px oklch(0.74 0.13 85 / 0.5), 0 0 12px 1px oklch(0.74 0.13 85 / 0.18), -4px -4px 10px rgba(80,80,85,0.4), 6px 6px 14px rgba(0,0,0,0.7)",
          },
        },
        /* Flowing path: SVG path draws itself via stroke-dashoffset. The path
           element sets pathLength="1" so dashoffset 1 → 0 draws the full vine.
           Paired with a dash array for a hand-drawn vine rhythm. */
        "goal-wizard-path-draw": {
          from: { strokeDashoffset: "1" },
          to: { strokeDashoffset: "0" },
        },
        /* Flowing path ambient pulse — the drawn vine gently breathes opacity
           so the progress path feels alive between steps. Subtle, slow. */
        "goal-wizard-path-pulse": {
          "0%, 100%": { opacity: "0.7" },
          "50%": { opacity: "1" },
        },
        /* Text reveal: field text wipes in left-to-right via a clip-path inset.
           Triggered as a field fills — the clip starts fully inset on the
           right and opens to reveal the full text. Pairs with a gold underline
           that grows from 0 width to full. */
        "goal-wizard-text-reveal": {
          "0%": {
            clipPath: "inset(0 100% 0 0)",
            opacity: "0",
          },
          "60%": {
            clipPath: "inset(0 0 0 0)",
            opacity: "1",
          },
          "100%": {
            clipPath: "inset(0 0 0 0)",
            opacity: "1",
          },
        },
        /* Text-reveal underline: a 2px gold gradient bar grows from the left
           under the revealed text. Runs in parallel with text-reveal. */
        "goal-wizard-underline-grow": {
          "0%": { transform: "scaleX(0)" },
          "100%": { transform: "scaleX(1)" },
        },
        /* Step settle: when a wizard step becomes active, its content drops in
           from -12px with a fade — softer than the WOOP wizard's translate-x-8
           slide. Reads as a petal unfolding. */
        "goal-wizard-step-settle": {
          "0%": { opacity: "0", transform: "translateY(-12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "trace-border": "trace-border var(--hold-duration, 1200ms) linear forwards",
        "swipe-reveal": "swipe-reveal 0.18s ease-out",
        "card-lock": "card-lock 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)",
        "avatar-swatch-pulse": "avatar-swatch-pulse 1.2s ease-in-out",
        "goal-chips-out":
          "goal-chips-out var(--goal-chips-out-duration, 280ms) cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "goal-chips-in":
          "goal-chips-in var(--goal-chips-in-duration, 320ms) cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "goal-fill-pop":
          "goal-fill-pop var(--goal-fill-pop-duration, 420ms) cubic-bezier(0.34, 1.56, 0.64, 1)",
        /* ── Goal wizard (Bloom & Flow) animations ──────────────────────── */
        "goal-wizard-bloom":
          "goal-wizard-bloom var(--goal-wizard-bloom-duration, 620ms) cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "goal-wizard-path-draw":
          "goal-wizard-path-draw var(--goal-wizard-path-draw-duration, 820ms) cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "goal-wizard-path-pulse":
          "goal-wizard-path-pulse 2.6s ease-in-out infinite",
        "goal-wizard-text-reveal":
          "goal-wizard-text-reveal var(--goal-wizard-text-reveal-duration, 540ms) cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "goal-wizard-underline-grow":
          "goal-wizard-underline-grow var(--goal-wizard-text-reveal-duration, 540ms) cubic-bezier(0.4, 0, 0.2, 1) forwards",
        "goal-wizard-step-settle":
          "goal-wizard-step-settle var(--goal-wizard-step-settle-duration, 480ms) cubic-bezier(0.4, 0, 0.2, 1) forwards",
      },
    },
  },
  plugins: [typography, containerQueries, animate],
};
