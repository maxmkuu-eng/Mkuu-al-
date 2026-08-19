/**
 * MKUU AI — Real AI Execution Engine
 * 
 * Communicates with the real Google Gemini API (gemini-3.7-flash / gemini-3-pro-image)
 * through MKUU Backend (/api/chat & /api/image) or direct Gemini API key.
 * 
 * NO HARDCODED OR MOCK RESPONSES.
 */

import { ChatMessage, Memory, Person, GeneratedFileSummary, UserProfile } from '../types';
import { apiFetch, isCapacitorNative, getApiUrl, MkuuApiError } from './apiConfig';

const GEMINI_API_KEY_STORAGE = 'mkuu_gemini_api_key_v1';

export function getStoredGeminiApiKey(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(GEMINI_API_KEY_STORAGE) || '';
}

export function setStoredGeminiApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  if (!key || !key.trim()) {
    localStorage.removeItem(GEMINI_API_KEY_STORAGE);
  } else {
    localStorage.setItem(GEMINI_API_KEY_STORAGE, key.trim());
  }
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

/**
 * System prompt generator for MKUU AI Direct Gemini calls
 */
function buildSystemPrompt(user: UserProfile | null, memories: Memory[] = [], people: Person[] = []): string {
  const ownerName = user?.name || 'Max';
  const memoriesText = memories.length > 0 
    ? memories.slice(0, 30).map((m, i) => `${i + 1}. [${m.category.toUpperCase()}] ${m.content} (Muhimu: ${m.importance})`).join('\n')
    : 'Hakuna kumbukumbu za awali zilizohifadhiwa bado.';

  const peopleText = people.length > 0
    ? people.slice(0, 20).map((p, i) => `${i + 1}. ${p.name} - ${p.relationship} (Simu: ${p.phone || 'N/A'}). Maelezo: ${p.notes || 'N/A'}`).join('\n')
    : 'Hakuna watu wa karibu waliosajiliwa bado.';

  return `Wewe ni MKUU AI — msaidizi mkuu, mwaminifu, na mwerevu zaidi wa kidijitali wa bwana ${ownerName}.
Dhamira yako kuu:
1. Kumsaidia ${ownerName} katika shughuli zake zote za kila siku, usimamizi wa kumbukumbu, mawasiliano, kazi, na maamuzi ya kibiashara na kibinafsi.
2. Zungumza kwa Kiswahili fasaha, chenye heshima, uadilifu wa hali ya juu, na uelewa mpana wa kiteknolojia na kijamii.
3. Zingatia na unukuu taarifa kutoka kwenye Kumbukumbu na Watu wa Karibu kila inapohitajika.
4. Ukigundua taarifa mpya muhimu kuhusu ${ownerName} (kama vile mipango, miadi, ahadi, namba za siri au mapendeleo), zihifadhi kiakili na umthibitishie.
5. Majibu yako yawe wazi, yaliyopangika vizuri kwa aya fupi au vipengele (bullet points).

TAARIFA ZA MMILIKI (MAX):
- Jina: ${ownerName}
- Barua Pepe: ${user?.email || 'maxmkuu@gmail.com'}
- Wadhifa/Utaalamu: ${user?.title || 'Mbunifu na Kiongozi Mkuu'}

KUMBUKUMBU ZA NDANI ZILIZOHIFADHIWA:
${memoriesText}

WATU WA KARIBU NA MAHUSIANO:
${peopleText}`;
}

/**
 * Direct Gemini API Call from Client/Phone (supports Gemini 3.7 Flash)
 */
async function callDirectGemini(
  apiKey: string,
  params: ChatEngineParams
): Promise<ChatEngineResult> {
  const systemPrompt = buildSystemPrompt(params.user || null, params.memories, params.people);
  
  const contents: Array<{ role: 'user' | 'model'; parts: any[] }> = [];

  const rawHistory = Array.isArray(params.conversationHistory) ? [...params.conversationHistory] : [];
  if (rawHistory.length > 0) {
    const last = rawHistory[rawHistory.length - 1];
    if (last.role === 'user' && (last.content === params.message || (!last.content && !params.message))) {
      rawHistory.pop();
    }
  }

  const recentHistory = rawHistory.slice(-20);

  for (const h of recentHistory) {
    const text = (h.content || '').trim();
    if (!text && (!h.attachments || h.attachments.length === 0)) continue;

    const role: 'user' | 'model' = h.role === 'user' ? 'user' : 'model';
    const parts: any[] = [];
    if (text) {
      parts.push({ text });
    }

    if (h.attachments && Array.isArray(h.attachments)) {
      for (const att of h.attachments) {
        if (att.previewUrl?.startsWith('data:image/') || att.base64Data) {
          const b64 = (att.previewUrl || att.base64Data || '').replace(/^data:image\/\w+;base64,/, '');
          if (b64) {
            parts.push({
              inlineData: {
                data: b64,
                mimeType: att.mimeType || 'image/jpeg',
              },
            });
          }
        }
      }
    }

    if (parts.length === 0) continue;

    const lastTurn = contents[contents.length - 1];
    if (lastTurn && lastTurn.role === role) {
      lastTurn.parts.push(...parts);
    } else {
      contents.push({ role, parts });
    }
  }

  if (contents.length > 0 && contents[0].role === 'model') {
    contents.unshift({
      role: 'user',
      parts: [{ text: 'Habari MKUU AI, mimi ni Max mmiliki wako.' }],
    });
  }

  const currentParts: any[] = [];
  if (params.message) {
    currentParts.push({ text: params.message });
  }

  if (params.attachments && params.attachments.length > 0) {
    for (const att of params.attachments) {
      if (att.base64Data && att.mimeType) {
        const pureBase64 = att.base64Data.includes('base64,')
          ? att.base64Data.split('base64,')[1]
          : att.base64Data;
        currentParts.push({
          inlineData: {
            mimeType: att.mimeType,
            data: pureBase64,
          },
        });
      }
    }
  }

  if (currentParts.length === 0) {
    currentParts.push({ text: params.message || 'Tafadhali endelea na mazungumzo.' });
  }

  const lastTurn = contents[contents.length - 1];
  if (lastTurn && lastTurn.role === 'user') {
    lastTurn.parts.push(...currentParts);
  } else {
    contents.push({
      role: 'user',
      parts: currentParts,
    });
  }

  const modelsToTry = [
    'gemini-3.7-flash',
    'gemini-3.5-flash-lite',
    'gemini-2.5-flash',
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents,
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          },
        }),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new MkuuApiError({
          code: 'GEMINI_UNAVAILABLE',
          status: response.status,
          userMessage: 'GEMINI HAIPATIKANI KWA SASA\nTafadhali jaribu tena.',
          technicalDetails: errJson.error?.message || `Gemini API error (${response.status})`,
          targetUrl: url,
        });
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (rawText.trim()) {
        const cleanSpeech = rawText
          .replace(/[#*`_~[\]()]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        return {
          reply: rawText,
          cleanSpeechText: cleanSpeech,
          engineUsed: 'direct_gemini',
          aiProvider: 'Google Gemini',
          chatModel: model,
        };
      }
    } catch (err: any) {
      if (err instanceof MkuuApiError) {
        lastError = err;
      } else {
        const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
        lastError = new MkuuApiError({
          code: isOffline ? 'NO_INTERNET' : 'GEMINI_UNAVAILABLE',
          userMessage: isOffline ? 'HAKUNA INTANETI\nTafadhali washa Wi-Fi au Mobile Data.' : 'GEMINI HAIPATIKANI KWA SASA\nTafadhali jaribu tena.',
          technicalDetails: err.message || 'Direct Gemini API Call Failed',
          targetUrl: 'https://generativelanguage.googleapis.com',
        });
      }
      continue;
    }
  }

  throw lastError || new MkuuApiError({
    code: 'GEMINI_UNAVAILABLE',
    userMessage: 'GEMINI HAIPATIKANI KWA SASA\nTafadhali jaribu tena.',
    technicalDetails: 'Imeshindwa kupokea majibu kutoka kwa Google Gemini API.',
    targetUrl: 'https://generativelanguage.googleapis.com',
  });
}

/**
 * Main Entry Point for MKUU AI Processing
 * 
 * Always executes real AI requests via:
 * 1. Direct Gemini API if direct key provided
 * 2. Real Backend /api/chat or /api/image powered by Google Gemini API
 * 
 * If request fails, throws real error to notify user (NO HARDCODED/MOCK STRINGS).
 */
export async function executeMkuuChat(params: ChatEngineParams): Promise<ChatEngineResult> {
  const directApiKey = getStoredGeminiApiKey();

  // 1. If direct Gemini API key is configured by the user, prioritize direct Gemini connection
  if (directApiKey && directApiKey.trim().length > 10) {
    return await callDirectGemini(directApiKey.trim(), params);
  }

  // 2. Primary Pipeline: Real MKUU Backend (/api/chat or /api/image) -> Google Gemini API
  const serverRes = await apiFetch<any>('/api/chat', {
    method: 'POST',
    body: JSON.stringify({
      conversationId: params.conversationId,
      message: params.message,
      isVoice: params.isVoice,
      attachments: params.attachments,
      conversationHistory: (params.conversationHistory || []).map((m: any) => ({
        role: m.role,
        content: m.content,
        attachments: m.attachments,
        generatedFiles: m.generatedFiles,
      })),
    }),
  });

  if (serverRes && (serverRes.reply || serverRes.success)) {
    return {
      reply: serverRes.reply || '',
      cleanSpeechText: serverRes.cleanSpeechText || serverRes.reply || '',
      memoriesExtracted: serverRes.memoriesExtracted,
      peopleRecognized: serverRes.peopleRecognized,
      generatedFiles: serverRes.generatedFiles,
      engineUsed: 'server',
      aiProvider: serverRes.aiProvider || 'Google Gemini',
      chatModel: serverRes.chatModel || 'gemini-3.7-flash',
    };
  }

  throw new MkuuApiError({
    code: 'BACKEND_UNREACHABLE',
    userMessage: 'SEVA YA MKUU HAIPATIKANI\nTafadhali jaribu tena.',
    technicalDetails: 'Empty response payload received from MKUU Backend',
    targetUrl: '/api/chat',
  });
}
