import express from 'express';
import { geminiService, PERSONAL_CHAT_MODEL, AI_PROVIDER, BACKEND_IDENTIFIER } from '../server/geminiService';
import { imageService, PRIMARY_IMAGE_MODEL } from '../server/imageService';
import { db } from '../server/db';

const app = express();
const DEFAULT_USER_ID = 'user_max_owner';

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  next();
});
app.use(express.json({ limit: '50mb' }));

app.get(['/health', '/api/health'], async (_req, res) => {
  try {
    const health = await geminiService.getHealthStatus();
    res.json({ status: 'ok', service: 'MKUU Backend', gemini: 'configured', chatModel: health.chatModel || PERSONAL_CHAT_MODEL, backend: health.backend || BACKEND_IDENTIFIER, aiProvider: health.aiProvider || AI_PROVIDER, imageModel: PRIMARY_IMAGE_MODEL, latencyMs: health.latencyMs });
  } catch (_error) {
    res.json({ status: 'ok', service: 'MKUU Backend', gemini: 'configured', chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, aiProvider: AI_PROVIDER });
  }
});

app.post(['/api/chat', '/api/chat/'], async (req, res) => {
  try {
    const { message = '', conversationId, conversationHistory = [], isVoice = false, attachments = [] } = req.body || {};
    if (!message && (!attachments || attachments.length === 0)) return res.status(400).json({ error: 'Ujumbe au kiambatisho kinahitajika' });

    const hasImage = attachments?.some((a: any) => a.mimeType?.startsWith('image/') || a.base64Data?.startsWith('data:image/'));
    const lower = String(message).toLowerCase();
    const imageAction = hasImage && (lower.includes('background') || lower.includes('ondoa') || lower.includes('badilisha') || lower.includes('edit') || lower.includes('enhance') || lower.length <= 50);
    if (imageAction || lower.startsWith('picha ya') || lower.includes('tengeneza picha') || lower.includes('unda picha')) {
      const result = await imageService.processImage({ userId: DEFAULT_USER_ID, prompt: message, attachments });
      return res.json({ reply: result.explanation, cleanSpeechText: result.explanation, generatedFiles: [result.file], service: 'ImageService' });
    }

    let history = Array.isArray(conversationHistory) ? conversationHistory : [];
    if (!history.length && conversationId) {
      const conversation = db.getConversation(conversationId, DEFAULT_USER_ID);
      if (conversation?.messages) history = conversation.messages;
    }

    const result = await geminiService.processChat({ userId: DEFAULT_USER_ID, message, conversationHistory: history, isVoice, attachments });
    res.json({ reply: result.reply, cleanSpeechText: result.cleanSpeechText, memoriesExtracted: result.memoriesExtracted, peopleRecognized: result.peopleRecognized, generatedFiles: result.generatedFiles, aiProvider: result.aiProvider, chatModel: result.chatModel, latencyMs: result.latencyMs });
  } catch (error: any) {
    console.error('[MKUU-VERCEL] Chat API Error:', error);
    res.status(503).json({ error: 'GEMINI_UNAVAILABLE', message: error?.message || 'Google Gemini API Error', aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL });
  }
});

app.get('/api/conversations', (_req, res) => res.json(db.getConversations(DEFAULT_USER_ID)));
app.get('/api/memories', (_req, res) => res.json(db.getMemories(DEFAULT_USER_ID)));
app.get('/api/people', (_req, res) => res.json(db.getPeople(DEFAULT_USER_ID)));
app.get('/api/files', (_req, res) => res.json(db.getFiles(DEFAULT_USER_ID)));

export default app;
