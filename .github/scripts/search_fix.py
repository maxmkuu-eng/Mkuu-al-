from pathlib import Path
p=Path('server/geminiService.ts')
s=p.read_text()

s=s.replace("preferredModel: PERSONAL_CHAT_MODEL,\n      });\n\n      // If search was not triggered upfront", "preferredModel: PERSONAL_CHAT_MODEL,\n        requireSearch: isSearchQuery,\n      });\n\n      // If search was not triggered upfront", 1)
s=s.replace("preferredModel: PERSONAL_CHAT_MODEL,\n          });\n          if (searchReplyText", "preferredModel: PERSONAL_CHAT_MODEL,\n            requireSearch: true,\n          });\n          if (searchReplyText", 1)
s=s.replace("preferredModel?: string;\n  }): Promise<string> {", "preferredModel?: string;\n    requireSearch?: boolean;\n  }): Promise<string> {", 1)
s=s.replace("if (params.config?.tools) {", "if (params.config?.tools && !params.requireSearch) {", 1)
needle="""    if (searchKeywords.some((kw) => lower.includes(kw))) {\n      return true;\n    }"""
extra="""    if (searchKeywords.some((kw) => lower.includes(kw))) {\n      return true;\n    }\n    if (/\\b(sasa|kwa sasa|wa sasa|leo|latest|current|today|recent|currently|hivi punde|right now|up to date)\\b/i.test(lower)) return true;\n    if ((/\\?|nani ni|ni nani|who is|what is|what's/i.test(lower)) && /\\b(rais|waziri|waziri mkuu|kiongozi|serikali|habari|news|siasa|uchaguzi|mchezo|mechi|ratiba|matokeo|bei|price|weather|tukio)\\b/i.test(lower)) return true;"""
if needle in s:
    s=s.replace(needle,extra,1)
s=s.replace("systemInstruction: systemPrompt,", "systemInstruction: systemPrompt + (isSearchQuery ? '\\n\\nFor live web answers, use current search evidence and include full source URLs (https://...) when available so the user can open them. Never claim a Google search happened unless grounding was actually used.' : ''),", 1)
p.write_text(s)
