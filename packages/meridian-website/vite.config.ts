import { defineConfig } from 'vite';
import { resolve } from 'path';
import { readdirSync, unlinkSync, existsSync } from 'fs';

function stripLargeInstallers() {
  return {
    name: 'strip-large-installers',
    closeBundle() {
      const dlDir = resolve(__dirname, 'dist/downloads');
      if (!existsSync(dlDir)) return;
      for (const name of readdirSync(dlDir)) {
        if (/\.(exe|dmg|zip|msi)$/i.test(name)) {
          unlinkSync(resolve(dlDir, name));
          console.log(`[cloudflare] Removed ${name} from dist (host on R2/GitHub)`);
        }
      }
    },
  };
}

export default defineConfig(({ mode }) => ({
  root: '.',
  publicDir: 'public',
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        contact: resolve(__dirname, 'contact.html'),
        success: resolve(__dirname, 'success.html'),
      },
    },
  },
  plugins: mode === 'cloudflare' ? [stripLargeInstallers()] : [],
}));
