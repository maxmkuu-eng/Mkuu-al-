    const startTime = Date.now();
    const { userId, message, conversationHistory = [], isVoice = false, attachments = [] } = params;
    console.log(`[MKUU-BACKEND] [CHAT_REQUEST_RECEIVED] user=${userId} msgLen=${message?.length || 0} attachCount=${attachments?.length || 0}`);

    const user = db.getUser(userId) || db.getOwner();
    const memories = db.getMemories(userId);
    const people = db.getPeople(userId);
    const newlySavedMemory = this.detectAndSaveMemory(userId, message);
    const newlySavedPerson = this.detectAndSavePerson(userId, message);
    const systemPrompt = this.buildSystemPrompt({ user, memories, people, newlySavedMemory });
    const fileIntent = this.detectFileGenerationIntent(message);
    const generatedFilesList: GeneratedFileSummary[] = [];
    const contents = this.buildConversationHistory(conversationHistory, message, attachments);
    const isSearchQuery = this.detectSearchIntent(message);
    const generationConfig: any = { systemInstruction: systemPrompt, temperature: 0.7 };
    const usedModel = isSearchQuery ? LIVE_SEARCH_MODEL : PERSONAL_CHAT_MODEL;

    let aiReplyText = '';

    // MKUU TAVILY AUTHORITY: Tavily is the sole source of live factual web evidence.
    // Gemini may only synthesize the evidence returned by Tavily. It must not run a
    // second search, fall back to Google, or use old assistant answers as evidence.
    if (isSearchQuery) {
      try {
        console.log('[MKUU-BACKEND] [TAVILY_SEARCH_STARTED] Using Tavily as the sole live web engine.');
        const tavilyResults = await searchWithTavily(`${message}\nCurrent date/time in Tanzania: ${getCurrentTanzaniaTimeContext().formattedString}`);
        const liveConversationHistory = conversationHistory.filter((item) => item?.role === 'user');
        const groundedSystemPrompt = `${systemPrompt}\n\nLIVE WEB EVIDENCE FROM TAVILY (AUTHORITATIVE FOR THIS TURN):\n${tavilyResults}\n\nSTRICT TAVILY AUTHORITY RULES:\n- Tavily is the ONLY web-search engine for this response.\n- Use the supplied Tavily evidence as the primary and authoritative evidence for current factual claims.\n- DO NOT call Google Search or any other search tool.\n- DO NOT use Gemini's pretrained knowledge to override, deny, replace, or contradict Tavily evidence.\n- DO NOT let older assistant messages override the Tavily evidence.\n- If Tavily evidence explicitly reports an event, person, result, date, time, announcement, or status, report that information rather than denying it from model memory.\n- Prefer the newest dated evidence and distinguish publication date from event date.\n- For sports, use the exact date, kickoff time and competition supported by the newest Tavily evidence; never invent or convert a time unless the source supports the conversion.\n- For celebrities and social-media claims, do not dismiss information merely because it originated on social media. Check the supplied evidence and report corroboration/conflict accurately.\n- If the supplied Tavily evidence conflicts, state the conflict and identify which source is newer/more authoritative.\n- If the supplied evidence does not establish the requested fact, say it could not be verified; do not fill the gap from memory.\n- Never invent a name, score, date, time, event, relationship, birth, appointment, or other detail.\n- Keep the answer concise and directly answer the user's question.\n`;
        const groundedContents = this.buildConversationHistory(
          liveConversationHistory,
          `${message}\n\n[MKUU TAVILY EVIDENCE — THIS IS THE ONLY WEB EVIDENCE TO USE]\n${tavilyResults}`,
          attachments,
        );
        aiReplyText = await this.executeGeminiCallWithFallback({
          contents: groundedContents,
          config: { systemInstruction: groundedSystemPrompt, temperature: 0.0 },
          preferredModel: PERSONAL_CHAT_MODEL,
        });
        if (!aiReplyText?.trim()) throw new Error('Gemini returned an empty response after Tavily search.');
        console.log('[MKUU-BACKEND] [TAVILY_SEARCH_SUCCESS] Gemini synthesis completed from Tavily evidence only.');
      } catch (tavilyErr: any) {
        const tavilyMsg = String(tavilyErr?.message || tavilyErr);
        console.warn(`[MKUU-BACKEND] [TAVILY_SEARCH_FAILED] ${tavilyMsg}`);

        // FAIL CLOSED: never let Gemini independently answer a live-web question.
        // A failed Tavily search must never be replaced with stale model knowledge
        // or a second search engine, because that is exactly what caused old/wrong
        // answers to override fresh web evidence.
        if (/AUTHORITATIVE_GOVERNMENT_SOURCE_UNAVAILABLE/i.test(tavilyMsg)) throw new Error(tavilyMsg);
        throw new Error(`LIVE_SEARCH_UNAVAILABLE: Tavily is unavailable; MKUU will not answer this current-information question from Gemini memory. ${tavilyMsg}`);
      }

      console.log(`[MKUU-BACKEND] [LIVE_SEARCH_RESPONSE_RECEIVED] model="${PERSONAL_CHAT_MODEL}" latency=${Date.now() - startTime}ms status=200`);
    } else {
      try {
        aiReplyText = await this.executeGeminiCallWithFallback({ contents, config: generationConfig, preferredModel: PERSONAL_CHAT_MODEL });

        if (this.isInsufficientKnowledgeResponse(aiReplyText)) {
          console.log('[MKUU-BACKEND] Insufficient knowledge detected. Retrying with Google Search grounding...');
          try {
            const searchReplyText = await this.executeGeminiCallWithFallback({
              contents,
              config: { ...generationConfig, tools: [{ googleSearch: {} }] },
              preferredModel: LIVE_SEARCH_MODEL,
            });
            if (searchReplyText?.trim()) aiReplyText = searchReplyText;
          } catch (searchRetryErr) {
            console.warn('[MKUU-BACKEND] Google Search retry warning:', searchRetryErr);
          }
        }
        console.log(`[MKUU-BACKEND] [GEMINI_RESPONSE_RECEIVED] model="${PERSONAL_CHAT_MODEL}" latency=${Date.now() - startTime}ms status=200`);
      } catch (err: any) {
        const errMsg = String(err?.message || err);
        console.error(`[MKUU-BACKEND] [GEMINI_REQUEST_FAILED] error="${errMsg}" latency=${Date.now() - startTime}ms`);
        const isRateLimit = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('Rate limit') || errMsg.includes('exceeded your current quota');
        if (isRateLimit) {
          aiReplyText = 'Mkuu wangu **Max**, seva za Gemini zimepata msongamano wa muda mfupi wa maombi (Rate Limit Quota). Tafadhali jaribu tena.';
        } else {
          throw new Error(`Google Gemini API (${PERSONAL_CHAT_MODEL}) Error: ${err?.message || 'Huduma haikupatikana kwa sasa'}`);
        }
      }
    }

    if (fileIntent) {
      try {
        const genFile = await generateRealFile({ userId, filename: fileIntent.filename, fileType: fileIntent.fileType, title: fileIntent.title, content: aiReplyText, description: fileIntent.description });
        generatedFilesList.push(genFile);
      } catch (err) {
        console.warn('[MKUU-BACKEND] File generation note:', err);
      }
    }

    const cleanSpeechText = this.cleanMarkdownForVoice(aiReplyText);
    return {
      reply: aiReplyText,
      cleanSpeechText,
      memoriesExtracted: newlySavedMemory ? [{ category: newlySavedMemory.category, content: newlySavedMemory.content }] : [],
      peopleRecognized: newlySavedPerson ? [{ name: newlySavedPerson.name, relationship: newlySavedPerson.relationship }] : [],
      generatedFiles: generatedFilesList,
      aiProvider: AI_PROVIDER,
      chatModel: usedModel,
      latencyMs: Date.now() - startTime,
    };
  }
