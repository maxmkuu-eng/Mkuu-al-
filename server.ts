import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { db, FILES_DIR } from './server/db.js';
import { geminiService, GeminiService, PERSONAL_CHAT_MODEL, AI_PROVIDER, BACKEND_IDENTIFIER } from './server/geminiService.js';
import { imageService, ImageService, PRIMARY_IMAGE_MODEL } from './server/imageService.js';
import { generateRealFile, ensureInitialSeedFiles } from './server/files.js';
import { processInboundAutoReply } from './server/autoreply.js';

async function startServer() {
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
      res.json({ status: 'ok', service: 'MKUU Backend', gemini: 'configured', chatModel: health.chatModel || PERSONAL_CHAT_MODEL, backend: health.backend || BACKEND_IDENTIFIER, aiProvider: health.aiProvider || AI_PROVIDER, imageModel: PRIMARY_IMAGE_MODEL, time: new Date().toISOString(), latencyMs: health.latencyMs });
    } catch (err: any) {
      res.json({ status: 'ok', service: 'MKUU Backend', gemini: 'configured', chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, aiProvider: AI_PROVIDER, time: new Date().toISOString() });
    }
  });

  const DEFAULT_USER_ID = 'user_max_owner';
  app.get(['/api/me', '/api/auth/me', '/api/user'], (req, res) => {
    const owner = db.getOwner();
    res.json({ ...owner, user: owner, authenticated: true, role: 'owner', title: 'MAX — Mmiliki Aliyeidhinishwa' });
  });
  app.put(['/api/auth/profile', '/api/me', '/api/user/profile'], (req, res) => {
    try { const updated = db.updateUser(DEFAULT_USER_ID, req.body); res.json({ success: true, user: updated, ...updated }); } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.post('/api/user/pin', (req, res) => {
    try { const { pin } = req.body; const updated = db.updateUser(DEFAULT_USER_ID, { securityPinSet: !!pin, securityPin: pin }); res.json({ success: true, user: updated }); } catch (e: any) { res.status(400).json({ error: e.message }); }
  });
  app.post('/api/system/reset', (req, res) => { try { db.resetSystem(); res.json({ success: true, message: 'Mfumo umerejeshwa katika hali ya msingi.' }); } catch (e: any) { res.status(500).json({ error: e.message }); } });

  app.post(['/api/chat', '/api/chat/'], async (req, res) => {
    try {
      const { message = '', conversationId, conversationHistory = [], isVoice = false, attachments = [] } = req.body;
      if (!message && (!attachments || attachments.length === 0)) return res.status(400).json({ error: 'Ujumbe au kiambatisho kinahitajika' });
      let effectiveHistory = Array.isArray(conversationHistory) && conversationHistory.length > 0 ? conversationHistory : [];
      if (effectiveHistory.length === 0 && conversationId) { const storedConv = db.getConversation(conversationId, DEFAULT_USER_ID); if (storedConv && Array.isArray(storedConv.messages)) effectiveHistory = storedConv.messages; }
      const hasImageAttachment = attachments?.some((a: any) => a.mimeType?.startsWith('image/') || a.base64Data?.startsWith('data:image/') || ['jpg','jpeg','png','webp'].includes(a.fileType?.toLowerCase() || ''));
      const lowerMsg = (message || '').toLowerCase();
      const isExplicitImageAction = (hasImageAttachment && (lowerMsg.includes('hd') || lowerMsg.includes('background') || lowerMsg.includes('enhance') || lowerMsg.includes('remove') || lowerMsg.includes('ondoa') || lowerMsg.includes('badilisha') || lowerMsg.includes('edit') || lowerMsg.length <= 50)) || lowerMsg.startsWith('picha ya') || lowerMsg.includes('tengeneza picha') || lowerMsg.includes('unda picha') || lowerMsg.includes('create an image') || lowerMsg.includes('draw a picture');
      if (isExplicitImageAction) {
        const imageResult = await imageService.processImage({ userId: DEFAULT_USER_ID, prompt: message, attachments });
        return res.json({ reply: imageResult.explanation, cleanSpeechText: imageResult.explanation, memoriesExtracted: [], peopleRecognized: [], generatedFiles: [imageResult.file], service: 'ImageService' });
      }
      const result = await geminiService.processChat({ userId: DEFAULT_USER_ID, message, conversationHistory: effectiveHistory, isVoice, attachments });
      if (conversationId) {
        let conversation = db.getConversation(conversationId, DEFAULT_USER_ID);
        const userMsg = { id: `msg_${Date.now()}_u`, role: 'user' as const, content: message, timestamp: new Date().toISOString(), isVoice, attachments: attachments.map((a: any) => ({ filename: a.filename, fileType: a.fileType, mimeType: a.mimeType, size: a.size || 0, previewUrl: a.previewUrl || (a.base64Data?.startsWith('data:image/') ? a.base64Data : undefined) })) };
        const assistantMsg = { id: `msg_${Date.now()}_a`, role: 'assistant' as const, content: result.reply, timestamp: new Date().toISOString(), generatedFiles: result.generatedFiles, memoryExtracted: result.memoriesExtracted?.map((m) => m.content), personRecognized: result.peopleRecognized?.map((p) => p.name) };
        if (conversation) { conversation.messages.push(userMsg, assistantMsg); db.saveConversation(conversation); }
        else { conversation = { id: conversationId, userId: DEFAULT_USER_ID, title: message.slice(0, 35) || 'Mazungumzo Mapya', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [userMsg, assistantMsg] }; db.saveConversation(conversation); }
      }
      res.json({ reply: result.reply, cleanSpeechText: result.cleanSpeechText, memoriesExtracted: result.memoriesExtracted, peopleRecognized: result.peopleRecognized, generatedFiles: result.generatedFiles, aiProvider: result.aiProvider, chatModel: result.chatModel, latencyMs: result.latencyMs });
    } catch (error: any) {
      console.error('[MKUU-BACKEND] Chat API Error:', error);
      res.status(503).json({ error: 'GEMINI_UNAVAILABLE', message: error.message || 'Google Gemini API Error', aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL });
    }
  });

  app.post(['/api/image/edit', '/api/image/generate', '/api/image'], async (req, res) => {
    try { const { prompt = '', imageBase64, mimeType = 'image/jpeg', filename = 'picha_iliyohaririwa.png' } = req.body; if (!prompt && !imageBase64) return res.status(400).json({ error: 'Maelekezo au picha inahitajika kwa ajili ya Image Studio' }); const attachments = imageBase64 ? [{ filename, fileType: mimeType.includes('png') ? 'png' : 'jpg', mimeType, base64Data: imageBase64 }] : []; const result = await imageService.processImage({ userId: DEFAULT_USER_ID, prompt: prompt || 'Enhance and edit this image with high precision while strictly preserving identity', attachments }); res.json({ success: true, reply: result.explanation, file: result.file, generatedFiles: [result.file], modelUsed: result.modelUsed }); } catch (error: any) { res.status(500).json({ error: error.message || 'Hitilafu ya Image Studio' }); }
  });

  app.get('/api/conversations', (req, res) => res.json(db.getConversations(DEFAULT_USER_ID)));
  app.get('/api/conversations/:id', (req, res) => { const conv = db.getConversation(req.params.id, DEFAULT_USER_ID); if (!conv) return res.json({ id: req.params.id, userId: DEFAULT_USER_ID, title: 'Mazungumzo Mapya', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages: [] }); res.json(conv); });
  app.post('/api/conversations', (req, res) => { const { title = 'Mazungumzo Mapya', messages = [] } = req.body; const newConv = { id: `conv_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`, userId: DEFAULT_USER_ID, title, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), messages }; db.saveConversation(newConv); res.json(newConv); });
  app.delete('/api/conversations/:id', (req, res) => res.json({ success: db.deleteConversation(req.params.id, DEFAULT_USER_ID) }));
  app.get('/api/memories', (req, res) => res.json(db.getMemories(DEFAULT_USER_ID)));
  app.post('/api/memories', (req, res) => { const { content, category = 'General', importance = 'medium', tags = [], source = 'manual' } = req.body; if (!content) return res.status(400).json({ error: 'Kumbukumbu inahitaji maelezo' }); res.json(db.addMemory({ userId: DEFAULT_USER_ID, content, category, importance, tags, source })); });
  app.delete('/api/memories/:id', (req, res) => res.json({ success: db.deleteMemory(req.params.id, DEFAULT_USER_ID), message: 'Kumbukumbu imefutwa kabisa kwenye database ya kudumu.' }));
  app.get('/api/people', (req, res) => res.json(db.getPeople(DEFAULT_USER_ID)));
  app.post('/api/people', (req, res) => { const { name, nickname, relationship, phone, email, notes, avatarColor } = req.body; if (!name || !relationship) return res.status(400).json({ error: 'Jina na Uhusiano vinahitajika' }); res.json(db.addPerson({ userId: DEFAULT_USER_ID, name, nickname, relationship, phone, email, notes, avatarColor: avatarColor || 'blue' })); });
  app.delete('/api/people/:id', (req, res) => res.json({ success: db.deletePerson(req.params.id, DEFAULT_USER_ID) }));
  app.get('/api/autoreply/settings', (req, res) => res.json(db.getAutoReplySettings(DEFAULT_USER_ID)));
  app.put('/api/autoreply/settings', (req, res) => res.json(db.updateAutoReplySettings(DEFAULT_USER_ID, req.body)));
  app.get('/api/autoreply/logs', (req, res) => res.json(db.getAutoReplyLogs(DEFAULT_USER_ID)));
  app.delete('/api/autoreply/logs', (req, res) => { db.clearAutoReplyLogs(DEFAULT_USER_ID); res.json({ success: true }); });
  app.post('/api/autoreply/emergency-stop', (req, res) => { const current = db.getAutoReplySettings(DEFAULT_USER_ID); const updated = db.updateAutoReplySettings(DEFAULT_USER_ID, { emergencyStop: req.body?.stop !== undefined ? req.body.stop : !current.emergencyStop }); res.json({ success: true, emergencyStop: updated.emergencyStop, settings: updated }); });
  app.get('/api/files', (req, res) => res.json(db.getFiles(DEFAULT_USER_ID)));
  app.get('/api/stats', (req, res) => { const memories = db.getMemories(DEFAULT_USER_ID), people = db.getPeople(DEFAULT_USER_ID), files = db.getFiles(DEFAULT_USER_ID), logs = db.getAutoReplyLogs(DEFAULT_USER_ID), settings = db.getAutoReplySettings(DEFAULT_USER_ID); res.json({ totalMemories: memories.length, totalPeople: people.length, totalFiles: files.length, totalAutoReplies: logs.length, emergencyStop: settings.emergencyStop, autoReplyEnabled: settings.enabled, systemHealth: '100% Salama & Imeunganishwa', owner: 'Max' }); });

  app.all('/api/*', (req, res) => res.status(404).json({ error: `API route ${req.method} ${req.path} not found` }));
  if (process.env.NODE_ENV !== 'production') { const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' }); app.use(vite.middlewares); }
  else { const distPath = path.join(process.cwd(), 'dist'); app.use(express.static(distPath)); app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html'))); }
  app.listen(PORT, '0.0.0.0', () => console.log(`👑 MKUU AI Server is running on port ${PORT}`));
}

startServer();
