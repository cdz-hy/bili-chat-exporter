/** @type {import('tailwindcss').Config} */
module.exports = {
  // plasmo- 前缀防止与 B 站原生样式冲突
  prefix: "plasmo-",
  content: [
    "./src/popup.tsx",
    "./src/content.tsx",
    "./src/contents/**/*.tsx",
    "./src/components/**/*.tsx",
    "./src/pages/**/*.tsx"
  ],
  theme: {
    extend: {
      colors: {
        bili: {
          pink: "#fb7299",
          blue: "#00aeec"
        }
      }
    },
  },
  plugins: [],
}
