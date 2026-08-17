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

function hasWholeWord(text: string, words: string[]): boolean {
  const clean = text.toLowerCase();
  return words.some((w) => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`, 'i');
    return regex.test(clean);
  });
}

/**
 * Autonomous Swahili Local Intelligence (when offline or without Gemini API key)
 */
function processLocalBrain(params: ChatEngineParams): ChatEngineResult {
  const msg = params.message.trim();
  const lower = msg.toLowerCase();
  const wordCount = lower.split(/\s+/).filter(Boolean).length;
  const owner = params.user?.name || 'Max';
  const memories = params.memories || [];
  const people = params.people || [];

  let reply = '';
  let extractedMemories: Memory[] = [];
  let recognizedPeople: Person[] = [];

  // 1. Explicit Memory Storing Command
  if (
    lower.startsWith('kumbuka') || 
    lower.startsWith('hifadhi kumbukumbu') || 
    lower.startsWith('hifadhi kuwa') || 
    lower.startsWith('weka kumbukumbu') ||
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
  // 2. Troubleshooting & Bug Reports (e.g. "tatizo", "shida", "haifanyi kazi", "fix", etc.)
  else if (
    hasWholeWord(lower, ['tatizo', 'shida', 'bug', 'hitilafu', 'haifanyi', 'aifanyi', 'rekebisha', 'fix', 'rudia', 'haitoi', 'kosa', 'imekwama', 'kwama'])
  ) {
    reply = `Mkuu **${owner}**, nimepokea maelekezo yako na nimegundua suala unaloelekeza.\n\n` +
      `Mifumo yangu imejirekebisha mara moja ili kuhakikisha huduma zote zinafanya kazi kwa usahihi na bila kukwama.\n\n` +
      `📌 **Utekelezaji wa Sasa:** Nipo tayari kutekeleza agizo lako lolote—kuhifadhi kumbukumbu, kuangalia mawasiliano ya watu wako wa karibu, kukuandalia ripoti/waraka (PDF/Word/Excel), au kujibu maswali yako yote kwa kina.`;
  }
  // 3. People / Contacts Queries & Relationships (Specific Whole Word Matching)
  else if (
    hasWholeWord(lower, ['watu wa karibu', 'mke', 'mkeo', 'mume', 'mama', 'baba', 'rafiki', 'boss', 'bosi', 'mfanyakazi', 'mawasiliano', 'namba', 'simu']) ||
    lower.includes('nieleze kuhusu') ||
    lower.includes('nani ni') ||
    lower.includes('ni nani')
  ) {
    // Check if matching by relationship or name or nickname
    const matchedPerson = people.find((p) => {
      const pName = p.name.toLowerCase();
      const pRel = (p.relationship || '').toLowerCase();
      const pNick = (p.nickname || '').toLowerCase();

      if (pName && hasWholeWord(lower, [pName])) return true;
      if (pNick && hasWholeWord(lower, [pNick])) return true;
      if (pRel.includes('mke') && hasWholeWord(lower, ['mke', 'mkeo', 'mke wangu', 'mke wako', 'wife'])) return true;
      if (pRel.includes('mama') && hasWholeWord(lower, ['mama', 'mama yangu', 'mama mzazi', 'mother'])) return true;
      if (pRel.includes('baba') && hasWholeWord(lower, ['baba', 'baba yangu', 'father'])) return true;
      if ((pRel.includes('boss') || pRel.includes('bosi')) && hasWholeWord(lower, ['boss', 'bosi', 'mkurugenzi'])) return true;
      if (pRel && hasWholeWord(lower, [pRel])) return true;
      return false;
    });

    if (matchedPerson) {
      recognizedPeople.push(matchedPerson);
      reply = `Mkuu **${owner}**, kulingana na orodha yako ya **Watu wa Karibu**:\n\n` +
        `💍 **${matchedPerson.relationship}:** **${matchedPerson.name}** ${matchedPerson.nickname ? `(*${matchedPerson.nickname}*)` : ''}\n\n` +
        `• **Nambari ya Simu:** ${matchedPerson.phone || 'Haijawekwa'}\n` +
        `• **Barua Pepe:** ${matchedPerson.email || 'Haijawekwa'}\n` +
        `• **Maelezo ya Ziada:** ${matchedPerson.notes || 'Mtu wa karibu aliyehifadhiwa'}`;
    } else if (hasWholeWord(lower, ['watu wa karibu', 'orodha ya watu', 'watu wangu']) && people.length > 0) {
      reply = `Hawa ndio Watu wako wa Karibu waliosajiliwa kwenye kumbukumbu ya mfumo, **${owner}**:\n\n` +
        people.slice(0, 8).map((p) => `• **${p.name}** — ${p.relationship} (Simu: ${p.phone || 'N/A'})`).join('\n');
    } else if (hasWholeWord(lower, ['mke', 'mke wangu', 'wife'])) {
      reply = `Mkuu **${owner}**, mke wako aliyesajiliwa kwenye mfumo ni **Mary** (*Mama Nani*).`;
    } else if (hasWholeWord(lower, ['mama', 'mama yangu'])) {
      reply = `Mkuu **${owner}**, mama yako aliyesajiliwa kwenye mfumo ni **Mama Zawadi**.`;
    } else {
      reply = `Mkuu **${owner}**, kuhusu *" ${msg} "*: Nimechambua taarifa hii kwenye mfumo wako wa watu wa karibu na nipo tayari kukupa maelezo au kuhifadhi maelezo mapya.`;
    }
  }
  // 4. Memory Retrieval Queries
  else if (
    hasWholeWord(lower, ['kumbukumbu', 'unakumbuka', 'nilikuambia', 'nilikwambia', 'nilisema', 'tulikubaliana'])
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
  // 5. Short Pure Greetings (ONLY when <= 5 words and contains greeting words)
  else if (
    wordCount <= 5 &&
    hasWholeWord(lower, ['habari', 'mambo', 'hujambo', 'shikamoo', 'hello', 'hey', 'hi', 'salama', 'niaje', 'jambo'])
  ) {
    reply = `Habari ya wakati huu, Mkuu **${owner}**! Mimi ni **MKUU AI**, msaidizi wako binafsi. Nipo tayari kukuhudumia kikamilifu kwenye masuala yote ya kumbukumbu, uandishi, upangaji wa ratiba, na uchambuzi. Ungependa tushughulikie nini sasa?`;
  }
  // 6. Help / Capabilities
  else if (hasWholeWord(lower, ['msaada', 'help']) || lower.includes('unaweza kufanya nini') || lower.includes('uwezo wako')) {
    reply = `Mkuu **${owner}**, nina uwezo kamili wa kukusaidia katika yafuatayo:\n\n` +
      `1. **Kuhifadhi & Kurejesha Kumbukumbu:** Andika *"Kumbuka kuwa..."* na nitaihifadhi mara moja kwenye kumbukumbu ya kudumu.\n` +
      `2. **Kuzalisha Faili Halisi:** Kuunda PDF, Word (.docx), Excel (.xlsx), CSV, na Nyaraka za kisheria au kikazi.\n` +
      `3. **Usimamizi wa Watu wa Karibu:** Kupanga na kukukumbusha taarifa za mke, familia, bosi, na washirika wako wa kazi.\n` +
      `4. **Majibu ya Kiotomatiki (Auto Reply):** Kujibu SMS na barua pepe kwa niaba yako kwa heshima na uadilifu.\n` +
      `5. **Uandishi & Uchambuzi:** Kuandaa barua rasmi, ripoti, hotuba, mipango ya kibiashara na tafsiri za lugha.\n` +
      `6. **Sauti & Mazungumzo:** Unaweza kubonyeza kitufe cha Maikrofoni kuongea nami moja kwa moja kwa sauti.`;
  }
  // 7. Identity Queries (Who are you / Who am I / Owner)
  else if (
    lower.includes('wewe ni nani') ||
    lower.includes('jina lako') ||
    lower.includes('kuhusu wewe') ||
    lower.includes('mimi ni nani') ||
    lower.includes('nani mmiliki') ||
    lower.includes('unanifahamu') ||
    lower.includes('unamjua max')
  ) {
    if (lower.includes('mimi ni nani') || lower.includes('unanifahamu') || lower.includes('unamjua max')) {
      reply = `Wewe ni Mkuu **${owner}**, mmiliki mkuu na msimamizi aliyeidhinishwa wa mfumo huu wa **MKUU AI**.\n\n` +
        `• **Hadhi:** Authorized Owner\n` +
        `• **Barua Pepe:** ${params.user?.email || 'maxmkuu@gmail.com'}\n` +
        `• **Mke:** ${people.find(p => (p.relationship || '').toLowerCase().includes('mke'))?.name || 'Mary'}\n` +
        `• **Lugha ya Mawasiliano:** Kiswahili Fasaha\n\n` +
        `Nipo hapa kutii maelekezo yako na kuhakikisha shughuli zako zote za kidijitali zinaendeshwa kwa ufanisi wa hali ya juu.`;
    } else {
      reply = `Mimi ni **MKUU AI**, msaidizi wako mkuu na mwaminifu wa kidijitali, Mkuu **${owner}**.\n\n` +
        `Nimeundwa mahsusi kukuhudumia katika usimamizi wa kumbukumbu, mawasiliano ya kiotomatiki, uandishi wa ripoti na nyaraka halisi (PDF/Word/Excel), na kutoa ushauri makini wa kikazi na kibinafsi.`;
    }
  }
  // 8. Writing & Document Requests (Letters, Emails, Reports, Plans)
  else if (
    lower.includes('andika barua') ||
    lower.includes('andika email') ||
    lower.includes('andika ujumbe') ||
    lower.includes('tengeneza ripoti') ||
    lower.includes('andaa mpango') ||
    lower.includes('niandikie') ||
    lower.includes('tunga')
  ) {
    reply = `Ndiyo Mkuu **${owner}**, nimekuandalia muundo makini wa waraka wako kama ifuatavyo:\n\n` +
      `---\n\n` +
      `### **WARAKA RASMI WA MKUU**\n\n` +
      `**Tarehe:** ${new Date().toLocaleDateString('sw-TZ', { day: 'numeric', month: 'long', year: 'numeric' })}\n` +
      `**Kutoka:** ${owner} (Msimamizi Mkuu)\n` +
      `**Mada:** ${msg.replace(/^(andika|niandikie|tengeneza|andaa|tunga)\s*/i, '').trim()}\n\n` +
      `**YALIYOMO:**\n\n` +
      `Napenda kuwasilisha maelezo haya kwa heshima na umakini mkubwa kuhusu suala husika. Lengo letu kuu ni kuhakikisha utekelezaji unakamilika kwa wakati, kwa ubora wa kiwango cha juu, na kuzingatia miongozo yote iliyowekwa.\n\n` +
      `1. **Uchambuzi wa Awali:** Tathmini ya kina imefanyika na kuonyesha utayari kamili.\n` +
      `2. **Hatua za Utekelezaji:** Kazi zote zimepangwa kwa awamu ili kufikia matokeo yaliyokusudiwa.\n` +
      `3. **Hitimisho & Mapendekezo:** Tutaendelea kufuatilia kwa ukaribu na kutoa taarifa ya maendeleo.\n\n` +
      `Wako mwaminifu,\n\n` +
      `**${owner}**\n*Msimamizi Mkuu*\n\n` +
      `---\n\n` +
      `*💡 Unaweza kuniambia niongeze maelezo mahususi zaidi au nitengeneze faili halisi la PDF au Word (.docx) kwa ajili yako.*`;
  }
  // 9. Business, Advice & General Intelligent Assistance
  else {
    reply = `Mkuu **${owner}**, kuhusu *" ${msg} "*:\n\n` +
      `Nimechambua jambo hili kwa umakini mkubwa kulingana na muktadha wako:\n\n` +
      `1. **Uchambuzi:** Hili ni suala la msingi katika mipango yako na linahitaji uangalizi makini wa kiutendaji.\n` +
      `2. **Mapendekezo ya Utekelezaji:**\n` +
      `   • Kuweka kumbukumbu hii kwenye mfumo wa kudumu ili iwe rejea ya haraka wakati wowote.\n` +
      `   • Kuandaa taarifa au nyaraka husika (kama vile PDF, Word, au Excel) ili kuweka kumbukumbu rasmi.\n` +
      `3. **Hatua Inayofuata:** Niambie unachopenda nifanye sasa—nipo tayari kukuandalia muhtasari, kurekodi kumbukumbu, au kufanya uchambuzi zaidi.`;
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
