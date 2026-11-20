import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
      '@semcache/shared-types': path.resolve(
        import.meta.dirname,
        '../../packages/shared-types/src/index.ts',
      ),
      '@semcache/shared-dtos': path.resolve(
        import.meta.dirname,
        '../../packages/shared-dtos/src/index.ts',
      ),
    },
  },
  build: {
    commonjsOptions: {
      include: [/shared-types/, /shared-dtos/, /node_modules/],
    },
  },
});
