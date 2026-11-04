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
    // src/integrations/supabase/client.ts calls createClient() at import time
    // and requires these. Tests must never reach a real Supabase project, so
    // they always get an unroutable loopback URL and a dummy key, whatever
    // the developer's shell exports (guarded by src/test/testEnv.test.ts).
    env: {
      VITE_SUPABASE_URL: 'http://127.0.0.1:9',
      VITE_SUPABASE_PUBLISHABLE_KEY: 'vitest-dummy-publishable-key',
    },
  },
})
