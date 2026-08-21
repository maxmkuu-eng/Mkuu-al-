import { GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';

// ============================================================================
// MKUU IMAGE STUDIO — OPENAI
// ============================================================================
// Image generation/editing is deliberately separate from Gemini chat/search.
// OpenAI GPT Image 2 is the single image model used by MKUU Image Studio.
// No Gemini image-model fallback is used here, so a Gemini image quota cannot
// break photo editing/background removal/logo generation.
// ============================================================================

export const PRIMARY_IMAGE_MODEL = 'gpt-image-2';
export const IMAGE_MODEL_FALLBACKS = ['gpt-image-2'];

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

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY || '';
  if (!key.trim()) {
    throw new Error('OPENAI_API_KEY is not configured on MKUU Backend for Image Studio.');
  }
  return key.trim();
}

function stripDataUrl(value: string): string {
  return value.includes(',') ? value.split(',')[1] : value;
}

function makePrompt(prompt: string, hasImage: boolean, isBgRemoval: boolean, isObjectRemoval: boolean, isClothingChange: boolean, isHd: boolean): string {
  const base = String(prompt || '').trim() || 'Create a high-quality professional image.';
  if (!hasImage) {
    return [
      'GENERATE THE IMAGE ITSELF. Do not return a prompt, description, SVG, JSON, or text-only answer.',
      base,
      'Create a polished, production-ready image suitable for the user request.',
    ].join('\n');
  }
  if (isBgRemoval) {
    return [
      'EDIT THE PROVIDED IMAGE.',
      'Remove the entire background and make it transparent.',
      'Return the edited image itself as a PNG with transparency.',
      'Preserve the subject identity, face, hair, clothing, body proportions and important details.',
      'Do not return the original image unchanged. Do not add a replacement background.',
      base,
    ].join('\n');
  }
  if (isObjectRemoval) {
    return [
      'EDIT THE PROVIDED IMAGE.',
      base,
      'Remove the requested object/person completely and reconstruct the surrounding area naturally.',
      'Do not return the original image unchanged. Preserve unrelated content.',
    ].join('\n');
  }
  if (isClothingChange) {
    return [
      'EDIT THE PROVIDED IMAGE.',
      base,
      'Change only the requested clothing. Preserve identity, face, hair, body proportions and scene.',
      'Do not return the original image unchanged.',
    ].join('\n');
  }
  if (isHd) {
    return [
      'EDIT THE PROVIDED IMAGE.',
      base,
      'Improve clarity and detail while preserving the exact identity and composition.',
      'Do not return the original image unchanged.',
    ].join('\n');
  }
  return [
    'EDIT THE PROVIDED IMAGE according to the instruction below.',
    base,
    'Return the edited image itself, not a prompt or explanation.',
    'Do not return the original image unchanged.',
  ].join('\n');
}

async function openAIImageRequest(params: {
  prompt: string;
  imageBase64?: string;
  mimeType?: string;
  isTransparent?: boolean;
  size?: string;
}): Promise<string> {
  const apiKey = getOpenAIKey();
  const endpoint = params.imageBase64
    ? 'https://api.openai.com/v1/images/edits'
    : 'https://api.openai.com/v1/images/generations';

  let response: Response;
  if (params.imageBase64) {
    const form = new FormData();
    const mimeType = params.mimeType || 'image/png';
    const extension = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
    const bytes = Buffer.from(stripDataUrl(params.imageBase64), 'base64');
    form.append('model', PRIMARY_IMAGE_MODEL);
    form.append('prompt', params.prompt);
    form.append('size', params.size || '1024x1024');
    form.append('quality', 'auto');
    form.append('output_format', 'png');
    if (params.isTransparent) form.append('background', 'transparent');
    form.append('image', new Blob([bytes], { type: mimeType }), `mkuu-input.${extension}`);
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });
  } else {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: PRIMARY_IMAGE_MODEL,
        prompt: params.prompt,
        size: params.size || '1024x1024',
        quality: 'auto',
        output_format: 'png',
        ...(params.isTransparent ? { background: 'transparent' } : {}),
      }),
    });
  }

  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data?.error?.message || `OpenAI Image API returned HTTP ${response.status}`;
    const code = data?.error?.code || '';
    if (response.status === 429) {
      throw new Error(`OPENAI_IMAGE_QUOTA_EXCEEDED: ${message}`);
    }
    throw new Error(`OPENAI_IMAGE_API_ERROR${code ? ` (${code})` : ''}: ${message}`);
  }

  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI Image API returned no image data.');
  return b64;
}

export class ImageService {
  private static instance: ImageService | null = null;

  public static getInstance(): ImageService {
    if (!ImageService.instance) ImageService.instance = new ImageService();
    return ImageService.instance;
  }

  public async processImage(params: ProcessImageParams): Promise<ImageProcessResult> {
    const { userId, prompt, attachments = [] } = params;
    const lower = String(prompt || '').toLowerCase().trim();
    const imageAttachment = attachments.find((a) => String(a.mimeType || '').startsWith('image/'));
    const rawBase64 = imageAttachment?.base64Data ? stripDataUrl(imageAttachment.base64Data) : '';
    const hasImage = !!rawBase64;

    const isBgRemoval = [
      'remove background', 'ondoa background', 'toa background', 'futa background',
      'background iwe transparent', 'transparent background',
    ].some((term) => lower.includes(term));
    const isObjectRemoval = ['ondoa mtu', 'remove person', 'ondoa kitu', 'remove object', 'ondoa object']
      .some((term) => lower.includes(term));
    const isHd = ['hd', '2k', '4k', 'enhance', 'boresha', 'quality', 'clear', 'restore']
      .some((term) => lower.includes(term));
    const isClothingChange = ['nguo', 'shirt', 'suti', 'shati', 'mavazi']
      .some((term) => lower.includes(term));

    console.log(`[MKUU-BACKEND] [OPENAI_IMAGE] model="${PRIMARY_IMAGE_MODEL}" hasInputImage=${hasImage}`);

    const imageBase64 = await openAIImageRequest({
      prompt: makePrompt(prompt, hasImage, isBgRemoval, isObjectRemoval, isClothingChange, isHd),
      imageBase64: rawBase64 || undefined,
      mimeType: imageAttachment?.mimeType || 'image/png',
      isTransparent: isBgRemoval,
      size: isHd ? '1536x1024' : '1024x1024',
    });

    const fileType = 'png';
    const filename = isBgRemoval
      ? `Picha_Bila_Background_${Date.now().toString().slice(-6)}.png`
      : hasImage
        ? `Picha_Iliyohaririwa_Max_${Date.now().toString().slice(-6)}.png`
        : lower.includes('logo')
          ? `Logo_ya_Max_${Date.now().toString().slice(-6)}.png`
          : `Picha_ya_Max_${Date.now().toString().slice(-6)}.png`;

    const title = isBgRemoval
      ? 'Picha Iliyoondolewa Background'
      : hasImage
        ? 'Picha Iliyohaririwa'
        : lower.includes('logo')
          ? 'Logo Iliyotengenezwa'
          : 'Picha Iliyotengenezwa';

    const saved = await generateRealFile({
      userId,
      filename,
      fileType,
      title,
      content: imageBase64,
      base64Data: imageBase64,
      description: `Picha halisi iliyotengenezwa/kuhaririwa na MKUU Image Studio (${PRIMARY_IMAGE_MODEL})`,
    });

    const explanation = isBgRemoval
      ? 'Nimeondoa background na kurudisha picha halisi ya PNG yenye transparency.'
      : hasImage
        ? 'Nimehariri picha yako na kurudisha picha halisi iliyotengenezwa.'
        : lower.includes('logo')
          ? 'Nimetengeneza logo halisi na nimeirudisha kama picha.'
          : 'Nimetengeneza picha halisi kulingana na maelekezo yako.';

    return { file: saved, explanation, modelUsed: PRIMARY_IMAGE_MODEL };
  }
}

export const imageService = ImageService.getInstance();
