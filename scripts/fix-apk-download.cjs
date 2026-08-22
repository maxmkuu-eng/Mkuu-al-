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
      const { Filesystem, Directory } = await import('@capacitor/filesystem');

      // Prefer Capacitor's native download for real HTTP/HTTPS files. This avoids
      // loading the whole file into a WebView/base64 buffer and prevents Android
      // from exiting on large generated images/PDFs.
      if (file.downloadUrl && !file.downloadUrl.startsWith('data:') && !file.downloadUrl.startsWith('blob:')) {
        const fullUrl = getApiUrl(file.downloadUrl);
        await Filesystem.downloadFile({
          url: fullUrl,
          path: filename,
          directory: Directory.Documents,
        });
        console.log('[MKUU] Android native download saved:', filename);
        return;
      }

      // Generated/local files may only exist as data. Keep this path small and
      // avoid recursive/nested native paths that can terminate some Android WebViews.
      let dataUrl: string | null = null;
      if (file.base64Data?.startsWith('data:')) dataUrl = file.base64Data;
      else if (file.downloadUrl?.startsWith('data:')) dataUrl = file.downloadUrl;
      else {
        const localFile = await localChatStorage.getFileData(file.filename);
        if (localFile?.data?.startsWith('data:')) dataUrl = localFile.data;
      }

      if (!dataUrl && file.content) {
        dataUrl = await blobToBase64(new Blob([file.content], {
          type: file.mimeType || 'application/octet-stream',
        }));
      }

      if (!dataUrl?.startsWith('data:')) {
        throw new Error('Faili halikupatikana kwa ajili ya kupakua.');
      }

      const comma = dataUrl.indexOf(',');
      if (comma < 0) throw new Error('Muundo wa faili si sahihi.');
      await Filesystem.writeFile({
        path: filename,
        data: dataUrl.slice(comma + 1),
        directory: Directory.Documents,
      });
      console.log('[MKUU] Android local download saved:', filename);
      return;
    }

    // Preserve the existing browser download behaviour.
    let sourceUrl: string | null = null;
    let objectUrl: string | null = null;

    if (file.base64Data?.startsWith('data:')) {
      sourceUrl = file.base64Data;
    } else if (file.downloadUrl?.startsWith('data:') || file.downloadUrl?.startsWith('blob:')) {
      sourceUrl = file.downloadUrl;
    } else {
      const localFile = await localChatStorage.getFileData(file.filename);
      if (localFile?.data?.startsWith('data:')) sourceUrl = localFile.data;
    }

    if (!sourceUrl && file.downloadUrl) {
      const fullUrl = getApiUrl(file.downloadUrl);
      try {
        const response = await fetch(fullUrl);
        if (response.ok) {
          objectUrl = URL.createObjectURL(await response.blob());
          sourceUrl = objectUrl;
        }
      } catch (error) {
        console.warn('[MKUU] Browser download fetch failed:', error);
      }
      if (!sourceUrl) sourceUrl = fullUrl;
    }

    if (!sourceUrl && file.content) {
      objectUrl = URL.createObjectURL(new Blob([file.content], {
        type: file.mimeType || 'text/plain;charset=utf-8',
      }));
      sourceUrl = objectUrl;
    }

    if (!sourceUrl) throw new Error('Faili halikupatikana kwa ajili ya kupakua.');

    const link = document.createElement('a');
    link.href = sourceUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    }, 2000);
  } catch (error) {
    console.error('[MKUU] Download failed:', error);
  }
}
`;

source = source.slice(0, start) + replacement;
fs.writeFileSync(filePath, source);
console.log('MKUU: APK Download now prefers native Filesystem.downloadFile for remote files; web download unchanged.');
