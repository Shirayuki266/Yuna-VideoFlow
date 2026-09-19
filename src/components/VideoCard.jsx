import React, { useState } from 'react';
import axios from 'axios';
import { Download, Loader2, CheckCircle2, AlertCircle, ExternalLink, Play, RotateCw, Check, ShoppingBag, Scissors } from 'lucide-react';

// Helper format lượt xem
function formatViews(views) {
  if (!views) return '0';
  const num = Number(views);
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace('.0', '') + 'M';
  if (num >= 10000) return (num / 10000).toFixed(1).replace('.0', '') + ' vạn';
  if (num >= 1000) return (num / 1000).toFixed(1).replace('.0', '') + 'K';
  return num.toLocaleString();
}

// Helper format ngày đăng video
function formatPubDate(pubdate) {
  if (!pubdate) return null;
  const date = new Date(pubdate * 1000);
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffSec < 3600) {
    const mins = Math.max(1, Math.floor(diffSec / 60));
    return `${mins}p trước`;
  }
  if (diffSec < 86400) {
    const hrs = Math.floor(diffSec / 3600);
    return `${hrs}h trước`;
  }
  if (diffSec < 86400 * 7) {
    const days = Math.floor(diffSec / 86400);
    return `${days} ngày trước`;
  }
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export default function VideoCard({ video, onDownloadSuccess, onPlayVideo, onAnalyzeProducts }) {
  const [downloadState, setDownloadState] = useState('idle'); // 'idle' | 'checking' | 'downloading' | 'already_downloaded' | 'success' | 'error'
  const [downloadInfo, setDownloadInfo] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  if (!video) return null;

  // Thực hiện kiểm tra trùng lặp trước khi tải
  const handleDownload = async (e, forceRedownload = false) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (downloadState === 'downloading' || downloadState === 'checking') return;
    if (!video.bvid) return;

    setErrorMessage('');

    // BƯỚC 1: Kiểm tra xem video đã được tải trước đó chưa (nếu không force)
    if (!forceRedownload) {
      setDownloadState('checking');
      try {
        const checkRes = await axios.get(`/api/download/check?bvid=${video.bvid}`);
        if (checkRes.data && checkRes.data.exists && checkRes.data.data) {
          // Video ĐÃ TỒN TẠI: Thông báo và không tải lại
          setDownloadInfo(checkRes.data.data);
          setDownloadState('already_downloaded');
          return;
        }
      } catch (checkErr) {
        console.warn('Lỗi kiểm tra trùng lặp, tiến hành tải tiếp:', checkErr);
      }
    }

    // BƯỚC 2: Video CHƯA TỒN TẠI (hoặc người dùng chọn tải lại bản mới) -> Tiến hành tải
    setDownloadState('downloading');

    try {
      const res = await axios.post('/api/download/process', {
        bvid: video.bvid,
        force: forceRedownload
      });

      if (res.data.success && res.data.data) {
        setDownloadInfo(res.data.data);

        if (res.data.alreadyDownloaded) {
          setDownloadState('already_downloaded');
        } else {
          setDownloadState('success');
        }

        if (onDownloadSuccess) {
          onDownloadSuccess(res.data.data);
        }

        // Tự động kích hoạt tải tệp về trình duyệt
        const downloadUrl = res.data.data.downloadUrl;
        const tempLink = document.createElement('a');
        tempLink.href = downloadUrl;
        tempLink.setAttribute('download', res.data.data.filename);
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
      } else {
        setDownloadState('error');
        setErrorMessage('Không thể tải video này.');
      }
    } catch (err) {
      console.error('Lỗi khi tải video từ card:', err);
      setDownloadState('error');
      setErrorMessage(err.response?.data?.error || 'Lỗi khi tải & ghép video.');
    }
  };

  const bilibiliUrl = video.bvid ? `https://www.bilibili.com/video/${video.bvid}` : '#';

  return (
    <div
      id={`video-card-${video.bvid || video.aid}`}
      className="bg-slate-800/90 rounded-2xl overflow-hidden border border-slate-700/70 hover:border-sky-500/60 transition-all duration-300 flex flex-col group hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/10"
    >
      {/* Thumbnail + Duration + Quick View link */}
      <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
        <a
          href={bilibiliUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full h-full relative"
          title="Xem trên Bilibili"
        >
          <img
            src={video.cover}
            alt={video.title_vi || video.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <span className="bg-black/70 text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm">
              <ExternalLink className="w-3 h-3" /> Xem gốc
            </span>
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAnalyzeProducts && onAnalyzeProducts(video);
              }}
              className="bg-[#ee4d2d]/95 hover:bg-[#ee4d2d] text-white text-xs px-2.5 py-1 rounded-full flex items-center gap-1 backdrop-blur-sm shadow-md transition-transform hover:scale-105 font-medium"
              title="Cắt video thành các khung hình ảnh & AI phân tích sản phẩm trên Shopee"
            >
              <Scissors className="w-3 h-3 text-amber-200" /> Cắt Khung & Soi Shopee
            </button>
          </div>
        </a>

        {video.duration && (
          <span className="absolute bottom-2 right-2 bg-black/85 text-white text-[11px] px-2 py-0.5 rounded font-mono font-medium pointer-events-none shadow">
            {video.duration}
          </span>
        )}

        {/* Badge nếu đã tải trước đó */}
        {downloadState === 'already_downloaded' && (
          <span className="absolute top-2 left-2 bg-emerald-600/90 text-white text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 backdrop-blur shadow">
            <Check className="w-3 h-3" /> Đã có sẵn
          </span>
        )}
      </div>

      {/* Video Details */}
      <div className="p-4 flex flex-col flex-1 justify-between">
        <div>
          {/* Vietnamese translated title */}
          <a
            href={bilibiliUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-white text-sm line-clamp-2 leading-snug group-hover:text-sky-400 transition-colors block"
            title={video.title_vi || video.title}
          >
            {video.title_vi || video.title}
          </a>

          {/* Original title subtitle if translated */}
          {video.title_vi && video.title_vi !== video.title && (
            <p className="text-[11px] text-slate-400 line-clamp-1 mt-1">
              Gốc: {video.title}
            </p>
          )}
        </div>

        {/* Author & Stats & Download Action */}
        <div className="mt-3.5 pt-3 border-t border-slate-700/50 flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="truncate max-w-[120px] font-medium text-slate-300" title={video.author || "N/A"}>
              {video.author || "N/A"}
            </span>
            <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
              <span title={`${video.play ? Number(video.play).toLocaleString() : 0} lượt xem`}>
                ▶ {formatViews(video.play)}
              </span>
              {video.pubdate && (
                <span className="text-slate-500 font-sans text-[11px]" title="Thời gian đăng">
                  • {formatPubDate(video.pubdate)}
                </span>
              )}
            </div>
          </div>

          {/* Video Actions & Duplicate Check Status */}
          <div className="pt-1">
            {/* Trạng thái 1: Chưa bấm tải -> Hiển thị cả Tải MP4 và Soi Hàng Shopee */}
            {downloadState === 'idle' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  id={`download-btn-${video.bvid}`}
                  type="button"
                  onClick={(e) => handleDownload(e, false)}
                  className="w-full py-2 px-2 bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/40 hover:border-sky-500 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-sm truncate"
                  title="Tải video về máy (Tự động kiểm tra trùng lặp)"
                >
                  <Download className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">Tải MP4</span>
                </button>

                <button
                  id={`shopee-btn-${video.bvid}`}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onAnalyzeProducts && onAnalyzeProducts(video);
                  }}
                  className="w-full py-2 px-2 bg-orange-500/20 hover:bg-[#ee4d2d] text-orange-300 hover:text-white border border-orange-500/40 hover:border-[#ee4d2d] rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-all shadow-sm truncate"
                  title="Cắt video thành các khung hình ảnh & AI phân tích sản phẩm trên Shopee"
                >
                  <Scissors className="w-3.5 h-3.5 flex-shrink-0 text-orange-400" />
                  <span className="truncate">Cắt Khung & Soi Shopee</span>
                </button>
              </div>
            )}

            {/* Trạng thái 2: Đang kiểm tra trước khi tải */}
            {downloadState === 'checking' && (
              <button
                type="button"
                disabled
                className="w-full py-2 px-3 bg-slate-700/80 text-sky-300 rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-wait"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Đang kiểm tra lịch sử tải...
              </button>
            )}

            {/* Trạng thái 3: Đang tải & ghép luồng */}
            {downloadState === 'downloading' && (
              <button
                type="button"
                disabled
                className="w-full py-2 px-3 bg-slate-700/80 text-sky-400 rounded-xl text-xs font-medium flex items-center justify-center gap-2 cursor-wait"
              >
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Đang tải & ghép MP4 (H.264+AAC)...
              </button>
            )}

            {/* Trạng thái 4: VIDEO ĐÃ ĐƯỢC TẢI TRƯỚC ĐÓ -> Thông báo & không tải lại */}
            {downloadState === 'already_downloaded' && downloadInfo && (
              <div className="space-y-1.5 animate-in fade-in duration-200">
                <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-[11px] text-emerald-300 flex items-center justify-between">
                  <span className="flex items-center gap-1 font-medium">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                    Đã tải ({downloadInfo.formattedSize})
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDownload(e, true)}
                    title="Bắt buộc tải lại bản mới"
                    className="text-[10px] text-slate-400 hover:text-white flex items-center gap-0.5 underline ml-1"
                  >
                    <RotateCw className="w-2.5 h-2.5" />
                    Tải lại
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPlayVideo && onPlayVideo(downloadInfo)}
                    className="py-1.5 px-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    Xem
                  </button>
                  <a
                    href={downloadInfo.downloadUrl}
                    download={downloadInfo.filename}
                    className="py-1.5 px-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors shadow-sm"
                  >
                    <Download className="w-3 h-3" />
                    Lưu file
                  </a>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onAnalyzeProducts && onAnalyzeProducts(video);
                    }}
                    className="py-1.5 px-2 bg-orange-500/20 hover:bg-[#ee4d2d] text-orange-300 hover:text-white border border-orange-500/30 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-colors"
                    title="Soi sản phẩm trên Shopee"
                  >
                    <ShoppingBag className="w-3 h-3" />
                    Shopee
                  </button>
                </div>
              </div>
            )}

            {/* Trạng thái 5: Tải mới thành công */}
            {downloadState === 'success' && downloadInfo && (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onPlayVideo && onPlayVideo(downloadInfo)}
                    className="py-1.5 px-2.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <Play className="w-3 h-3" />
                    Xem
                  </button>
                  <a
                    href={downloadInfo.downloadUrl}
                    download={downloadInfo.filename}
                    className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-sm"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Tải xong ({downloadInfo.formattedSize})
                  </a>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onAnalyzeProducts && onAnalyzeProducts(video);
                    }}
                    className="py-1.5 px-2.5 bg-orange-500/20 hover:bg-[#ee4d2d] text-orange-300 hover:text-white border border-orange-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                    title="Soi sản phẩm trên Shopee"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Shopee
                  </button>
                </div>
              </div>
            )}

            {/* Trạng thái 6: Lỗi */}
            {downloadState === 'error' && (
              <button
                type="button"
                onClick={(e) => handleDownload(e, false)}
                className="w-full py-1.5 px-3 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
                title={errorMessage}
              >
                <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
                Lỗi - Nhấn thử lại
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
