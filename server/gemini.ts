import { GoogleGenAI } from '@google/genai';
import { db, Memory, Person, GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';

let genAIClient: GoogleGenAI | null = null;

export function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

// Resilient multi-model fallback list in order of preference for high availability
const MODEL_FALLBACK_CANDIDATES = [
  'gemini-3.7-flash',
  'gemini-flash-latest',
  'gemini-3.1-flash-lite',
];

export async function generateContentWithFallback(params: {
  contents: any;
  config?: any;
  preferredModel?: string;
}): Promise<string> {
  const ai = getGenAI();
  const preferred = params.preferredModel || 'gemini-3.7-flash';
  const modelsToTry = [
    preferred,
    ...MODEL_FALLBACK_CANDIDATES.filter((m) => m !== preferred),
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const response = await ai.models.generateContent({
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
        const isTransient =
          errMsg.includes('503') ||
          errMsg.includes('UNAVAILABLE') ||
          errMsg.includes('high demand') ||
          errMsg.includes('429') ||
          errMsg.includes('RESOURCE_EXHAUSTED') ||
          errMsg.includes('Overloaded') ||
          errMsg.includes('fetch failed') ||
          errMsg.includes('network');

        // Log clean debug notice rather than full raw error trace
        if (process.env.NODE_ENV !== 'production') {
          console.log(`[MKUU AI] Notice: Model ${model} (attempt ${attempt}) transient check: ${errMsg.slice(0, 120)}... trying fallback.`);
        }

        if (isTransient && attempt === 1) {
          // Short jittered delay before retry
          const backoff = 300 + Math.floor(Math.random() * 200);
          await new Promise((resolve) => setTimeout(resolve, backoff));
          continue;
        }

        // On failure, switch to next model immediately
        break;
      }
    }
  }

  throw lastError || new Error('Wanamitandao wa AI hawajapatikana kwa sasa.');
}

export interface ProcessChatParams {
  userId: string;
  message: string;
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>;
  isVoice?: boolean;
  attachments?: Array<{
    filename: string;
    fileType: string;
    mimeType: string;
    base64Data: string;
  }>;
}

export interface ChatResponseResult {
  reply: string;
  cleanSpeechText: string;
  memoriesExtracted?: Memory[];
  peopleRecognized?: Person[];
  generatedFiles?: GeneratedFileSummary[];
}

export async function processMkuuChat(params: ProcessChatParams): Promise<ChatResponseResult> {
  const { userId, message, conversationHistory = [], isVoice = false, attachments = [] } = params;

  // 1. Fetch persistent context for Max
  const user = db.getUser(userId) || db.getOwner();
  const memories = db.getMemories(userId);
  const people = db.getPeople(userId);

  // 2. Check for explicit memory triggers
  const isExplicitMemoryCommand = detectMemoryIntent(message);
  let newlySavedMemory: Memory | null = null;

  if (isExplicitMemoryCommand) {
    const extractedContent = extractMemoryContent(message);
    if (extractedContent) {
      newlySavedMemory = db.addMemory({
        userId,
        content: extractedContent,
        category: categorizeMemory(extractedContent),
        importance: 'high',
        tags: ['chat_kumbukumbu', 'max_memory'],
        source: 'explicit_command',
      });
      // Refresh memory list with the new memory
      memories.unshift(newlySavedMemory);
    }
  }

  // 3. Check for real file generation requests
  const fileGenerationIntent = detectFileGenerationIntent(message);
  let generatedFilesList: GeneratedFileSummary[] = [];

  // 4. Construct System Prompt with True Context
  const systemPrompt = `
Wewe ni **MKUU AI** (Mkuu), msaidizi binafsi mwenye akili ya hali ya juu na mtiifu aliyejengwa mahsusi kwa ajili ya mmiliki wako mkuu anayeitwa **MAX**.

UTAMBULISHO WA MMILIKI:
- Jina la Mmiliki: ${user.name} (Max)
- Barua Pepe: ${user.email}
- Hadhi: Mmiliki Pekee Aliyeidhinishwa (Authorized Owner)

MAADILI NA TABIA YA MKUU AI:
1. Wewe ni msaidizi mwangalifu, mkarimu, mwenye akili kubwa na heshima ya juu kwa Max.
2. Lugha ya msingi ni **Kiswahili fasaha na cha asili**. Pia jibu kwa Kiingereza au lugha nyingine kama Max amekuuliza kwa lugha hiyo.
3. Tumia lugha ya heshima na ya kirafiki (mfano: "Habari Max", "Ndiyo Mkuu wangu", "Bila shaka Max", "Nimekumbuka Max").
4. **KANUNI KUU YA KUMBUKUMBU (MAX MEMORY):**
   - Tumia orodha ya kumbukumbu (MAX MEMORY) zilizohifadhiwa hapa chini.
   - Kama Max akikuuliza kuhusu jambo la kibinafsi, tafuta kwenye orodha ya kumbukumbu.
   - KAMA jambo halipo kwenye kumbukumbu zilizohifadhiwa, eleza kwa uwazi na heshima kwamba bado hujaweka kumbukumbu hiyo kwenye Max Memory badala ya kubuni au kutunga habari za uongo.
5. **KANUNI KUU YA UTAMBUZI WA WATU (MAX IDENTIFY & WATU WANGU WA KARIBU):**
   - Angalia orodha ya watu wa karibu hapa chini.
   - Kama Max akikuuliza "Unamjua mke wangu?", "Nani ni mke wangu?", "Unamjua mama yangu?", "Boss wangu ni nani?", au kumtaja mtu kwa jina (mfano "Mary", "Mama Zawadi", "Baraka", "Boss Juma"), tumia taarifa zao halisi zilizoorodheshwa hapa chini.
   - Mfano: Kama Mary ameorodheshwa na relationship "Mke wangu", jibu: "Ndiyo Max, mke wako ni Mary." Pamoja na kueleza taarifa zake kwa kifupi pale inapofaa.
   - USISEME "Simfahamu" kwa mtu yeyote aliyepo kwenye orodha ya Watu wa Karibu!
6. Kama Max ameagiza faili (PDF, Excel, Word, CSV, n.k.), uthibitisho wa faili utatengenezwa moja kwa moja na kuwekwa tayari kwa kupakuliwa.

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

  // 5. Call Gemini API with Fallbacks & Resiliency
  let aiReplyText = '';
  try {
    // Prepare contents with history
    const contents: any[] = [];
    for (const h of conversationHistory.slice(-6)) {
      contents.push({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }],
      });
    }
    // Prepare user parts with text and any attached images/documents
    const userParts: any[] = [];
    if (message) {
      userParts.push({ text: message });
    }

    if (attachments && attachments.length > 0) {
      for (const att of attachments) {
        if (att.base64Data) {
          const rawBase64 = att.base64Data.includes(',') ? att.base64Data.split(',')[1] : att.base64Data;
          if (att.mimeType && att.mimeType.startsWith('image/')) {
            userParts.push({
              inlineData: {
                data: rawBase64,
                mimeType: att.mimeType,
              },
            });
          } else if (att.mimeType === 'application/pdf') {
            userParts.push({
              inlineData: {
                data: rawBase64,
                mimeType: 'application/pdf',
              },
            });
          } else {
            // Textual document attachments
            try {
              const decodedText = Buffer.from(rawBase64, 'base64').toString('utf-8');
              userParts.push({
                text: `\n\n[Maudhui ya Faili Lililoambatanishwa: ${att.filename} (${att.fileType})]:\n${decodedText.slice(0, 8000)}\n---`,
              });
            } catch (e) {
              userParts.push({ text: `\n\n[Faili lililoambatanishwa: ${att.filename}]` });
            }
          }
        }
      }
    }

    contents.push({
      role: 'user',
      parts: userParts.length > 0 ? userParts : [{ text: message || 'Chambua faili hili' }],
    });

    aiReplyText = await generateContentWithFallback({
      preferredModel: 'gemini-3.7-flash',
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.7,
      },
    });
  } catch (error) {
    console.error('Error generating AI response with Gemini after fallbacks:', error);
    // Fallback contextual response if all model endpoints are temporarily unavailable
    aiReplyText = generateContextualFallback({
      message,
      user,
      memories,
      people,
      newlySavedMemory,
    });
  }

  // 6. If file generation was requested, generate the real binary file
  if (fileGenerationIntent) {
    try {
      const generated = await generateRealFile({
        userId,
        filename: fileGenerationIntent.filename,
        fileType: fileGenerationIntent.fileType,
        title: fileGenerationIntent.title,
        content: fileGenerationIntent.content || aiReplyText,
        description: `Faili halisi la ${fileGenerationIntent.fileType.toUpperCase()} lililoandaliwa na MKUU AI`,
      });
      generatedFilesList.push(generated);

      aiReplyText += `\n\n📄 **Faili Liko Tayari:** Nimeliandaa faili lako halisi la **${generated.filename}** (${(generated.size / 1024).toFixed(1)} KB). Unaweza kulipakua mara moja kupitia kitufe kilicho hapa chini.`;
    } catch (e) {
      console.error('Failed to generate binary file:', e);
    }
  }

  // 7. Clean text for Voice TTS (strip markdown asterisks, hashes, backticks, brackets)
  const cleanSpeechText = cleanMarkdownForVoice(aiReplyText);

  // 8. Find matching people mentioned in conversation
  const matchedPeople = people.filter((p) =>
    message.toLowerCase().includes(p.name.toLowerCase()) ||
    (p.nickname && message.toLowerCase().includes(p.nickname.toLowerCase())) ||
    message.toLowerCase().includes(p.relationship.toLowerCase())
  );

  return {
    reply: aiReplyText,
    cleanSpeechText,
    memoriesExtracted: newlySavedMemory ? [newlySavedMemory] : undefined,
    peopleRecognized: matchedPeople.length > 0 ? matchedPeople : undefined,
    generatedFiles: generatedFilesList.length > 0 ? generatedFilesList : undefined,
  };
}

function detectMemoryIntent(text: string): boolean {
  const lower = text.toLowerCase();
  const triggers = [
    'kumbuka hii',
    'kumbuka kwamba',
    'kumbuka kuwa',
    'save this',
    'usisahaul',
    'usisahau',
    'remember this',
    'remember that',
    'hifadhi hii',
    'weka kwenye kumbukumbu',
    'zingatia hili',
    'andika kumbukumbu',
  ];
  return triggers.some((t) => lower.includes(t));
}

function extractMemoryContent(text: string): string {
  // Strip trigger words and get core statement
  let cleaned = text
    .replace(/^(mkuu|mkuu ai|mkuu,\s*|mkuu ai,\s*)/i, '')
    .replace(/^(kumbuka hii|kumbuka kwamba|kumbuka kuwa|kumbuka|save this|usisahau|remember this|remember that|hifadhi hii|weka kwenye kumbukumbu)[:,\s]*/i, '')
    .trim();

  // If user says "napenda...", adjust context for Max
  if (cleaned.startsWith('napenda') || cleaned.startsWith('ninapenda')) {
    cleaned = `Max anapenda ${cleaned.replace(/^(napenda|ninapenda)\s*/i, '')}`;
  } else if (cleaned.startsWith('naitwa') || cleaned.startsWith('mimi ni')) {
    cleaned = `Max: ${cleaned}`;
  }

  return cleaned || text;
}

function categorizeMemory(content: string): Memory['category'] {
  const lower = content.toLowerCase();
  if (lower.includes('penda') || lower.includes('upendeleo') || lower.includes('lugha') || lower.includes('chakula') || lower.includes('rangi')) {
    return 'Preferences';
  }
  if (lower.includes('kazi') || lower.includes('ofisi') || lower.includes('mradi') || lower.includes('ripoti') || lower.includes('kampuni')) {
    return 'Work';
  }
  if (lower.includes('mke') || lower.includes('mama') || lower.includes('baba') || lower.includes('mtoto') || lower.includes('kaka') || lower.includes('dada') || lower.includes('familia')) {
    return 'Family';
  }
  if (lower.includes('afya') || lower.includes('dawa') || lower.includes('hospitali') || lower.includes('mazoezi')) {
    return 'Health';
  }
  if (lower.includes('fedha') || lower.includes('pesa') || lower.includes('benki') || lower.includes('bajeti') || lower.includes('shilingi') || lower.includes('dola')) {
    return 'Finance';
  }
  if (lower.includes('kanuni') || lower.includes('sheria') || lower.includes('kamwe') || lower.includes('usifanye')) {
    return 'Rules';
  }
  return 'General';
}

interface FileIntent {
  filename: string;
  fileType: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'json' | 'md';
  title: string;
  content?: string;
}

function detectFileGenerationIntent(text: string): FileIntent | null {
  const lower = text.toLowerCase();

  // Check PDF
  if (lower.includes('pdf') && (lower.includes('niandalie') || lower.includes('tengeneza') || lower.includes('create') || lower.includes('make') || lower.includes('andika') || lower.includes('download'))) {
    return {
      filename: `Ripoti_ya_Max_${Date.now().toString().slice(-4)}.pdf`,
      fileType: 'pdf',
      title: 'Ripoti Maalum ya Max',
    };
  }

  // Check Excel / XLSX
  if ((lower.includes('excel') || lower.includes('xlsx') || lower.includes('spreadsheet') || lower.includes('jedwali')) && (lower.includes('niandalie') || lower.includes('tengeneza') || lower.includes('create') || lower.includes('make'))) {
    return {
      filename: `Jedwali_la_Max_${Date.now().toString().slice(-4)}.xlsx`,
      fileType: 'xlsx',
      title: 'Jedwali la Kazi na Takwimu za Max',
    };
  }

  // Check DOCX / Word
  if ((lower.includes('docx') || lower.includes('word') || lower.includes('document')) && (lower.includes('niandalie') || lower.includes('tengeneza') || lower.includes('create'))) {
    return {
      filename: `Waraka_wa_Max_${Date.now().toString().slice(-4)}.docx`,
      fileType: 'docx',
      title: 'Waraka Rasmi wa Max',
    };
  }

  // Check CSV
  if (lower.includes('csv') && (lower.includes('tengeneza') || lower.includes('create') || lower.includes('niandalie'))) {
    return {
      filename: `Takwimu_za_Max_${Date.now().toString().slice(-4)}.csv`,
      fileType: 'csv',
      title: 'Faili la Takwimu za CSV',
    };
  }

  // Check JSON
  if (lower.includes('json') && (lower.includes('tengeneza') || lower.includes('create') || lower.includes('niandalie') || lower.includes('hifadhi kama json'))) {
    return {
      filename: `Data_ya_Max_${Date.now().toString().slice(-4)}.json`,
      fileType: 'json',
      title: 'Data ya JSON',
    };
  }

  return null;
}

export function cleanMarkdownForVoice(text: string): string {
  if (!text) return '';

  return text
    // Remove bold and italic markdown: **text** or *text* or __text__ or _text_
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    // Remove headers: # Header
    .replace(/^#+\s+/gm, '')
    // Remove list markers: - item or * item or 1. item
    .replace(/^[\*\-]\s+/gm, '')
    .replace(/^\d+\.\s+/gm, '')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, 'kuna kizuizi cha msimbo wa kompyuta')
    .replace(/`([^`]+)`/g, '$1')
    // Remove links: [text](url)
    .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1')
    // Remove emojis that may read weirdly or technical symbols
    .replace(/[#*_~`><|]/g, '')
    // Remove extra whitespaces and newlines
    .replace(/\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
}

function generateContextualFallback(params: {
  message: string;
  user: any;
  memories: Memory[];
  people: Person[];
  newlySavedMemory: Memory | null;
}): string {
  const { message, user, memories, people, newlySavedMemory } = params;
  const lower = message.toLowerCase();

  if (newlySavedMemory) {
    return `Ndiyo Max, nimehifadhi kumbukumbu hii kwenye Max Memory ya kudumu: "${newlySavedMemory.content}". Hawezi kupotea hata ukizima kifaa au ukianza mazungumzo mapya.`;
  }

  // Question about wife / people
  if (lower.includes('mke')) {
    const wife = people.find((p) => p.relationship.toLowerCase().includes('mke'));
    if (wife) {
      return `Ndiyo Max, mke wako ni ${wife.name}${wife.nickname ? ` (anayejulikana pia kama ${wife.nickname})` : ''}.${wife.notes ? ` ${wife.notes}` : ''}`;
    }
  }

  if (lower.includes('mama')) {
    const mama = people.find((p) => p.relationship.toLowerCase().includes('mama'));
    if (mama) {
      return `Ndiyo Max, mama yako ni ${mama.name}.${mama.notes ? ` ${mama.notes}` : ''}`;
    }
  }

  if (lower.includes('boss') || lower.includes('bosi')) {
    const boss = people.find((p) => p.relationship.toLowerCase().includes('boss') || p.relationship.toLowerCase().includes('bosi'));
    if (boss) {
      return `Ndiyo Max, boss wako ni ${boss.name} (${boss.nickname || 'Mkurugenzi'}). ${boss.notes || ''}`;
    }
  }

  // Greetings
  if (lower.includes('habari') || lower.includes('mambo') || lower.includes('hello') || lower.includes('hi')) {
    return `Habari Max! Mimi ni MKUU AI, msaidizi wako binafsi. Nipo tayari kukusaidia na kumbukumbu zako (Max Memory), watu wako wa karibu (Max Identify), majibu ya moja kwa moja (Max Auto Reply), na kuandaa mafaili halisi. Nikuongoze na nini leo?`;
  }

  // Memory query
  if (lower.includes('unakumbuka') || lower.includes('kumbukumbu')) {
    if (memories.length > 0) {
      const memList = memories.slice(0, 3).map((m) => `• ${m.content}`).join('\n');
      return `Ndiyo Max, ninakumbuka mambo yafuatayo yaliyohifadhiwa kwenye Max Memory:\n${memList}\n\nUngependa niongeze au nisasambue kumbukumbu yoyote?`;
    }
    return `Max, kwa sasa bado hatujaweka kumbukumbu maalum kuhusu hilo kwenye Max Memory. Niambie "Kumbuka [taarifa yako]" nami nitaweka kwenye kumbukumbu ya kudumu mara moja.`;
  }

  return `Nimekuelewa vyema Max. Ninaendelea kufanya kazi chini ya maelekezo yako kama MKUU AI. Unaweza kuniagiza nikumbuke jambo lolote, nikukumbushe kuhusu Watu wako wa Karibu, nikuandalie faili (PDF, Excel, Word), au kusimamia Auto Reply.`;
}
