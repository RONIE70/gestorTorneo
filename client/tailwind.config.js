/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Mapeamos las variables CSS a nombres de clases de Tailwind
        primary: 'var(--color-primario)',
        secondary: 'var(--color-secundario)',
      },
    },
  },
  plugins: [],
}