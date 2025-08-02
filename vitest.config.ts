import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts', 'workers/__tests__/**/*.test.ts'],
    exclude: ['node_modules', 'tmp-*/**', 'frontend/**', '.react-router/**']
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})