import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicRoot = path.join(__dirname, 'public');

const resolvePublicRoute = (url = '') => {
  const cleanUrl = url.split('?')[0] || '';
  if (cleanUrl === '/' || cleanUrl === '') {
    return 'index.html';
  }
  if (cleanUrl === '/public' || cleanUrl === '/public/') {
    return 'public-scripts.html';
  }
  if (cleanUrl === '/brainstorm' || cleanUrl === '/brainstorm/') {
    return 'brainstorm.html';
  }
  if (cleanUrl === '/profile' || cleanUrl === '/profile/') {
    return 'profile.html';
  }
  if (cleanUrl === '/auth' || cleanUrl === '/auth/' || cleanUrl === '/auth.html') {
    return 'auth.html';
  }
  if (/^\/u\/[^/]+\/?$/.test(cleanUrl)) {
    return 'public-user.html';
  }
  if (/^\/public\/[^/]+\/?$|^\/public\/[^/]+\/[^/]+\/?$/.test(cleanUrl)) {
    return 'public-script.html';
  }
  if (cleanUrl === '/mine' || cleanUrl === '/mine/') {
    return 'index.html';
  }
  if (/^\/mine\/[^/]+\/?$/.test(cleanUrl)) {
    return 'index.html';
  }
  return null;
};

const publicRoutesPlugin = () => ({
  name: 'public-routes',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const target = resolvePublicRoute(req.url || '');
      if (!target) {
        return next();
      }
      const filePath = path.join(publicRoot, target);
      try {
        const html = fs.readFileSync(filePath, 'utf8');
        const transformedHtml = await server.transformIndexHtml(req.url, html);
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
      const target = resolvePublicRoute(req.url || '');
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const backendUrl = env.VITE_API_BASE_URL || env.API_BASE_URL || 'http://localhost:3001';

  return {
    root: './public',
    appType: 'mpa',
    plugins: [publicRoutesPlugin()],
    server: {
      port: Number(env.VITE_DEV_PORT) || 5555,
      host: true,
      cors: true,
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false
        },
        '/public': {
          target: backendUrl,
          changeOrigin: true,
          secure: false
        },
        '/mine': {
          target: backendUrl,
          changeOrigin: true,
          secure: false
        },
        '/brainstorm': {
          target: backendUrl,
          changeOrigin: true,
          secure: false
        },
        '/u': {
          target: backendUrl,
          changeOrigin: true,
          secure: false
        },
        '/profile': {
          target: backendUrl,
          changeOrigin: true,
          secure: false
        }
      },
      headers: {
        'Content-Security-Policy':
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; img-src 'self' data: https:; font-src 'self' https://cdnjs.cloudflare.com; connect-src 'self' http://localhost:* https: wss:;"
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
          publicUser: path.join(publicRoot, 'public-user.html'),
          profile: path.join(publicRoot, 'profile.html'),
          auth: path.join(publicRoot, 'auth.html'),
          brainstorm: path.join(publicRoot, 'brainstorm.html')
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
  };
});
