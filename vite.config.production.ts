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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      input: './client/index.html',
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          tonconnect: ['@tonconnect/ui-react'],
          ui: ['@radix-ui/react-dialog', '@radix-ui/react-select', '@radix-ui/react-toast'],
          utils: ['wouter', '@tanstack/react-query', 'lucide-react']
        }
      }
    },
  },
  server: {
    port: 5173,
  },
});