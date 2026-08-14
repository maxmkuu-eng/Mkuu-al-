import React, { useState, useEffect } from 'react';
import {
  X,
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  Download,
  Trash2,
  Eye,
  ExternalLink,
  Copy,
  Check,
  ZoomIn,
  ZoomOut,
  RotateCw,
  Share2,
} from 'lucide-react';
import { GeneratedFileSummary } from '../types';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: GeneratedFileSummary | null;
  onDelete?: (id: string) => Promise<void>;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  file,
  onDelete,
}) => {
  const [textContent, setTextContent] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [zoomLevel, setZoomLevel] = useState<number>(100);

  useEffect(() => {
    if (!isOpen || !file) {
      setTextContent('');
      setError(null);
      return;
    }

    setZoomLevel(100);
    const isTextual = ['txt', 'json', 'csv', 'md'].includes(file.fileType);

    if (isTextual) {
      setLoading(true);
      setError(null);
      fetch(file.downloadUrl)
        .then((res) => {
          if (!res.ok) throw new Error('Haikuweza kupakia maudhui ya faili');
          return res.text();
        })
        .then((text) => {
          setTextContent(text);
          setLoading(false);
        })
        .catch((err) => {
          setError(err.message || 'Hitilafu ya kusoma faili');
          setLoading(false);
        });
    }
  }, [isOpen, file]);

  if (!isOpen || !file) return null;

  const handleCopyContent = () => {
    if (!textContent) return;
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'pdf':
        return <FileText className="w-5 h-5 text-red-400" />;
      case 'xlsx':
      case 'csv':
        return <FileSpreadsheet className="w-5 h-5 text-emerald-400" />;
      case 'docx':
        return <FileText className="w-5 h-5 text-blue-400" />;
      case 'json':
        return <FileCode className="w-5 h-5 text-[#D4AF37]" />;
      default:
        return <File className="w-5 h-5 text-[#888888]" />;
    }
  };

  const renderViewer = () => {
    if (loading) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-[#888888] space-y-3">
          <div className="w-8 h-8 border-2 border-[#D4AF37] border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold">Inasoma maudhui ya {file.filename}...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="p-6 text-center text-red-400 space-y-2">
          <p className="text-sm font-bold">Hitilafu ya Kusoma Faili</p>
          <p className="text-xs text-[#888888]">{error}</p>
        </div>
      );
    }

    // PDF Preview
    if (file.fileType === 'pdf') {
      return (
        <div className="w-full h-[65vh] flex flex-col bg-[#111111] rounded-2xl overflow-hidden border border-[#222222]">
          <div className="p-2 bg-[#1a1a1a] border-b border-[#2a2a2a] flex items-center justify-between px-4 text-xs text-[#888888]">
            <span>PDF In-App Reader (Muundo Halisi wa PDF)</span>
            <a
              href={file.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#D4AF37] hover:underline flex items-center gap-1 font-semibold"
            >
              <span>Fungua Kwenye Tab Mpya</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
          <iframe
            src={`${file.downloadUrl}#toolbar=1&navpanes=0`}
            title={file.filename}
            className="w-full h-full border-0 bg-[#222222]"
          />
        </div>
      );
    }

    // Image Preview
    if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(file.fileType)) {
      return (
        <div className="flex flex-col items-center justify-center p-4 bg-[#0a0a0a] rounded-2xl border border-[#222222] min-h-[300px] overflow-auto">
          <img
            src={file.downloadUrl}
            alt={file.filename}
            style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
            className="max-h-[60vh] max-w-full object-contain rounded-lg transition-transform duration-150"
          />
        </div>
      );
    }

    // Textual: JSON / CSV / TXT / MD
    if (['txt', 'json', 'csv', 'md'].includes(file.fileType)) {
      return (
        <div className="relative bg-[#050505] p-4 sm:p-6 rounded-2xl border border-[#222222] max-h-[60vh] overflow-y-auto font-mono text-xs sm:text-sm text-[#F5F2ED] leading-relaxed">
          <div className="absolute top-3 right-3 flex items-center space-x-2">
            <button
              onClick={handleCopyContent}
              className="p-2 rounded-lg bg-[#1a1a1a] hover:bg-[#2a2a2a] text-[#888888] hover:text-[#F5F2ED] border border-[#333333] transition cursor-pointer"
              title="Nakili Maudhui"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <pre className="whitespace-pre-wrap break-words font-mono select-text">
            {textContent || 'Faili ni tupu au halina maandishi.'}
          </pre>
        </div>
      );
    }

    // Word (DOCX) or Excel (XLSX)
    return (
      <div className="p-8 sm:p-12 text-center bg-[#0a0a0a] rounded-2xl border border-[#222222] space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-[#151515] border border-[#262626] flex items-center justify-center mx-auto shadow-xl">
          {getFileIcon(file.fileType)}
        </div>
        <div className="space-y-1">
          <h4 className="serif font-bold text-base sm:text-lg text-[#F5F2ED]">{file.filename}</h4>
          <p className="text-xs text-[#888888]">
            Muundo wa {file.fileType.toUpperCase()} ({ (file.size / 1024).toFixed(1) } KB)
          </p>
          <p className="text-xs text-[#666666] max-w-md mx-auto pt-2">
            Faili hili limetengenezwa kwa binary halisi ya {file.fileType.toUpperCase()}. Unaweza kulipakua mara moja au kulifungua kwenye Microsoft Office, Google Docs, au programu nyingine kwenye kifaa chako.
          </p>
        </div>

        <div className="pt-2 flex justify-center">
          <a
            id="modal-doc-download-action"
            href={file.downloadUrl}
            download={file.filename}
            className="px-6 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg transition cursor-pointer"
          >
            <Download className="w-4 h-4 stroke-[2.5]" />
            <span>PAKUA FAILI SASA ({ (file.size / 1024).toFixed(1) } KB)</span>
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in text-[#F5F2ED]">
      <div className="relative w-full max-w-3xl bg-[#0d0d0d] border border-[#262626] rounded-3xl p-5 sm:p-7 shadow-2xl overflow-hidden flex flex-col space-y-4 max-h-[92vh]">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-[#202020] pb-3.5">
          <div className="flex items-center space-x-3 overflow-hidden">
            <div className="p-2.5 rounded-xl bg-[#141414] border border-[#242424] flex-shrink-0">
              {getFileIcon(file.fileType)}
            </div>
            <div className="truncate">
              <div className="flex items-center space-x-2">
                <h3 className="font-bold text-white text-sm sm:text-base truncate" title={file.filename}>
                  {file.filename}
                </h3>
                <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 flex-shrink-0">
                  {file.fileType.toUpperCase()}
                </span>
              </div>
              <p className="text-[11px] text-[#888888] font-mono">
                {(file.size / 1024).toFixed(1)} KB • Imehifadhiwa {new Date(file.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            {['png', 'jpg', 'jpeg'].includes(file.fileType) && (
              <div className="flex items-center space-x-1 glass p-1 rounded-xl border border-[#222222] mr-1">
                <button
                  onClick={() => setZoomLevel((z) => Math.max(50, z - 20))}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-[#888888] hover:text-[#F5F2ED]"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[10px] text-[#888888] px-1 font-mono">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel((z) => Math.min(200, z + 20))}
                  className="p-1.5 rounded-lg hover:bg-white/5 text-[#888888] hover:text-[#F5F2ED]"
                  title="Zoom In"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button
              id="close-doc-preview-modal"
              onClick={onClose}
              className="p-2 rounded-xl glass text-[#888888] hover:text-[#F5F2ED] border-[#222222] hover:bg-white/5 transition cursor-pointer"
              title="Funga"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Viewer Content */}
        <div className="flex-1 overflow-y-auto py-1">
          {renderViewer()}
        </div>

        {/* Bottom Actions Bar */}
        <div className="flex items-center justify-between border-t border-[#202020] pt-3">
          <div>
            {onDelete && (
              <button
                id="doc-preview-delete-btn"
                onClick={async () => {
                  if (confirm(`Je, una uhakika unataka kufuta faili "${file.filename}" kabisa?`)) {
                    await onDelete(file.id);
                    onClose();
                  }
                }}
                className="px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 border border-red-500/20 text-xs font-bold flex items-center space-x-1.5 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Futa Faili</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <a
              id="doc-preview-download-btn"
              href={file.downloadUrl}
              download={file.filename}
              className="px-5 py-2 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center space-x-2 shadow-lg transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>PAKUA FAILI ({ (file.size / 1024).toFixed(1) } KB)</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreviewModal;
