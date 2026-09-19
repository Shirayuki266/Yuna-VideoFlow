import React, { useEffect, useRef } from 'react';
import { X, Download, Film, ExternalLink, Send, HardDrive, Wand2, LogOut, ShoppingBag } from 'lucide-react';

export default function VideoPlayerModal({ video, onClose, onOpenEditor, onAnalyzeProducts }) {
  const videoRef = useRef(null);

  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (onClose) onClose();
  };

  useEffect(() => {
    if (!video) return;

    // Lock background scrolling
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Escape key handler to exit video player
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [video]);

  if (!video) return null;

  const isTelegramStreaming = video.hasLocalFile === false && !!video.telegram?.fileId;
  const streamUrl = isTelegramStreaming
    ? `/api/telegram/stream/${video.id}`
    : video.streamUrl || video.downloadUrl;
  const downloadUrl = isTelegramStreaming
    ? `/api/telegram/download/${video.id}`
    : video.downloadUrl || streamUrl;
  const title = video.title_vi || video.title || video.filename;

  return (
    <>
      {/* Floating Exit Button (Always visible on any screen size/scroll state) */}
      <button
        id="player-floating-close-btn"
        type="button"
        onClick={handleClose}
        className="fixed top-3 right-3 sm:top-5 sm:right-6 z-[10000] px-3.5 py-2 bg-rose-600/90 hover:bg-rose-500 text-white rounded-full shadow-2xl flex items-center gap-1.5 text-xs font-bold transition-all hover:scale-105 border border-white/20 cursor-pointer backdrop-blur"
        title="Thoát xem video ngay (Phím ESC)"
      >
        <X className="w-4 h-4" />
        <span>Thoát (Esc)</span>
      </button>

      <div
        id="video-player-modal"
        className="fixed inset-0 z-[9999] flex items-center justify-center p-2 sm:p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
        onClick={handleClose}
      >
        <div
          className="bg-slate-900 border border-slate-700/80 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
            <div className="flex items-center gap-2.5 min-w-0 pr-3">
              <div className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg flex-shrink-0">
                <Film className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-white text-sm sm:text-base truncate" title={title}>
                    {title}
                  </h3>
                  {isTelegramStreaming && (
                    <span className="flex-shrink-0 text-[10px] font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                      <Send className="w-2.5 h-2.5" />
                      Telegram Cloud
                    </span>
                  )}
                </div>
                {video.bvid && (
                  <span className="font-mono text-xs text-sky-400">
                    Mã: {video.bvid}
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {onAnalyzeProducts && (
                <button
                  id="player-shopee-analysis-btn"
                  type="button"
                  onClick={() => onAnalyzeProducts(video)}
                  className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow"
                  title="Phân tích sản phẩm trong video này và tra cứu Shopee Việt Nam"
                >
                  <ShoppingBag className="w-3.5 h-3.5 text-amber-200" />
                  <span className="hidden sm:inline">Soi Sản Phẩm Shopee</span>
                  <span className="sm:hidden">Shopee</span>
                </button>
              )}
              {onOpenEditor && (
                <button
                  type="button"
                  onClick={() => {
                    handleClose();
                    onOpenEditor(video);
                  }}
                  className="px-2.5 sm:px-3 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow"
                  title="Chỉnh sửa Vietsub phụ đề & lồng tiếng giọng AI cho video này"
                >
                  <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                  <span className="hidden sm:inline">Chỉnh sửa (Vietsub & AI)</span>
                  <span className="sm:hidden">Vietsub</span>
                </button>
              )}
              {downloadUrl && (
                <a
                  id="player-download-btn"
                  href={downloadUrl}
                  download={video.filename}
                  className="px-2.5 sm:px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors shadow"
                  title="Tải video về máy tính"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tải về</span>
                </a>
              )}
              <button
                id="player-close-btn"
                type="button"
                onClick={handleClose}
                className="px-3 py-1.5 bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all border border-slate-700 hover:border-rose-500"
                title="Thoát xem video (Esc)"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">Thoát (Esc)</span>
              </button>
            </div>
          </div>

          {/* Video Player */}
          <div className="relative aspect-video w-full bg-black flex items-center justify-center">
            <video
              ref={videoRef}
              src={streamUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
            >
              Trình duyệt của bạn không hỗ trợ phát video HTML5.
            </video>
          </div>

          {/* Footer Meta */}
          <div className="p-3 sm:p-4 bg-slate-950/90 border-t border-slate-800/80 text-xs text-slate-300 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              {video.formattedSize && (
                <span className="bg-slate-800 px-2 py-0.5 rounded text-emerald-400 font-mono">
                  {video.formattedSize}
                </span>
              )}
              {video.duration && (
                <span className="bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                  Thời lượng: {video.duration}
                </span>
              )}
              {video.author && (
                <span className="text-slate-400">
                  Tác giả: <strong className="text-slate-200">{video.author}</strong>
                </span>
              )}
              {isTelegramStreaming ? (
                <span className="text-sky-400 flex items-center gap-1 font-medium">
                  <Send className="w-3 h-3" />
                  Telegram Cloud
                </span>
              ) : (
                <span className="text-slate-400 flex items-center gap-1">
                  <HardDrive className="w-3 h-3 text-slate-500" />
                  Ổ đĩa cục bộ
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {video.bvid && (
                <a
                  href={`https://www.bilibili.com/video/${video.bvid}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sky-400 hover:text-sky-300 flex items-center gap-1 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Bilibili
                </a>
              )}
              <button
                type="button"
                onClick={handleClose}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors border border-slate-700"
                title="Đóng trình xem video"
              >
                <LogOut className="w-3 h-3" />
                <span>Đóng</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
