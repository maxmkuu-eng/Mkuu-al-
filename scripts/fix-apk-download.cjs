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

  const filename = sanitizeFilename(file.filename || 'mkuu_file_' + Date.now());

  try {
    const isNative = Boolean((window as any).Capacitor?.isNativePlatform?.());

    if (isNative) {
      // APK: resolve the file to base64 first, then write one file to Documents.
      // Do not use browser downloads, windows, share sheets, recursive folders,
      // or legacy storage permissions.
      let dataUrl = file.base64Data || file.downloadUrl || '';

      if (!dataUrl.startsWith('data:')) {
        if (!file.downloadUrl) throw new Error('Faili halikupatikana.');
        const remoteUrl = getApiUrl(file.downloadUrl);
        const response = await fetch(remoteUrl);
        if (!response.ok) throw new Error('Picha haikuweza kupakuliwa kutoka seva.');
        dataUrl = await blobToBase64(await response.blob());
      }

      const comma = dataUrl.indexOf(',');
      if (comma < 0) throw new Error('Muundo wa faili si sahihi.');

      const header = dataUrl.slice(0, comma);
      const payload = dataUrl.slice(comma + 1);
      const data = header.includes(';base64')
        ? payload
        : btoa(unescape(encodeURIComponent(decodeURIComponent(payload))));

      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      await Filesystem.writeFile({
        path: filename,
        data,
        directory: Directory.Documents,
      });

      console.log('[MKUU] APK download saved:', filename);
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
    // A failed save must never terminate the APK/WebView process.
    console.error('[MKUU] Download failed:', error);
  }
}
`;

source = source.slice(0, start) + replacement;
fs.writeFileSync(filePath, source);
console.log('MKUU: image Download button uses safe Android Documents save; Smart Share/Export remains disabled.');
