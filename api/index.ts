import express from 'express';
import { geminiService, PERSONAL_CHAT_MODEL, AI_PROVIDER, BACKEND_IDENTIFIER } from '../server/geminiService.js';
import { imageService, PRIMARY_IMAGE_MODEL } from '../server/imageService.js';
import { db } from '../server/db.js';

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
    const { message = '', conversationId, conversationHistory = [], isVoice = false, attachments = [], people = [] } = req.body || {};
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

    // Keep the context bounded so Gemini starts generating sooner and requests stay small.
    history = history.slice(-10);

    // The APK keeps People locally in IndexedDB. Pass that trusted local context to the
    // server so Gemini can answer questions about saved people even when Vercel's
    // serverless filesystem has no persistent database record for them.
    if (Array.isArray(people) && people.length > 0) {
      const peopleContext = people.slice(0, 30).map((p: any) => `- ${p.name}${p.nickname ? ` (${p.nickname})` : ''}: ${p.relationship}; Simu: ${p.phone || 'N/A'}; Maelezo: ${p.notes || 'N/A'}`).join('\n');
      history = [{ role: 'system', content: `TAARIFA ZA WATU WA KARIBU WALIOHIFADHIWA KWENYE APP YA MAX:\n${peopleContext}` }, ...history];
    }

    const result = await geminiService.processChat({ userId: DEFAULT_USER_ID, message, conversationHistory: history, isVoice, attachments });
    res.json({ reply: result.reply, cleanSpeechText: result.cleanSpeechText, memoriesExtracted: result.memoriesExtracted, peopleRecognized: result.peopleRecognized, generatedFiles: result.generatedFiles, aiProvider: result.aiProvider, chatModel: result.chatModel, latencyMs: result.latencyMs });
  } catch (error: any) {
    console.error('[MKUU-VERCEL] Chat API Error:', error);
    res.status(503).json({ error: 'GEMINI_UNAVAILABLE', message: error?.message || 'Google Gemini API Error', aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL });
  }
});

// Dedicated image endpoint for APK/web clients that call /api/image directly.
app.post(['/api/image', '/api/image/'], async (req, res) => {
  try {
    const { prompt = '', attachments = [] } = req.body || {};
    if (!prompt && (!attachments || attachments.length === 0)) {
      return res.status(400).json({ error: 'IMAGE_REQUIRED', message: 'Picha au maelezo ya picha yanahitajika.' });
    }
    const result = await imageService.processImage({ userId: DEFAULT_USER_ID, prompt, attachments });
    return res.json({ reply: result.explanation, cleanSpeechText: result.explanation, generatedFiles: [result.file], modelUsed: result.modelUsed, service: 'ImageService' });
  } catch (error: any) {
    console.error('[MKUU-VERCEL] Image API Error:', error);
    return res.status(503).json({ error: 'IMAGE_UNAVAILABLE', message: error?.message || 'Huduma ya picha haipatikani kwa sasa.' });
  }
});

// Auto Reply phone verification. The OTP is generated and checked in the client;
// this endpoint confirms the verified number and keeps the verification step reachable on Vercel/APK.
app.post('/api/autoreply/verify-phone', async (req, res) => {
  try {
    const phoneNumber = String(req.body?.phoneNumber || '').trim();
    if (!phoneNumber) return res.status(400).json({ error: 'PHONE_REQUIRED', message: 'Nambari ya simu inahitajika.' });
    res.json({ success: true, phoneNumber, phoneVerified: true, phoneVerifiedAt: new Date().toISOString() });
  } catch (error: any) {
    console.error('[MKUU-VERCEL] Auto Reply Verify Error:', error);
    res.status(500).json({ error: 'VERIFY_FAILED', message: error?.message || 'Uthibitishaji haukufanikiwa.' });
  }
});

app.post('/api/autoreply/remove-phone', async (_req, res) => {
  res.json({ success: true, phoneNumber: '', phoneVerified: false });
});

app.get('/api/conversations', (_req, res) => res.json(db.getConversations(DEFAULT_USER_ID)));
app.get('/api/memories', (_req, res) => res.json(db.getMemories(DEFAULT_USER_ID)));
// On Vercel the filesystem is ephemeral. Do not return an empty server list because
// the APK would overwrite its durable local People list with []. Local People are
// sent with each chat request instead.
app.get('/api/people', (_req, res) => {
  const people = db.getPeople(DEFAULT_USER_ID);
  if (people.length === 0) return res.json({ source: 'local', people: [] });
  res.json(people);
});
app.get('/api/files', (_req, res) => res.json(db.getFiles(DEFAULT_USER_ID)));

export default app;
