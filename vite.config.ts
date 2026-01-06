import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // FIX: Only use the repo name in production. Use '/' locally.
  base: mode === 'production' ? "/Guided-Ear-Training/" : "/",
}))