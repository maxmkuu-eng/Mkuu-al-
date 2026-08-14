import React, { useState, useRef } from 'react';
import {
  FolderDown,
  FileText,
  FileSpreadsheet,
  FileCode,
  File,
  Download,
  Trash2,
  Plus,
  Search,
  UploadCloud,
  CheckCircle2,
  Eye,
  AlertCircle,
  MessageSquare,
  Image as ImageIcon,
} from 'lucide-react';
import { GeneratedFileSummary } from '../types';

interface FilesCenterProps {
  files: GeneratedFileSummary[];
  onDeleteFile: (id: string) => Promise<void>;
  onOpenFileGenerator: () => void;
  onAskChatAboutFile: (filename: string) => void;
  onPreviewDocument: (file: GeneratedFileSummary) => void;
  onFileUploadSuccess?: (file: GeneratedFileSummary) => void;
}

export const FilesCenter: React.FC<FilesCenterProps> = ({
  files,
  onDeleteFile,
  onOpenFileGenerator,
  onAskChatAboutFile,
  onPreviewDocument,
  onFileUploadSuccess,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('All');
  const [uploadedNotification, setUploadedNotification] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fileTypes = ['All', 'pdf', 'xlsx', 'docx', 'csv', 'json', 'txt', 'png'];

  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.filename.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = selectedType === 'All' || f.fileType === selectedType;
    return matchesSearch && matchesType;
  });

  const totalSize = files.reduce((acc, f) => acc + (f.size || 0), 0);

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
      case 'png':
      case 'jpg':
      case 'jpeg':
        return <ImageIcon className="w-5 h-5 text-purple-400" />;
      default:
        return <File className="w-5 h-5 text-[#888888]" />;
    }
  };

  const handleRealFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || !fileList[0]) return;

    const file = fileList[0];
    const maxSizeBytes = 25 * 1024 * 1024; // 25MB

    if (file.size > maxSizeBytes) {
      setErrorMessage(`Faili limezidi uwezo (Max 25MB). Faili hili lina ${(file.size / (1024 * 1024)).toFixed(1)}MB.`);
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        const ext = file.name.split('.').pop()?.toLowerCase() || 'txt';

        const res = await fetch('/api/files/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            fileType: ext,
            mimeType: file.type || 'application/octet-stream',
            base64Data,
            description: `Faili lililopakiwa na Max (${(file.size / 1024).toFixed(1)} KB)`,
          }),
        });

        if (!res.ok) {
          throw new Error('Haikuweza kuhifadhi faili kwenye seva.');
        }

        const newFileRecord: GeneratedFileSummary = await res.json();
        setUploadedNotification(`Faili "${file.name}" limehifadhiwa kikamilifu kwenye hifadhi ya Max!`);
        if (onFileUploadSuccess) {
          onFileUploadSuccess(newFileRecord);
        }
        setTimeout(() => setUploadedNotification(null), 5000);
      } catch (err: any) {
        setErrorMessage(err.message || 'Hitilafu ya kupakia faili.');
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) {
          fileInputRef.current.value = '';
        }
      }
    };

    reader.onerror = () => {
      setIsUploading(false);
      setErrorMessage('Hitilafu ya kusoma faili kwenye kifaa chako.');
    };

    reader.readAsDataURL(file);
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-[#080808] space-y-6 text-[#F5F2ED]">
      {/* Header Banner */}
      <div className="glass p-6 sm:p-8 rounded-3xl border border-[#222222] relative overflow-hidden shadow-2xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#D4AF37]/10 border border-[#D4AF37]/30 text-[#D4AF37] text-[10px] uppercase font-bold tracking-[0.2em]">
              <FolderDown className="w-3.5 h-3.5" />
              <span>FAILI ZANGU • REAL BINARY FILE VAULT</span>
            </div>
            <h2 className="serif text-xl sm:text-3xl font-bold text-[#F5F2ED] tracking-wide">
              Hifadhi ya Mafaili Halisi ya Max
            </h2>
            <p className="text-xs sm:text-sm text-[#888888] max-w-2xl leading-relaxed">
              Mafaili yote (PDF, Excel, Word, CSV, Picha) yanayotengenezwa au kupakiwa na Max yanahifadhiwa kiotomatiki,
              yakiwa na uwezo wa kusomwa moja kwa moja (In-App Preview) na kupakuliwa mara moja.
            </p>
          </div>

          <button
            id="create-file-top-btn"
            onClick={onOpenFileGenerator}
            className="px-5 py-3 rounded-xl bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-lg transition flex-shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>TENGENEZA FAILI JIPYA</span>
          </button>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="glass p-4 rounded-2xl border border-[#222222]">
          <div className="text-[10px] uppercase tracking-wider text-[#888888]">Jumla ya Mafaili</div>
          <div className="serif text-2xl font-bold text-[#F5F2ED] mt-1">{files.length}</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-[#222222]">
          <div className="text-[10px] uppercase tracking-wider text-[#888888]">Ukubwa wa Hifadhi</div>
          <div className="serif text-2xl font-bold text-[#D4AF37] mt-1">
            {(totalSize / 1024).toFixed(1)} KB
          </div>
        </div>
        <div className="glass p-4 rounded-2xl border border-[#222222]">
          <div className="text-[10px] uppercase tracking-wider text-[#888888]">Muundo wa Binary</div>
          <div className="serif text-2xl font-bold text-emerald-400 mt-1">100% Halisi</div>
        </div>
        <div className="glass p-4 rounded-2xl border border-[#222222]">
          <div className="text-[10px] uppercase tracking-wider text-[#888888]">Upatikanaji</div>
          <div className="serif text-2xl font-bold text-[#D4AF37] mt-1">Moja kwa Moja</div>
        </div>
      </div>

      {/* Upload Drag & Drop Section */}
      <div
        onClick={() => fileInputRef.current?.click()}
        className={`glass p-6 rounded-2xl border border-dashed text-center relative transition cursor-pointer ${
          isUploading
            ? 'border-[#D4AF37] bg-[#D4AF37]/5'
            : 'border-[#333333] hover:border-[#D4AF37]/50'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          id="file-vault-upload-input"
          onChange={handleRealFileUpload}
          className="hidden"
          accept=".pdf,.docx,.xlsx,.csv,.txt,.json,.md,.png,.jpg,.jpeg"
        />
        <div className="flex flex-col items-center justify-center space-y-2 pointer-events-none">
          <div className="p-3 rounded-2xl bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30">
            <UploadCloud className={`w-6 h-6 ${isUploading ? 'animate-bounce' : ''}`} />
          </div>
          <div>
            <div className="serif font-bold text-sm text-[#F5F2ED]">
              {isUploading ? 'Inapakia na kuhifadhi faili...' : 'Pakia Nyaraka au Picha Mpya Kwenye Vault ya Max'}
            </div>
            <div className="text-[11px] text-[#888888] mt-0.5">
              Gusa hapa kuchagua faili kutoka kifaa chako (PDF, Word, Excel, CSV, Picha, TXT, JSON)
            </div>
          </div>
        </div>
      </div>

      {uploadedNotification && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
          <span>{uploadedNotification}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-950/60 border border-red-500/40 text-red-300 text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#888888] absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            id="files-search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tafuta faili kwa jina..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[#050505] border border-[#222222] text-[#F5F2ED] placeholder-[#888888] text-xs focus:outline-none focus:border-[#D4AF37]"
          />
        </div>

        <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
          {fileTypes.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedType(t)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap uppercase transition cursor-pointer ${
                selectedType === t
                  ? 'bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/40'
                  : 'glass text-[#888888] border border-[#222222] hover:text-[#F5F2ED]'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Files Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFiles.length === 0 ? (
          <div className="col-span-full py-12 text-center text-[#888888]">
            <FolderDown className="w-12 h-12 mx-auto mb-2 opacity-30 text-[#D4AF37]" />
            <p className="text-sm font-semibold text-[#F5F2ED]">Hakuna faili lililopatikana.</p>
            <p className="text-xs text-[#888888] mt-1">
              Gusa 'Tengeneza Faili Jipya' au pakia faili kutoka kwenye kifaa chako.
            </p>
          </div>
        ) : (
          filteredFiles.map((file) => (
            <div
              key={file.id}
              className="3d-card glass p-5 rounded-2xl border border-[#222222] hover:border-[#D4AF37]/40 transition-all flex flex-col justify-between space-y-4 shadow-xl"
            >
              <div className="space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center space-x-3 overflow-hidden">
                    <div className="p-2.5 rounded-xl bg-[#050505] border border-[#222222] flex-shrink-0">
                      {getFileIcon(file.fileType)}
                    </div>
                    <div className="truncate">
                      <h4 className="font-bold text-[#F5F2ED] text-xs sm:text-sm truncate" title={file.filename}>
                        {file.filename}
                      </h4>
                      <div className="text-[10px] text-[#888888] font-mono">
                        {(file.size / 1024).toFixed(1)} KB • {file.fileType.toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <span className="text-[9px] px-2 py-0.5 rounded font-bold uppercase bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/30 flex-shrink-0">
                    REAL FILE
                  </span>
                </div>

                {file.description && (
                  <p className="text-xs text-[#888888] line-clamp-2 italic">
                    "{file.description}"
                  </p>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="pt-2.5 border-t border-[#222222] flex items-center justify-between gap-2">
                <button
                  id={`vault-chat-btn-${file.id}`}
                  onClick={() => onAskChatAboutFile(file.filename)}
                  className="text-xs text-[#D4AF37] hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>Chambua</span>
                </button>

                <div className="flex items-center space-x-1.5">
                  <button
                    id={`vault-preview-btn-${file.id}`}
                    onClick={() => onPreviewDocument(file)}
                    className="p-1.5 rounded-lg text-[#CCCCCC] hover:text-[#D4AF37] hover:bg-white/5 border border-[#333333] transition cursor-pointer"
                    title="Tazama / Soma Faili"
                  >
                    <Eye className="w-3.5 h-3.5" />
                  </button>

                  <button
                    id={`vault-delete-btn-${file.id}`}
                    onClick={async () => {
                      if (confirm(`Je, unataka kufuta faili "${file.filename}"?`)) {
                        await onDeleteFile(file.id);
                      }
                    }}
                    className="p-1.5 rounded-lg text-[#888888] hover:text-red-400 hover:bg-red-500/10 transition cursor-pointer"
                    title="Futa Faili"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  <a
                    id={`vault-download-file-${file.id}`}
                    href={file.downloadUrl}
                    download={file.filename}
                    className="px-3 py-1.5 rounded-lg bg-[#D4AF37] hover:bg-[#c59f2e] text-black font-bold text-xs uppercase tracking-wider flex items-center space-x-1.5 shadow-md transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>PAKUA</span>
                  </a>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
export default FilesCenter;
