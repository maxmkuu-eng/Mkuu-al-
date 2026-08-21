import { GoogleGenAI } from '@google/genai';
import { GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';

// ============================================================================
// MKUU BACKEND - DEDICATED IMAGE STUDIO SERVICE
// ============================================================================
// Image requests are handled here, separately from text chat.  A request that
// reaches this service must either return a real generated image or fail clearly.
// It must never return the original upload as if it had been edited and must
// never return a fake SVG/prompt as an image-generation substitute.
// ============================================================================

export const PRIMARY_IMAGE_MODEL = 'gemini-3.1-flash-image';
export const IMAGE_MODEL_FALLBACKS = [
  'gemini-3.1-flash-image',
  'gemini-3-pro-image',
  'gemini-3.1-flash-lite-image',
  'gemini-2.5-flash-image',
];

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

export class ImageService {
  private static instance: ImageService | null = null;
  private aiClient: GoogleGenAI | null = null;

  public static getInstance(): ImageService {
    if (!ImageService.instance) {
      ImageService.instance = new ImageService();
    }
    return ImageService.instance;
  }

  private getClient(): GoogleGenAI {
    if (!this.aiClient) {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('GEMINI_API_KEY is not configured on MKUU Backend for ImageService.');
      }
      this.aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'mkuu-ai-backend-image-service',
          },
        },
      });
    }
    return this.aiClient;
  }

  public async processImage(params: ProcessImageParams): Promise<ImageProcessResult> {
    const { userId, prompt, attachments = [] } = params;
    const lower = String(prompt || '').toLowerCase().trim();

    const imageAttachment = attachments.find(
      (a) => String(a.mimeType || '').startsWith('image/') ||
        ['jpg', 'jpeg', 'png', 'webp'].includes(String(a.fileType || '').toLowerCase())
    );

    const rawBase64 = imageAttachment?.base64Data
      ? (imageAttachment.base64Data.includes(',') ? imageAttachment.base64Data.split(',')[1] : imageAttachment.base64Data)
      : '';

    const isBgRemoval = [
      'remove background', 'ondoa background', 'toa background', 'futa background',
      'background iwe transparent', 'transparent background',
    ].some((term) => lower.includes(term));

    const isObjectRemoval = [
      'ondoa mtu', 'remove person', 'ondoa kitu', 'remove object', 'ondoa object',
    ].some((term) => lower.includes(term));

    const isHd = ['hd', '2k', '4k', 'enhance', 'boresha', 'quality', 'clear', 'restore']
      .some((term) => lower.includes(term));

    const isClothingChange = ['nguo', 'shirt', 'suti', 'shati', 'mavazi']
      .some((term) => lower.includes(term));

    const client = this.getClient();
    let lastError: any = null;

    for (const modelName of IMAGE_MODEL_FALLBACKS) {
      try {
        console.log(`[MKUU-BACKEND] [IMAGE_MODEL_ATTEMPT] model="${modelName}" hasInputImage=${!!rawBase64}`);

        const parts: any[] = [];
        if (rawBase64) {
          parts.push({
            inlineData: {
              data: rawBase64,
              mimeType: imageAttachment?.mimeType || 'image/jpeg',
            },
          });
        }

        let editPrompt = prompt || 'Create a high-quality professional image.';
        if (isBgRemoval && rawBase64) {
          editPrompt = [
            'EDIT THE PROVIDED IMAGE.',
            'Remove the entire background and return ONLY the edited subject as a transparent PNG.',
            'Do not return the original image unchanged.',
            'Preserve the subject identity, face, hair, clothing, body proportions and important details exactly.',
            'Use clean, precise edges around hair and clothing. No white, black, gray or replacement background.',
          ].join(' ');
        } else if (isObjectRemoval && rawBase64) {
          editPrompt = [
            'EDIT THE PROVIDED IMAGE.',
            editPrompt,
            'Remove the requested object/person completely and reconstruct the surrounding area naturally.',
            'Do not return the original image unchanged.',
            'Preserve all unrelated people, objects, identity and composition.',
          ].join(' ');
        } else if (isClothingChange && rawBase64) {
          editPrompt = [
            'EDIT THE PROVIDED IMAGE.',
            editPrompt,
            'Change only the requested clothing while preserving the person identity, face, hair, body proportions and scene.',
            'Do not return the original image unchanged.',
          ].join(' ');
        } else if (isHd && rawBase64) {
          editPrompt = [
            'EDIT THE PROVIDED IMAGE.',
            editPrompt,
            'Improve detail and clarity while preserving the exact identity and composition.',
            'Do not return the original image unchanged.',
          ].join(' ');
        } else if (rawBase64) {
          editPrompt = [
            'EDIT THE PROVIDED IMAGE according to this instruction:',
            editPrompt,
            'Return the edited image itself, not a prompt or explanation.',
            'Do not return the original image unchanged.',
          ].join(' ');
        } else {
          editPrompt = [
            'GENERATE A NEW IMAGE from this instruction:',
            editPrompt,
            'Return the generated image itself, not a prompt, description, SVG placeholder, or text-only answer.',
          ].join(' ');
        }

        parts.push({ text: editPrompt });

        const response = await client.models.generateContent({
          model: modelName,
          contents: { parts },
          config: {
            imageConfig: {
              imageSize: isHd ? '2K' : '1K',
              aspectRatio: '1:1',
            },
          } as any,
        });

        const outputParts = response.candidates?.[0]?.content?.parts || [];
        const imagePart = outputParts.find((part: any) => part?.inlineData?.data);

        if (!imagePart?.inlineData?.data) {
          throw new Error(`Image model ${modelName} returned no image data.`);
        }

        const mimeType = imagePart.inlineData.mimeType || 'image/png';
        const fileType = mimeType.includes('jpeg') || mimeType.includes('jpg') ? 'jpg' : 'png';
        const filename = isBgRemoval
          ? `Picha_Bila_Background_${Date.now().toString().slice(-6)}.${fileType}`
          : rawBase64
            ? `Picha_Iliyohaririwa_Max_${Date.now().toString().slice(-6)}.${fileType}`
            : lower.includes('logo')
              ? `Logo_ya_Max_${Date.now().toString().slice(-6)}.${fileType}`
              : `Picha_ya_Max_${Date.now().toString().slice(-6)}.${fileType}`;

        const title = isBgRemoval
          ? 'Picha Iliyoondolewa Background'
          : rawBase64
            ? 'Picha Iliyohaririwa'
            : lower.includes('logo')
              ? 'Logo Iliyotengenezwa'
              : 'Picha Iliyotengenezwa';

        const saved = await generateRealFile({
          userId,
          filename,
          fileType,
          title,
          content: imagePart.inlineData.data,
          base64Data: imagePart.inlineData.data,
          description: `Picha halisi iliyotengenezwa/kuhaririwa na MKUU Image Studio (${modelName})`,
        });

        const explanation = isBgRemoval
          ? 'Nimeondoa background na kurudisha picha halisi ya transparent PNG hapa chini.'
          : rawBase64
            ? 'Nimehariri picha yako na kurudisha picha halisi iliyotengenezwa hapa chini.'
            : lower.includes('logo')
              ? 'Nimetengeneza logo halisi na nimeirudisha kama picha hapa chini.'
              : 'Nimetengeneza picha halisi kulingana na maelekezo yako na nimeirudisha hapa chini.';

        return { file: saved, explanation, modelUsed: modelName };
      } catch (err: any) {
        lastError = err;
        console.warn(`[MKUU-BACKEND] [IMAGE_MODEL_FAILED] model="${modelName}" error="${err?.message || err}"`);
      }
    }

    // IMPORTANT: never return the uploaded image or a fake SVG as a successful
    // edit/generation. The caller must receive a real failure so the UI does not
    // display an unchanged image as if Image Studio had completed the request.
    throw new Error(`Image Studio failed to produce an image with all configured models. ${lastError?.message || ''}`.trim());
  }
}

export const imageService = ImageService.getInstance();
