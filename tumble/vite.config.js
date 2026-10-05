import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Replace 'tumble' with whatever your GitHub repo name will eventually be!
export default defineConfig({
  plugins: [react()],
  base: '/tumble/', 
})
