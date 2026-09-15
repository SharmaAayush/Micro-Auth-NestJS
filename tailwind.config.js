/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.hbs",   // scan Handlebars templates
    "./src/**/*.ts",      // scan TypeScript for class names (if used)
  ],
  theme: {
    extend: {
      // Add custom colors, fonts, etc. here if needed
      // Example: colors: { primary: '#1a202c' },
    },
  },
  plugins: [],
};