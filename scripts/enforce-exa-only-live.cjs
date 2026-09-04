// Intentionally disabled for the live-search-only repair.
// This legacy transformer rewrites server/geminiService.ts during every build and
// can break the existing Gemini runtime. Exa live routing is handled by the
// dedicated live-search pipeline without rewriting Gemini internals.
console.log('[EXA-ONLY] disabled; preserving existing Gemini runtime.');
