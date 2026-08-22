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
      const dataUrl = file.base64Data || file.downloadUrl;
      if (!dataUrl || !dataUrl.startsWith('data:')) {
        throw new Error('Faili halikupatikana kwa ajili ya kupakua.');
      }

      const comma = dataUrl.indexOf(',');
      if (comma < 0) throw new Error('Muundo wa faili si sahihi.');

      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      await Filesystem.writeFile({
        path: 'MKUU AI/' + filename,
        data: dataUrl.slice(comma + 1),
        directory: Directory.Documents,
        recursive: true,
      });

      console.log('[MKUU] File saved on Android:', filename);
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
console.log('MKUU: APK Download saves files to Android Documents; web download unchanged.');
