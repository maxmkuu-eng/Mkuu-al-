const fs = require('node:fs');

const file = 'server/geminiService.ts';
let source = fs.readFileSync(file, 'utf8');

// MKUU_TAVILY_ONLY_LIVE_SEARCH_V1
// Live/current-information requests are owned by Tavily. Gemini remains available
// for ordinary chat, but must not search, synthesize, or fallback to Google Search.
if (!source.includes('MKUU_TAVILY_ONLY_LIVE_SEARCH_V1')) {
  const startMarker = '    // IMPORTANT: Current-information questions must be grounded in fresh web data.';
  const endMarker = '    }\n\n    if (fileIntent) {';
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  if (start < 0 || end < 0) {
    throw new Error('MKUU: live-search block boundaries not found; no source was changed.');
  }

  const tavilyOnlyBlock = `    // MKUU_TAVILY_ONLY_LIVE_SEARCH_V1\n    // Tavily is the sole engine for live/current-information requests.\n    // Gemini is intentionally NOT called on this path.\n    if (isSearchQuery) {\n      console.log('[MKUU-BACKEND] [TAVILY_ONLY_SEARCH_STARTED] Live search is Tavily-only.');\n      aiReplyText = await searchWithTavily(\n        \`${'${message}'}\\nCurrent date/time in Tanzania: \${getCurrentTanzaniaTimeContext().formattedString}\`,\n      );\n      if (!aiReplyText?.trim()) throw new Error('LIVE_SEARCH_UNAVAILABLE: Tavily returned no usable evidence.');\n      console.log('[MKUU-BACKEND] [TAVILY_ONLY_SEARCH_SUCCESS] Gemini was not invoked for live search.');\n    } else {\n      try {\n        aiReplyText = await this.executeGeminiCallWithFallback({ contents, config: generationConfig, preferredModel: PERSONAL_CHAT_MODEL });\n\n        if (this.isInsufficientKnowledgeResponse(aiReplyText)) {\n          console.log('[MKUU-BACKEND] Insufficient knowledge detected; live web search is handled only by Tavily when explicitly requested.');\n        }\n        console.log(\`[MKUU-BACKEND] [GEMINI_RESPONSE_RECEIVED] model="\${PERSONAL_CHAT_MODEL}" latency=\${Date.now() - startTime}ms status=200\`);\n      } catch (err) {\n        const errMsg = String(err?.message || err);\n        console.error(\`[MKUU-BACKEND] [GEMINI_REQUEST_FAILED] error="\${errMsg}" latency=\${Date.now() - startTime}ms\`);\n        throw err;\n      }\n    }\n\n`;

  source = source.slice(0, start) + tavilyOnlyBlock + source.slice(end + 5);
  fs.writeFileSync(file, source, 'utf8');
  console.log('MKUU: Tavily is now the sole live web/social search engine; Gemini is excluded from live-search requests.');
} else {
  console.log('MKUU: Tavily-only live-search guard already applied.');
}
