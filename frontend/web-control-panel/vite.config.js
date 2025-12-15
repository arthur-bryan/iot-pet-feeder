import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import { minify } from 'terser';

function minifyAndCopyJS() {
  return {
    name: 'minify-copy-js',
    async closeBundle() {
      const srcJs = resolve(__dirname, 'public/js');
      const destJs = resolve(__dirname, 'dist/js');
      const srcEnv = resolve(__dirname, 'public/env-config.js');
      const destEnv = resolve(__dirname, 'dist/env-config.js');

      if (!existsSync(destJs)) {
        mkdirSync(destJs, { recursive: true });
      }

      if (existsSync(srcJs)) {
        const files = readdirSync(srcJs);
        for (const file of files) {
          if (file.endsWith('.js')) {
            const srcPath = resolve(srcJs, file);
            const destPath = resolve(destJs, file);
            const code = readFileSync(srcPath, 'utf-8');

            try {
              const minified = await minify(code, {
                compress: {
                  drop_console: true,
                  drop_debugger: true,
                  dead_code: true
                },
                mangle: true,
                format: {
                  comments: false
                }
              });
              writeFileSync(destPath, minified.code);
            } catch (e) {
              copyFileSync(srcPath, destPath);
            }
          }
        }
      }

      if (existsSync(srcEnv)) {
        copyFileSync(srcEnv, destEnv);
      }
    }
  };
}

export default defineConfig({
  root: 'public',
  publicDir: false,
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'public/index.html'),
        schedules: resolve(__dirname, 'public/schedules.html'),
        settings: resolve(__dirname, 'public/settings.html'),
        admin: resolve(__dirname, 'public/admin.html'),
        docs: resolve(__dirname, 'public/docs.html'),
        redoc: resolve(__dirname, 'public/redoc.html')
      }
    }
  },
  plugins: [minifyAndCopyJS()],
  server: {
    port: 3000,
    open: true
  }
});
