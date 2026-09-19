import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
  X,
  Sparkles,
  ShoppingBag,
  Search,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Globe,
  Tag,
  Layers,
  ArrowUpRight,
  RotateCw,
  Camera,
  Film,
  Play,
  Pause,
  Scissors,
  Maximize2,
  Download,
  Trash2,
  Upload,
  Image as ImageIcon,
  ChevronRight,
  Info
} from 'lucide-react';

export default function ProductAnalysisModal({
  isOpen,
  onClose,
  initialVideo = null,
  allVideos = []
}) {
  const [selectedVideo, setSelectedVideo] = useState(initialVideo);
  const [customInput, setCustomInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [analysisResult, setAnalysisResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'exact' | 'high' | 'related'
  const [copiedKeyword, setCopiedKeyword] = useState('');
  const [quickShopeeTerm, setQuickShopeeTerm] = useState('');

  // Mode: 'frames' (Cắt khung hình & Soi Shopee) | 'full' (Phân tích toàn bộ video)
  const [viewMode, setViewMode] = useState('frames');

  // Video playback & Frame extraction state
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [videoSrc, setVideoSrc] = useState('');
  const [localVideoFile, setLocalVideoFile] = useState(null);

  // Frames state
  const [extractedFrames, setExtractedFrames] = useState([]);
  const [selectedFrame, setSelectedFrame] = useState(null);
  const [isExtractingFrames, setIsExtractingFrames] = useState(false);
  const [extractProgress, setExtractProgress] = useState(0);
  const [extractCount, setExtractCount] = useState(12); // Default 12 frames
  const [zoomFrame, setZoomFrame] = useState(null);

  // Frame-specific analysis cache: { [frameId]: analysisData }
  const [frameAnalysisCache, setFrameAnalysisCache] = useState({});

  // Format seconds to MM:SS
  const formatTime = (secs) => {
    if (!secs || isNaN(secs)) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Determine video source URL whenever selectedVideo changes
  useEffect(() => {
    if (!selectedVideo) {
      if (!localVideoFile) {
        setVideoSrc('');
      }
      return;
    }

    // Determine playable video source
    let source = '';
    if (selectedVideo.streamUrl) {
      source = selectedVideo.streamUrl;
    } else if (selectedVideo.downloadUrl) {
      source = selectedVideo.downloadUrl;
    } else if (selectedVideo.id) {
      source = `/api/video/stream/${selectedVideo.id}`;
    } else if (selectedVideo.filename) {
      source = `/api/download/file/${encodeURIComponent(selectedVideo.filename)}?inline=true`;
    } else if (selectedVideo.playUrl) {
      source = selectedVideo.playUrl;
    }

    setVideoSrc(source);
  }, [selectedVideo, localVideoFile]);

  // When initialVideo changes or modal opens
  useEffect(() => {
    if (initialVideo) {
      setSelectedVideo(initialVideo);
      setCustomInput(
        initialVideo.bvid
          ? `https://www.bilibili.com/video/${initialVideo.bvid}`
          : initialVideo.title_vi || initialVideo.title || ''
      );
      setExtractedFrames([]);
      setSelectedFrame(null);
      setFrameAnalysisCache({});
      // Run automatic general analysis or prepare frames
      handleAnalyze(initialVideo);
    } else {
      setSelectedVideo(null);
      setAnalysisResult(null);
      setErrorMessage('');
      setCustomInput('');
      setExtractedFrames([]);
      setSelectedFrame(null);
      setVideoSrc('');
    }
  }, [initialVideo, isOpen]);

  // Lock background scroll when open
  useEffect(() => {
    if (!isOpen) return;
    const orig = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (zoomFrame) {
          setZoomFrame(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = orig;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose, zoomFrame]);

  // Handle local video file upload
  const handleLocalFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileUrl = URL.createObjectURL(file);
    setLocalVideoFile(file);
    setVideoSrc(fileUrl);
    setSelectedVideo({
      id: `local_${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      title_vi: file.name.replace(/\.[^/.]+$/, ''),
      isLocal: true,
      filename: file.name
    });
    setCustomInput(file.name);
    setExtractedFrames([]);
    setSelectedFrame(null);
    setErrorMessage('');
  };

  // Video player event handlers
  const handleVideoTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration || 0);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      videoRef.current.play();
      setIsPlaying(true);
    } else {
      videoRef.current.pause();
      setIsPlaying(false);
    }
  };

  const seekTo = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  // Helper to capture a frame from HTML5 video element using canvas
  const captureFrameFromVideoEl = (vEl) => {
    try {
      const canvas = document.createElement('canvas');
      const width = vEl.videoWidth || 854;
      const height = vEl.videoHeight || 480;
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(vEl, 0, 0, width, height);
      return canvas.toDataURL('image/jpeg', 0.92);
    } catch (err) {
      console.warn('Canvas capture warning (CORS or blank):', err);
      return null;
    }
  };

  // 1. Snapshot current frame from video player
  const handleSnapshotCurrentFrame = async () => {
    setErrorMessage('');
    const curTime = currentTime || (videoRef.current ? videoRef.current.currentTime : 0);
    const timeStr = formatTime(curTime);

    let dataUrl = null;
    if (videoRef.current) {
      dataUrl = captureFrameFromVideoEl(videoRef.current);
    }

    // If canvas capture failed (e.g. CORS) and video is on server, try server capture
    if (!dataUrl && selectedVideo?.id && !selectedVideo.isLocal) {
      try {
        const res = await axios.post('/api/video/capture-frame', {
          videoId: selectedVideo.id,
          timestamp: curTime
        });
        if (res.data.success && res.data.frame) {
          dataUrl = res.data.frame.dataUrl || res.data.frame.imageUrl;
        }
      } catch (err) {
        console.warn('Server frame capture failed:', err);
      }
    }

    if (!dataUrl) {
      setErrorMessage(
        'Không thể chụp khung hình tại giây này. Hãy thử chọn video đã tải về hoặc tải video trực tiếp từ máy!'
      );
      return;
    }

    const newFrame = {
      id: `snap_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      timestamp: curTime,
      timeFormatted: timeStr,
      imageUrl: dataUrl,
      dataUrl: dataUrl,
      title: `Khung hình tại [${timeStr}]`
    };

    setExtractedFrames((prev) => [newFrame, ...prev]);
    setSelectedFrame(newFrame);
  };

  // 2. Auto extract series of keyframes from video
  const handleAutoExtractFrames = async () => {
    setErrorMessage('');
    setIsExtractingFrames(true);
    setExtractProgress(5);

    const targetCount = extractCount || 12;

    try {
      let currentSource = videoSrc;
      let currentVid = selectedVideo;

      // If video has no playable source yet but has a bvid, download it first so we can extract frames
      if (!currentSource && selectedVideo?.bvid) {
        setExtractProgress(10);
        try {
          const dlRes = await axios.post('/api/download/process', {
            bvid: selectedVideo.bvid,
            force: false
          });

          if (dlRes.data?.success && dlRes.data.data) {
            const dlData = dlRes.data.data;
            const playableUrl = dlData.downloadUrl
              ? `${dlData.downloadUrl}${dlData.downloadUrl.includes('?') ? '&' : '?'}inline=true`
              : `/api/download/file/${encodeURIComponent(dlData.filename)}?inline=true`;

            currentSource = playableUrl;
            setVideoSrc(playableUrl);
            currentVid = {
              ...selectedVideo,
              id: dlData.id || selectedVideo.bvid,
              filename: dlData.filename,
              downloadUrl: playableUrl
            };
            setSelectedVideo(currentVid);
          }
        } catch (dlErr) {
          console.warn('Auto-download prior to frame extraction warning:', dlErr);
        }
      }

      // First try server-side FFmpeg extraction if video exists on server
      if (currentVid?.id && !currentVid.isLocal) {
        try {
          setExtractProgress(30);
          const res = await axios.post('/api/video/extract-frames', {
            videoId: currentVid.id,
            frameCount: targetCount
          });

          if (res.data.success && Array.isArray(res.data.frames) && res.data.frames.length > 0) {
            setExtractProgress(100);
            setExtractedFrames(res.data.frames);
            setSelectedFrame(res.data.frames[0]);
            setIsExtractingFrames(false);
            return;
          }
        } catch (serverErr) {
          console.log('Server FFmpeg extraction fallback to browser canvas:', serverErr?.message);
        }
      }

      // Browser Canvas extraction fallback
      if (!currentSource) {
        throw new Error('Chưa có nguồn video sẵn sàng để cắt khung hình. Hãy dán link/chọn video đã tải về hoặc tải video trực tiếp từ máy tính!');
      }

      const tempVideo = document.createElement('video');
      tempVideo.crossOrigin = 'anonymous';
      tempVideo.muted = true;
      tempVideo.preload = 'auto';
      tempVideo.src = currentSource;

      await new Promise((resolve, reject) => {
        tempVideo.onloadedmetadata = () => resolve(true);
        tempVideo.onerror = (e) => reject(new Error('Trình duyệt không thể đọc video để cắt khung hình.'));
        setTimeout(() => reject(new Error('Quá thời gian tải metadata video.')), 8000);
      });

      const vidDuration = tempVideo.duration || duration || 60;
      const start = Math.min(1, vidDuration * 0.03);
      const end = Math.max(start + 1, vidDuration * 0.96);
      const step = (end - start) / Math.max(1, targetCount - 1);
      const frames = [];

      for (let i = 0; i < targetCount; i++) {
        const t = start + i * step;
        const pct = Math.round(15 + ((i + 1) / targetCount) * 80);
        setExtractProgress(pct);

        await new Promise((resSeek) => {
          let timeout = setTimeout(() => resSeek(), 2000);
          const onSeeked = () => {
            clearTimeout(timeout);
            tempVideo.removeEventListener('seeked', onSeeked);
            const dUrl = captureFrameFromVideoEl(tempVideo);
            if (dUrl) {
              frames.push({
                id: `frame_${i + 1}_${Date.now()}`,
                index: i + 1,
                timestamp: t,
                timeFormatted: formatTime(t),
                imageUrl: dUrl,
                dataUrl: dUrl,
                title: `Khung hình #${i + 1} [${formatTime(t)}]`
              });
            }
            resSeek();
          };
          tempVideo.addEventListener('seeked', onSeeked);
          tempVideo.currentTime = t;
        });
      }

      if (frames.length === 0) {
        throw new Error('Không thể trích xuất khung hình qua Canvas. Hãy thử phát video và dùng nút "📸 Chụp khung hình này"!');
      }

      setExtractProgress(100);
      setExtractedFrames(frames);
      setSelectedFrame(frames[0]);
    } catch (err) {
      console.error('Lỗi cắt khung hình:', err);
      setErrorMessage(err.message || 'Lỗi khi cắt khung hình video.');
    } finally {
      setIsExtractingFrames(false);
      setExtractProgress(0);
    }
  };

  // 3. Analyze products for a specific frame or whole video
  const handleAnalyze = async (videoToAnalyze = selectedVideo, customText = '', targetFrame = null) => {
    const textToSearch = customText || customInput;
    if (!videoToAnalyze && !textToSearch.trim() && !targetFrame) {
      setErrorMessage('Vui lòng nhập link Bilibili hoặc chọn một video để phân tích.');
      return;
    }

    // Check if we already have cached results for this specific frame
    if (targetFrame && frameAnalysisCache[targetFrame.id]) {
      setAnalysisResult(frameAnalysisCache[targetFrame.id]);
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      const payload = {
        model: 'gemini-3.8-flash'
      };

      if (videoToAnalyze) {
        if (videoToAnalyze.bvid) payload.bvid = videoToAnalyze.bvid;
        if (videoToAnalyze.id) payload.videoId = videoToAnalyze.id;
        payload.title = videoToAnalyze.title || '';
        payload.titleVi = videoToAnalyze.title_vi || videoToAnalyze.title || '';
        payload.coverUrl = videoToAnalyze.cover || '';
        payload.author = videoToAnalyze.author || '';
        payload.description = videoToAnalyze.desc || videoToAnalyze.description || '';
      } else {
        payload.link = textToSearch.trim();
        payload.title = textToSearch.trim();
      }

      // Attach Frame data if analyzing a specific frame
      if (targetFrame) {
        payload.frameImage = targetFrame.dataUrl || targetFrame.imageUrl;
        payload.frameTimestamp = targetFrame.timestamp;
        payload.frameTimestampStr = targetFrame.timeFormatted;
      }

      const res = await axios.post('/api/video/analyze-products', payload);
      if (res.data.success && res.data.data) {
        const result = res.data.data;
        setAnalysisResult(result);

        // Cache result for this frame
        if (targetFrame) {
          setFrameAnalysisCache((prev) => ({
            ...prev,
            [targetFrame.id]: result
          }));
        }
      } else {
        setErrorMessage(res.data.error || 'Không thể nhận diện sản phẩm từ video này.');
      }
    } catch (err) {
      console.error('Lỗi khi phân tích sản phẩm:', err);
      setErrorMessage(err.response?.data?.error || err.message || 'Lỗi kết nối máy chủ phân tích Gemini.');
    } finally {
      setIsLoading(false);
    }
  };

  // Trigger analysis for a clicked frame
  const handleSelectAndAnalyzeFrame = (frame) => {
    setSelectedFrame(frame);
    if (frame.timestamp !== undefined && videoRef.current) {
      seekTo(frame.timestamp);
    }
    handleAnalyze(selectedVideo, customInput, frame);
  };

  // Download frame image
  const handleDownloadFrame = (frame) => {
    const link = document.createElement('a');
    link.href = frame.dataUrl || frame.imageUrl;
    link.download = `frame_${selectedVideo?.title || 'video'}_${frame.timeFormatted?.replace(':', 'm') || '00'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Remove a frame from gallery
  const handleDeleteFrame = (frameId) => {
    setExtractedFrames((prev) => prev.filter((f) => f.id !== frameId));
    if (selectedFrame?.id === frameId) {
      setSelectedFrame(null);
    }
  };

  const copyToClipboard = (text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKeyword(text);
    setTimeout(() => {
      setCopiedKeyword('');
    }, 2500);
  };

  if (!isOpen) return null;

  // Filter products according to selected filter tab
  const products = analysisResult?.detectedProducts || [];
  const filteredProducts = products.filter((p) => {
    if (activeFilter === 'exact') return p.similarityLevel === 'exact' || p.similarityScore >= 90;
    if (activeFilter === 'high')
      return p.similarityLevel === 'high' || (p.similarityScore >= 75 && p.similarityScore < 90);
    if (activeFilter === 'related') return p.similarityLevel === 'related' || p.similarityScore < 75;
    return true;
  });

  const getSimilarityBadge = (score, level) => {
    if (level === 'exact' || score >= 90) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
          🔥 {score}% Khớp Chính Xác
        </span>
      );
    }
    if (level === 'high' || score >= 75) {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-sky-500/20 text-sky-300 border border-sky-500/40">
          ✨ {score}% Tương Tự Cao
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40">
        🔗 {score}% Liên Quan / Phụ Kiện
      </span>
    );
  };

  return (
    <div
      id="product-analysis-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-slate-950/85 backdrop-blur-md transition-all duration-300"
      onClick={onClose}
    >
      <div
        id="product-analysis-modal-container"
        className="relative w-full max-w-5xl max-h-[92vh] bg-slate-900 border border-slate-700/80 rounded-2xl sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 bg-slate-950/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-orange-600 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-orange-950/50 flex-shrink-0">
              <ShoppingBag className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  Cắt Khung Hình & Soi Sản Phẩm Shopee AI
                </h2>
                <span className="text-[10px] font-semibold bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-full">
                  Gemini Vision 3.8 Flash
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cắt video thành các khung hình ảnh • Chọn khung hình để AI nhận diện sản phẩm chuẩn xác trên Shopee
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="close-product-analysis-modal-btn"
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              title="Đóng cửa sổ"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs: Frames Mode vs Full Video Mode */}
        <div className="px-5 py-2.5 bg-slate-950/50 border-b border-slate-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewMode('frames')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                viewMode === 'frames'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-950/40'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Scissors className="w-3.5 h-3.5 text-amber-200" />
              <span>🎞️ Cắt Khung Hình & Soi Shopee ({extractedFrames.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setViewMode('full')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                viewMode === 'full'
                  ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow-md shadow-orange-950/40'
                  : 'bg-slate-800/80 text-slate-300 hover:text-white hover:bg-slate-700'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-amber-200" />
              <span>📋 Phân Tích Toàn Bộ Video</span>
            </button>
          </div>

          {/* Video Selector Dropdown or Local Upload */}
          <div className="flex items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleLocalFileChange}
              accept="video/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Tải tệp video từ máy tính để cắt khung hình"
            >
              <Upload className="w-3.5 h-3.5 text-purple-400" />
              <span className="hidden sm:inline">Tải video từ máy</span>
              <span className="sm:hidden">Upload</span>
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Video Selection and Search Bar */}
          <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-3">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  id="product-video-link-input"
                  type="text"
                  placeholder="Dán link Bilibili (hoặc tên sản phẩm/video cần soi)..."
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleAnalyze(selectedVideo, customInput);
                    }
                  }}
                  className="w-full pl-10 pr-10 py-2.5 bg-slate-900/90 border border-slate-700 text-white placeholder-slate-400 text-xs sm:text-sm rounded-xl focus:outline-none focus:border-amber-500 transition-colors"
                />
                {customInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomInput('');
                      setSelectedVideo(null);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Quick Video Selector from Loaded Videos */}
              {allVideos.length > 0 && (
                <div className="w-full sm:w-56 flex-shrink-0">
                  <select
                    className="w-full py-2.5 px-3 bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-xl focus:outline-none focus:border-amber-500"
                    value={selectedVideo?.id || selectedVideo?.bvid || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      const found = allVideos.find((v) => v.id === val || v.bvid === val);
                      if (found) {
                        setSelectedVideo(found);
                        setCustomInput(
                          found.bvid
                            ? `https://www.bilibili.com/video/${found.bvid}`
                            : found.title_vi || found.title || ''
                        );
                        setExtractedFrames([]);
                        setSelectedFrame(null);
                        setFrameAnalysisCache({});
                      }
                    }}
                  >
                    <option value="">-- Chọn video trong kho --</option>
                    {allVideos.map((v) => (
                      <option key={v.id || v.bvid} value={v.id || v.bvid}>
                        {v.title_vi || v.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <button
                id="start-analyze-btn"
                onClick={() => handleAnalyze(selectedVideo, customInput, selectedFrame)}
                disabled={isLoading}
                className="px-5 py-2.5 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-xs sm:text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-orange-950/50 disabled:opacity-50 transition-all cursor-pointer active:scale-95"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Đang soi AI...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-200" />
                    <span>{selectedFrame ? 'Soi Khung Hình Này' : 'Soi Toàn Bộ Video'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Selected Video Information Banner */}
            {selectedVideo && (
              <div className="p-2.5 bg-slate-900/80 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2.5 overflow-hidden">
                  {selectedVideo.cover && (
                    <img
                      src={selectedVideo.cover}
                      alt="Cover"
                      className="w-14 h-9 object-cover rounded-lg flex-shrink-0 bg-slate-950 border border-slate-800"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <div className="overflow-hidden">
                    <span className="text-[10px] text-amber-400 font-semibold uppercase tracking-wider block">
                      {selectedVideo.isLocal ? 'Video tệp tải lên' : 'Video đang chọn'}
                    </span>
                    <p className="text-white font-medium truncate" title={selectedVideo.title_vi || selectedVideo.title}>
                      {selectedVideo.title_vi || selectedVideo.title}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {selectedFrame && (
                    <span className="text-[11px] bg-orange-500/20 text-orange-300 border border-orange-500/30 px-2 py-0.5 rounded-md font-mono">
                      Khung: {selectedFrame.timeFormatted}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleAnalyze(selectedVideo, customInput, selectedFrame)}
                    disabled={isLoading}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-medium flex items-center gap-1 border border-slate-700 transition-colors"
                  >
                    <RotateCw className="w-3 h-3" /> Phân tích lại
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ======================= SECTION 1: CẮT KHUNG HÌNH (FRAMES WORKSPACE) ======================= */}
          {viewMode === 'frames' && (
            <div className="space-y-6">
              {/* Video Player + Frame Extraction Controls */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-slate-950/60 p-4 sm:p-5 rounded-2xl border border-slate-800">
                {/* Left: Video Preview & Scrubber (7 cols) */}
                <div className="lg:col-span-7 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Film className="w-4 h-4 text-sky-400" />
                      Trình Xem Video Để Chọn Khung Hình
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>

                  {/* Video Stage */}
                  <div className="relative aspect-video w-full bg-black rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center group shadow-inner">
                    {videoSrc ? (
                      <video
                        ref={videoRef}
                        src={videoSrc}
                        onTimeUpdate={handleVideoTimeUpdate}
                        onLoadedMetadata={handleVideoLoadedMetadata}
                        controls={false}
                        className="w-full h-full object-contain"
                        crossOrigin="anonymous"
                      />
                    ) : (
                      <div className="text-center p-6 space-y-2">
                        <Film className="w-8 h-8 text-slate-600 mx-auto" />
                        <p className="text-xs text-slate-400">
                          Chưa có luồng phát video. Hãy chọn video có sẵn hoặc tải video từ máy lên để cắt khung hình!
                        </p>
                      </div>
                    )}

                    {/* Quick Snapshot overlay button */}
                    {videoSrc && (
                      <button
                        type="button"
                        onClick={handleSnapshotCurrentFrame}
                        className="absolute bottom-3 right-3 px-3 py-1.5 bg-orange-600/90 hover:bg-orange-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-lg backdrop-blur-sm transition-all hover:scale-105 active:scale-95"
                        title="Chụp khung hình tại giây hiện tại"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Chụp giây này</span>
                      </button>
                    )}
                  </div>

                  {/* Playback Controls & Seekbar */}
                  {videoSrc && (
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={togglePlay}
                          className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs flex items-center justify-center transition-colors"
                        >
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                        </button>

                        <input
                          type="range"
                          min="0"
                          max={duration || 100}
                          step="0.1"
                          value={currentTime}
                          onChange={(e) => seekTo(parseFloat(e.target.value))}
                          className="flex-1 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />

                        <span className="text-xs font-mono text-amber-300 font-medium">
                          {formatTime(currentTime)}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Right: Extraction Actions Panel (5 cols) */}
                <div className="lg:col-span-5 flex flex-col justify-between space-y-4 border-t lg:border-t-0 lg:border-l border-slate-800 pt-4 lg:pt-0 lg:pl-5">
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5 text-orange-400">
                      <Scissors className="w-4 h-4" />
                      Công Cụ Cắt Khung Hình
                    </h3>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      Cắt video thành chuỗi ảnh sắc nét giúp AI Gemini nhìn thẳng vào sản phẩm thực tế, cho mức độ tương quan chính xác cao nhất trên Shopee!
                    </p>

                    {/* Auto Series Settings */}
                    <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 space-y-2.5">
                      <label className="text-xs font-medium text-slate-300 block">
                        Số lượng khung hình tự động:
                      </label>
                      <div className="grid grid-cols-4 gap-2">
                        {[6, 12, 18, 24].map((num) => (
                          <button
                            key={num}
                            type="button"
                            onClick={() => setExtractCount(num)}
                            className={`py-1.5 rounded-lg text-xs font-bold transition-all ${
                              extractCount === num
                                ? 'bg-orange-600 text-white shadow'
                                : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                            }`}
                          >
                            {num} ảnh
                          </button>
                        ))}
                      </div>

                      {/* Auto Extract Button */}
                      <button
                        type="button"
                        onClick={handleAutoExtractFrames}
                        disabled={isExtractingFrames || (!videoSrc && !selectedVideo)}
                        className="w-full mt-2 py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-md shadow-orange-950/40 disabled:opacity-50 transition-all cursor-pointer"
                      >
                        {isExtractingFrames ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Đang cắt khung hình ({extractProgress}%)...</span>
                          </>
                        ) : (
                          <>
                            <Scissors className="w-4 h-4" />
                            <span>⚡ Tự Động Cắt {extractCount} Khung Hình</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* Snapshot Button */}
                    <button
                      type="button"
                      onClick={handleSnapshotCurrentFrame}
                      disabled={!videoSrc && !selectedVideo}
                      className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
                    >
                      <Camera className="w-4 h-4 text-amber-400" />
                      <span>📸 Chụp Tại Giây [{formatTime(currentTime)}]</span>
                    </button>
                  </div>

                  {/* Extract Progress Bar if running */}
                  {isExtractingFrames && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px] text-slate-400">
                        <span>Đang xử lý khung hình...</span>
                        <span className="font-mono text-orange-400">{extractProgress}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-300"
                          style={{ width: `${extractProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Extracted Frames Gallery */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-orange-400" />
                      Bộ Sưu Tập Khung Hình Đã Cắt ({extractedFrames.length})
                    </h3>
                    <span className="text-xs text-slate-400 hidden sm:inline">
                      (Nhấp vào khung hình bất kỳ để AI phân tích sản phẩm và tra cứu Shopee)
                    </span>
                  </div>

                  {extractedFrames.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setExtractedFrames([]);
                        setSelectedFrame(null);
                      }}
                      className="text-xs text-slate-400 hover:text-rose-400 flex items-center gap-1 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Xóa hết khung</span>
                    </button>
                  )}
                </div>

                {extractedFrames.length === 0 ? (
                  <div className="py-8 px-4 text-center bg-slate-950/30 rounded-2xl border border-dashed border-slate-800 space-y-2">
                    <Scissors className="w-8 h-8 text-slate-600 mx-auto" />
                    <p className="text-xs text-slate-300 font-medium">Chưa có khung hình nào được cắt</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Hãy bấm <strong>"⚡ Tự Động Cắt Khung Hình"</strong> ở trên hoặc dừng video tại khoảnh khắc có sản phẩm và bấm <strong>"📸 Chụp giây này"</strong>.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                    {extractedFrames.map((frame, fIdx) => {
                      const isSelected = selectedFrame?.id === frame.id;
                      const hasCachedResult = !!frameAnalysisCache[frame.id];

                      return (
                        <div
                          key={frame.id || fIdx}
                          onClick={() => handleSelectAndAnalyzeFrame(frame)}
                          className={`relative group rounded-xl overflow-hidden cursor-pointer transition-all duration-200 border-2 bg-slate-950 flex flex-col ${
                            isSelected
                              ? 'border-orange-500 shadow-lg shadow-orange-950/50 scale-[1.02]'
                              : 'border-slate-800 hover:border-slate-600'
                          }`}
                        >
                          {/* Frame Thumbnail */}
                          <div className="relative aspect-video w-full bg-black overflow-hidden">
                            <img
                              src={frame.imageUrl || frame.dataUrl}
                              alt={frame.title || `Frame ${fIdx + 1}`}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                            />

                            {/* Timestamp Badge */}
                            <span className="absolute bottom-1.5 left-1.5 bg-black/80 text-white font-mono text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm">
                              {frame.timeFormatted || formatTime(frame.timestamp)}
                            </span>

                            {/* Cached AI Analyzed indicator */}
                            {hasCachedResult && (
                              <span
                                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-black"
                                title="Đã có kết quả phân tích AI"
                              />
                            )}

                            {/* Active Badge */}
                            {isSelected && (
                              <span className="absolute top-1.5 left-1.5 bg-orange-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                                Đang chọn
                              </span>
                            )}
                          </div>

                          {/* Action Footer for Frame */}
                          <div className="p-1.5 bg-slate-900 flex items-center justify-between text-[11px]">
                            <span className="font-semibold text-slate-300 truncate">
                              #{fIdx + 1} [{frame.timeFormatted}]
                            </span>

                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setZoomFrame(frame);
                                }}
                                title="Xem ảnh phóng to"
                                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                              >
                                <Maximize2 className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDownloadFrame(frame);
                                }}
                                title="Tải ảnh về máy"
                                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                              >
                                <Download className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFrame(frame.id);
                                }}
                                title="Xóa khung hình này"
                                className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Selected Frame Focus Bar */}
              {selectedFrame && (
                <div className="p-4 bg-gradient-to-r from-orange-950/40 via-slate-900 to-slate-900 border border-orange-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-md">
                  <div className="flex items-center gap-3">
                    <img
                      src={selectedFrame.imageUrl || selectedFrame.dataUrl}
                      alt="Selected Frame"
                      className="w-24 h-14 object-cover rounded-lg border border-orange-500/60 shadow"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5" /> Khung hình mục tiêu
                        </span>
                        <span className="text-xs font-mono bg-slate-800 text-slate-200 px-2 py-0.5 rounded">
                          Mốc thời gian: {selectedFrame.timeFormatted}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 mt-1">
                        AI Gemini sẽ đọc chi tiết khung hình này để nhận diện sản phẩm tương đồng cao nhất cho Shopee.
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAnalyze(selectedVideo, customInput, selectedFrame)}
                    disabled={isLoading}
                    className="w-full sm:w-auto px-5 py-2.5 bg-[#ee4d2d] hover:bg-[#d73211] text-white rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-lg shadow-orange-950/50 transition-all hover:scale-105 active:scale-95 cursor-pointer flex-shrink-0"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Đang soi sản phẩm khung hình...</span>
                      </>
                    ) : (
                      <>
                        <ShoppingBag className="w-4 h-4" />
                        <span>Soi Shopee Khung Hình Này</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Error Message */}
          {errorMessage && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-300 text-xs flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Loading Animation with steps */}
          {isLoading && (
            <div className="py-12 px-4 text-center space-y-4 bg-slate-950/40 rounded-2xl border border-slate-800/80">
              <div className="relative w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-amber-500/20 animate-ping"></div>
                <div className="w-16 h-16 rounded-full border-4 border-orange-500 border-t-transparent animate-spin flex items-center justify-center">
                  <ShoppingBag className="w-6 h-6 text-amber-400 animate-pulse" />
                </div>
              </div>
              <div className="space-y-1.5">
                <h3 className="text-base font-semibold text-white">
                  Gemini đang soi chi tiết {selectedFrame ? `khung hình [${selectedFrame.timeFormatted}]` : 'video'}...
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Đang bóc tách hình ảnh, thương hiệu, cấu hình và tính điểm tương đồng cao nhất cho Shopee Việt Nam & Google Shopping.
                </p>
              </div>

              {/* Progress step visual */}
              <div className="max-w-md mx-auto pt-2 grid grid-cols-3 gap-2 text-[11px] text-slate-400">
                <div className="p-2 rounded-lg bg-slate-800/70 border border-slate-700 text-emerald-400 flex flex-col items-center gap-1">
                  <Check className="w-3.5 h-3.5" />
                  <span>1. Đọc Khung Hình</span>
                </div>
                <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-300 flex flex-col items-center gap-1 animate-pulse">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>2. Đo Tương Quan</span>
                </div>
                <div className="p-2 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-500 flex flex-col items-center gap-1">
                  <Globe className="w-3.5 h-3.5" />
                  <span>3. Tra Cứu Shopee</span>
                </div>
              </div>
            </div>
          )}

          {/* ======================= SECTION 2: KẾT QUẢ PHÂN TÍCH SẢN PHẨM SHOPEE ======================= */}
          {analysisResult && !isLoading && (
            <div className="space-y-6">
              {/* Summary Box */}
              <div className="p-4 bg-gradient-to-r from-orange-950/30 via-slate-800/80 to-slate-800/40 border border-orange-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-orange-400 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Kết quả nhận diện AI
                    </span>
                    <span className="text-[11px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700">
                      Tìm thấy {products.length} sản phẩm
                    </span>
                    {selectedFrame && (
                      <span className="text-[11px] bg-orange-500/20 text-orange-300 px-2 py-0.5 rounded-full border border-orange-500/30 font-mono">
                        Từ khung hình [{selectedFrame.timeFormatted}]
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-200 leading-relaxed">{analysisResult.summary}</p>
                </div>

                {/* Quick Shopee Direct Search Box */}
                <div className="w-full sm:w-auto flex-shrink-0 flex items-center gap-2">
                  <div className="relative flex-1 sm:w-60">
                    <input
                      type="text"
                      placeholder="Tìm nhanh từ khóa trên Shopee..."
                      value={quickShopeeTerm}
                      onChange={(e) => setQuickShopeeTerm(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && quickShopeeTerm.trim()) {
                          window.open(
                            `https://shopee.vn/search?keyword=${encodeURIComponent(quickShopeeTerm.trim())}`,
                            '_blank'
                          );
                        }
                      }}
                      className="w-full pl-3 pr-8 py-1.5 bg-slate-900 border border-slate-700 text-white placeholder-slate-400 text-xs rounded-lg focus:outline-none focus:border-orange-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (quickShopeeTerm.trim()) {
                        window.open(
                          `https://shopee.vn/search?keyword=${encodeURIComponent(quickShopeeTerm.trim())}`,
                          '_blank'
                        );
                      }
                    }}
                    className="px-3 py-1.5 bg-[#ee4d2d] hover:bg-[#d73211] text-white text-xs font-semibold rounded-lg flex items-center gap-1 shadow-sm transition-colors cursor-pointer"
                    title="Mở tìm kiếm Shopee trong tab mới"
                  >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    Shopee
                  </button>
                </div>
              </div>

              {/* Filter Tabs & Quick Count */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setActiveFilter('all')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      activeFilter === 'all'
                        ? 'bg-white text-slate-900 shadow'
                        : 'bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700'
                    }`}
                  >
                    Tất cả ({products.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('exact')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeFilter === 'exact'
                        ? 'bg-emerald-600 text-white shadow'
                        : 'bg-slate-800 text-slate-300 hover:text-emerald-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>Khớp chính xác (90-100%)</span>
                    <span className="text-[10px] opacity-80">
                      ({products.filter((p) => p.similarityLevel === 'exact' || p.similarityScore >= 90).length})
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('high')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeFilter === 'high'
                        ? 'bg-sky-600 text-white shadow'
                        : 'bg-slate-800 text-slate-300 hover:text-sky-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>Tương tự cao (75-89%)</span>
                    <span className="text-[10px] opacity-80">
                      (
                      {
                        products.filter(
                          (p) =>
                            p.similarityLevel === 'high' ||
                            (p.similarityScore >= 75 && p.similarityScore < 90)
                        ).length
                      }
                      )
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveFilter('related')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
                      activeFilter === 'related'
                        ? 'bg-amber-600 text-white shadow'
                        : 'bg-slate-800 text-slate-300 hover:text-amber-300 hover:bg-slate-700'
                    }`}
                  >
                    <span>Liên quan / Phụ kiện</span>
                    <span className="text-[10px] opacity-80">
                      ({products.filter((p) => p.similarityLevel === 'related' || p.similarityScore < 75).length})
                    </span>
                  </button>
                </div>

                <span className="text-xs text-slate-400">
                  Sắp xếp theo: <strong className="text-slate-200">Độ tương quan giảm dần</strong>
                </span>
              </div>

              {/* Product Cards List */}
              <div className="space-y-4">
                {filteredProducts.length === 0 ? (
                  <div className="text-center py-10 text-slate-400 text-sm">
                    Không có sản phẩm nào thuộc bộ lọc này. Hãy chọn tab "Tất cả".
                  </div>
                ) : (
                  filteredProducts.map((product, idx) => {
                    const isCopied = copiedKeyword === product.shopeeKeyword;
                    return (
                      <div
                        key={product.id || idx}
                        id={`product-card-${idx}`}
                        className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-orange-500/50 rounded-2xl p-4 sm:p-5 transition-all shadow-md space-y-4"
                      >
                        {/* Header: Title, Brand, Similarity Score */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              {getSimilarityBadge(product.similarityScore, product.similarityLevel)}
                              {product.brand && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-700/80 text-slate-300 px-2 py-0.5 rounded-md border border-slate-600/60">
                                  <Tag className="w-3 h-3 text-slate-400" />
                                  {product.brand}
                                </span>
                              )}
                              {product.category && (
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-700/80 text-slate-300 px-2 py-0.5 rounded-md border border-slate-600/60">
                                  <Layers className="w-3 h-3 text-slate-400" />
                                  {product.category}
                                </span>
                              )}
                            </div>

                            <h3 className="text-base sm:text-lg font-bold text-white leading-snug">
                              {product.name}
                            </h3>
                            {product.originalName && product.originalName !== product.name && (
                              <p className="text-xs text-slate-400">
                                Tên quốc tế / gốc: <span className="text-slate-300">{product.originalName}</span>
                              </p>
                            )}
                          </div>

                          {/* Price Tag */}
                          <div className="sm:text-right flex-shrink-0">
                            <span className="text-[11px] text-slate-400 block">Khoảng giá ước tính:</span>
                            <span className="text-sm sm:text-base font-bold text-emerald-400 font-mono">
                              {product.estimatedPriceVND}
                            </span>
                          </div>
                        </div>

                        {/* Description & Similarity explanation */}
                        <div className="space-y-2 text-xs text-slate-300 bg-slate-900/60 rounded-xl p-3 border border-slate-800">
                          <p>{product.description}</p>
                          {product.similarityDescription && (
                            <p className="text-amber-300/90 font-medium">
                              💡 Đánh giá tương quan: {product.similarityDescription}
                            </p>
                          )}
                        </div>

                        {/* Specs Chips */}
                        {product.specs && product.specs.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-[11px] text-slate-400 font-medium">Thông số kỹ thuật nhận diện:</span>
                            <div className="flex flex-wrap gap-1.5">
                              {product.specs.map((spec, sIdx) => (
                                <span
                                  key={sIdx}
                                  className="text-[11px] bg-slate-900/90 text-slate-300 px-2.5 py-1 rounded-lg border border-slate-700/70"
                                >
                                  {spec}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Key Features */}
                        {product.keyFeatures && product.keyFeatures.length > 0 && (
                          <div className="space-y-1 text-xs text-slate-400">
                            <span className="font-medium text-slate-300">Điểm nổi bật:</span>
                            <ul className="list-disc list-inside space-y-0.5 text-slate-300 pl-1">
                              {product.keyFeatures.map((feat, fIdx) => (
                                <li key={fIdx}>{feat}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Direct Action Bar: Shopee Button & Copy Keyword */}
                        <div className="pt-2 border-t border-slate-700/60 flex flex-wrap items-center justify-between gap-3">
                          {/* Shopee Keyword helper */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-slate-400">Từ khóa tìm Shopee:</span>
                            <code className="text-xs bg-slate-900 text-orange-400 px-2 py-0.5 rounded border border-orange-500/30 font-mono font-medium">
                              {product.shopeeKeyword}
                            </code>
                            <button
                              type="button"
                              onClick={() => copyToClipboard(product.shopeeKeyword)}
                              className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white rounded text-xs font-medium flex items-center gap-1 transition-colors"
                              title="Sao chép từ khóa để dán vào Shopee"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Đã chép</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Sao chép</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Big Shopee CTA Button */}
                          <div className="flex items-center gap-2">
                            <a
                              href={product.googleShoppingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors border border-slate-600/70"
                              title="Xem so sánh giá trên Google Shopping"
                            >
                              <Globe className="w-3.5 h-3.5 text-sky-400" />
                              <span>Google Shopping</span>
                            </a>

                            <a
                              href={product.shopeeSearchUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-4 py-2 bg-[#ee4d2d] hover:bg-[#d73211] text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-md shadow-orange-950/40 transition-all hover:scale-[1.02] active:scale-95"
                              title="Mở tìm kiếm sản phẩm này trực tiếp trên Shopee Việt Nam"
                            >
                              <ShoppingBag className="w-4 h-4" />
                              <span>Tìm & Mua Trên Shopee</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </a>
                          </div>
                        </div>

                        {/* Internet Matches & Fallback Sources */}
                        {product.internetMatches && product.internetMatches.length > 0 && (
                          <div className="mt-3 pt-3 border-t border-slate-700/40 space-y-2 bg-slate-950/40 p-3 rounded-xl">
                            <div className="flex items-center justify-between text-[11px] text-slate-400 font-semibold">
                              <span className="flex items-center gap-1 text-sky-400">
                                <Globe className="w-3 h-3" /> Thông tin tìm thấy trên Internet & Nguồn khác:
                              </span>
                              <span className="text-[10px] text-slate-500">Tra cứu thời gian thực</span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {product.internetMatches.map((match, mIdx) => (
                                <div
                                  key={mIdx}
                                  className="p-2 bg-slate-900/80 rounded-lg border border-slate-800 text-[11px] space-y-1"
                                >
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="font-semibold text-slate-200 truncate">{match.title}</span>
                                    {match.price && (
                                      <span className="text-emerald-400 font-mono text-[10px] flex-shrink-0">
                                        {match.price}
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-slate-400 text-[10px] line-clamp-2">{match.snippet}</p>
                                  <div className="flex items-center justify-between text-[10px] text-slate-500 pt-1">
                                    <span>Nguồn: {match.source}</span>
                                    {match.url && (
                                      <a
                                        href={match.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sky-400 hover:underline flex items-center gap-0.5"
                                      >
                                        Xem link <ExternalLink className="w-2.5 h-2.5" />
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Grounding Sources citations */}
              {analysisResult.groundingSources && analysisResult.groundingSources.length > 0 && (
                <div className="p-3 bg-slate-950/50 rounded-xl border border-slate-800 text-xs space-y-1.5">
                  <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                    <Globe className="w-3 h-3 text-sky-400" /> Nguồn tra cứu web từ Google Search Grounding:
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {analysisResult.groundingSources.map((source, sIdx) => (
                      <a
                        key={sIdx}
                        href={source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-sky-400 hover:text-sky-300 bg-slate-900 hover:bg-slate-850 px-2 py-1 rounded border border-slate-800 flex items-center gap-1 truncate max-w-xs"
                        title={source.title}
                      >
                        <ExternalLink className="w-2.5 h-2.5 flex-shrink-0" />
                        <span className="truncate">{source.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Initial state before search */}
          {!analysisResult && !isLoading && !errorMessage && (
            <div className="text-center py-10 px-4 space-y-3 bg-slate-950/30 rounded-2xl border border-slate-800/60">
              <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 flex items-center justify-center mx-auto">
                <ShoppingBag className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-white">Sẵn sàng phân tích sản phẩm</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Hãy bấm <strong>"⚡ Tự Động Cắt Khung Hình"</strong> ở trên để bóc tách video thành các hình ảnh, sau đó nhấp vào khung hình ưng ý để AI nhận diện và đưa ra liên kết Shopee chính xác nhất!
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-slate-950/90 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>
              {extractedFrames.length > 0
                ? `Đã cắt ${extractedFrames.length} khung hình • Chọn khung để soi sản phẩm`
                : 'Hỗ trợ trích xuất khung hình từ video và soi hàng Shopee thông minh'}
            </span>
          </span>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded-lg font-medium transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>

      {/* Frame Zoom Modal */}
      {zoomFrame && (
        <div
          className="fixed inset-0 z-60 bg-black/90 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setZoomFrame(null)}
        >
          <div
            className="relative max-w-4xl w-full bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-white font-mono">
                {zoomFrame.title || `Khung hình tại [${zoomFrame.timeFormatted}]`}
              </span>
              <button
                type="button"
                onClick={() => setZoomFrame(null)}
                className="p-1 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-2 bg-black flex items-center justify-center max-h-[75vh]">
              <img
                src={zoomFrame.imageUrl || zoomFrame.dataUrl}
                alt="Zoomed Frame"
                className="max-h-[70vh] w-auto object-contain rounded"
              />
            </div>
            <div className="p-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => handleDownloadFrame(zoomFrame)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg flex items-center gap-1.5 transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Tải ảnh JPG</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setZoomFrame(null);
                  handleSelectAndAnalyzeFrame(zoomFrame);
                }}
                className="px-4 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shadow"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Soi Shopee Khung Hình Này</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
