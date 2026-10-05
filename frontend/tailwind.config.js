/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgMain: "#F7F9FC",
        cardBg: "#FFFFFF",
        primaryAccent: "#5B4BDB",
        secondaryAccent: "#7C6CE6",
        statusSuccess: "#16A34A",
        statusWarning: "#D97706",
        statusDanger: "#DC2626",
        statusInfo: "#2563EB",
        textMain: "#172033",
        textSecondary: "#64748B",
        textMuted: "#94A3B8",
        borderColor: "#E5E7EB",
        bgSuccessSoft: "#ECFDF3",
        bgWarningSoft: "#FFF7ED",
        bgDangerSoft: "#FEF2F2",
        bgPurpleSoft: "#F3F0FF",
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Monaco', 'monospace'],
      }
    },
  },
  plugins: [],
}
