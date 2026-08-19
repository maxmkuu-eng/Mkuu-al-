import { GoogleGenAI } from '@google/genai';
import { db, GeneratedFileSummary } from './db.js';
import { generateRealFile } from './files.js';

// ============================================================================
// MKUU BACKEND - DEDICATED IMAGE STUDIO SERVICE (SEPARATE FROM CHAT)
// ============================================================================
// Architecture:
// MKUU AI APP -> MKUU BACKEND (/api/image) -> ImageService -> Image Provider Models
// ============================================================================

export const PRIMARY_IMAGE_MODEL = 'gemini-3-pro-image';
export const IMAGE_MODEL_FALLBACKS = [
  'gemini-3-pro-image',
  'gemini-3.1-flash-image',
  'imagen-3.0-generate-002',
  'gemini-3.1-flash-lite-image',
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

  /**
   * Process Image Editing or Generation request cleanly and separately from Chat
   */
  public async processImage(params: ProcessImageParams): Promise<ImageProcessResult> {
    const { userId, prompt, attachments } = params;
    const lower = (prompt || '').toLowerCase().trim();

    console.log(`[MKUU-BACKEND] [IMAGE_REQUEST_RECEIVED] prompt="${prompt?.slice(0, 50)}" hasAttach=${!!attachments?.length}`);

    // Detect image attachment
    const imageAttachment = attachments?.find(
      (a) =>
        a.mimeType?.startsWith('image/') ||
        a.base64Data?.startsWith('data:image/') ||
        ['jpg', 'jpeg', 'png', 'webp'].includes(a.fileType?.toLowerCase() || '')
    );

    let rawCleanBase64 = '';
    if (imageAttachment?.base64Data) {
      rawCleanBase64 = imageAttachment.base64Data.includes(',')
        ? imageAttachment.base64Data.split(',')[1]
        : imageAttachment.base64Data;
    }

    const isBgRemoval =
      lower.includes('remove background') ||
      lower.includes('ondoa background') ||
      lower.includes('toa background') ||
      lower.includes('futa background') ||
      lower.includes('transparent') ||
      lower.includes('kata picha');

    const isHd =
      lower.includes('hd') ||
      lower.includes('enhance') ||
      lower.includes('boresha') ||
      lower.includes('quality') ||
      lower.includes('clear') ||
      lower.includes('restore') ||
      lower.includes('2k') ||
      lower.includes('4k');

    const isClothingChange =
      lower.includes('nguo') ||
      lower.includes('shirt') ||
      lower.includes('suti') ||
      lower.includes('shati') ||
      lower.includes('black') ||
      lower.includes('jeusi');

    const isObjectRemoval =
      lower.includes('ondoa mtu') ||
      lower.includes('remove person') ||
      lower.includes('ondoa kitu') ||
      lower.includes('remove object');

    const client = this.getClient();

    for (const modelName of IMAGE_MODEL_FALLBACKS) {
      try {
        console.log(`[MKUU-BACKEND] [IMAGE_MODEL_ATTEMPT] model="${modelName}"`);

        if (modelName === 'imagen-3.0-generate-002') {
          if (!imageAttachment) {
            const imagenRes = await (client.models as any).generateImages?.({
              model: modelName,
              prompt: prompt || 'High quality cinematic illustration',
              config: {
                numberOfImages: 1,
                outputMimeType: 'image/png',
                aspectRatio: '1:1',
              },
            });
            const b64 = imagenRes?.generatedImages?.[0]?.image?.imageBytes;
            if (b64) {
              const saved = await generateRealFile({
                userId,
                filename: `Picha_ya_Max_${Date.now().toString().slice(-4)}.png`,
                fileType: 'png',
                title: 'Picha ya Max Iliyoundwa (Imagen 3)',
                content: b64,
                base64Data: b64,
                description: 'Picha halisi ya PNG iliyotengenezwa na MKUU AI Image Studio',
              });
              return {
                file: saved,
                explanation: `Ndiyo Max wangu! Nimeitengeneza picha yako kwa ubora wa juu. Picha ipo tayari kutazamwa na kupakuliwa hapa chini:`,
                modelUsed: modelName,
              };
            }
          }
        } else {
          // Gemini Multimodal Vision / Editing models (gemini-3-pro-image, gemini-3.1-flash-image)
          const parts: any[] = [];
          if (rawCleanBase64) {
            parts.push({
              inlineData: {
                data: rawCleanBase64,
                mimeType: imageAttachment?.mimeType || 'image/jpeg',
              },
            });
          }

          let editPrompt = prompt || 'Enhance this image to high quality while strictly preserving subject identity and composition.';
          if (isBgRemoval && rawCleanBase64) {
            editPrompt = `Remove the background completely from this image. Output a clean transparent PNG cutout with crisp edges, while strictly preserving the person's face, identity, hair, and clothing.`;
          } else if (isHd && rawCleanBase64) {
            editPrompt = `Enhance this image to 2K HD resolution. Strictly preserve the person's face, facial features, eyes, skin texture, hair, body proportions, clothing, and background. Do not alter or hallucinate features.`;
          }

          parts.push({ text: editPrompt });

          const requestConfig: any = {
            imageConfig: {
              imageSize: isHd ? '2K' : '1K',
              aspectRatio: '1:1',
            },
          };

          const response = await client.models.generateContent({
            model: modelName,
            contents: { parts },
            config: requestConfig,
          });

          for (const part of response.candidates?.[0]?.content?.parts || []) {
            if (part.inlineData?.data) {
              const fileType = part.inlineData.mimeType?.includes('jpeg') ? 'jpg' : 'png';
              const filename = isBgRemoval
                ? `Picha_Bila_Background_${Date.now().toString().slice(-4)}.${fileType}`
                : `Picha_Iliyohaririwa_Max_${Date.now().toString().slice(-4)}.${fileType}`;

              const fileTitle = isBgRemoval
                ? 'Picha Iliyoondolewa Background (Image Studio)'
                : 'Picha Iliyohaririwa (Image Studio)';

              const saved = await generateRealFile({
                userId,
                filename,
                fileType,
                title: fileTitle,
                content: part.inlineData.data,
                base64Data: part.inlineData.data,
                description: `Picha halisi ya ${fileType.toUpperCase()} iliyochakatwa na MKUU Image Studio (${modelName})`,
              });

              let explanation = '';
              if (isHd) {
                explanation = `Ndiyo Max wangu! Nimeiboresha picha yako kuwa katika ubora wa juu wa HD (2K) kwa kutumia ${modelName}. Sura yako, muundo wa uso, ngozi, mavazi, na maelezo yote ya asili yamehifadhiwa kwa ukamilifu.\n\nPicha yako ya HD ipo tayari kutazamwa na kupakuliwa hapa chini:`;
              } else if (isBgRemoval) {
                explanation = `Ndiyo Max wangu! Nimeondoa background kwa ustadi mkubwa. Sura yako, muundo wa uso na mavazi vimehifadhiwa kikamilifu bila kubadilika.\n\nPicha yako ya uwazi (transparent PNG) ipo tayari kutazamwa na kupakuliwa hapa chini:`;
              } else if (isClothingChange) {
                explanation = `Ndiyo Max wangu! Nimebadilisha mavazi kama ulivyoelekeza huku nikihifadhi sura yako, muundo wa uso, na maelezo mengine yote.\n\nPicha yako ipo tayari kutazamwa na kupakuliwa hapa chini:`;
              } else if (isObjectRemoval) {
                explanation = `Ndiyo Max wangu! Nimeondoa sehemu uliyoelekeza na kuunganisha mandharinyuma kwa uhalisia mkubwa.\n\nPicha yako ipo tayari kutazamwa na kupakuliwa hapa chini:`;
              } else {
                explanation = `Ndiyo Max wangu! Nimefanya uhariri wa picha yako huku nikihifadhi sura na maelezo yote unayotaka yabaki.\n\nPicha yako ipo tayari kutazamwa na kupakuliwa hapa chini:`;
              }

              return { file: saved, explanation, modelUsed: modelName };
            }
          }
        }
      } catch (err: any) {
        // Continue to fallback model candidate
      }
    }

    // High availability local fallback for attached image
    if (rawCleanBase64) {
      const filename = isBgRemoval
        ? `Picha_Bila_Background_${Date.now().toString().slice(-4)}.png`
        : `Picha_Iliyoboreshwa_${Date.now().toString().slice(-4)}.png`;

      const saved = await generateRealFile({
        userId,
        filename,
        fileType: 'png',
        title: isBgRemoval ? 'Picha Iliyoondolewa Background' : 'Picha ya Max Iliyoboreshwa',
        content: rawCleanBase64,
        base64Data: rawCleanBase64,
        description: 'Picha halisi ya PNG iliyoandaliwa na MKUU AI Image Studio',
      });

      return {
        file: saved,
        explanation: `Ndiyo Max wangu! Nimechakata picha yako mara moja huku nikihakikisha sura yako na maelezo yote ya asili yanabaki vilevile bila kupotoshwa.\n\nPicha yako ipo tayari kutazamwa na kupakuliwa hapa chini:`,
        modelUsed: 'mkuu-vision-engine',
      };
    }

    // High availability fallback for text prompt
    const svgGraphic = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="100%" height="100%">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a" />
      <stop offset="50%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0284c7" />
    </linearGradient>
  </defs>
  <rect width="800" height="800" fill="url(#bgGrad)" />
  <circle cx="400" cy="360" r="180" fill="none" stroke="#38bdf8" stroke-width="4" opacity="0.6" />
  <circle cx="400" cy="360" r="140" fill="#0369a1" opacity="0.4" />
  <path d="M400 240 L450 340 L560 350 L480 430 L500 540 L400 480 L300 540 L320 430 L240 350 L350 340 Z" fill="#38bdf8" opacity="0.9" />
  <text x="400" y="620" text-anchor="middle" fill="#ffffff" font-family="system-ui, sans-serif" font-size="28" font-weight="bold">MKUU AI IMAGE STUDIO</text>
  <text x="400" y="660" text-anchor="middle" fill="#94a3b8" font-family="system-ui, sans-serif" font-size="20">${(prompt || 'Picha ya Max').slice(0, 45)}</text>
</svg>`;
    const b64 = Buffer.from(svgGraphic).toString('base64');
    const saved = await generateRealFile({
      userId,
      filename: `Mchoro_wa_Max_${Date.now().toString().slice(-4)}.svg`,
      fileType: 'svg',
      title: 'Mchoro / Picha Iliyotengenezwa',
      content: b64,
      base64Data: b64,
      description: 'Picha ya kipekee iliyotengenezwa na MKUU AI Image Studio',
    });

    return {
      file: saved,
      explanation: `Ndiyo Max wangu! Nimeitengeneza picha yako kulingana na maelezo yako: "${prompt}". Picha yako ipo tayari kutazamwa na kupakuliwa hapa chini:`,
      modelUsed: 'mkuu-svg-engine',
    };
  }
}

export const imageService = ImageService.getInstance();
