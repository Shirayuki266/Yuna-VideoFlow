import React, { useState } from 'react';
import axios from 'axios';
import {
  Link2,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  Film,
  Play,
  RotateCw,
  AlertTriangle,
  ShoppingBag
} from 'lucide-react';

export default function LinkDownloader({ onDownloadSuccess, onPlayVideo, onAnalyzeProducts }) {
  const [inputUrl, setInputUrl] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [resolvedVideo, setResolvedVideo] = useState(null);
  const [alreadyDownloaded, setAlreadyDownloaded] = useState(false);
  const [existingVideoData, setExistingVideoData] = useState(null);
  const [downloadResult, setDownloadResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Extract BV ID from link or raw input
  const extractBvid = (str) => {
    if (!str) return null;
    const match = str.trim().match(/BV[0-9a-zA-Z]{10}/i);
    return match ? match[0] : null;
  };

  const handleResolve = async (e) => {
    if (e) e.preventDefault();
    setErrorMessage('');
    setDownloadResult(null);
    setAlreadyDownloaded(false);
    setExistingVideoData(null);

    const bvid = extractBvid(inputUrl);
    if (!bvid) {
      setErrorMessage('Vui lòng nhập đường link Bilibili hợp lệ (ví dụ: https://www.bilibili.com/video/BV1xx411c7mD hoặc mã BV).');
      return;
    }

    setIsResolving(true);
    try {
      const res = await axios.get('/api/video/resolve', {
        params: { link: inputUrl }
      });
      if (res.data.success && res.data.data) {
        setResolvedVideo(res.data.data);
        if (res.data.alreadyDownloaded && res.data.downloadedData) {
          setAlreadyDownloaded(true);
          setExistingVideoData(res.data.downloadedData);
        }
      } else {
        setErrorMessage('Không thể lấy thông tin video này.');
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Lỗi khi phân tích link video. Hãy kiểm tra lại đường dẫn.');
    } finally {
      setIsResolving(false);
    }
  };

  const handleDownload = async (forceRedownload = false) => {
    if (!resolvedVideo && !inputUrl) return;
    const bvid = resolvedVideo ? resolvedVideo.bvid : extractBvid(inputUrl);
    if (!bvid) return;

    // Cơ chế kiểm tra trước khi tải nếu không force
    if (!forceRedownload && alreadyDownloaded) {
      return; // Không tải lại
    }

    setIsDownloading(true);
    setErrorMessage('');
    try {
      const res = await axios.post('/api/download/process', {
        bvid,
        force: forceRedownload
      });

      if (res.data.success && res.data.data) {
        setDownloadResult(res.data.data);
        if (res.data.alreadyDownloaded) {
          setAlreadyDownloaded(true);
          setExistingVideoData(res.data.data);
        }

        if (onDownloadSuccess) {
          onDownloadSuccess(res.data.data);
        }

        // Trigger automatic file download in user's browser
        const downloadUrl = res.data.data.downloadUrl;
        const tempLink = document.createElement('a');
        tempLink.href = downloadUrl;
        tempLink.setAttribute('download', res.data.data.filename);
        document.body.appendChild(tempLink);
        tempLink.click();
        document.body.removeChild(tempLink);
      }
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Lỗi trong quá trình tải và ghép video. Vui lòng thử lại.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      id="link-downloader-card"
      className="w-full bg-slate-800/90 border border-slate-700/80 rounded-2xl p-5 mb-8 shadow-xl backdrop-blur"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-700/60 mb-4">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-sky-400" />
            Lấy & Tải Video từ Link Bilibili
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Dán link bất kỳ từ Bilibili để tải về đầy đủ cả <span className="text-sky-400 font-semibold">hình ảnh</span> và <span className="text-emerald-400 font-semibold">âm thanh</span>.
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-amber-400/90 bg-amber-400/10 border border-amber-400/20 px-3 py-1.5 rounded-lg w-fit">
          <Clock className="w-3.5 h-3.5" />
          <span>Tự động kiểm tra trùng lặp & lưu tệp tạm 5h</span>
        </div>
      </div>

      {/* Input Form */}
      <form onSubmit={handleResolve} className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <input
            id="link-downloader-input"
            type="text"
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="Dán link video Bilibili (ví dụ: https://www.bilibili.com/video/BV1xx411c7mD hoặc BV1...)"
            className="w-full bg-slate-900/90 text-sm text-white placeholder-slate-500 rounded-xl py-3 pl-4 pr-10 border border-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all font-mono text-xs sm:text-sm"
          />
          {inputUrl && (
            <button
              type="button"
              onClick={() => {
                setInputUrl('');
                setResolvedVideo(null);
                setDownloadResult(null);
                setAlreadyDownloaded(false);
                setExistingVideoData(null);
                setErrorMessage('');
              }}
              className="absolute right-3 top-3 text-slate-400 hover:text-white text-xs px-1.5 py-0.5 rounded bg-slate-800"
            >
              Xóa
            </button>
          )}
        </div>

        <button
          id="link-downloader-resolve-btn"
          type="submit"
          disabled={isResolving || !inputUrl.trim()}
          className="px-6 py-3 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 disabled:text-slate-500 text-white text-sm font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20"
        >
          {isResolving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Đang kiểm tra...
            </>
          ) : (
            <>
              <Film className="w-4 h-4" />
              Lấy video
            </>
          )}
        </button>
      </form>

      {/* Error Message */}
      {errorMessage && (
        <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Preview Card */}
      {resolvedVideo && (
        <div className="mt-5 p-4 rounded-xl bg-slate-900/80 border border-slate-700/80 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex gap-4 items-start w-full md:w-auto">
            <div className="relative w-36 aspect-video bg-slate-950 rounded-lg overflow-hidden flex-shrink-0 border border-slate-800">
              <img
                src={resolvedVideo.cover}
                alt={resolvedVideo.title_vi || resolvedVideo.title}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] px-1.5 py-0.2 rounded font-mono">
                {resolvedVideo.duration}
              </span>
            </div>

            <div className="flex flex-col justify-between">
              <h3 className="text-sm font-semibold text-white line-clamp-2 leading-snug">
                {resolvedVideo.title_vi || resolvedVideo.title}
              </h3>
              {resolvedVideo.title_vi && resolvedVideo.title_vi !== resolvedVideo.title && (
                <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                  Gốc: {resolvedVideo.title}
                </p>
              )}
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-2">
                <span>Tác giả: <strong className="text-slate-300 font-medium">{resolvedVideo.author}</strong></span>
                <span>•</span>
                <span>▶ {Number(resolvedVideo.play || 0).toLocaleString()} lượt xem</span>
                <span>•</span>
                <span className="font-mono text-sky-400">{resolvedVideo.bvid}</span>
              </div>
            </div>
          </div>

          {/* Action Buttons with Duplicate Check */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full md:w-auto flex-shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-slate-800">
            {alreadyDownloaded && existingVideoData ? (
              <div className="flex flex-col gap-2 w-full">
                <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-300 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    Video này đã được tải trước đó ({existingVideoData.formattedSize})
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDownload(true)}
                    className="text-[11px] text-slate-400 hover:text-white underline flex items-center gap-1"
                    title="Tải lại bản mới từ Bilibili"
                  >
                    <RotateCw className="w-3 h-3" />
                    Tải lại
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onPlayVideo && onPlayVideo(existingVideoData)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-medium flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Xem video ngay
                  </button>

                  <a
                    href={existingVideoData.downloadUrl}
                    download={existingVideoData.filename}
                    className="flex-1 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Tải lại file đã lưu
                  </a>

                  {onAnalyzeProducts && (
                    <button
                      type="button"
                      onClick={() => onAnalyzeProducts(resolvedVideo || existingVideoData)}
                      className="px-4 py-2 bg-orange-500/20 hover:bg-[#ee4d2d] text-orange-300 hover:text-white border border-orange-500/40 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow"
                      title="Phân tích sản phẩm trong video này để tra cứu Shopee"
                    >
                      <ShoppingBag className="w-3.5 h-3.5 text-orange-400" />
                      Soi Shopee
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  id="link-downloader-process-btn"
                  onClick={() => handleDownload(false)}
                  disabled={isDownloading}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-400 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20"
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Đang tải & ghép (Hình + Tiếng)...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Tải video đầy đủ (MP4)
                    </>
                  )}
                </button>

                {onAnalyzeProducts && (
                  <button
                    type="button"
                    onClick={() => onAnalyzeProducts(resolvedVideo)}
                    className="px-4 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-orange-950/40"
                    title="Phân tích sản phẩm trong video này để tra cứu Shopee"
                  >
                    <ShoppingBag className="w-4 h-4 text-amber-200" />
                    Soi Shopee
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Success Notification */}
      {downloadResult && !alreadyDownloaded && (
        <div className="mt-4 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>
              Đã tải thành công <strong>{downloadResult.filename}</strong> ({downloadResult.formattedSize}). Tệp đang được lưu tại thư mục tạm trong 5 giờ.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onPlayVideo && onPlayVideo(downloadResult)}
              className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white font-medium rounded-lg text-xs flex items-center gap-1.5 transition-colors"
            >
              <Play className="w-3.5 h-3.5" />
              Xem ngay
            </button>
            <a
              href={downloadResult.downloadUrl}
              download={downloadResult.filename}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Tải lại tệp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
