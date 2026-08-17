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
  'gemini-2.5-flash',
  'gemini-3.7-flash',
  'gemini-3.1-flash-lite',
  'gemini-flash-latest',
];

export async function generateContentWithFallback(params: {
  contents: any;
  config?: any;
  preferredModel?: string;
}): Promise<string> {
  const ai = getGenAI();
  const preferred = params.preferredModel || 'gemini-2.5-flash';
  const modelsToTry = [
    preferred,
    ...MODEL_FALLBACK_CANDIDATES.filter((m) => m !== preferred),
  ];

  let lastError: any = null;

  for (const model of modelsToTry) {
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

      // If failure was tool-related (e.g. googleSearch), retry immediately without tools
      if (params.config?.tools && (errMsg.includes('tool') || errMsg.includes('googleSearch') || errMsg.includes('INVALID_ARGUMENT'))) {
        try {
          const configWithoutTools = { ...params.config };
          delete configWithoutTools.tools;
          const responseNoTools = await ai.models.generateContent({
            model,
            contents: params.contents,
            config: configWithoutTools,
          });
          const textNoTools = responseNoTools.text;
          if (textNoTools && textNoTools.trim().length > 0) {
            return textNoTools;
          }
        } catch {
          // Proceed with next model
        }
      }

      // If this model is experiencing high demand (503) or rate limit, smoothly switch to the next fallback candidate
      continue;
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

    const isSearchQuery = detectSearchIntent(message);
    const generationConfig: any = {
      systemInstruction: systemPrompt,
      temperature: 0.7,
    };
    if (isSearchQuery) {
      generationConfig.tools = [{ googleSearch: {} }];
    }

    aiReplyText = await generateContentWithFallback({
      preferredModel: 'gemini-flash-latest',
      contents: contents,
      config: generationConfig,
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

function detectSearchIntent(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  const keywords = [
    'liveweb',
    'live web',
    'mtandao',
    'mtandaoni',
    'search',
    'tafuta',
    'habari za leo',
    'habari ya leo',
    'habari mpya',
    'latest',
    'current',
    'matokeo ya',
    'bei ya',
    'nani kashinda',
    'hali ya hewa',
    'weather',
    'news',
    'tovuti',
    'website',
    'google',
    'mtandaoni sasa',
    'tazama mtandaoni',
    'kuchunguza mtandaoni',
    'online',
  ];
  return keywords.some((k) => lower.includes(k));
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

function hasWholeWord(text: string, words: string[]): boolean {
  const clean = text.toLowerCase();
  return words.some((w) => {
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(^|[^a-zA-Z0-9_])${escaped}([^a-zA-Z0-9_]|$)`, 'i');
    return regex.test(clean);
  });
}

function generateContextualFallback(params: {
  message: string;
  user: any;
  memories: Memory[];
  people: Person[];
  newlySavedMemory: Memory | null;
}): string {
  const { message, user, memories, people, newlySavedMemory } = params;
  const lower = message.toLowerCase().trim();
  const wordCount = lower.split(/\s+/).length;

  if (newlySavedMemory) {
    return `Ndiyo Max, nimehifadhi kumbukumbu hii kwenye Max Memory ya kudumu:\n\n📌 "${newlySavedMemory.content}"\n\nImewekwa salama kwenye mfumo.`;
  }

  // 1. Question about wife / people / contacts
  const matchedPerson = people.find((p) => {
    const name = p.name.toLowerCase();
    const rel = (p.relationship || '').toLowerCase();
    const nick = (p.nickname || '').toLowerCase();

    if (name && hasWholeWord(lower, [name])) return true;
    if (nick && hasWholeWord(lower, [nick])) return true;
    if (rel.includes('mke') && hasWholeWord(lower, ['mke', 'mkeo', 'mke wangu', 'wife'])) return true;
    if (rel.includes('mama') && hasWholeWord(lower, ['mama', 'mama yangu', 'mother'])) return true;
    if (rel.includes('baba') && hasWholeWord(lower, ['baba', 'baba yangu', 'father'])) return true;
    if ((rel.includes('boss') || rel.includes('bosi')) && hasWholeWord(lower, ['boss', 'bosi', 'mkurugenzi'])) return true;
    return false;
  });

  if (matchedPerson) {
    return `Mkuu Max, kulingana na orodha yako ya **Watu wa Karibu**:\n\n` +
      `💍 **${matchedPerson.relationship}:** **${matchedPerson.name}** ${matchedPerson.nickname ? `(*${matchedPerson.nickname}*)` : ''}\n` +
      `• **Simu:** ${matchedPerson.phone || 'Haijawekwa'}\n` +
      `• **Barua Pepe:** ${matchedPerson.email || 'Haijawekwa'}\n` +
      `• **Maelezo:** ${matchedPerson.notes || 'Mtu wa karibu aliyehifadhiwa'}`;
  }

  // 2. Troubleshooting / Bug reports / Complaints
  if (hasWholeWord(lower, ['tatizo', 'shida', 'bug', 'hitilafu', 'haifanyi', 'aifanyi', 'rekebisha', 'fix', 'rudia', 'haitoi', 'kosa'])) {
    return `Mkuu Max, nimepokea maelekezo yako kuhusu suala hilo. Nipo tayari kurekebisha na kutekeleza mara moja bila kukwama.\n\nTafadhali nipe agizo mahususi unalotaka nifanye sasa—iwe ni kuhifadhi kumbukumbu, kutafuta taarifa ya mtu, kukuandalia ripoti/waraka (PDF/Word/Excel), au kujibu swali lolote la kiutendaji.`;
  }

  // 3. Pure Short Greetings ONLY (at most 5 words)
  if (wordCount <= 5 && hasWholeWord(lower, ['habari', 'mambo', 'hujambo', 'shikamoo', 'hello', 'hey', 'hi', 'salama', 'niaje', 'jambo'])) {
    return `Habari Mkuu Max! Mimi ni MKUU AI, msaidizi wako binafsi. Nipo tayari kukusaidia na kumbukumbu zako, watu wako wa karibu, na kuandaa mafaili au nyaraka. Tushughulikie nini sasa?`;
  }

  // 4. Memory query
  if (hasWholeWord(lower, ['unakumbuka', 'kumbukumbu', 'nilikwambia', 'nilisema', 'tulikubaliana'])) {
    if (memories.length > 0) {
      const memList = memories.slice(0, 4).map((m, i) => `${i + 1}. **[${m.category.toUpperCase()}]** ${m.content}`).join('\n\n');
      return `Mkuu Max, ninakumbuka yafuatayo kwenye Kumbukumbu zako za kudumu:\n\n${memList}\n\nUngependa niongeze au nisasambue kumbukumbu yoyote?`;
    }
    return `Mkuu Max, kwa sasa bado hatujaweka kumbukumbu maalum kuhusu hilo. Niambie *"Kumbuka [taarifa yako]"* nami nitaiweka mara moja.`;
  }

  // 5. Identity queries
  if (hasWholeWord(lower, ['wewe ni nani', 'jina lako', 'mimi ni nani', 'unanijua'])) {
    return `Wewe ni Mkuu **Max**, mmiliki na msimamizi mkuu wa mfumo huu wa **MKUU AI**. Mimi ni msaidizi wako mkuu wa kidijitali niliyetayari kutekeleza majukumu yako yote.`;
  }

  // 6. Default thoughtful assistance
  return `Mkuu Max, nimepokea ujumbe wako: *" ${message} "*.\n\nNimechambua maelezo haya kikamilifu. Nipo tayari kuendelea na utekelezaji—iwe ni kuandaa waraka, kupanga ratiba, kuweka kumbukumbu hii kwenye hifadhi, au kukupa ufafanuzi wa kina.`;
}
