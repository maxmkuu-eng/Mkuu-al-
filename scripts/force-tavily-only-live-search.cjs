const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'geminiService.ts');
let source = fs.readFileSync(file, 'utf8');

// Live/current questions are Tavily-authoritative. Gemini may synthesize Tavily
// evidence, but it must never invoke Google Search or answer from stale memory
// when Tavily fails.
const startMarker = "    if (isSearchQuery) {\n      try {";
const fallbackMarker = "        // Secondary fallback: Google Search grounding.";
const fallbackEndMarker = "      }\n\n      console.log(`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED]";

const start = source.indexOf(startMarker);
const fallback = source.indexOf(fallbackMarker, start);
const fallbackEnd = source.indexOf(fallbackEndMarker, fallback);
if (start < 0 || fallback < 0 || fallbackEnd < 0) {
  throw new Error('MKUU: Tavily-only live-search markers not found; refusing unsafe source rewrite.');
}

const fallbackBlockEnd = source.indexOf("\n        }\n      }", fallback);
if (fallbackBlockEnd < 0 || fallbackBlockEnd > fallbackEnd) {
  throw new Error('MKUU: Google Search fallback block boundary not found; refusing unsafe source rewrite.');
}

const fallbackBlock = source.slice(fallback, fallbackBlockEnd + "\n        }\n      }".length);
source = source.replace(fallbackBlock, "        throw new Error(`LIVE_SEARCH_UNAVAILABLE: Tavily live search failed. MKUU will not use Gemini/Google Search as a fallback. ${tavilyMsg}`);", 1);

source = source.replace("          preferredModel: PERSONAL_CHAT_MODEL,\n        });", "          preferredModel: usedModel,\n        });", 1);
source = source.replace("// Live-search path: Tavily -> Gemini without tools; Google Search is retained as a secondary fallback", "// Live-search path: Tavily -> Gemini synthesis only; Google Search is forbidden");
source = source.replace("console.log(`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED] model=\\\"${PERSONAL_CHAT_MODEL}\\\"", "console.log(`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED] model=\\\"${usedModel}\\\"");

fs.writeFileSync(file, source);
console.log('MKUU: Tavily is now the sole authoritative live web/social search engine; Gemini Google Search fallback disabled.');
