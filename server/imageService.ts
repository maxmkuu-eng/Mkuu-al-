import { GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';

// MKUU IMAGE STUDIO
// Provider: PixelAPI. No browser SDK, Puter popup, or user login.
export const PRIMARY_IMAGE_MODEL = 'PixelAPI Image Studio';
export const EDIT_IMAGE_MODEL = 'PixelAPI /v1/image/edit';

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

const BASE_URL = 'https://api.pixelapi.dev';

function getApiKey(): string {
  return (process.env.PIXELAPI_API_KEY || '').trim();
}

function stripDataUrl(value: string): string {
  const comma = value.indexOf(',');
  return comma >= 0 ? value.slice(comma + 1) : value;
}

function toDataUri(base64: string, mimeType = 'image/png'): string {
  if (base64.startsWith('data:')) return base64;
  return `data:${mimeType};base64,${base64}`;
}

function makePrompt(prompt: string, hasImage: boolean, isBgRemoval: boolean, isObjectRemoval: boolean, isClothingChange: boolean, isHd: boolean): string {
  const base = String(prompt || '').trim() || 'Create a high-quality professional image.';
  if (!hasImage) return base;
  if (isBgRemoval) return `${base}\nRemove the background completely. Preserve the subject identity, face, hair, clothing, body proportions and important details.`;
  if (isObjectRemoval) return `${base}\nRemove the requested object or person and reconstruct the surrounding area naturally. Preserve the rest of the scene.`;
  if (isClothingChange) return `${base}\nChange only the requested clothing while preserving identity, face, hair, body proportions and the rest of the scene.`;
  if (isHd) return `${base}\nImprove clarity and detail while preserving the identity and composition.`;
  return base;
}

async function pixelRequest(path: string, init: RequestInit): Promise<any> {
  const key = getApiKey();
  if (!key) throw new Error('PIXELAPI_API_KEY is not configured.');

  const headers = new Headers(init.headers || {});
  headers.set('Authorization', `Bearer ${key}`);
  headers.set('User-Agent', 'MKUU-AI/1.0');
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');

  const response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }

  if (!response.ok) {
    const detail = data?.error || data?.message || data?.raw || text;
    throw new Error(`PIXELAPI_IMAGE_API_ERROR: HTTP ${response.status} - ${String(detail).slice(0, 500)}`);
  }
  return data;
}

async function waitForGeneration(generationId: string): Promise<string> {
  for (let attempt = 0; attempt < 45; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const data = await pixelRequest(`/v1/image/${encodeURIComponent(generationId)}`, { method: 'GET' });
    if (data.status === 'completed' && data.output_url) return String(data.output_url);
    if (data.status === 'failed' || data.status === 'blocked') {
      throw new Error(`PIXELAPI_IMAGE_PROCESSING_ERROR: ${data.status}`);
    }
  }
  throw new Error('PIXELAPI_IMAGE_TIMEOUT: image processing did not complete within 90 seconds.');
}

async function downloadAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`PIXELAPI_OUTPUT_DOWNLOAD_ERROR: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error('PIXELAPI_OUTPUT_EMPTY: generated image was empty.');
  return bytes.toString('base64');
}

async function editImage(imageBase64: string, mimeType: string, instruction: string): Promise<string> {
  const data = await pixelRequest('/v1/image/edit', {
    method: 'POST',
    body: JSON.stringify({
      image_url: toDataUri(imageBase64, mimeType),
      instruction,
    }),
  });

  if (data.output_url) return downloadAsBase64(String(data.output_url));
  if (data.output && typeof data.output === 'string') return stripDataUrl(data.output);
  if (data.generation_id) return downloadAsBase64(await waitForGeneration(String(data.generation_id)));
  throw new Error('PIXELAPI_IMAGE_API_EMPTY: edit response contained no image output.');
}

async function generateImage(prompt: string): Promise<string> {
  const data = await pixelRequest('/v1/image/generate', {
    method: 'POST',
    body: JSON.stringify({ model: 'fast-image', prompt }),
  });
  if (data.output_url) return downloadAsBase64(String(data.output_url));
  if (data.generation_id) return downloadAsBase64(await waitForGeneration(String(data.generation_id)));
  throw new Error('PIXELAPI_IMAGE_API_EMPTY: generation response contained no image output.');
}

async function removeBackground(imageBase64: string, mimeType: string): Promise<string> {
  const data = await pixelRequest('/v1/image/remove-background', {
    method: 'POST',
    body: JSON.stringify({ image_url: toDataUri(imageBase64, mimeType) }),
  });
  if (data.output_url) return downloadAsBase64(String(data.output_url));
  if (data.generation_id) return downloadAsBase64(await waitForGeneration(String(data.generation_id)));
  throw new Error('PIXELAPI_IMAGE_API_EMPTY: background-removal response contained no image output.');
}

async function removeObject(imageBase64: string, mimeType: string, prompt: string): Promise<string> {
  const data = await pixelRequest('/v1/image/remove-object', {
    method: 'POST',
    body: JSON.stringify({ image_url: toDataUri(imageBase64, mimeType), prompt }),
  });
  if (data.output_url) return downloadAsBase64(String(data.output_url));
  if (data.generation_id) return downloadAsBase64(await waitForGeneration(String(data.generation_id)));
  throw new Error('PIXELAPI_IMAGE_API_EMPTY: object-removal response contained no image output.');
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
    const mimeType = imageAttachment?.mimeType || 'image/png';

    const isBgRemoval = ['remove background', 'ondoa background', 'toa background', 'futa background', 'background iwe transparent', 'transparent background'].some((term) => lower.includes(term));
    const isObjectRemoval = ['ondoa mtu', 'remove person', 'ondoa kitu', 'remove object', 'ondoa object'].some((term) => lower.includes(term));
    const isHd = ['hd', '2k', '4k', 'enhance', 'boresha', 'quality', 'clear', 'restore'].some((term) => lower.includes(term));
    const isClothingChange = ['nguo', 'shirt', 'suti', 'shati', 'mavazi'].some((term) => lower.includes(term));

    let imageBase64: string;
    if (!hasImage) {
      imageBase64 = await generateImage(prompt);
    } else if (isBgRemoval) {
      imageBase64 = await removeBackground(rawBase64, mimeType);
    } else if (isObjectRemoval) {
      imageBase64 = await removeObject(rawBase64, mimeType, prompt);
    } else {
      imageBase64 = await editImage(rawBase64, mimeType, makePrompt(prompt, true, false, false, isClothingChange, isHd));
    }

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
        : lower.includes('logo') ? 'Logo Iliyotengenezwa' : 'Picha Iliyotengenezwa';

    const saved = await generateRealFile({
      userId,
      filename,
      fileType: 'png',
      title,
      content: imageBase64,
      base64Data: imageBase64,
      description: 'Picha halisi iliyotengenezwa/kuhaririwa na MKUU Image Studio (PixelAPI).',
    });

    const explanation = isBgRemoval
      ? 'Nimeondoa background ya picha yako kupitia MKUU Image Studio.'
      : hasImage
        ? 'Nimehariri picha yako kupitia MKUU Image Studio na nimekuandalia picha halisi.'
        : 'Nimetengeneza picha halisi kupitia MKUU Image Studio.';

    return { file: saved, explanation, modelUsed: PRIMARY_IMAGE_MODEL };
  }
}

export const imageService = ImageService.getInstance();
