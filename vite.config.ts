import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Build provenance for analysis result manifests (Manus PCA audit D14). Vercel provides VERCEL_GIT_COMMIT_SHA.
  define: {
    __VIVASENSE_FRONTEND_COMMIT__: JSON.stringify(process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA || "unknown"),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
