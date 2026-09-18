import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  HardDrive,
  FolderDown,
  UploadCloud,
  Database,
  RefreshCw,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Trash2,
  Sliders,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Server,
  Zap
} from 'lucide-react';

export default function StorageMonitorDashboard({
  isOpen,
  onClose,
  onOpenTempFiles,
  onStorageChange
}) {
  const [stats, setStats] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCleaningExpired, setIsCleaningExpired] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [statusMessage, setStatusMessage] = useState(null);

  const fetchStorageStats = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get('/api/storage/stats');
      if (res.data.success) {
        setStats(res.data.data);
        if (onStorageChange) {
          onStorageChange(res.data.data);
        }
      }
    } catch (err) {
      console.error('Lỗi khi lấy dữ liệu giám sát bộ nhớ:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStorageStats();
      setConfirmClearAll(false);
      setStatusMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Cleanup expired files
  const handleCleanExpired = async () => {
    setIsCleaningExpired(true);
    setStatusMessage(null);
    try {
      const res = await axios.post('/api/storage/cleanup-expired');
      if (res.data.success) {
        setStats(res.data.data);
        setStatusMessage({
          type: 'success',
          text: 'Đã dọn dẹp các tệp tạm thời hết hạn (> 5 tiếng) thành công!'
        });
        if (onStorageChange) onStorageChange(res.data.data);
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: 'Lỗi khi dọn tệp hết hạn: ' + (err.response?.data?.error || err.message)
      });
    } finally {
      setIsCleaningExpired(false);
    }
  };

  // Clear all temporary files
  const handleClearAllTemp = async () => {
    setIsClearingAll(true);
    setStatusMessage(null);
    try {
      const res = await axios.post('/api/downloads/delete-all');
      if (res.data.success) {
        setStatusMessage({
          type: 'success',
          text: `Đã xóa toàn bộ ${res.data.count} tệp tạm thời và giải phóng dung lượng!`
        });
        setConfirmClearAll(false);
        await fetchStorageStats();
      }
    } catch (err) {
      setStatusMessage({
        type: 'error',
        text: 'Lỗi khi xóa tệp tạm: ' + (err.response?.data?.error || err.message)
      });
    } finally {
      setIsClearingAll(false);
    }
  };

  const system = stats?.system;
  const tempFolder = stats?.tempFolder;
  const uploadsFolder = stats?.uploadsFolder;
  const otherUsed = stats?.otherUsed;

  // Calculate proportional percentages for the visual storage bar
  const totalDisk = system?.totalBytes || 1;
  const tempPct = Math.max(0.1, ((tempFolder?.totalBytes || 0) / totalDisk) * 100);
  const uploadsPct = Math.max(0, ((uploadsFolder?.totalBytes || 0) / totalDisk) * 100);
  const otherPct = Math.max(0, ((otherUsed?.totalBytes || 0) / totalDisk) * 100);
  const freePct = Math.max(0, 100 - tempPct - uploadsPct - otherPct);

  return (
    <div
      id="storage-monitor-dashboard-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700/90 w-full max-w-3xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 text-sky-400 border border-sky-500/20 rounded-xl shadow-inner">
              <HardDrive className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-base sm:text-lg">
                  Bảng Giám Sát Bộ Nhớ & Ổ Đĩa
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-sky-500/20 text-sky-300 border border-sky-500/30">
                  Thời Gian Thực
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Theo dõi chi tiết dung lượng thư mục video tạm thời và tài nguyên hệ thống
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="refresh-storage-stats-btn"
              type="button"
              onClick={fetchStorageStats}
              disabled={isLoading}
              title="Làm mới thông số ổ đĩa"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              id="close-storage-dashboard-btn"
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Status notification toast */}
          {statusMessage && (
            <div
              className={`p-3 rounded-xl border text-xs flex items-center gap-2.5 ${
                statusMessage.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {statusMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 flex-shrink-0 text-rose-400" />
              )}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Section 1: Visual Storage Indicator Bar */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-sky-400" />
                <span className="text-sm font-semibold text-white">Chỉ Số Dung Lượng Ổ Đĩa Hệ Thống</span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-0.5 rounded-full border ${
                    system?.status === 'critical'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : system?.status === 'warning'
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {system?.status === 'critical'
                    ? 'Báo động: Sắp hết'
                    : system?.status === 'warning'
                    ? 'Cần chú ý'
                    : 'Trạng thái: Tốt (Dồi dào)'}
                </span>
              </div>
            </div>

            {/* Multi-segment Visual Indicator Gauge */}
            <div className="space-y-2">
              <div className="h-4 w-full bg-slate-800/90 rounded-full overflow-hidden flex border border-slate-700/50 p-0.5">
                {/* Temp Folder (Amber) */}
                {tempPct > 0 && (
                  <div
                    style={{ width: `${Math.max(tempPct, 1)}%` }}
                    className="h-full bg-amber-500 rounded-l-full transition-all duration-500 relative group"
                    title={`Thư mục video tạm: ${tempFolder?.formattedTotal || '0 B'}`}
                  />
                )}
                {/* Uploads Folder (Purple) */}
                {uploadsPct > 0 && (
                  <div
                    style={{ width: `${uploadsPct}%` }}
                    className="h-full bg-purple-500 transition-all duration-500 relative group"
                    title={`Video cá nhân: ${uploadsFolder?.formattedTotal || '0 B'}`}
                  />
                )}
                {/* Other Used (Slate) */}
                {otherPct > 0 && (
                  <div
                    style={{ width: `${otherPct}%` }}
                    className="h-full bg-slate-600 transition-all duration-500 relative group"
                    title={`Hệ thống & Tệp khác: ${otherUsed?.formattedTotal || '0 B'}`}
                  />
                )}
                {/* Free / Available Storage (Emerald) */}
                <div
                  style={{ width: `${freePct}%` }}
                  className="h-full bg-emerald-500/90 rounded-r-full transition-all duration-500 relative group"
                  title={`Dung lượng khả dụng: ${system?.formattedFree || '0 B'}`}
                />
              </div>

              {/* Legend with Color Dots */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 flex-shrink-0" />
                  <span className="truncate">Thư mục tạm:</span>
                  <strong className="text-amber-300 font-mono ml-auto">
                    {tempFolder?.formattedTotal || '0 B'}
                  </strong>
                </div>

                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0" />
                  <span className="truncate">Video cá nhân:</span>
                  <strong className="text-purple-300 font-mono ml-auto">
                    {uploadsFolder?.formattedTotal || '0 B'}
                  </strong>
                </div>

                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-600 flex-shrink-0" />
                  <span className="truncate">Hệ thống:</span>
                  <strong className="text-slate-300 font-mono ml-auto">
                    {otherUsed?.formattedTotal || '0 B'}
                  </strong>
                </div>

                <div className="flex items-center gap-1.5 text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 flex-shrink-0" />
                  <span className="truncate">Còn trống:</span>
                  <strong className="text-emerald-400 font-mono ml-auto">
                    {system?.formattedFree || '0 B'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Storage capacity numbers summary */}
            <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-slate-800/80 text-center">
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Tổng dung lượng</span>
                <span className="text-sm sm:text-base font-bold text-white font-mono">
                  {system?.formattedTotal || '500 GB'}
                </span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Dung lượng đã dùng</span>
                <span className="text-sm sm:text-base font-bold text-amber-400 font-mono">
                  {system?.formattedUsed || '0 B'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  ({system?.usedPercentage || 0}% ổ đĩa)
                </span>
              </div>
              <div className="bg-slate-900/60 p-2.5 rounded-xl border border-slate-800">
                <span className="text-[11px] text-slate-400 block">Dung lượng khả dụng</span>
                <span className="text-sm sm:text-base font-bold text-emerald-400 font-mono">
                  {system?.formattedFree || '500 GB'}
                </span>
                <span className="text-[10px] text-emerald-400/80 block mt-0.5">
                  ({system?.freePercentage || 100}% khả dụng)
                </span>
              </div>
            </div>
          </div>

          {/* Section 2: Temporary Videos Folder In-Depth Spotlight */}
          <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-amber-500/20 text-amber-400 rounded-lg">
                  <FolderDown className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">
                    Chi Tiết Thư Mục Video Tạm (temp_downloads)
                  </h4>
                  <p className="text-[11px] text-slate-400">
                    Nơi lưu trữ các video Bilibili đã tải ghép hoàn chỉnh để người dùng xem trước hoặc tải về
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {onOpenTempFiles && (
                  <button
                    id="open-temp-files-from-dashboard-btn"
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenTempFiles();
                    }}
                    className="px-2.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <span>Mở danh sách tệp ({tempFolder?.videoCount || 0})</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Key Stat Cards for Temporary Videos */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-3">
              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Dung lượng chiếm dụng</span>
                <span className="text-lg font-bold text-amber-300 font-mono">
                  {tempFolder?.formattedTotal || '0 B'}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Chiếm {tempFolder?.percentageOfUsed || 0}% dung lượng dùng
                </span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Số video tạm (.mp4)</span>
                <span className="text-lg font-bold text-white font-mono">
                  {tempFolder?.videoCount || 0}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Tổng {tempFolder?.fileCount || 0} tệp trong thư mục
                </span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Chính sách lưu trữ</span>
                <span className="text-lg font-bold text-sky-300 font-mono">
                  {tempFolder?.retentionHours || 5} Giờ
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Tự động thu hồi định kỳ
                </span>
              </div>

              <div className="bg-slate-900/90 border border-slate-800 p-3 rounded-xl">
                <span className="text-[11px] text-slate-400 block">Tần suất dọn dẹp</span>
                <span className="text-lg font-bold text-purple-300 font-mono">
                  Mỗi 15 phút
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">
                  Tiến trình chạy ngầm
                </span>
              </div>
            </div>

            {/* Quick Actions Bar for Temporary Files */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-amber-500/20">
              <div className="flex items-center gap-2">
                <button
                  id="cleanup-expired-temp-files-btn"
                  type="button"
                  onClick={handleCleanExpired}
                  disabled={isCleaningExpired}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
                  title="Chạy dọn dẹp ngay các tệp quá hạn 5 tiếng"
                >
                  <Clock className={`w-3.5 h-3.5 text-sky-400 ${isCleaningExpired ? 'animate-spin' : ''}`} />
                  <span>{isCleaningExpired ? 'Đang dọn dẹp...' : 'Dọn dẹp tệp quá hạn'}</span>
                </button>
              </div>

              {/* Clear all temporary files button */}
              <div>
                {!confirmClearAll ? (
                  <button
                    id="trigger-clear-all-temp-files-btn"
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors"
                    title="Xóa toàn bộ các tệp video tạm thời để giải phóng dung lượng"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa sạch thư mục tạm</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-rose-300 font-medium">Xác nhận xóa sạch?</span>
                    <button
                      id="confirm-clear-all-temp-btn"
                      type="button"
                      onClick={handleClearAllTemp}
                      disabled={isClearingAll}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow transition-all"
                    >
                      {isClearingAll ? 'Đang xóa...' : 'Đồng ý xóa'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Section 3: Educational Insights & Storage Hygiene */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3.5 text-xs text-slate-400 space-y-2">
            <div className="flex items-center gap-2 font-semibold text-slate-300">
              <Zap className="w-3.5 h-3.5 text-sky-400" />
              <span>Ghi chú quản lý bộ nhớ:</span>
            </div>
            <ul className="list-disc list-inside space-y-1 text-slate-400 text-[11px] leading-relaxed">
              <li>
                Các video tải về từ Bilibili được lưu trữ trong thư mục <code className="text-sky-300 bg-slate-900 px-1 py-0.5 rounded">temp_downloads</code> với thời hạn tối đa <strong>5 giờ</strong>.
              </li>
              <li>
                Sau 5 giờ kể từ thời điểm tải, hệ thống tự động xóa bỏ tệp để tránh làm đầy dung lượng ổ đĩa.
              </li>
              <li>
                Video tải lên cá nhân nằm riêng biệt trong thư mục <code className="text-purple-300 bg-slate-900 px-1 py-0.5 rounded">user_uploads</code> và không bị giới hạn thời gian xóa tự động.
              </li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs text-slate-400">
          <span>
            Lần cập nhật cuối: {stats?.timestamp ? new Date(stats.timestamp).toLocaleTimeString('vi-VN') : 'Vừa xong'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
