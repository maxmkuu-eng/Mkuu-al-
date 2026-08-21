const fs = require('node:fs');

const file = 'server/geminiService.ts';
const source = fs.readFileSync(file, 'utf8');
if (source.includes('MKUU_GLOBAL_LIVE_WEB_V1')) {
  console.log('MKUU: Global Live Web Engine already enabled.');
  process.exit(0);
}

const oldMethod = /  private detectSearchIntent\(message: string\): boolean \{[\s\S]*?\n  \}\n\n  private isInsufficientKnowledgeResponse/;
const newMethod = `  // MKUU_GLOBAL_LIVE_WEB_V1\n  private detectSearchIntent(message: string): boolean {\n    if (!message) return false;\n    const lower = message.toLowerCase().trim();\n    const personalOnly = [\n      'mke wangu unamjua', 'mke wangu ni nani', 'mume wangu ni nani', 'mama yangu ni nani',\n      'baba yangu ni nani', 'mtoto wangu ni nani', 'unamjua ', 'unakumbuka ', 'kumbuka ',\n      'nimekwambia', 'nilikuambia', 'nilikwambia', 'max memory'\n    ];\n    if (personalOnly.some((x) => lower.includes(x))) return false;\n\n    const explicitSearch = /\\b(tafuta|search|google|web|mtandao|online|source|chanzo)\\b/i.test(lower);\n    const currentSignals = /\\b(leo|kesho|jana|sasa|hivi sasa|kwa sasa|latest|current|today|tomorrow|yesterday|now|recent|recently|latest news|breaking|live|updated|update|mpya|hivi punde|hivi karibuni)\\b/i.test(lower);\n    const factualQuestion = /^(nani|nini|lini|wapi|kwa nini|vipi|je|how|who|what|when|where|why|which|is|are|can|does|did|will)\\b/i.test(lower) || /[?？]/.test(lower);\n    const dynamicDomains = /\\b(serikali|rais|waziri|wizara|kiongozi|uchaguzi|siasa|habari|news|michezo|mpira|football|soccer|basketball|tennis|cricket|mechi|mchezo|ratiba|matokeo|score|standings|msimamo|biashara|kampuni|uchumi|economy|market|hisa|stock|bei|price|dola|exchange rate|sarafu|crypto|bitcoin|ethereum|msanii|msanii|artist|music|album|wimbo|concert|movie|filamu|technology|teknolojia|ai|artificial intelligence|iphone|android|product|launch|event|weather|hali ya hewa|trafiki|flight|ndege|visa|sheria|law|court|mahakama|scientist|sayansi|space|science|transfer|injury|election|president|minister|prime minister|company|business|finance|stock price)\\b/i.test(lower);\n\n    // A factual question about a dynamic real-world subject is live-search first.\n    // This is intentionally global: no Tanzania-only or sports-only keyword gate.\n    if (explicitSearch || currentSignals || (factualQuestion && dynamicDomains)) return true;\n\n    // Short factual questions can still be time-sensitive even without a domain keyword.\n    if (factualQuestion && lower.length >= 12 && lower.length <= 220) return true;\n\n    return false;\n  }\n\n  private isInsufficientKnowledgeResponse`;

if (!oldMethod.test(source)) {
  throw new Error('MKUU: global live web detectSearchIntent insertion point not found.');
}
fs.writeFileSync(file, source.replace(oldMethod, newMethod), 'utf8');
console.log('MKUU: Global Live Web Engine enabled: dynamic factual questions are live-search first worldwide.');
