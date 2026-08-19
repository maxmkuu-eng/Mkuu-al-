import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let appPromise;

export default async function handler(req, res) {
  if (!appPromise) {
    appPromise = import('../dist/server.cjs').then((mod) => mod.default || mod.app || mod);
  }

  try {
    const app = await appPromise;
    return app(req, res);
  } catch (error) {
    console.error('MKUU Vercel backend startup error:', error);
    return res.status(500).json({
      error: 'BACKEND_STARTUP_FAILED',
      message: error?.message || 'Failed to start MKUU backend'
    });
  }
}
