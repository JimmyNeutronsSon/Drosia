import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// `npm run build`         -> dist/        (multi-file, production deploy)
// `npm run build:single`  -> dist-single/ (one self-contained index.html for previews)
export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    base: './',
    plugins: single ? [viteSingleFile()] : [],
    build: {
      outDir: single ? 'dist-single' : 'dist',
      target: 'es2020',
      assetsInlineLimit: single ? 100_000_000 : 4096,
      chunkSizeWarningLimit: 900,
    },
  };
});
