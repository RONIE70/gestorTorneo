/** @type {import('tailwindcss').Config} */
export default {
  // VERIFICA ESTAS RUTAS: Si tus componentes están en carpetas raras, agrégalas aquí
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./pages/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Usamos una función para asegurar que el valor sea procesado
        primary: 'var(--color-primario)',
        secondary: 'var(--color-secundario)',
      },
    },
  },
  plugins: [],
}