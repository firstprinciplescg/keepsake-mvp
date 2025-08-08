import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        beige: '#F5E1DA',
        terracotta: '#D98880',
        warmbrown: '#5A3E36',
      }
    },
  },
  plugins: [],
}
export default config
