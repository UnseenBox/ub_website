import { defineConfig } from 'vite'

// Relative base so the build runs from any path: a portal iframe, a zip upload
// or a sub folder such as /arcade/chronodle/ on the studio site.
export default defineConfig({
  base: './',
  build: { target: 'es2020' },
})
