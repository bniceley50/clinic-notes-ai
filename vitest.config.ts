import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      'server-only': path.resolve(__dirname, 'tests/__mocks__/server-only.ts'),
    },
  },
  test: {
    environment: 'node',
    exclude: [
      'tests/e2e/**',
      'node_modules/**',
    ],
  },
})