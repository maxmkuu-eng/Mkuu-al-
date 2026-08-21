const fs = require('node:fs');

function patch(filePath, label, transform) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`MKUU Puter patch target not found: ${filePath}`);
  }
  const before = fs.readFileSync(filePath, 'utf8');
  const after = transform(before);
  if (after === before) {
    console.log(`MKUU: ${label} already enabled.`);
    return;
  }
  fs.writeFileSync(filePath, after, 'utf8');
  console.log(`MKUU: ${label} enabled.`);
}

patch('index.html', 'Puter.js Image Studio', (source) => {
  if (source.includes('https://js.puter.com/v2/')) return source;
  return source.replace(
    '  </head>',
    '    <script src="https://js.puter.com/v2/"></script>\n  </head>'
  );
});

patch('src/services/aiEngine.ts', 'direct Puter Image Studio', (source) => {
  const start = source.indexOf('async function callImageStudio(');
  const end = source.indexOf('\nasync function callDirectGemini(', start);
  if (start < 0 || end < 0) {
    throw new Error('MKUU Puter patch target not found in src/services/aiEngine.ts: callImageStudio');
  }

  const replacement = String.raw`async function callImageStudio(params: ChatEngineParams): Promise<ChatEngineResult> {
  const puter = (typeof window !== 'undefined' ? (window as any).puter : null);
  if (!puter?.ai?.txt2img) {
    throw new MkuuApiError({
      code: 'PUTER_UNAVAILABLE',
      status: 503,
      userMessage: 'IMAGE STUDIO HAIJAPATIKANA\nTafadhali subiri sekunde chache kisha jaribu tena.',
      technicalDetails: 'Puter.js Image Studio is not loaded.',
    });
  }

  const attachments = params.attachments || [];
  const imageAttachment = attachments.find((a: any) => String(a?.mimeType || '').startsWith('image/'));
  const imageBase64 = String(imageAttachment?.base64Data || '');
  const mimeType = imageAttachment?.mimeType || 'image/jpeg';
  const lower = String(params.message || '').toLowerCase();
  const hasImage = !!imageBase64;
  const isBgRemoval = ['remove background', 'ondoa background', 'toa background', 'futa background', 'background iwe transparent', 'transparent background'].some((term) => lower.includes(term));
  const isGeneration = !hasImage;

  let prompt = String(params.message || '').trim() || 'Create a high-quality professional image.';
  if (hasImage && isBgRemoval) {
    prompt = [
      'EDIT THE PROVIDED IMAGE.',
      'Remove the entire background and make it transparent.',
      'Return the edited image itself.',
      'Preserve the exact person, face, hair, clothing, body proportions and important details.',
      'Do not return a text explanation and do not return the original image unchanged.',
      prompt,
    ].join('\n');
  } else if (hasImage) {
    prompt = [
      'EDIT THE PROVIDED IMAGE according to the user instruction.',
      'Return the edited image itself, not a prompt or text-only answer.',
      'Preserve identity and important details unless the user explicitly asks to change them.',
      prompt,
    ].join('\n');
  } else {
    prompt = [
      'GENERATE THE IMAGE ITSELF.',
      'Do not return a prompt, SVG, JSON, or text-only answer.',
      prompt,
    ].join('\n');
  }

  const options: any = {
    provider: 'gemini',
    model: 'gemini-3.1-flash-image-preview',
    image_config: { image_size: '1K' },
  };

  if (hasImage) {
    const dataUri = imageBase64.startsWith('data:')
      ? imageBase64
      : 'data:' + mimeType + ';base64,' + imageBase64;
    options.input_images = [dataUri];
    options.input_image_mime_type = mimeType;
  }

  try {
    // Image Studio must not force a Puter sign-in/sign-up popup.
    // Call the Puter AI API directly and let the SDK use the current session.
    // If Puter cannot authorize the request, surface that failure instead of
    // opening an authentication window that can end with auth_window_closed.
    const image = await puter.ai.txt2img(prompt, options);
    const dataUrl = image?.src || (typeof image === 'string' ? image : '');
    if (!dataUrl || !dataUrl.startsWith('data:image/')) {
      throw new Error('Puter returned no image data.');
    }

    const b64 = dataUrl.split(',')[1] || '';
    const suffix = Date.now().toString().slice(-6);
    const filename = isBgRemoval
      ? 'Picha_Bila_Background_' + suffix + '.png'
      : hasImage
        ? 'Picha_Iliyohaririwa_Mkuu_' + suffix + '.png'
        : lower.includes('logo')
          ? 'Logo_ya_Mkuu_' + suffix + '.png'
          : 'Picha_ya_Mkuu_' + suffix + '.png';

    const file: GeneratedFileSummary = {
      id: 'puter_image_' + Date.now(),
      filename,
      fileType: 'png',
      size: Math.floor((b64.length * 3) / 4),
      mimeType: 'image/png',
      createdAt: new Date().toISOString(),
      description: 'Picha iliyotengenezwa/kuhaririwa na MKUU Image Studio kupitia Puter.',
      downloadUrl: dataUrl,
    };

    const reply = isBgRemoval
      ? 'Nimeondoa background ya picha na nimekuandalia picha mpya kupitia MKUU Image Studio.'
      : isGeneration
        ? 'Nimetengeneza picha kupitia MKUU Image Studio na iko tayari hapa chini.'
        : 'Nimehariri picha yako kupitia MKUU Image Studio na iko tayari hapa chini.';

    return {
      reply,
      cleanSpeechText: reply,
      generatedFiles: [file],
      engineUsed: 'server',
      aiProvider: 'Puter Image Studio',
      chatModel: 'gemini-3.1-flash-image-preview',
      intent: isGeneration ? 'image_generation' : 'image_edit',
    };
  } catch (error: any) {
    const raw = error?.message ?? error?.error ?? error?.details ?? error;
    let details = '';
    if (typeof raw === 'string') details = raw;
    else {
      try { details = JSON.stringify(raw); } catch { details = String(raw); }
    }
    if (!details || details === '[object Object]') details = 'Unknown Puter Image Studio error';
    throw new MkuuApiError({
      code: 'PUTER_IMAGE_FAILED',
      status: 502,
      userMessage: 'IMAGE STUDIO IMESHINDWA KUTENGENEZA PICHA\nTafadhali jaribu tena.',
      technicalDetails: 'Puter Image Studio: ' + details,
    });
  }
}`;

  return source.slice(0, start) + replacement + source.slice(end);
});
