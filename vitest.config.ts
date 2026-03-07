import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    exclude: [
      'tests/e2e/**',
      'node_modules/**',
    ],
    alias: {
      'server-only': path.resolve(
        __dirname, 
        'tests/__mocks__/server-only.ts'
      ),
    },
  },
})
