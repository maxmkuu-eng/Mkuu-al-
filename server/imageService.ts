import { GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';

// MKUU IMAGE STUDIO
// Provider: Sikasio Image Gen API.
// Text-to-image generation is handled server-side; the API key is never exposed to the client.
export const PRIMARY_IMAGE_MODEL = 'Sikasio Image Gen (flash)';
export const EDIT_IMAGE_MODEL = 'Sikasio Image Gen (generation only)';

export interface ProcessImageParams { userId: string; prompt: string; attachments?: Array<{ filename: string; fileType: string; mimeType: string; size?: number; base64Data?: string; }>; }
export interface ImageProcessResult { file: GeneratedFileSummary; explanation: string; modelUsed: string; }

const BASE_URL = 'https://img-gen-api.sikasio.com';
const MODEL = 'flash';

function getApiKey(): string {
  return (process.env.SIKASIO_API_KEY || '').trim();
}

async function generateImage(prompt: string): Promise<string> {
  const key = getApiKey();
  if (!key) throw new Error('SIKASIO_API_KEY is not configured.');
  const response = await fetch(`${BASE_URL}/v1/generate?wait=true`, {
    method: 'POST',
    headers: { 'X-API-Key': key, 'Content-Type': 'application/json', 'User-Agent': 'MKUU-AI/1.0' },
    body: JSON.stringify({ prompt: String(prompt || '').trim() || 'Create a high-quality professional image.', model: MODEL, count: 1, aspectRatio: '1:1', size: 'original' }),
  });
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    const detail = data?.error?.message || data?.error || data?.message || data?.raw || text;
    throw new Error(`SIKASIO_IMAGE_API_ERROR: HTTP ${response.status} - ${String(detail).slice(0, 500)}`);
  }
  const imageUrl = data?.images?.[0]?.url;
  if (imageUrl) return downloadAsBase64(String(imageUrl));
  if (data?.status === 'running' || data?.status === 'queued') {
    if (!data?.id) throw new Error('SIKASIO_IMAGE_API_EMPTY: generation returned no job id.');
    return pollJob(String(data.id), key);
  }
  throw new Error(`SIKASIO_IMAGE_API_EMPTY: no image URL returned. Response: ${JSON.stringify(data).slice(0, 800)}`);
}

async function pollJob(jobId: string, key: string): Promise<string> {
  for (let attempt = 0; attempt < 60; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const response = await fetch(`${BASE_URL}/v1/jobs/${encodeURIComponent(jobId)}`, { headers: { 'X-API-Key': key, 'User-Agent': 'MKUU-AI/1.0' } });
    const text = await response.text();
    let data: any = {};
    try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
    if (!response.ok) {
      const detail = data?.error?.message || data?.error || data?.message || text;
      throw new Error(`SIKASIO_IMAGE_JOB_ERROR: HTTP ${response.status} - ${String(detail).slice(0, 500)}`);
    }
    if (data.status === 'done') {
      const url = data?.images?.[0]?.url;
      if (!url) throw new Error('SIKASIO_IMAGE_API_EMPTY: completed job contained no image URL.');
      return downloadAsBase64(String(url));
    }
    if (data.status === 'failed') throw new Error(`SIKASIO_IMAGE_PROCESSING_ERROR: ${String(data?.error || 'generation failed').slice(0, 500)}`);
  }
  throw new Error('SIKASIO_IMAGE_TIMEOUT: image processing did not complete within 120 seconds.');
}

async function downloadAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`SIKASIO_OUTPUT_DOWNLOAD_ERROR: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error('SIKASIO_OUTPUT_EMPTY: generated image was empty.');
  return bytes.toString('base64');
}

export class ImageService {
  private static instance: ImageService | null = null;
  public static getInstance(): ImageService { if (!ImageService.instance) ImageService.instance = new ImageService(); return ImageService.instance; }
  public async processImage(params: ProcessImageParams): Promise<ImageProcessResult> {
    const { userId, prompt, attachments = [] } = params;
    const imageAttachment = attachments.find((a) => String(a.mimeType || '').startsWith('image/'));
    if (imageAttachment) {
      throw new Error('SIKASIO_IMAGE_EDIT_UNSUPPORTED: Sikasio Image Gen is currently configured for new image generation only. Image editing/background removal will use a separate image-edit provider later.');
    }
    const lower = String(prompt || '').toLowerCase().trim();
    const imageBase64 = await generateImage(prompt);
    const filename = lower.includes('logo') ? `Logo_ya_Max_${Date.now().toString().slice(-6)}.jpg` : `Picha_ya_Max_${Date.now().toString().slice(-6)}.jpg`;
    const title = lower.includes('logo') ? 'Logo Iliyotengenezwa' : 'Picha Iliyotengenezwa';
    const saved = await generateRealFile({ userId, filename, fileType: 'jpg', title, content: imageBase64, base64Data: imageBase64, description: 'Picha halisi iliyotengenezwa na MKUU Image Studio kupitia Sikasio Image Gen.' });
    return { file: saved, explanation: 'Nimetengeneza picha halisi kupitia MKUU Image Studio kwa kutumia Sikasio Image Gen.', modelUsed: PRIMARY_IMAGE_MODEL };
  }
}

export const imageService = ImageService.getInstance();
