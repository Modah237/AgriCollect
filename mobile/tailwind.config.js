/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        agricultural: {
          green: "#2D6A27",
          dark: "#1C3D1A",
          light: "#E0EBD9",
        },
        cameroon: {
          yellow: "#FFD700",
          red: "#CE1126",
        }
      }
    },
  },
  plugins: [],
}
