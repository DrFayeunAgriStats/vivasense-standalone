/**
 * Test-only config, kept separate from vite.config.ts.
 *
 * vitest 3 resolves its own nested vite (rollup-based) while the app builds on
 * vite 8 (rolldown). Merging the two configs makes `tsc -b` compare the two
 * plugin types and fail the production build, so the test runner gets its own
 * entry point and the build config stays untouched.
 */
import path from 'path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
