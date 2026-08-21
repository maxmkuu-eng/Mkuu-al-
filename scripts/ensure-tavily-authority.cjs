const fs = require('node:fs');

function patchFile(file, replacements) {
  let source = fs.readFileSync(file, 'utf8');
  let changed = false;
  for (const [from, to] of replacements) {
    if (source.includes(to)) continue;
    if (!source.includes(from)) throw new Error(`MKUU_TAVILY_AUTHORITY: expected anchor missing in ${file}`);
    source = source.replace(from, to);
    changed = true;
  }
  if (changed) fs.writeFileSync(file, source, 'utf8');
  console.log(`MKUU_TAVILY_AUTHORITY: ${file} ${changed ? 'patched' : 'already authoritative'}.`);
}

patchFile('server/geminiService.ts', [
  [`          config: { systemInstruction: groundedSystemPrompt, temperature: 0.2 },\n          preferredModel: PERSONAL_CHAT_MODEL,\n`, `          config: { systemInstruction: groundedSystemPrompt, temperature: 0.2 },\n          // Tavily is authoritative for live questions; Gemini only synthesizes its evidence.\n          preferredModel: usedModel,\n`],
  [`      } catch (tavilyErr: any) {\n        const tavilyMsg = String(tavilyErr?.message || tavilyErr);\n`, `      } catch (tavilyErr: any) {\n        const tavilyMsg = String(tavilyErr?.message || tavilyErr);\n        // FAIL CLOSED: never interrupt Tavily with Google Search or Gemini memory.\n        throw new Error(\`LIVE_SEARCH_UNAVAILABLE: Tavily authoritative search failed. \${tavilyMsg}\`);\n`],
  [`    const modelsToTry = params.config?.tools ? [preferred] : [preferred, ...CHAT_MODEL_FALLBACKS.filter((m) => m !== preferred)];\n`, `    // Grounded responses use exactly the requested model; no fallback can replace fresh evidence with stale memory.\n    const modelsToTry = params.config?.tools || params.config?.systemInstruction?.includes('LIVE WEB SEARCH RESULTS (Tavily):')\n      ? [preferred]\n      : [preferred, ...CHAT_MODEL_FALLBACKS.filter((m) => m !== preferred)];\n`]
]);

patchFile('server/tavilySearch.ts', [
  [` const searches:Promise<TavilySearchResult[]>[]=[];\n // WORLDWIDE WEB: current/factual questions receive broad web + news evidence.\n searches.push(runTavilySearch(\`\${query} latest current update 2026\`,'general'));\n searches.push(runTavilySearch(\`\${query} latest current news today 2026\`,'news'));\n`, ` const searches:Promise<TavilySearchResult[]>[]=[];\n // WORLDWIDE WEB + PUBLIC SOCIAL: Tavily is the sole evidence engine for live factual questions.\n searches.push(runTavilySearch(query,'general'));\n searches.push(runTavilySearch(\`\${query} latest current update 2026\`,'general'));\n searches.push(runTavilySearch(\`\${query} latest current news today 2026\`,'news'));\n searches.push(runTavilySearch(\`\${query} latest official announcement statement 2026\`,'general'));\n searches.push(runTavilySearch(\`\${query} latest public social media Instagram TikTok YouTube Facebook X Twitter 2026\`,'general',SOCIAL_DOMAINS));\n`]
]);

console.log('MKUU_TAVILY_AUTHORITY: Tavily worldwide web/news/public-social evidence is authoritative; Gemini cannot interrupt it with fallback search or stale model memory.');
