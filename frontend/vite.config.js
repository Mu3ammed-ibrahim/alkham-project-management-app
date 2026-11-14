import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Vitest reads this block, so tests reuse the same React plugin as the app
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    // Fresh mock state per test, so one test's mockReturnValue can't leak into the next
    mockReset: true,
    restoreMocks: true,
    // lib/api.js warns without it; tests never reach a real server
    env: { VITE_BASE_URL: 'http://api.test' },
  },
})
