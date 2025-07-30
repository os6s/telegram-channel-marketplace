import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Production build config without Replit plugins that cause issues
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
      '@shared': path.resolve(__dirname, './shared'),
      '@assets': path.resolve(__dirname, './attached_assets'),
    },
  },
  root: 'client',
  build: {
    outDir: '../dist/public',
    emptyOutDir: true,
    rollupOptions: {
      input: './client/index.html',
    },
  },
  server: {
    port: 5173,
  },
});