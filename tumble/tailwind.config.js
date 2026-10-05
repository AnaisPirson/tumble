/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        tumble: {
          bg: "#0d0f12",       // Deep morgue charcoal
          card: "#161a1e",     // Slightly lighter panel
          border: "#262b32",   // Subtle borders
          blood: "#e11d48",    // Fresh red
          bruise: "#9333ea",   // Purple impact
          gauze: "#e2e8f0",    // Off-white text
          muted: "#64748b",    // Cynical gray
        }
      }
    },
    
  },
  plugins: [],
}
