import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({
  base: './',
  build: {
    outDir: 'dist',
    assetsInlineLimit: 100000000, // inline everything: dist/index.html works via file:// double-click
    chunkSizeWarningLimit: 2000,
  },
  plugins: [viteSingleFile()],
  server: { port: 5173 },
});
