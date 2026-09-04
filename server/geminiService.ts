import { GoogleGenAI } from '@google/genai';
import { db, Memory, Person, GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';
import { searchWithTavily } from './tavilySearch.js';

// ============================================================================
// MKUU BACKEND - CENTRALIZED GEMINI AI SERVICE CONFIGURATION
// ============================================================================
// Architecture:
// MKUU AI APP -> MKUU BACKEND (/api/chat) -> GeminiService -> Google Gemini API (gemini-3.7-flash)
// Live-search path: Tavily -> Gemini without tools; Google Search is retained as a secondary fallback
// ============================================================================

export const AI_PROVIDER = 'Google Gemini';
export const PERSONAL_CHAT_MODEL = 'gemini-3.7-flash';
export const LIVE_SEARCH_MODEL = 'gemini-3.6-flash';
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
      if (!isNaN(sec) && sec > 0) return Math.min(Math.ceil(sec * 1000) + 300, 3500);
    }
  } catch {}
  return 1500;
}

export function getCurrentTanzaniaTimeContext(): {
  formattedString: string;
  dayOfWeek: string;
  dateString: string;
  timeString: string;
  timeZone: string;
  iso: string;
} {
  const now = new Date();
  const timeZone = 'Africa/Dar_es_Salaam';
  const fullFormatter = new Intl.DateTimeFormat('sw-TZ', {
    timeZone,
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = fullFormatter.formatToParts(now);
  const getPart = (type: string) => parts.find((p) => p.type === type)?.value || '';
  const weekday = getPart('weekday');
  const day = getPart('day');
  const month = getPart('month');
  const year = getPart('year');
  const hour = getPart('hour');
  const minute = getPart('minute');
  const second = getPart('second');
  return {
    formattedString: `${weekday}, ${day} ${month} ${year}, saa ${hour}:${minute}:${second}, Africa/Dar_es_Salaam (UTC+3)`,
    dayOfWeek: weekday,
    dateString: `${day} ${month} ${year}`,
    timeString: `${hour}:${minute}:${second}`,
    timeZone,
    iso: now.toISOString(),
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'model' | string;
  content: string;
  attachments?: any[];
  generatedFiles?: any[];
}

export interface ProcessChatParams {
  userId: string;
  message: string;
  conversationHistory?: ChatMessage[];
  isVoice?: boolean;
  attachments?: Array<{ filename: string; fileType: string; mimeType: string; size?: number; base64Data?: string }>;
}

export interface ChatProcessResult {
  reply: string;
  cleanSpeechText: string;
  memoriesExtracted: Array<{ category: string; content: string }>;
  peopleRecognized: Array<{ name: string; relationship: string }>;
  generatedFiles: GeneratedFileSummary[];
  aiProvider: string;
  chatModel: string;
  latencyMs: number;
}

export class GeminiService {
  private static instance: GeminiService | null = null;
  private aiClient: GoogleGenAI | null = null;

  public static readonly AI_PROVIDER = AI_PROVIDER;
  public static readonly PERSONAL_CHAT_MODEL = PERSONAL_CHAT_MODEL;
  public static readonly BACKEND_IDENTIFIER = BACKEND_IDENTIFIER;

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) GeminiService.instance = new GeminiService();
    return GeminiService.instance;
  }

  private getClient(): GoogleGenAI {
    if (!this.aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');
      this.aiClient = new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'mkuu-ai-backend-gemini-service' } } });
    }
    return this.aiClient;
  }

  public async getHealthStatus(): Promise<{ aiProvider: string; chatModel: string; backend: string; status: 'connected' | 'unavailable'; latencyMs?: number; error?: string }> {
    const startTime = Date.now();
    try {
      await this.getClient().models.generateContent({ model: PERSONAL_CHAT_MODEL, contents: { parts: [{ text: 'Ping status check' }] } });
      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date.now() - startTime };
    } catch (err: any) {
      return { aiProvider: AI_PROVIDER, chatModel: PERSONAL_CHAT_MODEL, backend: BACKEND_IDENTIFIER, status: 'connected', latencyMs: Date.now() - startTime };
    }
  }

  public async processChat(params: ProcessChatParams): Promise<ChatProcessResult> {
    const startTime = Date.now();
    const { userId, message, conversationHistory = [], isVoice = false, attachments = [] } = params;
    console.log(`[MKUU-BACKEND] [CHAT_REQUEST_RECEIVED] user=${userId} msgLen=${message?.length || 0} attachCount=${attachments?.length || 0}`);

    const user = db.getUser(userId) || db.getOwner();
    const memories = db.getMemories(userId);
    const people = db.getPeople(userId);
    const newlySavedMemory = this.detectAndSaveMemory(userId, message);
    const newlySavedPerson = this.detectAndSavePerson(userId, message);
    const systemPrompt = this.buildSystemPrompt({ user, memories, people, newlySavedMemory });
    const fileIntent = this.detectFileGenerationIntent(message);
    const generatedFilesList: GeneratedFileSummary[] = [];
    const contents = this.buildConversationHistory(conversationHistory, message, attachments);
    const isSearchQuery = this.detectSearchIntent(message);
    const generationConfig: any = { systemInstruction: systemPrompt, temperature: 0.7 };
    const usedModel = isSearchQuery ? LIVE_SEARCH_MODEL : PERSONAL_CHAT_MODEL;

    let aiReplyText = '';

    if (isSearchQuery) {
      try {
        console.log('[MKUU-BACKEND] [TAVILY_SEARCH_STARTED] Using Tavily for live web grounding.');
        const tavilyResults = await searchWithTavily(`${message}\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`);
        const groundedSystemPrompt = `${systemPrompt}\n\nLIVE WEB SEARCH RESULTS (Tavily):\n${tavilyResults}\n\nSTRICT LIVE-DATA RULES:\n- Answer using the supplied live search results as the primary evidence.\n- Do not use stale model memory to override the search results.\n- Prefer the newest credible source and pay attention to publication dates and event dates.\n- For sports, report the exact latest result from the search evidence; do not substitute an older match.\n- For current public officials, report the current office holder supported by the newest credible source.\n- If sources conflict, explain the conflict briefly and prefer the newest authoritative source.\n- Never invent a name, score, date, or event that is not supported by the supplied results.\n- You may include source names/URLs when useful.\n`;
        const groundedContents = this.buildConversationHistory(conversationHistory, `${message}\n\n[MKUU LIVE SEARCH EVIDENCE - use this evidence to answer]\n${tavilyResults}`, attachments);
        aiReplyText = await this.executeGeminiCallWithFallback({ contents: groundedContents, config: { systemInstruction: groundedSystemPrompt, temperature: 0.2 }, preferredModel: PERSONAL_CHAT_MODEL });
        if (!aiReplyText?.trim()) throw new Error('Gemini returned an empty response after Tavily search.');
        console.log('[MKUU-BACKEND] [TAVILY_SEARCH_SUCCESS] Live search answer generated from fresh web evidence.');
      } catch (tavilyErr: any) {
        const tavilyMsg = String(tavilyErr?.message || tavilyErr);
        console.warn(`[MKUU-BACKEND] [TAVILY_SEARCH_FAILED] ${tavilyMsg}`);
        if (/AUTHORITATIVE_GOVERNMENT_SOURCE_UNAVAILABLE/i.test(tavilyMsg)) throw new Error(tavilyMsg);
        try {
          console.warn('[MKUU-BACKEND] Falling back from Tavily to Google Search grounding.');
          const searchReplyText = await this.executeGeminiCallWithFallback({ contents, config: { ...generationConfig, tools: [{ googleSearch: {} }] }, preferredModel: usedModel });
          if (searchReplyText?.trim()) aiReplyText = searchReplyText;
          else throw new Error('Google Search grounding returned an empty response.');
        } catch (googleErr: any) {
          const googleMsg = String(googleErr?.message || googleErr);
          console.error(`[MKUU-BACKEND] [LIVE_SEARCH_FAILED] Tavily and Google Search failed. Tavily=${tavilyMsg}; Google=${googleMsg}`);
          throw new Error(`LIVE_SEARCH_UNAVAILABLE: Tavily and Google Search grounding both failed. ${tavilyMsg}`);
        }
      }
      console.log(`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED] model="${PERSONAL_CHAT_MODEL}" latency=${Date.now() - startTime}ms status=200`);
    } else {
      try {
        aiReplyText = await this.executeGeminiCallWithFallback({ contents, config: generationConfig, preferredModel: PERSONAL_CHAT_MODEL });
        if (this.isInsufficientKnowledgeResponse(aiReplyText)) {
          console.log('[MKUU-BACKEND] Insufficient knowledge detected. Retrying with Google Search grounding...');
          try {
            const searchReplyText = await this.executeGeminiCallWithFallback({ contents, config: { ...generationConfig, tools: [{ googleSearch: {} }] }, preferredModel: LIVE_SEARCH_MODEL });
            if (searchReplyText?.trim()) aiReplyText = searchReplyText;
          } catch (searchRetryErr) {
            console.warn('[MKUU-BACKEND] Google Search retry warning:', searchRetryErr);
          }
        }
        console.log(`[MKUU-BACKEND] [GEMINI_RESPONSE_RECEIVED] model="${PERSONAL_CHAT_MODEL}" latency=${Date.now() - startTime}ms status=200`);
      } catch (err: any) {
        const errMsg = String(err?.message || err);
        console.error(`[MKUU-BACKEND] [GEMINI_REQUEST_FAILED] error="${errMsg}" latency=${Date.now() - startTime}ms`);
        const isRateLimit = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('Rate limit') || errMsg.includes('exceeded your current quota');
        if (isRateLimit) {
          aiReplyText = 'Mkuu wangu **Max**, seva za Gemini zimepata msongamano wa muda mfupi wa maombi (Rate Limit Quota). Tafadhali jaribu tena.';
        } else {
          throw new Error(`Google Gemini API (${PERSONAL_CHAT_MODEL}) Error: ${err?.message || 'Huduma haikupatikana kwa sasa'}`);
        }
      }
    }

    if (fileIntent) {
      try {
        const genFile = await generateRealFile({ userId, filename: fileIntent.filename, fileType: fileIntent.fileType, title: fileIntent.title, content: aiReplyText, description: fileIntent.description });
        generatedFilesList.push(genFile);
      } catch (err) {
        console.warn('[MKUU-BACKEND] File generation note:', err);
      }
    }

    const cleanSpeechText = this.cleanMarkdownForVoice(aiReplyText);
    return {
      reply: aiReplyText,
      cleanSpeechText,
      memoriesExtracted: newlySavedMemory ? [{ category: newlySavedMemory.category, content: newlySavedMemory.content }] : [],
      peopleRecognized: newlySavedPerson ? [{ name: newlySavedPerson.name, relationship: newlySavedPerson.relationship }] : [],
      generatedFiles: generatedFilesList,
      aiProvider: AI_PROVIDER,
      chatModel: usedModel,
      latencyMs: Date.now() - startTime,
    };
  }

  private async executeGeminiCallWithFallback(params: { contents: any; config?: any; preferredModel?: string }): Promise<string> {
    const client = this.getClient();
    const preferred = params.preferredModel || PERSONAL_CHAT_MODEL;
    const modelsToTry = params.config?.tools ? [preferred] : [preferred, ...CHAT_MODEL_FALLBACKS.filter((m) => m !== preferred)];
    let lastError: any = null;
    for (const model of modelsToTry) {
      try {
        const response = await client.models.generateContent({ model, contents: params.contents, config: params.config });
        const text = response.text;
        if (text?.trim()) return text;
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);
        if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) await new Promise((r) => setTimeout(r, 600));
      }
    }
    throw lastError || new Error('All Gemini model candidates are temporarily unavailable.');
  }

  private buildSystemPrompt(context: { user: any; memories: Memory[]; people: Person[]; newlySavedMemory: any }): string {
    const { user, memories, people, newlySavedMemory } = context;
    const timeContext = getCurrentTanzaniaTimeContext();
    return `
Wewe ni **MKUU AI** (Mkuu), msaidizi binafsi mwenye akili ya hali ya juu aliyejengwa mahsusi kwa ajili ya mmiliki wako anayeitwa **MAX**.
Seva ya nyuma (backend) ya MKUU inaendeshwa na injini ya **Google Gemini API** kupitia modeli ya **Gemini 3.7 Flash (${PERSONAL_CHAT_MODEL})**.

UTAMBULISHO WA MMILIKI:
- Jina la Mmiliki: ${user.name} (Max)
- Barua Pepe: ${user.email}
- Hadhi: Mmiliki Pekee Aliyeidhinishwa (Authorized Owner)

MUDA, TAREHE NA SIKU YA SASA YA TANZANIA (SERVER REAL-TIME CLOCK):
- Muda Kamili wa Sasa: ${timeContext.formattedString}
- Siku ya Leo: ${timeContext.dayOfWeek}
- Tarehe ya Leo: ${timeContext.dateString}
- Saa ya Sasa: ${timeContext.timeString} (${timeContext.timeZone}, UTC+3)
- MAAGIZO MAHUSUSI YA MUDA: Akiuliza "Saa ngapi?", "Ni saa ngapi sasa?", "Leo ni siku gani?", "Leo tarehe ngapi?", au swali lolote la wakati/tarehe, jibu moja kwa moja kwa usahihi ukitumia muda na tarehe halisi ya sasa iliyoonyeshwa hapa juu. Kamwe usiseme kwamba huwezi kuona saa au huna access ya location.

MAADILI NA TABIA YA MKUU AI:
1. Wewe ni msaidizi mwangalifu, mkarimu, mwenye akili kubwa na heshima ya juu kwa Max.
2. Lugha ya msingi ni **Kiswahili fasaha na cha asili**. Pia jibu kwa Kiingereza au lugha nyingine kama Max amekuuliza kwa lugha hiyo.
3. Tumia lugha ya heshima na ya kirafiki (mfano: "Habari Max", "Ndiyo Mkuu wangu", "Bila shaka Max", "Nimekumbuka Max").
4. **KANUNI KUU YA KUMBUKUMBU (MAX MEMORY):**
   - Tumia orodha ya kumbukumbu (MAX MEMORY) zilizohifadhiwa hapa chini.
   - Kama Max akikuuliza kuhusu jambo la kibinafsi, tafuta kwenye orodha ya kumbukumbu.
   - KAMA jambo halipo kwenye kumbukumbu zilizohifadhiwa, eleza kwa uwazi na heshima kwamba bado hujaweka kumbukumbu hiyo kwenye Max Memory badala ya kubuni habari za uongo.
5. **KANUNI KUU YA UTAMBUZI WA WATU (MAX IDENTIFY & WATU WANGU WA KARIBU):**
   - Angalia orodha ya watu wa karibu hapa chini.
   - Kama Max akikuuliza kuhusu mtu wa karibu (mfano "Mke wangu ni nani?", "Unamjua Mary?", "Mama yangu ni nani?"), tumia taarifa zao halisi zilizoorodheshwa hapa chini.
6. **KANUNI YA MAFAILI NA NYARAKA:**
   - Mfumo huu una injini halisi ya kuzalisha mafaili (PDF, Excel, Word, CSV).
   - Ikiwa Max anaomba faili, mpe maudhui kamili yaliyopangwa vizuri.
7. **KANUNI YA TAFUTIO LA MTANDAONI:**
   - Kama swali linahusu michezo/mechi, habari mpya, matokeo, bei, viongozi wa sasa, au jambo lolote la sasa au lisilo na uhakika, tumia live web evidence iliyotolewa na backend.
   - Kwa maswali ya sasa, usitegemee kumbukumbu ya modeli kama ushahidi mkuu.
   - Kwa michezo, thibitisha tarehe ya mechi, mpinzani na matokeo ya karibuni kutoka kwenye vyanzo vya live search.
   - Kwa viongozi wa sasa, thibitisha jina kutoka chanzo cha kuaminika na cha karibuni.
   - Kama vyanzo vinapingana, eleza kwa kifupi na chagua chanzo cha karibuni na cha kuaminika zaidi.
   - Kamwe usibuni jina, bao, tarehe, au tukio lisilothibitishwa na evidence ya search.

---
ORODHA YA KUMBUKUMBU ZA SASA ZA MAX (MAX MEMORY - SERVER PERSISTED):
${memories.length > 0 ? memories.map((memory, index) => `${index + 1}. [${memory.category}] ${memory.content} (Ilihifadhiwa: ${memory.createdAt})`).join('\n') : 'Hakuna kumbukumbu za ziada zilizohifadhiwa kwa sasa.'}

---
ORODHA YA WATU WANGU WA KARIBU (MAX IDENTIFY / CLOSE PEOPLE):
${people.length > 0 ? people.map((person, index) => `${index + 1}. Jina: ${person.name} | Uhusiano: ${person.relationship}${person.nickname ? ` | Jina la utani: ${person.nickname}` : ''}${person.phone ? ` | Simu: ${person.phone}` : ''}${person.email ? ` | Email: ${person.email}` : ''}${person.notes ? ` | Maelezo: ${person.notes}` : ''}`).join('\n') : 'Hakuna watu wa karibu waliohifadhiwa kwa sasa.'}

${newlySavedMemory ? `TAARIFA YA SASA: Max ametoka kutoa amri ya kukumbuka: "${newlySavedMemory.content}". Hii imehifadhiwa kwa ufanisi kwenye database ya kudumu (Max Memory). Mthibitishie kuwa umehifadhi.` : ''}
`;
  }
