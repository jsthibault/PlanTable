import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/', // Use '/' for custom domain, '/PlanTable/' for github.io
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
