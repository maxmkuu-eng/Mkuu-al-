import { GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';

// MKUU IMAGE STUDIO
// Provider: Cloudflare Workers AI. No browser SDK, Puter popup, or user login.
export const PRIMARY_IMAGE_MODEL = '@cf/runwayml/stable-diffusion-v1-5-img2img';
export const EDIT_IMAGE_MODEL = PRIMARY_IMAGE_MODEL;

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

function getAccountId(): string {
  return (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
}

function getApiToken(): string {
  return (process.env.CLOUDFLARE_API_TOKEN || '').trim();
}

function stripDataUrl(value: string): string {
  return value.includes(',') ? value.split(',')[1] : value;
}

function makePrompt(prompt: string, hasImage: boolean, isBgRemoval: boolean, isObjectRemoval: boolean, isClothingChange: boolean, isHd: boolean): string {
  const base = String(prompt || '').trim() || 'Create a high-quality professional image.';
  if (!hasImage) return [
    'GENERATE THE IMAGE ITSELF.',
    base,
    'Create a polished production-ready image suitable for the user request.',
  ].join('\n');
  if (isBgRemoval) return [
    'EDIT THE PROVIDED IMAGE.',
    'Remove the background as completely as possible and replace it with a clean plain background suitable for the request.',
    'Preserve the subject identity, face, hair, clothing, body proportions and important details.',
    'Do not return the original image unchanged.',
    base,
  ].join('\n');
  if (isObjectRemoval) return ['EDIT THE PROVIDED IMAGE.', base, 'Remove the requested object or person completely and reconstruct the surrounding area naturally.', 'Preserve the rest of the scene.', 'Do not return the original image unchanged.'].join('\n');
  if (isClothingChange) return ['EDIT THE PROVIDED IMAGE.', base, 'Change only the requested clothing while preserving identity, face, hair, body proportions and scene.', 'Do not return the original image unchanged.'].join('\n');
  if (isHd) return ['EDIT THE PROVIDED IMAGE.', base, 'Improve clarity and detail while preserving the identity and composition.', 'Do not return the original image unchanged.'].join('\n');
  return ['EDIT THE PROVIDED IMAGE according to the instruction below.', base, 'Return the edited image itself.', 'Do not return the original image unchanged.'].join('\n');
}

async function cloudflareImageRequest(params: { prompt: string; imageBase64?: string; }): Promise<string> {
  const accountId = getAccountId();
  const token = getApiToken();
  if (!accountId) throw new Error('CLOUDFLARE_ACCOUNT_ID is not configured.');
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not configured.');

  const body: any = {
    prompt: params.prompt,
    width: 1024,
    height: 1024,
    num_steps: 20,
    guidance: 7.5,
  };
  if (params.imageBase64) body.image_b64 = stripDataUrl(params.imageBase64);

  const endpoint = `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/${encodeURIComponent(PRIMARY_IMAGE_MODEL)}`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const contentType = response.headers.get('content-type') || '';
  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`CLOUDFLARE_IMAGE_API_ERROR: HTTP ${response.status}${errorText ? ` - ${errorText.slice(0, 500)}` : ''}`);
  }

  // Cloudflare's REST Execute AI endpoint returns the generated PNG as the
  // result string for TextToImage models. Some deployments may wrap it in JSON.
  if (contentType.includes('application/json')) {
    const data: any = await response.json().catch(() => ({}));
    const result = data?.result;
    const b64 = typeof result === 'string' ? result : result?.image || result?.image_b64 || result?.data;
    if (typeof b64 === 'string' && b64.trim()) return stripDataUrl(b64.trim());
    throw new Error('CLOUDFLARE_IMAGE_API_EMPTY: response contained no image data.');
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error('CLOUDFLARE_IMAGE_API_EMPTY: response contained no image bytes.');
  return bytes.toString('base64');
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
    const promptText = makePrompt(prompt, hasImage, isBgRemoval, isObjectRemoval, isClothingChange, isHd);

    console.log(`[MKUU-BACKEND] [CLOUDFLARE_IMAGE] model="${PRIMARY_IMAGE_MODEL}" hasInputImage=${hasImage}`);
    const imageBase64 = await cloudflareImageRequest({ prompt: promptText, imageBase64: rawBase64 || undefined });

    const filename = isBgRemoval
      ? `Picha_Bila_Background_${Date.now().toString().slice(-6)}.png`
      : hasImage
        ? `Picha_Iliyohaririwa_Max_${Date.now().toString().slice(-6)}.png`
        : lower.includes('logo')
          ? `Logo_ya_Max_${Date.now().toString().slice(-6)}.png`
          : `Picha_ya_Max_${Date.now().toString().slice(-6)}.png`;
    const title = isBgRemoval ? 'Picha Iliyoondolewa Background' : hasImage ? 'Picha Iliyohaririwa' : lower.includes('logo') ? 'Logo Iliyotengenezwa' : 'Picha Iliyotengenezwa';
    const saved = await generateRealFile({
      userId,
      filename,
      fileType: 'png',
      title,
      content: imageBase64,
      base64Data: imageBase64,
      description: `Picha halisi iliyotengenezwa/kuhaririwa na MKUU Image Studio (Cloudflare Workers AI ${PRIMARY_IMAGE_MODEL}).`,
    });

    const explanation = isBgRemoval
      ? 'Nimehariri picha yako kwa Image Studio na kuondoa background kwa kadiri model inavyoweza.'
      : hasImage
        ? 'Nimehariri picha yako kupitia MKUU Image Studio na nimekuandalia picha halisi.'
        : 'Nimetengeneza picha halisi kupitia MKUU Image Studio.';
    return { file: saved, explanation, modelUsed: PRIMARY_IMAGE_MODEL };
  }
}

export const imageService = ImageService.getInstance();
