import express from 'express';
import { geminiService, PERSONAL_CHAT_MODEL, AI_PROVIDER, BACKEND_IDENTIFIER } from '../server/geminiService.js';
import { imageService, PRIMARY_IMAGE_MODEL } from '../server/imageService.js';
import { db } from '../server/db.js';
import { universalAgent } from '../server/agentEngine.js';
import { streamGemini } from '../server/streaming.js';
import { runDiagnostics } from '../server/diagnostics.js';

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
    const httpStatus = health.status === 'connected' ? 200 : 503;
    res.status(httpStatus).json({
      status: health.status === 'connected' ? 'ok' : 'degraded',
      service: 'MKUU Backend',
      gemini: health.status,
      chatModel: health.chatModel || PERSONAL_CHAT_MODEL,
      backend: health.backend || BACKEND_IDENTIFIER,
      aiProvider: health.aiProvider || AI_PROVIDER,
      imageModel: PRIMARY_IMAGE_MODEL,
      latencyMs: health.latencyMs,
      ...(health.error ? { error: health.error } : {}),
    });
  } catch (error: any) {
    console.error('[MKUU-BACKEND] Health check failed:', error);
    res.status(503).json({
      status: 'degraded',
      service: 'MKUU Backend',
      gemini: 'unavailable',
      chatModel: PERSONAL_CHAT_MODEL,
      backend: BACKEND_IDENTIFIER,
      aiProvider: AI_PROVIDER,
      error: error?.message || String(error),
    });
  }
});

// Universal Agent: one entry point for chat, image, documents, spreadsheets and analysis.
app.post(['/api/agent', '/api/agent/'], async (req, res) => {
  try {
    const { message = '', conversationHistory = [], isVoice = false, attachments = [], people = [] } = req.body || {};
    if (!message && (!attachments || attachments.length === 0)) return res.status(400).json({ error: 'Ujumbe au kiambatisho kinahitajika' });
    const plan = universalAgent.plan(message, attachments);
    const result = await universalAgent.execute({
      userId: DEFAULT_USER_ID,
      message,
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory.slice(-10) : [],
      isVoice,
      attachments,
      people,
    });
    res.json({ ...result, plan });
  } catch (error: any) {
    console.error('[MKUU-VERCEL] Agent API Error:', error);
    res.status(503).json({ error: 'AGENT_UNAVAILABLE', message: error?.message || 'MKUU Agent haipatikani kwa sasa.', aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL });
  }
});

app.post('/api/agent/plan', (req, res) => {
  try {
    const { message = '', attachments = [] } = req.body || {};
    if (!message && (!attachments || attachments.length === 0)) return res.status(400).json({ error: 'Ujumbe au kiambatisho kinahitajika' });
    res.json({ success: true, ...universalAgent.plan(message, attachments) });
  } catch (error: any) {
    res.status(400).json({ error: 'PLAN_FAILED', message: error?.message || String(error) });
  }
});

// True server-sent streaming endpoint. Existing /api/chat remains JSON-compatible.
app.post('/api/chat/stream', async (req, res) => {
  const { message = '', conversationHistory = [], people = [], attachments = [] } = req.body || {};
  if (!message && (!attachments || attachments.length === 0)) return res.status(400).json({ error: 'Ujumbe au kiambatisho kinahitajika' });
  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  try {
    for await (const chunk of streamGemini({ userId: DEFAULT_USER_ID, message, conversationHistory, people, attachments })) {
      res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk })}\n\n`);
    }
    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    res.end();
  } catch (error: any) {
    console.error('[MKUU-VERCEL] Streaming API Error:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error?.message || 'Streaming haikupatikana.' })}\n\n`);
    res.end();
  }
});

app.get('/api/system/diagnostics', async (_req, res) => {
  try { res.json(await runDiagnostics()); }
  catch (error: any) { res.status(503).json({ status: 'degraded', error: error?.message || String(error) }); }
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
    history = history.slice(-10);

    if (Array.isArray(people) && people.length > 0) {
      const peopleContext = people.slice(0, 30).map((p: any) => `- ${p.name}${p.nickname ? ` (${p.nickname})` : ''}: ${p.relationship}; Simu: ${p.phone || 'N/A'}; Maelezo: ${p.notes || 'N/A'}`).join('\n');
      history = [{ role: 'system', content: `TAARIFA ZA WATU WA KARIBU WALIOHIFADHIWA KWENYE APP YA MAX:\n${peopleContext}` }, ...history];
    }

    const result = await geminiService.processChat({ userId: DEFAULT_USER_ID, message, conversationHistory: history, isVoice, attachments });
    res.json({ reply: result.reply, cleanSpeechText: result.cleanSpeechText, memoriesExtracted: result.memoriesExtracted, peopleRecognized: result.peopleRecognized, generatedFiles: result.generatedFiles, aiProvider: result.aiProvider, chatModel: result.chatModel, latencyMs: result.latencyMs });
  } catch (error: any) {
    const rawMessage = String(error?.message || error || 'Google Gemini API Error');
    const statusMatch = rawMessage.match(/(?:HTTP|status|code)[\s:=]+(400|401|403|404|409|429|500|502|503|504)\b/i);
    const statusFromMessage = statusMatch ? Number(statusMatch[1]) : 0;
    const isAuth = statusFromMessage === 401 || /authentication|api key|invalid.*key|unauthorized/i.test(rawMessage);
    const isPermission = statusFromMessage === 403 || /permission|forbidden|access denied/i.test(rawMessage);
    const isNotFound = statusFromMessage === 404 || /model_not_found|model.*not found|not found/i.test(rawMessage);
    const isRateLimit = statusFromMessage === 429 || /RESOURCE_EXHAUSTED|rate.?limit|quota|too many requests/i.test(rawMessage);
    const errorType = isAuth ? 'GEMINI_AUTHENTICATION_ERROR'
      : isPermission ? 'GEMINI_PERMISSION_ERROR'
      : isNotFound ? 'GEMINI_MODEL_ERROR'
      : isRateLimit ? 'GEMINI_RATE_LIMIT_ERROR'
      : statusFromMessage >= 500 ? 'GEMINI_SERVER_ERROR'
      : 'GEMINI_REQUEST_ERROR';
    const httpStatus = statusFromMessage >= 400 && statusFromMessage < 600 ? statusFromMessage : 503;
    console.error(`[MKUU-BACKEND] [${errorType}] ${rawMessage}`);
    res.status(httpStatus).json({
      error: errorType,
      message: rawMessage,
      detail: rawMessage,
      aiProvider: AI_PROVIDER,
      chatModel: PERSONAL_CHAT_MODEL,
      timestamp: new Date().toISOString(),
    });
  }
});

app.post(['/api/image', '/api/image/'], async (req, res) => {
  try {
    const { prompt = '', attachments = [] } = req.body || {};
    if (!prompt && (!attachments || attachments.length === 0)) return res.status(400).json({ error: 'IMAGE_REQUIRED', message: 'Picha au maelezo ya picha yanahitajika.' });
    const result = await imageService.processImage({ userId: DEFAULT_USER_ID, prompt, attachments });
    return res.json({ reply: result.explanation, cleanSpeechText: result.explanation, generatedFiles: [result.file], modelUsed: result.modelUsed, service: 'ImageService' });
  } catch (error: any) {
    console.error('[MKUU-VERCEL] Image API Error:', error);
    return res.status(503).json({ error: 'IMAGE_UNAVAILABLE', message: error?.message || 'Huduma ya picha haipatikani kwa sasa.' });
  }
});

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
app.get('/api/people', (_req, res) => {
  const people = db.getPeople(DEFAULT_USER_ID);
  if (people.length === 0) return res.json({ source: 'local', people: [] });
  res.json(people);
});
app.get('/api/files', (_req, res) => res.json(db.getFiles(DEFAULT_USER_ID)));

export default app;
