const fs = require('fs');
const path = require('path');

const file = path.join(process.cwd(), 'server', 'geminiService.ts');
let source = fs.readFileSync(file, 'utf8');

// LIVE SEARCH CONTRACT:
// current/live question -> Tavily web/news/social evidence -> Gemini synthesis only.
// Gemini must never invoke Google Search or use conversation/model memory as evidence
// for a current-information request.
const searchStart = "    if (isSearchQuery) {\n      try {";
const fallbackStartMarker = "        // Secondary fallback: Google Search grounding.";
const outerCatchEndMarker = "      }\n\n      console.log(`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED]";

const searchStartIndex = source.indexOf(searchStart);
const fallbackStart = source.indexOf(fallbackStartMarker, searchStartIndex);
const outerCatchEnd = source.indexOf(outerCatchEndMarker, fallbackStart);
if (searchStartIndex < 0 || fallbackStart < 0 || outerCatchEnd < 0) {
  throw new Error('MKUU: Tavily-only live-search markers not found; refusing unsafe source rewrite.');
}

const fallbackSection = source.slice(fallbackStart, outerCatchEnd);
if (!/googleSearch|Falling back from Tavily to Google Search grounding/i.test(fallbackSection)) {
  throw new Error('MKUU: Google Search fallback section not found; refusing unsafe source rewrite.');
}
source = source.replace(
  fallbackSection,
  "        throw new Error(`LIVE_SEARCH_UNAVAILABLE: Tavily live search failed. MKUU will not use Gemini/Google Search as a fallback. ${tavilyMsg}`);\n",
);

// For live questions, do not pass prior conversation turns, memories, or old model
// answers into Gemini. Gemini receives only the current user question + Tavily evidence.
const oldGroundedContents = "        const groundedContents = this.buildConversationHistory(\n          conversationHistory,\n          `${message}\\n\\n[MKUU LIVE SEARCH EVIDENCE - use this evidence to answer]\\n${tavilyResults}`,\n          attachments,\n        );";
const newGroundedContents = "        const groundedContents = [{ role: 'user', parts: [{ text: `${message}\\n\\n[MKUU LIVE SEARCH EVIDENCE - Tavily ONLY]\\n${tavilyResults}` }] }];";
if (!source.includes(oldGroundedContents)) {
  throw new Error('MKUU: live-search conversation-history injection marker not found; refusing unsafe rewrite.');
}
source = source.replace(oldGroundedContents, newGroundedContents, 1);

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

// Safety assertions: fail the build if the live-search branch still contains a
// Google Search fallback or if it accidentally sends historical conversation data.
const liveBlock = source.slice(source.indexOf(searchStart), source.indexOf("    } else {", searchStartIndex));
if (/googleSearch|Falling back from Tavily to Google Search grounding/i.test(liveBlock)) {
  throw new Error('MKUU: unsafe Google Search fallback remains inside live-search path.');
}
if (/buildConversationHistory\(\s*conversationHistory/i.test(liveBlock)) {
  throw new Error('MKUU: historical conversation is still exposed to live-search synthesis.');
}

fs.writeFileSync(file, source);
console.log('MKUU: Tavily is authoritative for worldwide live web/news/social search; Gemini is synthesis-only and receives Tavily evidence without historical chat context.');
