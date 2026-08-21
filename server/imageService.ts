import { GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';

// MKUU IMAGE STUDIO
// Provider: Cloudflare Workers AI. Credentials are read only from Render
// environment variables; no browser login or Puter account is required.
export const PRIMARY_IMAGE_MODEL = '@cf/runwayml/stable-diffusion-v1-5-img2img';
export const EDIT_IMAGE_MODEL = '@cf/runwayml/stable-diffusion-v1-5-img2img';

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

function getCloudflareAccountId(): string {
  return (process.env.CLOUDFLARE_ACCOUNT_ID || '').trim();
}

function getCloudflareToken(): string {
  return (process.env.CLOUDFLARE_API_TOKEN || '').trim();
}

function stripDataUrl(value: string): string {
  return value.includes(',') ? value.split(',')[1] : value;
}

function makePrompt(prompt: string, hasImage: boolean, isBgRemoval: boolean, isObjectRemoval: boolean, isClothingChange: boolean, isHd: boolean): string {
  const base = String(prompt || '').trim() || 'Create a high-quality professional image.';
  if (!hasImage) return [
    'GENERATE THE IMAGE ITSELF.',
    'Do not return a prompt, description, SVG, JSON, or text-only answer.',
    base,
    'Create a polished production-ready image suitable for the user request.',
  ].join('\n');
  if (isBgRemoval) return [
    'EDIT THE PROVIDED IMAGE.',
    'Remove the entire background and make the background transparent or cleanly separated from the subject.',
    'Return the edited image itself.',
    'Preserve the subject identity, face, hair, clothing, body proportions and important details.',
    'Do not return the original image unchanged and do not add an unrelated replacement background.',
    base,
  ].join('\n');
  if (isObjectRemoval) return [
    'EDIT THE PROVIDED IMAGE.', base,
    'Remove the requested object or person completely and reconstruct the surrounding area naturally.',
    'Preserve all unrelated details and do not return the original image unchanged.',
  ].join('\n');
  if (isClothingChange) return [
    'EDIT THE PROVIDED IMAGE.', base,
    'Change only the requested clothing. Preserve identity, face, hair, body proportions and scene.',
    'Do not return the original image unchanged.',
  ].join('\n');
  if (isHd) return [
    'EDIT THE PROVIDED IMAGE.', base,
    'Improve clarity and detail while preserving the exact identity and composition.',
    'Do not return the original image unchanged.',
  ].join('\n');
  return [
    'EDIT THE PROVIDED IMAGE according to the instruction below.', base,
    'Return the edited image itself, not a prompt or explanation.',
    'Preserve identity and important details unless the user explicitly asks to change them.',
    'Do not return the original image unchanged.',
  ].join('\n');
}

function toBase64Result(result: unknown): string {
  if (typeof result === 'string') {
    // Workers AI REST returns the generated PNG as a base64 string for this model.
    return stripDataUrl(result);
  }
  if (result && typeof result === 'object') {
    const candidate = result as any;
    const value = candidate.image || candidate.image_b64 || candidate.data || candidate.result;
    if (typeof value === 'string') return stripDataUrl(value);
  }
  throw new Error('Cloudflare Workers AI returned no image data.');
}

async function cloudflareImageRequest(params: {
  prompt: string;
  imageBase64?: string;
  width?: number;
  height?: number;
}): Promise<string> {
  const accountId = getCloudflareAccountId();
  const token = getCloudflareToken();
  if (!accountId || !token) {
    throw new Error('CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN is not configured.');
  }

  const body: Record<string, unknown> = {
    prompt: params.prompt,
    width: params.width || 1024,
    height: params.height || 1024,
    num_steps: 20,
    guidance: 7.5,
    strength: params.imageBase64 ? 0.75 : 1,
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
    const text = await response.text().catch(() => '');
    let message = text;
    try {
      const data = JSON.parse(text);
      message = data?.errors?.[0]?.message || data?.message || text;
    } catch { /* keep raw response */ }
    throw new Error(`CLOUDFLARE_IMAGE_API_ERROR (${response.status}): ${message}`);
  }

  if (contentType.includes('image/')) {
    return Buffer.from(await response.arrayBuffer()).toString('base64');
  }

  const data: any = await response.json().catch(() => ({}));
  if (data?.success === false) {
    throw new Error(`CLOUDFLARE_IMAGE_API_ERROR: ${data?.errors?.[0]?.message || 'Workers AI request failed.'}`);
  }
  return toBase64Result(data?.result);
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
    const isObjectRemoval = [
      'ondoa mtu', 'remove person', 'ondoa kitu', 'remove object', 'ondoa object',
    ].some((term) => lower.includes(term));
    const isHd = ['hd', '2k', '4k', 'enhance', 'boresha', 'quality', 'clear', 'restore'].some((term) => lower.includes(term));
    const isClothingChange = ['nguo', 'shirt', 'suti', 'shati', 'mavazi'].some((term) => lower.includes(term));
    const promptText = makePrompt(prompt, hasImage, isBgRemoval, isObjectRemoval, isClothingChange, isHd);

    console.log(`[MKUU-BACKEND] [CLOUDFLARE_IMAGE] model="${PRIMARY_IMAGE_MODEL}" hasInputImage=${hasImage}`);
    const imageBase64 = await cloudflareImageRequest({
      prompt: promptText,
      imageBase64: rawBase64 || undefined,
      width: 1024,
      height: 1024,
    });

    const suffix = Date.now().toString().slice(-6);
    const filename = isBgRemoval
      ? `Picha_Bila_Background_${suffix}.png`
      : hasImage
        ? `Picha_Iliyohaririwa_Max_${suffix}.png`
        : lower.includes('logo')
          ? `Logo_ya_Max_${suffix}.png`
          : `Picha_ya_Max_${suffix}.png`;
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
      fileType: 'png',
      title,
      content: imageBase64,
      base64Data: imageBase64,
      description: 'Picha halisi iliyotengenezwa/kuhaririwa na MKUU Image Studio kupitia Cloudflare Workers AI.',
    });

    const explanation = isBgRemoval
      ? 'Nimehariri picha yako kupitia MKUU Image Studio na nimeondoa background kulingana na maelekezo yako.'
      : hasImage
        ? 'Nimehariri picha yako kupitia MKUU Image Studio na nimekuandalia picha mpya.'
        : lower.includes('logo')
          ? 'Nimetengeneza logo kupitia MKUU Image Studio na iko tayari.'
          : 'Nimetengeneza picha kupitia MKUU Image Studio na iko tayari.';

    return {
      file: saved,
      explanation,
      modelUsed: PRIMARY_IMAGE_MODEL,
    };
  }
}

export const imageService = ImageService.getInstance();