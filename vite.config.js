import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/ask':         'http://localhost:8000',
      '/translate':   'http://localhost:8000',
      '/stt':         'http://localhost:8000',
      '/voice':       'http://localhost:8000',
      '/reset':       'http://localhost:8000',
      '/history':     'http://localhost:8000',
      '/static':      'http://localhost:8000',
      '/voices':      'http://localhost:8000',
      '/settings':    'http://localhost:8000',
      '/health':      'http://localhost:8000',
    },
  },
  build: {
    outDir: 'dist',
    lib: {
      entry: path.resolve(__dirname, 'src/main.js'),
      name: 'AIAvatarUi',
      fileName: 'ai-avatar-ui',
    },
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },
});