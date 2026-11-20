import { defineConfig } from 'vitest/config'

// relative base so the build works from a subpath like /trip-calculator/
export default defineConfig({
  base: './',
  test: {
    environment: 'node',
  },
})
