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
      // Android: use the system share/save sheet instead of directly writing to
      // shared storage. This avoids storage-permission and native-write crashes.
      const dataUrl = file.base64Data || file.downloadUrl;
      if (!dataUrl || !dataUrl.startsWith('data:')) {
        throw new Error('Faili halikupatikana kwa ajili ya kupakua.');
      }

      const { Share } = await import('@capacitor/share');
      const canShare = await Share.canShare();
      if (!canShare.value) throw new Error('Android sharing haipatikani.');

      const { Filesystem, Directory } = await import('@capacitor/filesystem');
      const comma = dataUrl.indexOf(',');
      if (comma < 0) throw new Error('Muundo wa faili si sahihi.');

      const base64 = dataUrl.slice(comma + 1);
      const saved = await Filesystem.writeFile({
        path: filename,
        data: base64,
        directory: Directory.Cache,
      });

      await Share.share({
        title: filename,
        text: filename,
        url: saved.uri,
        dialogTitle: 'Hifadhi au Shiriki faili',
      });
      return;
    }

    // Existing browser behaviour: unchanged.
    const sourceUrl = file.base64Data || file.downloadUrl;
    if (!sourceUrl) throw new Error('Faili halikupatikana kwa ajili ya kupakua.');

    const link = document.createElement('a');
    link.href = sourceUrl;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    setTimeout(() => document.body.removeChild(link), 1500);
  } catch (error) {
    console.error('[MKUU] Download failed:', error);
    // Never terminate the app because Download failed.
  }
}
`;

source = source.slice(0, start) + replacement;
fs.writeFileSync(filePath, source);
console.log('MKUU: APK Download now uses Android Cache + system Save/Share sheet; web download unchanged.');
