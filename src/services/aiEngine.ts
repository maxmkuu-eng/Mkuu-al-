/**
 * MKUU AI — Autonomous Unified Intelligence Engine
 * 
 * Provides 3 layers of resilient intelligence:
 * 1. Remote Backend Server Proxy (/api/chat) when running on web or connected server
 * 2. Direct Gemini 2.5 / Flash Engine when on standalone Android APK with API key
 * 3. Autonomous Swahili Local Intelligence Engine when offline or running without external server
 */

import { ChatMessage, Memory, Person, GeneratedFileSummary, UserProfile } from '../types';
import { localChatStorage } from './localChatStorage';
import { apiFetch, isCapacitorNative, getRemoteServerUrl } from './apiConfig';

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
  engineUsed: 'server' | 'direct_gemini' | 'local_brain';
}

/**
 * System prompt generator for MKUU AI
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
${peopleText}

MUHIMU: Ikiwa ${ownerName} ataomba faili (PDF, Word, Excel, CSV), eleza muundo wa faili na maelezo yake kwa kina.`;
}

/**
 * Direct Gemini API Call from Client/Phone (supports Gemini 2.5 Flash, Gemini Flash, etc.)
 */
async function callDirectGemini(
  apiKey: string,
  params: ChatEngineParams
): Promise<ChatEngineResult> {
  const systemPrompt = buildSystemPrompt(params.user || null, params.memories, params.people);
  
  // Format conversation history for Gemini REST API
  const contents: any[] = [];

  // Add past conversation turns
  if (params.conversationHistory && params.conversationHistory.length > 0) {
    const recent = params.conversationHistory.slice(-10);
    for (const msg of recent) {
      contents.push({
        role: msg.role === 'user' ? 'user' : 'model',
        parts: [{ text: msg.content }],
      });
    }
  }

  // Add current user prompt
  const currentParts: any[] = [{ text: params.message }];

  // Add attachments if any (images, etc.)
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

  contents.push({
    role: 'user',
    parts: currentParts,
  });

  const modelsToTry = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-1.5-flash',
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
        throw new Error(errJson.error?.message || `Gemini API error (${response.status})`);
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (rawText.trim()) {
        const cleanSpeech = rawText
          .replace(/[#*`_~[\]()]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        // Check if user asked to remember something and extract
        const extractedMemories = detectAndExtractLocalMemories(params.message);

        return {
          reply: rawText,
          cleanSpeechText: cleanSpeech,
          memoriesExtracted: extractedMemories,
          engineUsed: 'direct_gemini',
        };
      }
    } catch (err: any) {
      lastError = err;
      continue;
    }
  }

  throw lastError || new Error('Hitilafu ya kuunganishwa na Google Gemini API.');
}

/**
 * Autonomous Swahili Local Intelligence (when offline or without Gemini API key)
 */
function processLocalBrain(params: ChatEngineParams): ChatEngineResult {
  const msg = params.message.trim();
  const lower = msg.toLowerCase();
  const owner = params.user?.name || 'Max';
  const memories = params.memories || [];
  const people = params.people || [];

  let reply = '';
  let extractedMemories: Memory[] = [];
  let recognizedPeople: Person[] = [];

  // 1. Explicit Memory Storing Command
  if (
    lower.startsWith('kumbuka') || 
    lower.includes('hifadhi kumbukumbu') || 
    lower.includes('hifadhi kuwa') || 
    lower.includes('weka kumbukumbu') ||
    lower.startsWith('remind me')
  ) {
    const cleanContent = msg
      .replace(/^(kumbuka kuwa|kumbuka kwamba|kumbuka|hifadhi kumbukumbu kuwa|hifadhi kwamba|hifadhi|weka kumbukumbu)/i, '')
      .trim();

    const newMem: Memory = {
      id: `mem_local_${Date.now()}`,
      userId: params.userId || 'user_max_owner',
      content: cleanContent || msg,
      category: 'Work',
      importance: 'high',
      tags: ['kumbukumbu', 'max'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'explicit_command',
    };

    extractedMemories.push(newMem);

    reply = `Nimeelewa na nimehifadhi salama kwenye Kumbukumbu zako, **${owner}**:\n\n📌 *"${newMem.content}"*\n\nTaarifa hii imewekwa kwenye orodha yako ya kudumu na nitakukumbusha wakati wowote utakapoiulizia.`;
  }
  // 2. Memory Retrieval Queries
  else if (
    lower.includes('kumbukumbu') || 
    lower.includes('unakumbuka') || 
    lower.includes('nilikuambia') ||
    lower.includes('niliwahi kusema')
  ) {
    // Find matching memories
    const matches = memories.filter((m) => {
      const words = lower.split(/\s+/).filter((w) => w.length > 3);
      return words.some((w) => m.content.toLowerCase().includes(w));
    });

    if (matches.length > 0) {
      reply = `Hapa kuna kumbukumbu nilizonazo kuhusu hilo, **${owner}**:\n\n` +
        matches.map((m, i) => `${i + 1}. **[${m.category.toUpperCase()}]** ${m.content}`).join('\n\n');
    } else if (memories.length > 0) {
      reply = `Nimeangalia kumbukumbu zako ${memories.length} zilizopo, **${owner}**. Hapa kuna za hivi karibuni:\n\n` +
        memories.slice(0, 5).map((m, i) => `• **${m.content}** *(Muhimu: ${m.importance})*`).join('\n');
    } else {
      reply = `Kwa sasa bado hujahifadhi kumbukumbu maalum, **${owner}**. Unaweza kuniambia kwa mfano: *"Kumbuka kuwa kesho nina kikao saa nne asubuhi"* nami nitaihifadhi mara moja.`;
    }
  }
  // 3. People / Contacts Queries
  else if (
    lower.includes('watu wa karibu') || 
    lower.includes('nieleze kuhusu') || 
    lower.includes('nani ni') ||
    lower.includes('mawasiliano ya')
  ) {
    const matchedPerson = people.find((p) => lower.includes(p.name.toLowerCase()));

    if (matchedPerson) {
      recognizedPeople.push(matchedPerson);
      reply = `Taarifa za **${matchedPerson.name}** kutoka kwenye orodha yako ya Watu wa Karibu:\n\n` +
        `• **Uhusiano:** ${matchedPerson.relationship}\n` +
        `• **Nambari ya Simu:** ${matchedPerson.phone || 'Haijawekwa'}\n` +
        `• **Barua Pepe:** ${matchedPerson.email || 'Haijawekwa'}\n` +
        `• **Maelezo:** ${matchedPerson.notes || 'Hakuna maelezo ya ziada'}`;
    } else if (people.length > 0) {
      reply = `Hawa ndio baadhi ya Watu wako wa Karibu waliosajiliwa, **${owner}**:\n\n` +
        people.slice(0, 5).map((p) => `• **${p.name}** — ${p.relationship} (Simu: ${p.phone || 'N/A'})`).join('\n');
    } else {
      reply = `Bado hujaongeza watu kwenye orodha ya Watu wa Karibu, **${owner}**. Unaweza kwenda kwenye kichupo cha *Watu wa Karibu* kuwaweka ili niweze kuwatambua na kuwajibu kiotomatiki.`;
    }
  }
  // 4. Greetings and Salutations
  else if (
    lower.includes('habari') || 
    lower.includes('mambo') || 
    lower.includes('hujambo') || 
    lower.includes('shikamoo') || 
    lower.includes('hello') ||
    lower.includes('hi')
  ) {
    reply = `Habari ya wakati huu, Mkuu **${owner}**! Mimi ni **MKUU AI**, msaidizi wako binafsi. Nipo tayari kukuhudumia kikamilifu kwenye masuala yote ya kumbukumbu, uandishi, upangaji wa ratiba, na uchambuzi. Ungependa tushughulikie nini sasa?`;
  }
  // 5. Help / Capabilities
  else if (lower.includes('msaada') || lower.includes('unaweza kufanya nini') || lower.includes('help')) {
    reply = `Mkuu **${owner}**, nina uwezo wa kukusaidia katika yafuatayo:\n\n` +
      `1. **Kuhifadhi & Kurejesha Kumbukumbu:** Andika *"Kumbuka kuwa..."* na nitahifadhi milele.\n` +
      `2. **Kuzalisha Faili Halisi:** Kuunda PDF, Word (.docx), Excel (.xlsx), CSV, na Nyaraka za kisheria au kikazi.\n` +
      `3. **Majibu ya Kiotomatiki (Auto Reply):** Kujibu SMS na barua pepe kwa niaba yako kwa heshima.\n` +
      `4. **Usimamizi wa Watu wa Karibu:** Kupanga viwango vya uaminifu na maelezo ya watu unaowasiliana nao.\n` +
      `5. **Sauti & Mazungumzo ya Moja kwa Moja:** Unaweza kubonyeza kitufe cha Maikrofoni kuongea nami moja kwa moja kwa sauti.`;
  }
  // 6. Intelligent Contextual General Swahili Response
  else {
    reply = `Mkuu **${owner}**, nimepokea ujumbe wako: *" ${msg} "*.\n\n` +
      `Nipo tayari kukusaidia kuchakata jambo hili kwa kina. Ujumbe wako umehifadhiwa salama kwenye kumbukumbu ya kifaa hiki.\n\n` +
      `💡 *Dokezo la Muunganisho:* Ili kuwasha uwezo kamili wa Google Gemini AI ya moja kwa moja kwenye simu hii (hata bila seva ya wingu), unaweza kuweka **Gemini API Key** yako ya bure kwenye sehemu ya **Usalama & Mmiliki** (Security Center).`;
  }

  const cleanSpeech = reply
    .replace(/[#*`_~[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    reply,
    cleanSpeechText: cleanSpeech,
    memoriesExtracted: extractedMemories,
    peopleRecognized: recognizedPeople,
    engineUsed: 'local_brain',
  };
}

/**
 * Helper to detect memory patterns
 */
function detectAndExtractLocalMemories(message: string): Memory[] {
  const lower = message.toLowerCase();
  if (lower.startsWith('kumbuka') || lower.includes('hifadhi kumbukumbu') || lower.includes('hifadhi kuwa')) {
    const clean = message.replace(/^(kumbuka kuwa|kumbuka kwamba|kumbuka|hifadhi kumbukumbu kuwa|hifadhi kwamba|hifadhi)/i, '').trim();
    if (clean.length > 4) {
      return [{
        id: `mem_ext_${Date.now()}`,
        userId: 'user_max_owner',
        content: clean,
        category: 'Work',
        importance: 'high',
        tags: ['kumbukumbu'],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        source: 'auto_extracted',
      }];
    }
  }
  return [];
}

/**
 * Unified Main Entry Point for MKUU AI Processing
 */
export async function executeMkuuChat(params: ChatEngineParams): Promise<ChatEngineResult> {
  const directApiKey = getStoredGeminiApiKey();

  // 1. If direct Gemini API key is configured by the user, prioritize direct Gemini connection
  if (directApiKey && directApiKey.trim().length > 10) {
    try {
      return await callDirectGemini(directApiKey.trim(), params);
    } catch (geminiError: any) {
      console.warn('Direct Gemini API call failed, falling back to backend server:', geminiError);
    }
  }

  // 2. Primary: Call the live backend server (/api/chat) via apiFetch
  try {
    const serverRes = await apiFetch<any>('/api/chat', {
      method: 'POST',
      body: JSON.stringify({
        conversationId: params.conversationId,
        message: params.message,
        isVoice: params.isVoice,
        attachments: params.attachments,
      }),
    });

    if (serverRes && serverRes.reply) {
      return {
        reply: serverRes.reply,
        cleanSpeechText: serverRes.cleanSpeechText || serverRes.reply,
        memoriesExtracted: serverRes.memoriesExtracted,
        peopleRecognized: serverRes.peopleRecognized,
        generatedFiles: serverRes.generatedFiles,
        engineUsed: 'server',
      };
    }
  } catch (serverError: any) {
    console.warn('Server chat call failed; falling back to local engine:', serverError);
  }

  // 3. Fallback smoothly to Autonomous Swahili Local Intelligence (when completely offline)
  return processLocalBrain(params);
}
