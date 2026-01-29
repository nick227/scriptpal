import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicRoot = path.join(__dirname, 'public');

const resolvePublicRoute = (url = '') => {
  if (url === '/' || url === '') {
    return 'index.html';
  }
  if (url === '/public' || url === '/public/') {
    return 'public-scripts.html';
  }
  if (url === '/auth' || url === '/auth/' || url === '/auth.html') {
    return 'auth.html';
  }
  if (/^\/public\/[^/]+\/?$/.test(url)) {
    return 'public-script.html';
  }
  if (url === '/mine' || url === '/mine/') {
    return 'index.html';
  }
  if (/^\/mine\/[^/]+\/?$/.test(url)) {
    return 'index.html';
  }
  return null;
};

const publicRoutesPlugin = () => ({
  name: 'public-routes',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url ? req.url.split('?')[0] : '';
      const target = resolvePublicRoute(url);
      if (!target) {
        return next();
      }
      const filePath = path.join(publicRoot, target);
      try {
        const html = fs.readFileSync(filePath, 'utf8');
        const transformedHtml = await server.transformIndexHtml(url, html);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.statusCode = 200;
        res.end(transformedHtml);
      } catch (error) {
        next(error);
      }
    });
  },
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      const url = req.url ? req.url.split('?')[0] : '';
      const target = resolvePublicRoute(url);
      if (!target) {
        return next();
      }
      const filePath = path.join(publicRoot, target);
      try {
        const html = fs.readFileSync(filePath, 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.statusCode = 200;
        res.end(html);
      } catch (error) {
        next(error);
      }
    });
  }
});

export default defineConfig({
  root: './public',
  appType: 'mpa',
  plugins: [publicRoutesPlugin()],
  server: {
    port: 5555,
    host: true,
    cors: true,
    headers: {
      'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: https:; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self' http://localhost:* https: wss:;"
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        index: path.join(publicRoot, 'index.html'),
        publicScripts: path.join(publicRoot, 'public-scripts.html'),
        publicScript: path.join(publicRoot, 'public-script.html'),
        auth: path.join(publicRoot, 'auth.html')
      },
      external: ['fsevents'],
      output: {
        manualChunks: {
          vendor: ['vite']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['vite']
  }
});
