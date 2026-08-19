import { ChatMessage, Memory, Person, GeneratedFileSummary, UserProfile } from '../types';
import { apiFetch, MkuuApiError } from './apiConfig';

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

export async function executeMkuuChat(params: ChatEngineParams): Promise<ChatEngineResult> {
  const directApiKey = getStoredGeminiApiKey();
  if (directApiKey && directApiKey.trim().length > 10) return callDirectGemini(directApiKey.trim(), params);

  const serverRes = await apiFetch<any>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      conversationId: params.conversationId,
      message: params.message,
      isVoice: params.isVoice,
      attachments: params.attachments,
      conversationHistory: (params.conversationHistory || []).slice(-10).map((m: any) => ({ role: m.role, content: m.content, attachments: m.attachments, generatedFiles: m.generatedFiles })),
      people: params.people || [],
    }),
  });
  if (serverRes && (serverRes.reply || serverRes.success)) {
    return { reply: serverRes.reply || '', cleanSpeechText: serverRes.cleanSpeechText || serverRes.reply || '', memoriesExtracted: serverRes.memoriesExtracted, peopleRecognized: serverRes.peopleRecognized, generatedFiles: serverRes.generatedFiles, engineUsed: 'server', aiProvider: serverRes.aiProvider || 'Google Gemini', chatModel: serverRes.chatModel || 'gemini-3.7-flash' };
  }
  throw new MkuuApiError({ code: 'BACKEND_UNREACHABLE', userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.', technicalDetails: 'Empty response payload received from MKUU Backend', targetUrl: '/api/chat' });
}
