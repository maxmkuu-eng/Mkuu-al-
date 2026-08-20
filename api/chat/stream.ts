import { geminiService, AI_PROVIDER, PERSONAL_CHAT_MODEL } from '../../server/geminiService.js';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
    return;
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no');
  if (typeof res.flushHeaders === 'function') res.flushHeaders();

  const send = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  try {
    const {
      message = '',
      conversationHistory = [],
      isVoice = false,
      attachments = [],
    } = req.body || {};

    if (!message && (!attachments || attachments.length === 0)) {
      send({ type: 'error', message: 'Ujumbe au kiambatisho kinahitajika' });
      res.end();
      return;
    }

    const result = await geminiService.processChat({
      userId: 'user_max_owner',
      message,
      conversationHistory: Array.isArray(conversationHistory) ? conversationHistory : [],
      isVoice: Boolean(isVoice),
      attachments: Array.isArray(attachments) ? attachments : [],
    });

    // The backend currently uses the centralized processChat pipeline. We expose
    // its result through SSE so the client has a stable streaming transport while
    // preserving the same Gemini, memory, people, and file-generation logic.
    const chunks = result.reply.match(/.{1,48}(?:\s+|$)/g) || [result.reply];
    for (const chunk of chunks) {
      if (!chunk) continue;
      send({ type: 'delta', text: chunk });
      await new Promise((resolve) => setTimeout(resolve, 8));
    }

    send({
      type: 'done',
      cleanSpeechText: result.cleanSpeechText,
      memoriesExtracted: result.memoriesExtracted,
      peopleRecognized: result.peopleRecognized,
      generatedFiles: result.generatedFiles,
      aiProvider: result.aiProvider || AI_PROVIDER,
      chatModel: result.chatModel || PERSONAL_CHAT_MODEL,
      latencyMs: result.latencyMs,
    });
    res.end();
  } catch (error: any) {
    console.error('[MKUU-BACKEND] Streaming API Error:', error);
    send({
      type: 'error',
      message: error?.message || 'Google Gemini API Error',
      aiProvider: AI_PROVIDER,
      chatModel: PERSONAL_CHAT_MODEL,
    });
    res.end();
  }
}
