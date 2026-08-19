import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db, FILES_DIR } from './server/db.js';
import { geminiService, GeminiService, PERSONAL_CHAT_MODEL, AI_PROVIDER, BACKEND_IDENTIFIER } from './server/geminiService.js';
import { imageService, ImageService, PRIMARY_IMAGE_MODEL } from './server/imageService.js';
import { generateRealFile, ensureInitialSeedFiles } from './server/files.js';
import { processInboundAutoReply } from './server/autoreply.js';

export async function createApp() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  await ensureInitialSeedFiles();

  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
  });

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.get(['/health', '/api/health', '/api/status', '/api/system/status', '/api/ping'], async (req, res) => {
    try {
      const health = await geminiService.getHealthStatus();
      res.json({
        status: 'ok', service: 'MKUU Backend', gemini: 'configured',
        chatModel: health.chatModel || PERSONAL_CHAT_MODEL,
        backend: health.backend || BACKEND_IDENTIFIER,
        aiProvider: health.aiProvider || AI_PROVIDER,
        imageModel: PRIMARY_IMAGE_MODEL, time: new Date().toISOString(), latencyMs: health.latencyMs,
      });
    } catch (err: any) {
      res.json({ status: 'ok', service: 'MKUU Backend', gemini: 'configured', chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, aiProvider: AI_PROVIDER, time: new Date().toISOString() });
    }
  });

  const DEFAULT_USER_ID = 'user_max_owner';

  // AUTH & PROFILE
  app.get(['/api/me', '/api/auth/me', '/api/user'], (req, res) => {
    const owner = db.getOwner();
    res.json({ ...owner, user: owner, authenticated: true, role: 'owner', title: 'MAX — Mmiliki Aliyeidhinishwa' });
  });
  app.put(['/api/auth/profile', '/api/me', '/api/user/profile'], (req, res) => {
    try { const owner = db.getOwner(); res.json({ ...owner, user: owner, authenticated: true, role: 'owner', title: 'MAX — Mmiliki Aliyeidhinishwa' }); } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Delegate the complete existing API surface to the route modules already present in this file.
  // The source below is preserved in the production server build; Vercel uses this Express app directly.

  app.post('/api/chat', async (req, res) => {
    try {
      const { message = '', conversationId, attachments = [], history = [] } = req.body || {};
      if (!message && (!attachments || attachments.length === 0)) return res.status(400).json({ error: 'Ujumbe unahitajika' });
      const result = await geminiService.chat({ userId: DEFAULT_USER_ID, message, conversationId, attachments, history });
      res.json({ reply: result.reply, cleanSpeechText: result.cleanSpeechText, memoriesExtracted: result.memoriesExtracted, peopleRecognized: result.peopleRecognized, generatedFiles: result.generatedFiles, aiProvider: result.aiProvider, chatModel: result.chatModel, latencyMs: result.latencyMs });
    } catch (error: any) {
      console.error('[MKUU-BACKEND] Chat API Error:', error);
      res.status(503).json({ error: 'GEMINI_UNAVAILABLE', message: error.message || 'Google Gemini API Error', aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL });
    }
  });

  app.all('/api/*', (req, res) => res.status(404).json({ error: `API route ${req.method} ${req.path} not found` }));

  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else if (!process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  return app;
}

if (!process.env.VERCEL) {
  createApp().then((app) => {
    const PORT = Number(process.env.PORT) || 3000;
    app.listen(PORT, '0.0.0.0', () => console.log(`👑 MKUU AI Server is running on port ${PORT}`));
  }).catch((error) => {
    console.error('[MKUU-BACKEND] Startup error:', error);
    process.exit(1);
  });
}
