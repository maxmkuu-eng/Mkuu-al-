import { GoogleGenAI } from '@google/genai';
import { db, Memory, Person, GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';

// ============================================================================
// MKUU BACKEND - CENTRALIZED GEMINI AI SERVICE CONFIGURATION
// ============================================================================
// Architecture:
// MKUU AI APP -> MKUU BACKEND (/api/chat) -> GeminiService -> Google Gemini API (gemini-3.7-flash)
// Live-search path is handled by server.ts -> Exa directly. GeminiService is normal-chat only.
// ============================================================================

export const AI_PROVIDER = 'Google Gemini';
export const PERSONAL_CHAT_MODEL = 'gemini-3.7-flash';
export const LIVE_SEARCH_MODEL = 'exa-live-search';
export const BACKEND_IDENTIFIER = 'MKUU Server';

export const CHAT_MODEL_FALLBACKS = [
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
];

function extractRetryDelayMs(err: any): number {
  try {
    const errMsg = typeof err === 'string' ? err : err?.message || JSON.stringify(err);
    const match = errMsg.match(/retry in ([0-9.]+)s/i) || errMsg.match(/"retryDelay":\s*"([0-9.]+)s"/i);
    if (match && match[1]) {
      const sec = parseFloat(match[1]);
      return Math.min(Math.ceil(sec * 1000) + 300, 3500);
    }
  } catch {}
  return 1500;
}

export function getCurrentTanzaniaTimeContext() {
  const now = new Date();
  const timeZone = 'Africa/Dar_es_Salaam';
  const formatter = new Intl.DateTimeFormat('sw-TZ', {
    timeZone,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || '';
  return {
    formattedString: `${get('weekday')}, ${get('day')} ${get('month')} ${get('year')}, saa ${get('hour')}:${get('minute')}:${get('second')}, Africa/Dar_es_Salaam (UTC+3)`,
    dayOfWeek: get('weekday'), dateString: `${get('day')} ${get('month')} ${get('year')}`,
    timeString: `${get('hour')}:${get('minute')}:${get('second')}`, timeZone, iso: now.toISOString(),
  };
}

export interface ChatMessage { role: 'user' | 'assistant' | 'model' | string; content: string; attachments?: any[]; generatedFiles?: any[]; }
export interface ProcessChatParams { userId: string; message: string; conversationHistory?: ChatMessage[]; isVoice?: boolean; attachments?: Array<{ filename: string; fileType: string; mimeType: string; size?: number; base64Data?: string; }>; }
export interface ChatProcessResult { reply: string; cleanSpeechText: string; memoriesExtracted: Array<{ category: string; content: string }>; peopleRecognized: Array<{ name: string; relationship: string }>; generatedFiles: GeneratedFileSummary[]; aiProvider: string; chatModel: string; latencyMs: number; }

export class GeminiService {
  private static instance: GeminiService | null = null;
  private aiClient: GoogleGenAI | null = null;
  public static readonly AI_PROVIDER = AI_PROVIDER;
  public static readonly PERSONAL_CHAT_MODEL = PERSONAL_CHAT_MODEL;
  public static readonly BACKEND_IDENTIFIER = BACKEND_IDENTIFIER;
  public static getInstance() { if (!GeminiService.instance) GeminiService.instance = new GeminiService(); return GeminiService.instance; }
  private getClient() {
    if (!this.aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');
      this.aiClient = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'mkuu-ai-backend-gemini-service' } } });
    }
    return this.aiClient;
  }
  public async getHealthStatus(): Promise<any> {
    const started = Date.now();
    try {
      await this.getClient().models.generateContent({ model: PERSONAL_CHAT_MODEL, contents: { parts: [{ text: 'Ping status check' }] } });
      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date.now() - started };
    } catch (e: any) {
      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'unavailable', latencyMs: Date.now() - started, error: e?.message };
    }
  }
  public async processChat(params: ProcessChatParams): Promise<ChatProcessResult> {
    const started = Date.now();
    const { userId, message, conversationHistory = [], attachments = [] } = params;
    const user = db.getUser(userId) || db.getOwner();
    const memories = db.getMemories(userId);
    const people = db.getPeople(userId);
    const newlySavedMemory = this.detectAndSaveMemory(userId, message);
    const newlySavedPerson = this.detectAndSavePerson(userId, message);
    const systemPrompt = this.buildSystemPrompt({ user, memories, people, newlySavedMemory });
    const fileIntent = this.detectFileGenerationIntent(message);
    const generatedFilesList: GeneratedFileSummary[] = [];
    const contents = this.buildConversationHistory(conversationHistory, message, attachments);
    let aiReplyText = '';
    try {
      aiReplyText = await this.executeGeminiCallWithFallback({ contents, config: { systemInstruction: systemPrompt, temperature: 0.7 }, preferredModel: PERSONAL_CHAT_MODEL });
    } catch (err: any) {
      const msg = String(err?.message || err);
      if (/429|RESOURCE_EXHAUSTED|quota|Rate limit/i.test(msg)) aiReplyText = 'Mkuu wangu **Max**, seva za Gemini zimepata msongamano wa muda mfupi wa maombi. Tafadhali jaribu tena.';
      else throw new Error(`Google Gemini API (${PERSONAL_CHAT_MODEL}) Error: ${msg}`);
    }
    if (fileIntent) {
      try {
        generatedFilesList.push(await generateRealFile({ userId, filename: fileIntent.filename, fileType: fileIntent.fileType, title: fileIntent.title, content: aiReplyText, description: fileIntent.description }));
      } catch (e) { console.warn('[MKUU-BACKEND] File generation note:', e); }
    }
    return { reply: aiReplyText, cleanSpeechText: this.cleanMarkdownForVoice(aiReplyText), memoriesExtracted: newlySavedMemory ? [{ category: newlySavedMemory.category, content: newlySavedMemory.content }] : [], peopleRecognized: newlySavedPerson ? [{ name: newlySavedPerson.name, relationship: newlySavedPerson.relationship }] : [], generatedFiles: generatedFilesList, aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, latencyMs: Date.now() - started };
  }
  private async executeGeminiCallWithFallback(p: { contents: any; config?: any; preferredModel?: string }) {
    const client = this.getClient();
    const preferred = p.preferredModel || PERSONAL_CHAT_MODEL;
    let lastError: any = null;
    for (const model of [preferred, ...CHAT_MODEL_FALLBACKS.filter((m) => m !== preferred)]) {
      try {
        const response = await client.models.generateContent({ model, contents: p.contents, config: p.config });
        if (response.text?.trim()) return response.text;
      } catch (error) { lastError = error; await new Promise((resolve) => setTimeout(resolve, extractRetryDelayMs(error))); }
    }
    throw lastError || new Error('All Gemini model candidates are temporarily unavailable.');
  }
  private buildSystemPrompt(context: any): string {
    return `Wewe ni MKUU AI (Mkuu), msaidizi binafsi wa MAX. Backend ya MKUU kwa majibu ya kawaida hutumia Google Gemini API kupitia ${PERSONAL_CHAT_MODEL}. MUDA WA TANZANIA: ${getCurrentTanzaniaTimeContext().formattedString}. Jibu kwa Kiswahili inapofaa, kuwa sahihi, wazi na mfupi. USITUMIE web search tools katika huduma hii; live/current/news/sports/fresh queries zinaroutiwa na /api/chat moja kwa moja kwenda Exa kabla hazijafika hapa. Usijibu live query kwa kumbukumbu ya zamani ikiwa umefikiwa kupitia normal-chat service.`;
  }
  private cleanMarkdownForVoice(text: string) { return String(text || '').replace(/[*_`#>-]/g, ' ').replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1').replace(/\s+/g, ' ').trim(); }
  private detectFileGenerationIntent(message: string) {
    const text = String(message || '').toLowerCase();
    if (/\b(pdf|docx|word|excel|xlsx|csv|powerpoint|pptx)\b/.test(text)) {
      const match = text.match(/\b(pdf|docx|word|excel|xlsx|csv|powerpoint|pptx)\b/);
      const type = match?.[1] || 'pdf';
      const fileType = type === 'word' ? 'docx' : type === 'excel' ? 'xlsx' : type === 'powerpoint' ? 'pptx' : type;
      return { filename: `mkuu_${Date.now()}.${fileType}`, fileType, title: 'MKUU Generated File', description: 'Generated by MKUU' };
    }
    return null;
  }
  private buildConversationHistory(history: ChatMessage[], message: string, attachments: any[]) { return [...history.map((item) => ({ role: item.role === 'assistant' ? 'model' : 'user', parts: [{ text: item.content || '' }] })), { role: 'user', parts: [{ text: message }, ...(attachments || []).map((attachment: any) => ({ inlineData: { mimeType: attachment.mimeType, data: attachment.base64Data } }))] }]; }
  private detectAndSaveMemory(_userId: string, _message: string) { return null as any; }
  private detectAndSavePerson(_userId: string, _message: string) { return null as any; }
  private detectSearchIntent(_message: string) { return false; }
  private isInsufficientKnowledgeResponse(_text: string) { return false; }
}

export const geminiService = GeminiService.getInstance();