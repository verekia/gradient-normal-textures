import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        pca: resolve(__dirname, 'pca.html'),
        test: resolve(__dirname, 'test.html'),
      },
    },
  },
});
