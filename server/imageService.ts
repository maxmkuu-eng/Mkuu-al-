import { GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';

// MKUU IMAGE STUDIO — Pollinations
export const PRIMARY_IMAGE_MODEL = 'gptimage';
export const EDIT_IMAGE_MODEL = 'kontext';

export interface ProcessImageParams { userId: string; prompt: string; attachments?: Array<{ filename: string; fileType: string; mimeType: string; size?: number; base64Data?: string; }>; }
export interface ImageProcessResult { file: GeneratedFileSummary; explanation: string; modelUsed: string; }
const BASE_URL = 'https://gen.pollinations.ai';

function requireKey(): string {
  const key = (process.env.POLLINATIONS_API_KEY || '').trim();
  if (!key) throw new Error('POLLINATIONS_API_KEY is not configured.');
  return key;
}
function cleanBase64(value: string): string {
  const raw = String(value || '').trim();
  const match = raw.match(/^data:image\/[^;]+;base64,(.*)$/is);
  return (match ? match[1] : raw).replace(/\s/g, '');
}
function imageBlob(attachment: NonNullable<ProcessImageParams['attachments']>[number]): Blob {
  if (!attachment.base64Data) throw new Error('POLLINATIONS_IMAGE_INPUT_MISSING: uploaded image has no base64 data.');
  const bytes = Buffer.from(cleanBase64(attachment.base64Data), 'base64');
  if (!bytes.length) throw new Error('POLLINATIONS_IMAGE_INPUT_EMPTY: uploaded image is empty.');
  return new Blob([bytes], { type: attachment.mimeType || 'image/jpeg' });
}
async function parseJsonResponse(response: Response): Promise<any> {
  const text = await response.text();
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!response.ok) {
    const detail = data?.error?.message || data?.error || data?.message || data?.raw || text;
    throw new Error(`POLLINATIONS_IMAGE_API_ERROR: HTTP ${response.status} - ${String(detail).slice(0, 900)}`);
  }
  return data;
}
async function downloadAsBase64(url: string, key: string): Promise<string> {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
  if (!response.ok) throw new Error(`POLLINATIONS_OUTPUT_DOWNLOAD_ERROR: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length) throw new Error('POLLINATIONS_OUTPUT_EMPTY: generated image was empty.');
  return bytes.toString('base64');
}
function extractImageBase64(data: any): string | null {
  const b64 = data?.data?.[0]?.b64_json || data?.b64_json || data?.result?.b64_json;
  return typeof b64 === 'string' && b64.trim() ? cleanBase64(b64) : null;
}
async function generateImage(prompt: string): Promise<string> {
  const key = requireKey();
  const response = await fetch(`${BASE_URL}/v1/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'User-Agent': 'MKUU-AI/1.0' },
    body: JSON.stringify({ model: PRIMARY_IMAGE_MODEL, prompt: String(prompt || '').trim(), n: 1, size: '1024x1024', quality: 'hd', response_format: 'b64_json', user: 'user_max_owner' }),
  });
  const data = await parseJsonResponse(response);
  const b64 = extractImageBase64(data);
  if (b64) return b64;
  const url = data?.data?.[0]?.url || data?.url || data?.image_url || data?.output_url;
  if (typeof url === 'string' && url) return downloadAsBase64(url, key);
  throw new Error(`POLLINATIONS_IMAGE_GENERATION_EMPTY: no image returned. Response: ${JSON.stringify(data).slice(0, 1000)}`);
}
async function editImage(attachment: NonNullable<ProcessImageParams['attachments']>[number], prompt: string, transparent = false): Promise<string> {
  const key = requireKey();
  const form = new FormData();
  // Critical: send the exact original uploaded image bytes. Never substitute another image.
  form.append('image', imageBlob(attachment), attachment.filename || 'input.png');
  form.append('prompt', String(prompt || '').trim());
  form.append('model', EDIT_IMAGE_MODEL);
  form.append('size', '1024x1024');
  if (transparent) form.append('transparent', 'true');
  const response = await fetch(`${BASE_URL}/v1/images/edits`, { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'User-Agent': 'MKUU-AI/1.0' }, body: form });
  const data = await parseJsonResponse(response);
  const b64 = extractImageBase64(data);
  if (b64) return b64;
  const url = data?.data?.[0]?.url || data?.url || data?.image_url || data?.output_url;
  if (typeof url === 'string' && url) return downloadAsBase64(url, key);
  throw new Error(`POLLINATIONS_IMAGE_EDIT_EMPTY: no edited image returned. Response: ${JSON.stringify(data).slice(0, 1000)}`);
}
function wantsBackgroundRemoval(prompt: string): boolean {
  const p = String(prompt || '').toLowerCase();
  return /(remove|ondoa|toa|delete|futa|fanya).{0,40}(background|bg|mandhar|backdrop)/i.test(p) || /(background|bg|mandhar|backdrop).{0,40}(remove|ondoa|toa|delete|futa)/i.test(p);
}
function buildEditPrompt(prompt: string, backgroundRemoval: boolean): string {
  if (backgroundRemoval) return ['EDIT THE PROVIDED SOURCE IMAGE ONLY.','Preserve the exact main subject from the uploaded image: identity, face, body, pose, clothing, colors and important details.','Do not replace the subject with another person/object and do not invent a different image.','Remove only the background as requested and keep the subject itself intact.','Return the edited image, not a prompt, explanation or description.',`USER INSTRUCTION: ${prompt}`].join('\n');
  return ['EDIT THE PROVIDED SOURCE IMAGE ONLY.','Use the uploaded image as the actual source/reference. Do not substitute another image.','Preserve the original subject identity and all details that the user did not explicitly ask to change.','Apply exactly the requested modification and return the resulting image itself.','Do not return a prompt, explanation, placeholder, unrelated image, or the unchanged original.',`USER INSTRUCTION: ${prompt}`].join('\n');
}

export class ImageService {
  private static instance: ImageService | null = null;
  public static getInstance(): ImageService { if (!ImageService.instance) ImageService.instance = new ImageService(); return ImageService.instance; }
  public async processImage(params: ProcessImageParams): Promise<ImageProcessResult> {
    const { userId, prompt, attachments = [] } = params;
    const imageAttachment = attachments.find((a) => String(a.mimeType || '').startsWith('image/'));
    const lower = String(prompt || '').toLowerCase();
    const isLogo = /\b(logo|nembo|alama)\b/i.test(lower);
    let imageBase64: string; let modelUsed: string; let explanation: string;
    if (imageAttachment) {
      const removeBg = wantsBackgroundRemoval(prompt);
      imageBase64 = await editImage(imageAttachment, buildEditPrompt(prompt, removeBg), removeBg);
      modelUsed = EDIT_IMAGE_MODEL;
      explanation = removeBg ? 'Nimehariri picha uliyoipakia na kuondoa background bila kubadilisha subject ya picha.' : 'Nimehariri picha uliyoipakia moja kwa moja kulingana na maelekezo yako; picha nyingine haijatumika kama source.';
    } else {
      imageBase64 = await generateImage(prompt);
      modelUsed = PRIMARY_IMAGE_MODEL;
      explanation = isLogo ? 'Nimetengeneza logo halisi kulingana na maelekezo yako kupitia Pollinations Image Studio.' : 'Nimetengeneza picha halisi kulingana na maelekezo yako kupitia Pollinations Image Studio.';
    }
    const filename = imageAttachment ? `Picha_Iliyohaririwa_${Date.now().toString().slice(-6)}.png` : (isLogo ? `Logo_ya_Max_${Date.now().toString().slice(-6)}.png` : `Picha_ya_Max_${Date.now().toString().slice(-6)}.png`);
    const title = imageAttachment ? 'Picha Iliyohaririwa' : (isLogo ? 'Logo Iliyotengenezwa' : 'Picha Iliyotengenezwa');
    const saved = await generateRealFile({ userId, filename, fileType: 'png', title, content: imageBase64, base64Data: imageBase64, description: explanation });
    return { file: saved, explanation, modelUsed };
  }
}
export const imageService = ImageService.getInstance();
