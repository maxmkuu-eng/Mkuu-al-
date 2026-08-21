declare global {
  interface Window { puter?: any; }
}

const PUTER_SCRIPT = 'https://js.puter.com/v2/';
const IMAGE_MODEL = 'gemini-3.1-flash-image-preview';

function loadPuter(): Promise<any> {
  if (typeof window === 'undefined') throw new Error('Puter Image Studio requires a browser/WebView runtime.');
  if (window.puter) return Promise.resolve(window.puter);
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${PUTER_SCRIPT}"]`) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve(window.puter));
      existing.addEventListener('error', () => reject(new Error('PUTER_SCRIPT_LOAD_FAILED')));
      return;
    }
    const script = document.createElement('script');
    script.src = PUTER_SCRIPT;
    script.async = true;
    script.onload = () => window.puter ? resolve(window.puter) : reject(new Error('PUTER_NOT_AVAILABLE'));
    script.onerror = () => reject(new Error('PUTER_SCRIPT_LOAD_FAILED'));
    document.head.appendChild(script);
  });
}

function toDataUrl(base64: string, mimeType: string): string {
  if (base64.startsWith('data:')) return base64;
  return `data:${mimeType};base64,${base64}`;
}

async function ensurePuterAuth(puter: any): Promise<void> {
  try {
    if (puter.auth?.isSignedIn?.()) return;
    if (puter.auth?.signIn) await puter.auth.signIn({ attempt_temp_user_creation: true });
  } catch (error: any) {
    throw new Error(`PUTER_AUTH_REQUIRED: ${error?.msg || error?.message || 'Puter authentication failed.'}`);
  }
}

function extractImage(result: any): string {
  const image = result?.message?.images?.[0]?.image_url?.url || result?.images?.[0]?.image_url?.url || result?.image?.image_url?.url;
  if (typeof image === 'string' && image.startsWith('data:image/')) return image;
  if (typeof result?.src === 'string' && result.src.startsWith('data:image/')) return result.src;
  throw new Error('PUTER_IMAGE_EMPTY: Puter returned no generated image data.');
}

function buildPrompt(prompt: string, hasImage: boolean): string {
  if (!hasImage) return `Generate the actual image requested by the user. Do not return a prompt, instructions, SVG, JSON, or text-only answer. ${prompt}`;
  const lower = prompt.toLowerCase();
  if (lower.includes('background') || lower.includes('remove background') || lower.includes('ondoa background') || lower.includes('toa background') || lower.includes('futa background')) {
    return `Edit the provided image. Remove the entire background and return the edited image itself with a transparent background. Preserve the subject identity, face, hair, clothing and important details. Do not return the original image unchanged. Do not describe the edit; produce the image. User instruction: ${prompt}`;
  }
  return `Edit the provided image according to the user's instruction. Return the edited image itself, not a prompt or explanation. Do not return the original image unchanged. User instruction: ${prompt}`;
}

export async function runPuterImageStudio(params: {
  prompt: string;
  imageBase64?: string;
  mimeType?: string;
  filename?: string;
}): Promise<any> {
  const puter = await loadPuter();
  await ensurePuterAuth(puter);
  const hasImage = !!params.imageBase64;
  const prompt = buildPrompt(params.prompt, hasImage);
  let result: any;

  if (hasImage) {
    const dataUrl = toDataUrl(params.imageBase64!, params.mimeType || 'image/jpeg');
    result = await puter.ai.txt2img(prompt, {
      model: IMAGE_MODEL,
      input_image: dataUrl,
      input_image_mime_type: params.mimeType || 'image/jpeg',
      quality: '1K',
    });
  } else {
    result = await puter.ai.txt2img(prompt, { model: IMAGE_MODEL, quality: '1K' });
  }

  const dataUrl = extractImage(result);
  const fileType = 'png';
  const filename = params.filename || (hasImage ? 'Picha_Iliyohaririwa_Mkuu.png' : 'Picha_ya_Mkuu.png');
  const size = Math.max(0, Math.floor(((dataUrl.split(',')[1] || '').length * 3) / 4));

  return {
    file: {
      id: `puter_image_${Date.now()}`,
      filename,
      fileType,
      size,
      mimeType: 'image/png',
      createdAt: new Date().toISOString(),
      description: 'Picha halisi iliyotengenezwa/kuhaririwa na MKUU Image Studio kupitia Puter.',
      downloadUrl: dataUrl,
    },
    model: IMAGE_MODEL,
  };
}
