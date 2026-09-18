import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  FolderDown,
  Download,
  Clock,
  RefreshCw,
  X,
  HardDrive,
  CheckCircle2,
  Film,
  Trash2,
  Play,
  Copy,
  Check,
  Calendar,
  ExternalLink,
  ShieldCheck,
  Zap,
  Wand2
} from 'lucide-react';

export default function TempFilesModal({
  isOpen,
  onClose,
  onPlayVideo,
  onOpenEditor,
  onFilesChange,
  onOpenStorageDashboard
}) {
  const [files, setFiles] = useState([]);
  const [storageStats, setStorageStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [deletingFilename, setDeletingFilename] = useState(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const [listRes, storageRes] = await Promise.all([
        axios.get('/api/downloads/list'),
        axios.get('/api/storage/stats').catch(() => ({ data: { success: false } }))
      ]);

      if (listRes.data.success) {
        setFiles(listRes.data.data || []);
        if (onFilesChange) onFilesChange(listRes.data.data?.length || 0);
      }
      if (storageRes.data?.success) {
        setStorageStats(storageRes.data.data);
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách tệp tạm:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchFiles();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleDeleteFile = async (filename) => {
    if (deletingFilename) return;
    setDeletingFilename(filename);
    try {
      await axios.delete(`/api/download/file/${encodeURIComponent(filename)}`);
      setFiles((prev) => prev.filter((f) => f.filename !== filename));
      if (onFilesChange) onFilesChange(files.length - 1);
    } catch (err) {
      console.error('Lỗi khi xóa tệp tạm:', err);
      alert('Không thể xóa tệp này: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeletingFilename(null);
    }
  };

  const handleClearAll = async () => {
    setIsClearingAll(true);
    try {
      await axios.post('/api/downloads/delete-all');
      await fetchFiles();
      setConfirmClearAll(false);
    } catch (err) {
      console.error('Lỗi khi xóa tất cả tệp tạm:', err);
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const totalTempBytes = files.reduce((acc, f) => acc + (f.sizeBytes || 0), 0);
  const formatBytes = (bytes) => {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / Math.pow(k, i);
    return `${val < 10 && i > 1 ? val.toFixed(2) : val.toFixed(1)} ${sizes[i]}`;
  };

  return (
    <div
      id="temp-files-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <FolderDown className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base">Thư Mục Video Tạm Thời</h3>
                <span className="text-xs font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
                  {files.length} tệp
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Các video tải về lưu tạm tối đa <strong className="text-amber-400">5 tiếng</strong>. Bạn có thể xóa chủ động bất kỳ lúc nào.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {files.length > 0 && (
              <div>
                {!confirmClearAll ? (
                  <button
                    id="temp-modal-clear-all-btn"
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                    title="Xóa tất cả video tạm thời"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Xóa tất cả</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleClearAll}
                      disabled={isClearingAll}
                      className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold whitespace-nowrap shadow"
                    >
                      {isClearingAll ? 'Đang xóa...' : 'Chắc chắn xóa?'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="px-2 py-1.5 bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              onClick={fetchFiles}
              disabled={isLoading}
              title="Làm mới"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Storage Monitor Indicator Banner */}
        <div className="bg-slate-950/80 border-b border-slate-800 p-3 sm:px-5 sm:py-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-semibold text-white">Dung Lượng Thư Mục Tạm:</span>
              <span className="text-xs font-bold font-mono text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {formatBytes(totalTempBytes)}
              </span>
              <span className="text-[11px] text-slate-400 hidden sm:inline">({files.length} tệp)</span>
            </div>

            <div className="flex items-center gap-2">
              {storageStats?.system && (
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>Trống khả dụng:</span>
                  <span className="text-emerald-400 font-mono font-medium">
                    {storageStats.system.formattedFree}
                  </span>
                </div>
              )}
              {onOpenStorageDashboard && (
                <button
                  id="temp-modal-open-dashboard-btn"
                  type="button"
                  onClick={onOpenStorageDashboard}
                  className="px-2 py-1 bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3 h-3" />
                  <span>Bảng Giám Sát</span>
                </button>
              )}
            </div>
          </div>

          {/* Visual Indicator Progress Bar */}
          {storageStats?.system && (
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex border border-slate-700/60">
              <div
                style={{
                  width: `${Math.max(0.5, ((totalTempBytes || 0) / (storageStats.system.totalBytes || 1)) * 100)}%`
                }}
                className="bg-amber-500 h-full"
                title={`Thư mục tạm: ${formatBytes(totalTempBytes)}`}
              />
              <div
                style={{
                  width: `${Math.max(0, storageStats.system.usedPercentage - (((totalTempBytes || 0) / (storageStats.system.totalBytes || 1)) * 100))}%`
                }}
                className="bg-slate-600 h-full"
                title="Dung lượng đã dùng khác"
              />
              <div
                style={{
                  width: `${Math.max(0, storageStats.system.freePercentage)}%`
                }}
                className="bg-emerald-500/80 h-full"
                title={`Dung lượng khả dụng: ${storageStats.system.formattedFree}`}
              />
            </div>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {files.length === 0 ? (
            <div className="py-14 text-center text-slate-500 flex flex-col items-center">
              <HardDrive className="w-12 h-12 mb-3 text-slate-600" />
              <p className="font-medium text-slate-400">Chưa có video nào trong thư mục tạm</p>
              <p className="text-xs mt-1">Khi bạn tải video từ danh sách hoặc từ link, video sẽ xuất hiện ở đây trong 5 tiếng.</p>
            </div>
          ) : (
            files.map((file) => {
              const bvid = file.bvid || file.id;

              return (
                <div
                  key={file.filename}
                  id={`temp-file-${file.filename}`}
                  className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 hover:border-slate-600 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Thumbnail or Film icon */}
                    {file.cover ? (
                      <div
                        onClick={() => onPlayVideo && onPlayVideo(file)}
                        className="relative w-24 aspect-video rounded-lg overflow-hidden bg-slate-950 flex-shrink-0 cursor-pointer group"
                      >
                        <img
                          src={file.cover}
                          alt={file.title_vi || file.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          referrerPolicy="no-referrer"
                        />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Play className="w-3.5 h-3.5 fill-white text-white" />
                        </div>
                      </div>
                    ) : (
                      <div className="p-2.5 bg-slate-700/50 text-amber-400 rounded-lg flex-shrink-0 mt-0.5">
                        <Film className="w-4 h-4" />
                      </div>
                    )}

                    <div className="min-w-0">
                      {/* Video Title */}
                      <p
                        className="font-medium text-sm text-slate-200 truncate cursor-pointer hover:text-sky-400"
                        title={file.title_vi || file.title || file.filename}
                        onClick={() => onPlayVideo && onPlayVideo(file)}
                      >
                        {file.title_vi || file.title || file.filename}
                      </p>

                      {/* Video Code & Meta */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
                        {bvid && (
                          <div className="flex items-center gap-1 bg-slate-900 border border-slate-700/60 px-1.5 py-0.2 rounded font-mono text-[11px] text-sky-400">
                            <span>Mã: {bvid}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(bvid, file.filename)}
                              title="Sao chép mã video"
                              className="text-slate-400 hover:text-white"
                            >
                              {copiedId === file.filename ? (
                                <Check className="w-2.5 h-2.5 text-emerald-400" />
                              ) : (
                                <Copy className="w-2.5 h-2.5" />
                              )}
                            </button>
                          </div>
                        )}

                        <span className="font-mono text-emerald-400 font-medium">{file.formattedSize}</span>

                        {file.createdAt && (
                          <span className="hidden md:inline text-slate-400">
                            • Tải: {formatDateTime(file.createdAt)}
                          </span>
                        )}

                        <span>•</span>
                        <span className="flex items-center gap-1 text-amber-300">
                          <Clock className="w-3 h-3" />
                          Còn lại ~{file.remainingHours}h
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: Edit, Play, Download, Delete */}
                  <div className="flex items-center gap-2 flex-shrink-0 self-end sm:self-center">
                    {onOpenEditor && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenEditor(file);
                        }}
                        className="px-2.5 py-1.5 bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/40 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all shadow-sm"
                        title="Chỉnh sửa Vietsub & lồng tiếng AI"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                        <span>Chỉnh sửa</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => onPlayVideo && onPlayVideo(file)}
                      className="px-2.5 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1 transition-colors"
                      title="Xem trước video"
                    >
                      <Play className="w-3 h-3" />
                      <span className="hidden sm:inline">Xem</span>
                    </button>

                    <a
                      href={file.downloadUrl}
                      download={file.filename}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow"
                      title="Tải video về máy tính"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Tải về
                    </a>

                    {/* NÚT XÓA VIDEO Ở THƯ MỤC TẠM THỜI */}
                    <button
                      id={`delete-temp-btn-${file.filename}`}
                      type="button"
                      onClick={() => handleDeleteFile(file.filename)}
                      disabled={deletingFilename === file.filename}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-transparent hover:border-rose-500/30"
                      title="Xóa video này khỏi thư mục tạm"
                    >
                      <Trash2 className={`w-4 h-4 ${deletingFilename === file.filename ? 'animate-pulse text-rose-500' : ''}`} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Đầy đủ hình ảnh (1080p/720p H.264) & âm thanh (AAC stereo)</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
