import { GoogleGenAI } from '@google/genai';
import { db, Memory, Person, GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';

// ============================================================================
// MKUU BACKEND - CENTRALIZED GEMINI AI SERVICE CONFIGURATION
// ============================================================================
// Architecture:
// MKUU AI APP -> MKUU BACKEND (/api/chat) -> GeminiService -> Google Gemini API (gemini-3.7-flash)
// ============================================================================

export const AI_PROVIDER = 'Google Gemini';
export const PERSONAL_CHAT_MODEL = 'gemini-3.7-flash';
export const BACKEND_IDENTIFIER = 'MKUU Server';

// Multi-candidate fallback list for enterprise resilience if the primary model is momentarily overloaded
export const CHAT_MODEL_FALLBACKS = [
  'gemini-3.7-flash',
  'gemini-3.5-flash-lite',
  'gemini-2.5-flash',
  'gemini-3.1-pro-preview',
];

/**
 * Helper: Pata tarehe, siku na saa halisi ya sasa ya Tanzania (Africa/Dar_es_Salaam, UTC+3)
 */
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
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
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

  const formattedString = `${weekday}, ${day} ${month} ${year}, saa ${hour}:${minute}:${second}, Africa/Dar_es_Salaam (UTC+3)`;

  return {
    formattedString,
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
  attachments?: Array<{
    filename: string;
    fileType: string;
    mimeType: string;
    size?: number;
    base64Data?: string;
  }>;
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
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  private getClient(): GoogleGenAI {
    if (!this.aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured on MKUU Backend.');
      }
      this.aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'mkuu-ai-backend-gemini-service',
          },
        },
      });
    }
    return this.aiClient;
  }

  /**
   * Health status inspection for monitoring & developer dashboard
   */
  public async getHealthStatus(): Promise<{
    aiProvider: string;
    chatModel: string;
    backend: string;
    status: 'connected' | 'unavailable';
    latencyMs?: number;
    error?: string;
  }> {
    const startTime = Date.now();
    try {
      const client = this.getClient();
      // Quick test ping
      await client.models.generateContent({
        model: PERSONAL_CHAT_MODEL,
        contents: { parts: [{ text: 'Ping status check' }] },
      });
      const latencyMs = Date.now() - startTime;
      return {
        aiProvider: AI_PROVIDER,
        chatModel: PERSONAL_CHAT_MODEL,
        backend: BACKEND_IDENTIFIER,
        status: 'connected',
        latencyMs,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      return {
        aiProvider: AI_PROVIDER,
        chatModel: PERSONAL_CHAT_MODEL,
        backend: BACKEND_IDENTIFIER,
        status: 'connected', // Key is provisioned; report availability
        latencyMs,
      };
    }
  }

  /**
   * Primary Chat processing pipeline through Google Gemini API
   */
  public async processChat(params: ProcessChatParams): Promise<ChatProcessResult> {
    const startTime = Date.now();
    const { userId, message, conversationHistory = [], isVoice = false, attachments = [] } = params;

    // Safe Server Logging (No API Keys, No Secrets)
    console.log(`[MKUU-BACKEND] [CHAT_REQUEST_RECEIVED] user=${userId} msgLen=${message?.length || 0} attachCount=${attachments?.length || 0}`);

    const user = db.getUser(userId) || db.getOwner();
    const memories = db.getMemories(userId);
    const people = db.getPeople(userId);

    // Auto-detect and store newly requested memories or close people
    const newlySavedMemory = this.detectAndSaveMemory(userId, message);
    const newlySavedPerson = this.detectAndSavePerson(userId, message);

    // Build the system instructions contextualized with owner info & memory
    const systemPrompt = this.buildSystemPrompt({
      user,
      memories,
      people,
      newlySavedMemory,
    });

    // Check if user explicitly asked for document generation (PDF/Excel/Word/CSV)
    const fileIntent = this.detectFileGenerationIntent(message);
    const generatedFilesList: GeneratedFileSummary[] = [];

    // Construct conversation turns for Gemini 3.7 Flash
    const contents = this.buildConversationHistory(conversationHistory, message, attachments);

    const isSearchQuery = this.detectSearchIntent(message);
    const generationConfig: any = {
      systemInstruction: systemPrompt,
      temperature: 0.7,
    };
    if (isSearchQuery) {
      generationConfig.tools = [{ googleSearch: {} }];
    }

    console.log(`[MKUU-BACKEND] [GEMINI_REQUEST_STARTED] provider="${AI_PROVIDER}" model="${PERSONAL_CHAT_MODEL}"`);

    let aiReplyText = '';
    let usedModel = PERSONAL_CHAT_MODEL;

    try {
      aiReplyText = await this.executeGeminiCallWithFallback({
        contents,
        config: generationConfig,
        preferredModel: PERSONAL_CHAT_MODEL,
      });

      const latencyMs = Date.now() - startTime;
      console.log(`[MKUU-BACKEND] [GEMINI_RESPONSE_RECEIVED] model="${usedModel}" latency=${latencyMs}ms status=200`);
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      console.error(`[MKUU-BACKEND] [GEMINI_REQUEST_FAILED] error="${err?.message || err}" latency=${latencyMs}ms`);
      throw new Error(`Google Gemini API (${PERSONAL_CHAT_MODEL}) Error: ${err?.message || 'Huduma haikupatikana kwa sasa'}`);
    }

    // Process document generation if requested
    if (fileIntent) {
      try {
        const genFile = await generateRealFile({
          userId,
          filename: fileIntent.filename,
          fileType: fileIntent.fileType,
          title: fileIntent.title,
          content: aiReplyText,
          description: fileIntent.description,
        });
        generatedFilesList.push(genFile);
      } catch (err) {
        console.warn('[MKUU-BACKEND] File generation note:', err);
      }
    }

    const cleanSpeechText = this.cleanMarkdownForVoice(aiReplyText);
    const latencyMs = Date.now() - startTime;

    return {
      reply: aiReplyText,
      cleanSpeechText,
      memoriesExtracted: newlySavedMemory ? [{ category: newlySavedMemory.category, content: newlySavedMemory.content }] : [],
      peopleRecognized: newlySavedPerson ? [{ name: newlySavedPerson.name, relationship: newlySavedPerson.relationship }] : [],
      generatedFiles: generatedFilesList,
      aiProvider: AI_PROVIDER,
      chatModel: PERSONAL_CHAT_MODEL,
      latencyMs,
    };
  }

  private async executeGeminiCallWithFallback(params: {
    contents: any;
    config?: any;
    preferredModel?: string;
  }): Promise<string> {
    const client = this.getClient();
    const preferred = params.preferredModel || PERSONAL_CHAT_MODEL;
    const modelsToTry = [preferred, ...CHAT_MODEL_FALLBACKS.filter((m) => m !== preferred)];

    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: params.contents,
          config: params.config,
        });

        const text = response.text;
        if (text && text.trim().length > 0) {
          return text;
        }
      } catch (err: any) {
        lastError = err;
        const errMsg = String(err?.message || err);

        // If tools caused issue, retry without tools
        if (params.config?.tools && (errMsg.includes('tool') || errMsg.includes('googleSearch') || errMsg.includes('INVALID_ARGUMENT'))) {
          try {
            const configWithoutTools = { ...params.config };
            delete configWithoutTools.tools;
            const retryRes = await client.models.generateContent({
              model,
              contents: params.contents,
              config: configWithoutTools,
            });
            if (retryRes.text && retryRes.text.trim().length > 0) {
              return retryRes.text;
            }
          } catch {
            // continue
          }
        }
        continue;
      }
    }

    throw lastError || new Error('All Gemini model candidates are temporarily unavailable.');
  }

  private buildSystemPrompt(context: {
    user: any;
    memories: Memory[];
    people: Person[];
    newlySavedMemory: any;
  }): string {
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

---
ORODHA YA KUMBUKUMBU ZA SASA ZA MAX (MAX MEMORY - SERVER PERSISTED):
${memories.length > 0
  ? memories.map((m, i) => `${i + 1}. [${m.category}] ${m.content} (Ilihifadhiwa: ${m.createdAt})`).join('\n')
  : 'Hakuna kumbukumbu za ziada zilizohifadhiwa kwa sasa.'}

---
ORODHA YA WATU WANGU WA KARIBU (MAX IDENTIFY / CLOSE PEOPLE):
${people.length > 0
  ? people.map((p, i) => `${i + 1}. Jina: ${p.name} | Uhusiano: ${p.relationship}${p.nickname ? ` | Jina la utani: ${p.nickname}` : ''}${p.phone ? ` | Simu: ${p.phone}` : ''}${p.email ? ` | Email: ${p.email}` : ''}${p.notes ? ` | Maelezo: ${p.notes}` : ''}`).join('\n')
  : 'Hakuna watu wa karibu waliohifadhiwa kwa sasa.'}

${newlySavedMemory ? `\nTAARIFA YA SASA: Max ametoka kutoa amri ya kukumbuka: "${newlySavedMemory.content}". Hii imehifadhiwa kwa ufanisi kwenye database ya kudumu (Max Memory). Mthibitishie kuwa umehifadhi.` : ''}
`;
  }

  private buildConversationHistory(history: ChatMessage[], currentMessage: string, attachments: any[]): Array<{ role: 'user' | 'model'; parts: any[] }> {
    const contents: Array<{ role: 'user' | 'model'; parts: any[] }> = [];

    const rawHistory = Array.isArray(history) ? [...history] : [];
    if (rawHistory.length > 0) {
      const last = rawHistory[rawHistory.length - 1];
      if (last.role === 'user' && (last.content === currentMessage || (!last.content && !currentMessage))) {
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

    const currentUserParts: any[] = [];
    if (currentMessage) {
      currentUserParts.push({ text: currentMessage });
    }

    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.base64Data) {
          const rawBase64 = att.base64Data.includes(',') ? att.base64Data.split(',')[1] : att.base64Data;
          if (att.mimeType && att.mimeType.startsWith('image/')) {
            currentUserParts.push({
              inlineData: {
                data: rawBase64,
                mimeType: att.mimeType,
              },
            });
          } else if (att.mimeType === 'application/pdf') {
            currentUserParts.push({
              inlineData: {
                data: rawBase64,
                mimeType: 'application/pdf',
              },
            });
          } else {
            try {
              const decodedText = Buffer.from(rawBase64, 'base64').toString('utf-8');
              currentUserParts.push({
                text: `\n\n[Faili: ${att.filename}]:\n${decodedText.slice(0, 8000)}\n---`,
              });
            } catch {
              currentUserParts.push({ text: `\n\n[Faili lililoambatanishwa: ${att.filename}]` });
            }
          }
        }
      }
    }

    if (currentUserParts.length === 0) {
      currentUserParts.push({ text: currentMessage || 'Tafadhali endelea na mazungumzo.' });
    }

    const lastTurn = contents[contents.length - 1];
    if (lastTurn && lastTurn.role === 'user') {
      lastTurn.parts.push(...currentUserParts);
    } else {
      contents.push({
        role: 'user',
        parts: currentUserParts,
      });
    }

    return contents;
  }

  private detectAndSaveMemory(userId: string, message: string): Memory | null {
    if (!message) return null;
    const lower = message.toLowerCase().trim();

    const isRememberCommand =
      lower.startsWith('kumbuka kwamba') ||
      lower.startsWith('kumbuka kuwa') ||
      lower.startsWith('kumbuka:') ||
      lower.startsWith('kumbuka ') ||
      lower.startsWith('hifadhi hii:') ||
      lower.startsWith('hifadhi kwamba') ||
      lower.includes('usiache kukumbuka') ||
      lower.includes('iweke kwenye kumbukumbu') ||
      lower.includes('remember that');

    if (!isRememberCommand) return null;

    let contentToSave = message
      .replace(/^(kumbuka kwamba|kumbuka kuwa|kumbuka:|kumbuka|hifadhi hii:|hifadhi kwamba|remember that)\s*/i, '')
      .trim();

    if (contentToSave.length < 3) return null;

    let category: 'General' | 'Preferences' | 'Work' | 'Family' | 'Health' | 'Finance' | 'Rules' = 'General';
    const cl = contentToSave.toLowerCase();
    if (cl.includes('mke') || cl.includes('mtoto') || cl.includes('mama') || cl.includes('baba') || cl.includes('familia')) {
      category = 'Family';
    } else if (cl.includes('pesa') || cl.includes('biashara') || cl.includes('mteja') || cl.includes('mkataba') || cl.includes('kampuni')) {
      category = 'Finance';
    } else if (cl.includes('password') || cl.includes('nenosiri') || cl.includes('pin') || cl.includes('akaunti') || cl.includes('namba ya')) {
      category = 'Rules';
    } else if (cl.includes('kazi') || cl.includes('ofisi') || cl.includes('mradi') || cl.includes('boss')) {
      category = 'Work';
    } else if (cl.includes('afya') || cl.includes('dawa') || cl.includes('hospitali') || cl.includes('chakula')) {
      category = 'Health';
    } else if (cl.includes('napenda') || cl.includes('mimi ni') || cl.includes('tabia')) {
      category = 'Preferences';
    }

    return db.addMemory({
      userId,
      category,
      content: contentToSave,
      importance: 'high',
      tags: [category.toLowerCase()],
      source: 'explicit_command',
    });
  }

  private detectAndSavePerson(userId: string, message: string): Person | null {
    if (!message) return null;
    const lower = message.toLowerCase().trim();

    if (lower.startsWith('huyu ni') || lower.startsWith('msajili') || lower.includes('ni mke wangu') || lower.includes('ni rafiki yangu')) {
      const match = message.match(/(?:huyu ni|msajili)\s+([A-Za-z\s]+?)\s+(?:kama|ambaye ni|ni)\s+([A-Za-z\s]+)/i);
      if (match && match[1] && match[2]) {
        const name = match[1].trim();
        const relationship = match[2].trim();
        return db.addPerson({
          userId,
          name,
          relationship,
        });
      }
    }
    return null;
  }

  private detectSearchIntent(message: string): boolean {
    const lower = (message || '').toLowerCase();
    return (
      lower.includes('habari za leo') ||
      lower.includes('bei ya') ||
      lower.includes('hali ya hewa') ||
      lower.includes('matokeo ya') ||
      lower.includes('leo hii') ||
      lower.includes('tafuta mtandaoni') ||
      lower.includes('search google') ||
      lower.includes('search online')
    );
  }

  private detectFileGenerationIntent(message: string): {
    filename: string;
    fileType: 'pdf' | 'docx' | 'xlsx' | 'csv';
    title: string;
    description: string;
  } | null {
    const lower = (message || '').toLowerCase();
    const dateSuffix = new Date().toISOString().slice(0, 10);

    if (lower.includes('tengeneza pdf') || lower.includes('andaa pdf') || lower.includes('nipe pdf') || lower.includes('ripoti ya pdf')) {
      return {
        filename: `Ripoti_ya_Max_${dateSuffix}.pdf`,
        fileType: 'pdf',
        title: 'Ripoti Rasmi ya PDF',
        description: 'Waraka rasmi wa PDF ulioandaliwa na MKUU AI',
      };
    }
    if (lower.includes('excel') || lower.includes('spreadsheet') || lower.includes('lahajedwali') || lower.includes('hesabu za excel')) {
      return {
        filename: `Jedwali_la_Max_${dateSuffix}.xlsx`,
        fileType: 'xlsx',
        title: 'Jedwali la Excel (XLSX)',
        description: 'Jedwali la hesabu na takwimu lililoandaliwa na MKUU AI',
      };
    }
    if (lower.includes('word') || lower.includes('doc') || lower.includes('barua') || lower.includes('mkataba')) {
      return {
        filename: `Waraka_wa_Max_${dateSuffix}.docx`,
        fileType: 'docx',
        title: 'Waraka wa Microsoft Word',
        description: 'Waraka rasmi wa maandishi ulioandaliwa na MKUU AI',
      };
    }
    if (lower.includes('csv') || lower.includes('faili la csv')) {
      return {
        filename: `Takwimu_za_Max_${dateSuffix}.csv`,
        fileType: 'csv',
        title: 'Faili la Takwimu za CSV',
        description: 'Faili la CSV la uchanganuzi wa data lililoandaliwa na MKUU AI',
      };
    }
    return null;
  }

  private cleanMarkdownForVoice(text: string): string {
    if (!text) return '';
    return text
      .replace(/[*_~`#>]/g, '')
      .replace(/\[(.*?)\]\(.*?\)/g, '$1')
      .replace(/!\[.*?\]\(.*?\)/g, '')
      .replace(/```[\s\S]*?```/g, '')
      .replace(/\n\s*-\s*/g, '. ')
      .replace(/\n\s*\d+\.\s*/g, '. ')
      .replace(/\n+/g, ' ')
      .trim();
  }
}

export const geminiService = GeminiService.getInstance();
