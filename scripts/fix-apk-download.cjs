const fs = require('fs');
const path = require('path');

const root = process.cwd();
const filePath = path.join(root, 'src/services/clientFileGenerator.ts');
let source = fs.readFileSync(filePath, 'utf8');

const marker = 'export async function downloadFileHelper(file: {';
const start = source.indexOf(marker);
if (start < 0) throw new Error('MKUU APK download fix: downloadFileHelper marker not found.');

const replacement = String.raw`export async function downloadFileHelper(file: {
  filename: string;
  downloadUrl?: string;
  base64Data?: string;
  content?: string;
  mimeType?: string;
  fileType?: string;
}): Promise<void> {
  if (typeof window === 'undefined') return;

  const filename = sanitizeFilename(file.filename || 'mkuu_image_' + Date.now() + '.png');

  try {
    const isNative = Boolean((window as any).Capacitor?.isNativePlatform?.());

    if (isNative && (file.fileType === 'image' || (file.mimeType || '').startsWith('image/'))) {
      let dataUrl = file.base64Data || file.downloadUrl || '';

      if (!dataUrl.startsWith('data:')) {
        if (!file.downloadUrl) throw new Error('Picha haikupatikana.');
        const response = await fetch(getApiUrl(file.downloadUrl));
        if (!response.ok) throw new Error('Picha haikuweza kupakuliwa kutoka seva.');
        dataUrl = await blobToBase64(await response.blob());
      }

      const comma = dataUrl.indexOf(',');
      if (comma < 0) throw new Error('Muundo wa picha si sahihi.');

      const header = dataUrl.slice(0, comma);
      const payload = dataUrl.slice(comma + 1);
      const base64 = header.includes(';base64')
        ? payload
        : btoa(unescape(encodeURIComponent(decodeURIComponent(payload))));

      const { registerPlugin } = await import('@capacitor/core');
      const GallerySaver = registerPlugin<{ saveImage(options: { filename: string; base64: string; mimeType: string }): Promise<{ uri: string }> }>('GallerySaver');
      await GallerySaver.saveImage({
        filename,
        base64,
        mimeType: file.mimeType || 'image/png',
      });

      console.log('[MKUU] Image saved directly to Android Gallery:', filename);
      return;
    }

    const sourceUrl = file.base64Data || file.downloadUrl;
    if (!sourceUrl) throw new Error('Faili halikupatikana kwa ajili ya kupakua.');

    const link = document.createElement('a');
    link.href = sourceUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => document.body.removeChild(link), 1500);
  } catch (error) {
    console.error('[MKUU] Download failed:', error);
  }
}
`;

source = source.slice(0, start) + replacement;
fs.writeFileSync(filePath, source);
console.log('MKUU: image Download button saves directly to Android Gallery; other downloads remain unchanged.');
