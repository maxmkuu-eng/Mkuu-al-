import { ChatMessage, Memory, Person, GeneratedFileSummary, UserProfile } from '../types';
import { apiFetch, getApiUrl, MkuuApiError } from './apiConfig';

const GEMINI_API_KEY_STORAGE = 'mkuu_gemini_api_key_v1';

export function getStoredGeminiApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
}

export function setStoredGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (!key || !key.trim()) localStorage.removeItem(GEMINI_API_KEY_STORAGE);
  else localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
}

export interface ChatEngineParams {
  userId: string;
  message: string;
  conversationId: string;
  conversationHistory?: ChatMessage[];
  isVoice?: boolean;
  attachments?: any[];
  user?: UserProfile | null;
  memories?: Memory[];
  people?: Person[];
}

export interface ChatEngineResult {
  reply: string;
  cleanSpeechText: string;
  memoriesExtracted?: Memory[];
  peopleRecognized?: Person[];
  generatedFiles?: GeneratedFileSummary[];
  engineUsed: 'server' | 'direct_gemini';
  aiProvider?: string;
  chatModel?: string;
  intent?: string;
}

let streamPreview = '';

function emitStream(text: string, done = false) {
  if (typeof window === 'undefined') return;
  streamPreview += text;
  let node = document.getElementById('mkuu-stream-preview');
  if (!node && !done) {
    node = document.createElement('div');
    node.id = 'mkuu-stream-preview';
    node.setAttribute('aria-live', 'polite');
    Object.assign(node.style, {
      position: 'fixed', left: '16px', right: '16px', bottom: '88px', zIndex: '9999',
      maxWidth: '760px', margin: '0 auto', padding: '14px 16px', borderRadius: '16px',
      background: 'rgba(8,8,8,.96)', color: '#F5F2ED', border: '1px solid rgba(212,175,55,.45)',
      boxShadow: '0 18px 50px rgba(0,0,0,.45)', fontSize: '14px', lineHeight: '1.55',
      whiteSpace: 'pre-wrap', maxHeight: '38vh', overflow: 'auto', backdropFilter: 'blur(14px)',
    });
    document.body.appendChild(node);
  }
  if (node) node.textContent = streamPreview;
  if (done) {
    window.setTimeout(() => document.getElementById('mkuu-stream-preview')?.remove(), 120);
    streamPreview = '';
  }
}

function needsArtifactRoute(params: ChatEngineParams) {
  const text = String(params.message || '').toLowerCase();
  const hasImage = (params.attachments || []).some((a: any) => String(a?.mimeType || '').startsWith('image/'));
  return hasImage || /\b(pdf|docx?|word|excel|xlsx|csv|logo|banner|poster|cartoon|picha|image|background|document|proposal|ripoti)\b/i.test(text);
}

async function callDirectGemini(apiKey: string, params: ChatEngineParams): Promise<ChatEngineResult> {
  const peopleText = (params.people || []).slice(0, 20).map((p) => `- ${p.name}${p.nickname ? ` (${p.nickname})` : ''}: ${p.relationship}; ${p.phone || ''}; ${p.notes || ''}`).join('\n');
  const systemPrompt = `Wewe ni MKUU AI, msaidizi wa Max. Zungumza kwa Kiswahili fasaha. Tumia taarifa hizi za watu wa karibu inapohitajika:\n${peopleText || 'Hakuna watu wa karibu waliosajiliwa.'}`;
  const rawHistory = Array.isArray(params.conversationHistory) ? params.conversationHistory.slice(-10) : [];
  const contents: any[] = rawHistory.filter((h) => h.content || h.attachments?.length).map((h) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.content || '' }] }));
  contents.push({ role: 'user', parts: [{ text: params.message }] });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=${apiKey}`;
  const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ systemInstruction: { parts: [{ text: systemPrompt }] }, contents, generationConfig: { temperature: 0.7, maxOutputTokens: 1024 } }) });
  if (!response.ok) throw new MkuuApiError({ code: 'GEMINI_UNAVAILABLE', status: response.status, userMessage: 'GEMINI HAIPATIKANI KWA SASA\nTafadhali jaribu tena.', technicalDetails: `Gemini API error (${response.status})`, targetUrl: url });
  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  if (!rawText.trim()) throw new Error('Gemini returned an empty response');
  return { reply: rawText, cleanSpeechText: rawText.replace(/[#*`_~[\]()]/g, ' ').replace(/\s+/g, ' ').trim(), engineUsed: 'direct_gemini', aiProvider: 'Google Gemini', chatModel: 'gemini-3.7-flash' };
}

async function streamServerChat(params: ChatEngineParams): Promise<ChatEngineResult> {
  const url = getApiUrl('/api/chat/stream');
  const response = await fetch(url, { method: 'POST', headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }, body: JSON.stringify({ message: params.message, conversationHistory: (params.conversationHistory || []).slice(-10), people: params.people || [], attachments: params.attachments || [] }) });
  if (!response.ok || !response.body) throw new MkuuApiError({ code: 'BACKEND_UNREACHABLE', status: response.status, userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.', technicalDetails: `Streaming endpoint returned HTTP ${response.status}`, targetUrl: url });

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let reply = '';
  emitStream('', false);
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const events = buffer.split('\n\n');
    buffer = events.pop() || '';
    for (const event of events) {
      const line = event.split('\n').find((l) => l.startsWith('data: '));
      if (!line) continue;
      try {
        const payload = JSON.parse(line.slice(6));
        if (payload.type === 'delta' && payload.text) { reply += payload.text; emitStream(payload.text, false); }
        if (payload.type === 'error') throw new Error(payload.message || 'Streaming error');
      } catch (error) {
        if (error instanceof SyntaxError) continue;
        throw error;
      }
    }
  }
  emitStream('', true);
  if (!reply.trim()) throw new Error('MKUU streaming returned an empty response');
  return { reply, cleanSpeechText: reply.replace(/[#*`_~[\]()]/g, ' ').replace(/\s+/g, ' ').trim(), engineUsed: 'server', aiProvider: 'Google Gemini', chatModel: 'gemini-3.7-flash', intent: 'chat' };
}

export async function executeMkuuChat(params: ChatEngineParams): Promise<ChatEngineResult> {
  const directApiKey = getStoredGeminiApiKey();
  if (directApiKey && directApiKey.trim().length > 10) return callDirectGemini(directApiKey.trim(), params);

  if (needsArtifactRoute(params)) {
    const serverRes = await apiFetch<any>('/api/agent', { method: 'POST', body: JSON.stringify({ conversationId: params.conversationId, message: params.message, isVoice: params.isVoice, attachments: params.attachments, conversationHistory: (params.conversationHistory || []).slice(-10), people: params.people || [] }) });
    if (serverRes && (serverRes.reply || serverRes.success)) return { reply: serverRes.reply || '', cleanSpeechText: serverRes.cleanSpeechText || serverRes.reply || '', memoriesExtracted: serverRes.memoriesExtracted, peopleRecognized: serverRes.peopleRecognized, generatedFiles: serverRes.generatedFiles, engineUsed: 'server', aiProvider: serverRes.aiProvider || 'Google Gemini', chatModel: serverRes.chatModel || 'gemini-3.7-flash', intent: serverRes.intent };
    throw new MkuuApiError({ code: 'BACKEND_UNREACHABLE', userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.', technicalDetails: 'Empty Universal Agent response payload', targetUrl: '/api/agent' });
  }

  return streamServerChat(params);
}
