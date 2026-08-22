const fs = require('fs');
const path = require('path');

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const write = (p, s) => fs.writeFileSync(path.join(root, p), s);

// Image download: keep web behaviour, but use Capacitor Filesystem + Share on Android.
{
  const file = 'src/services/clientFileGenerator.ts';
  let s = read(file);

  if (!s.includes("async function resolveFileDataUrlForNative")) {
    const marker = 'export async function downloadFileHelper(file: {';
    if (!s.includes(marker)) throw new Error('MKUU: downloadFileHelper marker not found.');

    const nativeBlock = String.raw`
async function resolveFileDataUrlForNative(file: {
  filename: string;
  downloadUrl?: string;
  base64Data?: string;
  content?: string;
  mimeType?: string;
}): Promise<string | null> {
  if (file.base64Data?.startsWith('data:')) return file.base64Data;
  if (file.downloadUrl?.startsWith('data:')) return file.downloadUrl;

  const localFile = await localChatStorage.getFileData(file.filename);
  if (localFile?.data?.startsWith('data:')) return localFile.data;

  if (file.downloadUrl) {
    try {
      const fullUrl = getApiUrl(file.downloadUrl);
      const res = await fetch(fullUrl);
      if (res.ok) return await blobToBase64(await res.blob());
    } catch (error) {
      console.warn('[MKUU] Native image fetch failed:', error);
    }
  }

  if (file.content) {
    return await blobToBase64(new Blob([file.content], { type: file.mimeType || 'text/plain;charset=utf-8' }));
  }
  return null;
}

async function saveImageToAndroidGallery(file: {
  filename: string;
  downloadUrl?: string;
  base64Data?: string;
  content?: string;
  mimeType?: string;
}): Promise<string> {
  const dataUrl = await resolveFileDataUrlForNative(file);
  if (!dataUrl?.startsWith('data:')) throw new Error('Picha haikupatikana kwa ajili ya kuhifadhi.');

  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('Muundo wa picha si sahihi.');
  const base64 = dataUrl.slice(comma + 1);
  const safeName = sanitizeFilename(file.filename || 'mkuu_image') || ('mkuu_image_' + Date.now() + '.png');
  const mimeType = file.mimeType || dataUrl.slice(5, comma).split(';')[0] || 'image/png';
  const extension = safeName.includes('.') ? safeName.split('.').pop() : (mimeType.split('/')[1] || 'png');
  const filename = safeName.includes('.') ? safeName : safeName + '.' + extension;

  const { Filesystem, Directory } = await import('@capacitor/filesystem');
  const result = await Filesystem.writeFile({
    path: `MKUU AI/${filename}`,
    data: base64,
    directory: Directory.Pictures,
    recursive: true,
  });
  return result.uri;
}

export async function shareFileHelper(file: {
  filename: string;
  downloadUrl?: string;
  base64Data?: string;
  content?: string;
  mimeType?: string;
  fileType?: string;
}): Promise<void> {
  if (typeof window === 'undefined') return;
  const isImage = Boolean(file.mimeType?.startsWith('image/')) || ['png','jpg','jpeg','webp','gif','svg'].includes((file.fileType || '').toLowerCase());
  if (!isImage) return;

  try {
    const isNative = Boolean((window as any).Capacitor?.isNativePlatform?.());
    if (isNative) {
      const uri = await saveImageToAndroidGallery(file);
      const { Share } = await import('@capacitor/share');
      await Share.share({ title: 'MKUU AI', text: file.filename, url: uri, dialogTitle: 'Shiriki picha ya MKUU AI' });
      return;
    }

    const dataUrl = await resolveFileDataUrlForNative(file);
    if (!dataUrl) return;
    if (navigator.share) {
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const sharedFile = new File([blob], file.filename, { type: file.mimeType || blob.type || 'image/png' });
      if (!navigator.canShare || navigator.canShare({ files: [sharedFile] })) {
        await navigator.share({ title: 'MKUU AI', files: [sharedFile] });
        return;
      }
    }
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => document.body.removeChild(link), 1000);
  } catch (error) {
    console.error('[MKUU] Image share failed:', error);
  }
}
`;
    s = s.replace(marker, nativeBlock + '\n' + marker);
  }

  const nativeMarker = '  try {\n    // 1. If base64 data is present';
  if (!s.includes('const isNativeImage = isNativePlatform && isImageFile;')) {
    const injected = String.raw`  try {
    const isNativePlatform = Boolean((window as any).Capacitor?.isNativePlatform?.());
    const isImageFile = Boolean(file.mimeType?.startsWith('image/')) || ['png','jpg','jpeg','webp','gif','svg'].includes((file.fileType || '').toLowerCase());
    const isNativeImage = isNativePlatform && isImageFile;
    if (isNativeImage) {
      await saveImageToAndroidGallery(file);
      return;
    }

    // 1. If base64 data is present`;
    if (!s.includes(nativeMarker)) throw new Error('MKUU: download helper body marker not found.');
    s = s.replace(nativeMarker, injected);
  }

  write(file, s);
}

// Chat UI: add a dedicated Share button for generated images only.
{
  const file = 'src/components/ChatView.tsx';
  let s = read(file);
  s = s.replace(
    '  Send, Mic, Crown, Brain, Users, Download, FileText, FileSpreadsheet, FileCode,',
    '  Send, Share2, Mic, Crown, Brain, Users, Download, FileText, FileSpreadsheet, FileCode,'
  );
  s = s.replace(
    "import { downloadFileHelper } from '../services/clientFileGenerator';",
    "import { downloadFileHelper, shareFileHelper } from '../services/clientFileGenerator';"
  );

  const downloadMarker = '<button id={`download-file-${file.id}`}';
  if (!s.includes('share-file-${file.id}')) {
    const start = s.indexOf(downloadMarker);
    if (start < 0) throw new Error('MKUU: image download button marker not found.');
    const shareButton = `<button id={\`share-file-\${file.id}\`} onClick={() => shareFileHelper(file)} className="px-2.5 py-1.5 rounded-lg glass hover:bg-white/10 text-xs font-semibold text-[#CCCCCC] hover:text-white flex items-center space-x-1 border border-[#333333] transition cursor-pointer" title="Shiriki Picha">{<Share2 className="w-3.5 h-3.5 text-[#D4AF37]" />}<span>SHIRIKI</span></button>`;
    s = s.slice(0, start) + `{isImage && ${shareButton}}` + s.slice(start);
  }
  write(file, s);
}

console.log('MKUU: PixelAPI image download now saves to Android Gallery; image Share uses native Share Sheet. Web download/share remains intact.');
