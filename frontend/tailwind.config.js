/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bupa: {
          light: '#f0f9ff',
          50: '#eef8ff',
          100: '#d8eeff',
          200: '#b9dfff',
          300: '#89caff',
          400: '#52aeff',
          500: '#2a8dff',
          600: '#146eff',
          700: '#0d56eb',
          800: '#1146be',
          900: '#153c95',
          950: '#11255b',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
