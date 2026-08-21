const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'geminiService.ts');
let source = fs.readFileSync(file, 'utf8');

// Current/live questions are Tavily-authoritative. Gemini may synthesize Tavily
// evidence, but it must never invoke Google Search or answer from stale memory
// when Tavily fails.
const searchStart = "    if (isSearchQuery) {\n      try {";
const fallbackStartMarker = "        // Secondary fallback: Google Search grounding.";
const outerCatchEndMarker = "      }\n\n      console.log(`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED]";

const searchStartIndex = source.indexOf(searchStart);
const fallbackStart = source.indexOf(fallbackStartMarker, searchStartIndex);
const outerCatchEnd = source.indexOf(outerCatchEndMarker, fallbackStart);
if (searchStartIndex < 0 || fallbackStart < 0 || outerCatchEnd < 0) {
  throw new Error('MKUU: Tavily-only live-search markers not found; refusing unsafe source rewrite.');
}

// Replace the entire Google Search fallback section while preserving the
// surrounding Tavily catch block and the normal response logging.
const fallbackSection = source.slice(fallbackStart, outerCatchEnd);
if (!/googleSearch|Falling back from Tavily to Google Search grounding/i.test(fallbackSection)) {
  throw new Error('MKUU: Google Search fallback section not found; refusing unsafe source rewrite.');
}
source = source.replace(
  fallbackSection,
  "        throw new Error(`LIVE_SEARCH_UNAVAILABLE: Tavily live search failed. MKUU will not use Gemini/Google Search as a fallback. ${tavilyMsg}`);\n",
);

// Search synthesis can use Gemini, but it must use the selected live-search
// model rather than silently switching back to the personal chat model.
const searchPreferred = "          preferredModel: PERSONAL_CHAT_MODEL,\n        });";
if (!source.includes(searchPreferred)) {
  throw new Error('MKUU: Tavily synthesis model marker not found; refusing unsafe source rewrite.');
}
source = source.replace(searchPreferred, "          preferredModel: usedModel,\n        });", 1);

source = source.replace(
  "// Live-search path: Tavily -> Gemini without tools; Google Search is retained as a secondary fallback",
  "// Live-search path: Tavily -> Gemini synthesis only; Google Search is forbidden",
);
source = source.replace(
  "console.log(`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED] model=\"${PERSONAL_CHAT_MODEL}\"",
  "console.log(`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED] model=\"${usedModel}\"",
);

fs.writeFileSync(file, source);
console.log('MKUU: Tavily is now the sole authoritative live web/social search engine; Gemini Google Search fallback disabled.');
