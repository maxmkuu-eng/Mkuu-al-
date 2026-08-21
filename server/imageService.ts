import { GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';

// MKUU IMAGE STUDIO
// Primary provider: Pollinations. Fallback: Gemini 3.1 Flash Image using the
// existing GEMINI_API_KEY, so Image Studio does not become unusable just because
// the separate Pollinations key is missing from Render.
export const PRIMARY_IMAGE_MODEL = 'flux';
export const EDIT_IMAGE_MODEL = 'p-image-edit';
export const GEMINI_IMAGE_FALLBACK_MODEL = 'gemini-3.1-flash-image';

export interface ProcessImageParams {
  userId: string;
  prompt: string;
  attachments?: Array<{
    filename: string;
    fileType: string;
    mimeType: string;
    size?: number;
    base64Data?: string;
  }>;
}

export interface ImageProcessResult {
  file: GeneratedFileSummary;
  explanation: string;
  modelUsed: string;
}

function getPollinationsKey(): string {
  return (process.env.POLLINATIONS_API_KEY || '').trim();
}

function getGeminiKey(): string {
  return (process.env.GEMINI_API_KEY || '').trim();
}

function stripDataUrl(value: string): string {
  return value.includes(',') ? value.split(',')[1] : value;
}

function makePrompt(prompt: string, hasImage: boolean, isBgRemoval: boolean, isObjectRemoval: boolean, isClothingChange: boolean, isHd: boolean): string {
  const base = String(prompt || '').trim() || 'Create a high-quality professional image.';
  if (!hasImage) return [
    'GENERATE THE IMAGE ITSELF. Do not return a prompt, description, SVG, JSON, or text-only answer.',
    base,
    'Create a polished production-ready image suitable for the user request.',
  ].join('\n');
  if (isBgRemoval) return [
    'EDIT THE PROVIDED IMAGE.',
    'Remove the entire background and make it transparent.',
    'Return the edited image itself as a PNG with transparency.',
    'Preserve the subject identity, face, hair, clothing, body proportions and important details.',
    'Do not return the original image unchanged. Do not add a replacement background.',
    base,
  ].join('\n');
  if (isObjectRemoval) return ['EDIT THE PROVIDED IMAGE.', base, 'Remove the requested object/person completely and reconstruct the surrounding area naturally.', 'Do not return the original image unchanged.'].join('\n');
  if (isClothingChange) return ['EDIT THE PROVIDED IMAGE.', base, 'Change only the requested clothing. Preserve identity, face, hair, body proportions and scene.', 'Do not return the original image unchanged.'].join('\n');
  if (isHd) return ['EDIT THE PROVIDED IMAGE.', base, 'Improve clarity and detail while preserving the exact identity and composition.', 'Do not return the original image unchanged.'].join('\n');
  return ['EDIT THE PROVIDED IMAGE according to the instruction below.', base, 'Return the edited image itself, not a prompt or explanation.', 'Do not return the original image unchanged.'].join('\n');
}

async function pollinationsImageRequest(params: { prompt: string; imageBase64?: string; mimeType?: string; transparent?: boolean; model: string; }): Promise<string> {
  const key = getPollinationsKey();
  if (!key) throw new Error('POLLINATIONS_API_KEY is not configured.');

  const endpoint = params.imageBase64
    ? 'https://gen.pollinations.ai/v1/images/edits'
    : 'https://gen.pollinations.ai/v1/images/generations';
  let response: Response;

  if (params.imageBase64) {
    const form = new FormData();
    const mimeType = params.mimeType || 'image/png';
    const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
    const bytes = Buffer.from(stripDataUrl(params.imageBase64), 'base64');
    form.append('model', params.model);
    form.append('prompt', params.prompt);
    form.append('size', '1024x1024');
    form.append('output_format', 'png');
    if (params.transparent) form.append('background', 'transparent');
    form.append('image', new Blob([bytes], { type: mimeType }), `mkuu-input.${extension}`);
    response = await fetch(endpoint, { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: form });
  } else {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: params.model, prompt: params.prompt, size: '1024x1024', output_format: 'png', ...(params.transparent ? { background: 'transparent' } : {}) }),
    });
  }

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Pollinations Image API returned HTTP ${response.status}`;
    if (response.status === 402 || response.status === 429) throw new Error(`POLLINATIONS_QUOTA_OR_POLLEN: ${message}`);
    throw new Error(`POLLINATIONS_IMAGE_API_ERROR: ${message}`);
  }
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('Pollinations Image API returned no image data.');
  return b64;
}

async function geminiImageRequest(params: { prompt: string; imageBase64?: string; mimeType?: string; }): Promise<string> {
  const key = getGeminiKey();
  if (!key) throw new Error('GEMINI_API_KEY is not configured.');

  const parts: any[] = [{ text: params.prompt }];
  if (params.imageBase64) {
    parts.push({ inlineData: { mimeType: params.mimeType || 'image/jpeg', data: stripDataUrl(params.imageBase64) } });
  }

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_IMAGE_FALLBACK_MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ role: 'user', parts }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `Gemini Image API returned HTTP ${response.status}`;
    throw new Error(`GEMINI_IMAGE_API_ERROR: ${message}`);
  }

  const responseParts = data?.candidates?.[0]?.content?.parts || [];
  const imagePart = responseParts.find((part: any) => part?.inlineData?.data || part?.inline_data?.data);
  const b64 = imagePart?.inlineData?.data || imagePart?.inline_data?.data;
  if (!b64) throw new Error('Gemini Image API returned no image data.');
  return b64;
}

export class ImageService {
  private static instance: ImageService | null = null;
  public static getInstance(): ImageService { if (!ImageService.instance) ImageService.instance = new ImageService(); return ImageService.instance; }

  public async processImage(params: ProcessImageParams): Promise<ImageProcessResult> {
    const { userId, prompt, attachments = [] } = params;
    const lower = String(prompt || '').toLowerCase().trim();
    const imageAttachment = attachments.find((a) => String(a.mimeType || '').startsWith('image/'));
    const rawBase64 = imageAttachment?.base64Data ? stripDataUrl(imageAttachment.base64Data) : '';
    const hasImage = !!rawBase64;
    const isBgRemoval = ['remove background', 'ondoa background', 'toa background', 'futa background', 'background iwe transparent', 'transparent background'].some((term) => lower.includes(term));
    const isObjectRemoval = ['ondoa mtu', 'remove person', 'ondoa kitu', 'remove object', 'ondoa object'].some((term) => lower.includes(term));
    const isHd = ['hd', '2k', '4k', 'enhance', 'boresha', 'quality', 'clear', 'restore'].some((term) => lower.includes(term));
    const isClothingChange = ['nguo', 'shirt', 'suti', 'shati', 'mavazi'].some((term) => lower.includes(term));
    const model = hasImage ? EDIT_IMAGE_MODEL : PRIMARY_IMAGE_MODEL;
    const promptText = makePrompt(prompt, hasImage, isBgRemoval, isObjectRemoval, isClothingChange, isHd);

    let imageBase64 = '';
    let modelUsed = model;
    let primaryError = '';

    if (getPollinationsKey()) {
      try {
        console.log(`[MKUU-BACKEND] [POLLINATIONS_IMAGE] model="${model}" hasInputImage=${hasImage}`);
        imageBase64 = await pollinationsImageRequest({
          prompt: promptText,
          imageBase64: rawBase64 || undefined,
          mimeType: imageAttachment?.mimeType || 'image/png',
          transparent: isBgRemoval,
          model,
        });
      } catch (err: any) {
        primaryError = String(err?.message || err);
        console.warn(`[MKUU-BACKEND] [POLLINATIONS_IMAGE_FAILED] ${primaryError}`);
      }
    } else {
      primaryError = 'POLLINATIONS_API_KEY is not configured.';
      console.warn('[MKUU-BACKEND] [POLLINATIONS_IMAGE] key missing; using Gemini Image fallback.');
    }

    if (!imageBase64) {
      try {
        console.log(`[MKUU-BACKEND] [GEMINI_IMAGE_FALLBACK] model="${GEMINI_IMAGE_FALLBACK_MODEL}" hasInputImage=${hasImage}`);
        imageBase64 = await geminiImageRequest({
          prompt: promptText,
          imageBase64: rawBase64 || undefined,
          mimeType: imageAttachment?.mimeType || 'image/png',
        });
        modelUsed = GEMINI_IMAGE_FALLBACK_MODEL;
      } catch (err: any) {
        const fallbackError = String(err?.message || err);
        throw new Error(`IMAGE_STUDIO_FAILED: Pollinations=${primaryError}; Gemini=${fallbackError}`);
      }
    }

    const filename = isBgRemoval
      ? `Picha_Bila_Background_${Date.now().toString().slice(-6)}.png`
      : hasImage
        ? `Picha_Iliyohaririwa_Max_${Date.now().toString().slice(-6)}.png`
        : lower.includes('logo')
          ? `Logo_ya_Max_${Date.now().toString().slice(-6)}.png`
          : `Picha_ya_Max_${Date.now().toString().slice(-6)}.png`;
    const title = isBgRemoval ? 'Picha Iliyoondolewa Background' : hasImage ? 'Picha Iliyohaririwa' : lower.includes('logo') ? 'Logo Iliyotengenezwa' : 'Picha Iliyotengenezwa';
    const providerLabel = modelUsed === GEMINI_IMAGE_FALLBACK_MODEL ? 'Gemini Image fallback' : `Pollinations ${modelUsed}`;
    const saved = await generateRealFile({ userId, filename, fileType: 'png', title, content: imageBase64, base64Data: imageBase64, description: `Picha halisi iliyotengenezwa/kuhaririwa na MKUU Image Studio (${providerLabel})` });
    const explanation = isBgRemoval ? 'Nimeondoa background na kurudisha picha halisi ya PNG.' : hasImage ? 'Nimehariri picha yako na kurudisha picha halisi iliyotengenezwa.' : lower.includes('logo') ? 'Nimetengeneza logo halisi na nimeirudisha kama picha.' : 'Nimetengeneza picha halisi kulingana na maelekezo yako.';
    return { file: saved, explanation, modelUsed };
  }
}

export const imageService = ImageService.getInstance();
