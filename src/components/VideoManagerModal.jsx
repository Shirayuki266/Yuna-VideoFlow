import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  FolderKanban,
  Download,
  Trash2,
  Play,
  Copy,
  Check,
  RefreshCw,
  X,
  HardDrive,
  Clock,
  Calendar,
  Sparkles,
  Film,
  Upload,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Filter,
  SlidersHorizontal,
  Flame,
  Wand2,
  ShoppingBag
} from 'lucide-react';

export default function VideoManagerModal({
  isOpen,
  onClose,
  onPlayVideo,
  onOpenEditor,
  onOpenUploader,
  onListChange,
  onAnalyzeProducts
}) {
  const [videos, setVideos] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  // filterType: 'all' | 'downloaded' | 'uploads'
  const [filterType, setFilterType] = useState('all');
  // timeFilter: 'all' | 'today' | 'week' | 'month' | 'year'
  const [timeFilter, setTimeFilter] = useState('all');
  // sortBy: 'date-desc' | 'date-asc' | 'size-desc' | 'size-asc' | 'title-asc' | 'title-desc' | 'views-desc' | 'views-asc'
  const [sortBy, setSortBy] = useState('date-desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [deletingFilename, setDeletingFilename] = useState(null);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  const fetchVideos = async () => {
    setIsLoading(true);
    try {
      const res = await axios.get('/api/videos/managed');
      if (res.data.success) {
        setVideos(res.data.data || []);
        if (onListChange) onListChange(res.data.data?.length || 0);
      }
    } catch (err) {
      console.error('Lỗi khi tải danh sách quản lý video:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchVideos();
    }
  }, [isOpen]);

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteFile = async (video) => {
    if (!video || deletingFilename) return;

    setDeletingFilename(video.filename);
    try {
      if (video.type === 'personal') {
        await axios.delete(`/api/upload/file/${encodeURIComponent(video.filename)}`);
      } else {
        await axios.delete(`/api/download/file/${encodeURIComponent(video.filename)}`);
      }
      setVideos((prev) => prev.filter((v) => v.filename !== video.filename));
      if (onListChange) onListChange(videos.length - 1);
    } catch (err) {
      console.error('Lỗi khi xóa video:', err);
      alert('Không thể xóa video này: ' + (err.response?.data?.error || err.message));
    } finally {
      setDeletingFilename(null);
    }
  };

  const handleClearAll = async () => {
    setIsClearingAll(true);
    try {
      await axios.post('/api/downloads/delete-all');
      await fetchVideos();
      setConfirmClearAll(false);
    } catch (err) {
      console.error('Lỗi khi xóa tất cả video tạm:', err);
    } finally {
      setIsClearingAll(false);
    }
  };

  const formatDateTime = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  // Quick stats
  const downloadedCount = videos.filter((v) => v.type === 'bilibili').length;
  const uploadsCount = videos.filter((v) => v.type === 'personal').length;

  // Toggle sort order between asc and desc for the current category
  const toggleSortOrder = () => {
    if (sortBy === 'date-desc') setSortBy('date-asc');
    else if (sortBy === 'date-asc') setSortBy('date-desc');
    else if (sortBy === 'size-desc') setSortBy('size-asc');
    else if (sortBy === 'size-asc') setSortBy('size-desc');
    else if (sortBy === 'title-asc') setSortBy('title-desc');
    else if (sortBy === 'title-desc') setSortBy('title-asc');
  };

  // Filter and sort videos
  const filteredAndSortedVideos = useMemo(() => {
    // 1. Filtering
    const now = Date.now();
    const result = videos.filter((v) => {
      // Type filter (All vs Downloaded vs Uploads)
      if (filterType === 'downloaded' && v.type !== 'bilibili') return false;
      if (filterType === 'uploads' && v.type !== 'personal') return false;

      // Time range filter (today, week, month, year)
      if (timeFilter !== 'all') {
        const vTime = v.createdAt || (v.pubdate ? v.pubdate * 1000 : 0);
        if (timeFilter === 'today' && vTime < now - 24 * 60 * 60 * 1000) return false;
        if (timeFilter === 'week' && vTime < now - 7 * 24 * 60 * 60 * 1000) return false;
        if (timeFilter === 'month' && vTime < now - 30 * 24 * 60 * 60 * 1000) return false;
        if (timeFilter === 'year' && vTime < now - 365 * 24 * 60 * 60 * 1000) return false;
      }

      // Keyword search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (v.title_vi || v.title || '').toLowerCase().includes(q);
        const matchId = (v.id || '').toLowerCase().includes(q);
        const matchFile = (v.filename || '').toLowerCase().includes(q);
        return matchTitle || matchId || matchFile;
      }
      return true;
    });

    // 2. Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return (b.createdAt || 0) - (a.createdAt || 0);
        case 'date-asc':
          return (a.createdAt || 0) - (b.createdAt || 0);
        case 'views-desc':
          return (b.play || 0) - (a.play || 0);
        case 'views-asc':
          return (a.play || 0) - (b.play || 0);
        case 'size-desc':
          return (b.fileSizeBytes || 0) - (a.fileSizeBytes || 0);
        case 'size-asc':
          return (a.fileSizeBytes || 0) - (b.fileSizeBytes || 0);
        case 'title-asc': {
          const tA = a.title_vi || a.title || '';
          const tB = b.title_vi || b.title || '';
          return tA.localeCompare(tB, 'vi');
        }
        case 'title-desc': {
          const tA = a.title_vi || a.title || '';
          const tB = b.title_vi || b.title || '';
          return tB.localeCompare(tA, 'vi');
        }
        default:
          return (b.createdAt || 0) - (a.createdAt || 0);
      }
    });

    return result;
  }, [videos, filterType, timeFilter, sortBy, searchQuery]);

  const isSortByDate = sortBy === 'date-desc' || sortBy === 'date-asc';
  const isDescending = sortBy.endsWith('-desc');

  if (!isOpen) return null;

  return (
    <div
      id="video-manager-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-5xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 bg-slate-950/60">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-sky-500/10 text-sky-400 rounded-xl border border-sky-500/20">
              <FolderKanban className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-white text-lg">Quản Lý Video</h3>
                <span className="text-xs font-mono bg-sky-500/20 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full">
                  {videos.length} video
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Xem lại thời gian tải, lọc Downloaded / Uploads, sắp xếp theo ngày tải & xóa tệp
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="manager-upload-trigger-btn"
              type="button"
              onClick={() => {
                onClose();
                if (onOpenUploader) onOpenUploader();
              }}
              className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              Upload video mới
            </button>

            <button
              id="manager-refresh-btn"
              type="button"
              onClick={fetchVideos}
              disabled={isLoading}
              title="Làm mới danh sách"
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <button
              id="manager-close-btn"
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-xl transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Filter and Sorting Control Bar */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-900/90 flex flex-col gap-3">
          {/* Row 1: Filter tabs ('Uploads' vs 'Downloaded' vs 'All') & Search */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Filter Buttons: All, Downloaded, Uploads */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                id="manager-filter-all-btn"
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  filterType === 'all'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>Tất cả</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800/80 font-mono">
                  {videos.length}
                </span>
              </button>

              <button
                id="manager-filter-downloaded-btn"
                type="button"
                onClick={() => setFilterType('downloaded')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  filterType === 'downloaded'
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Lọc các video đã tải về từ Bilibili"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Downloaded (Đã tải về)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800/80 font-mono">
                  {downloadedCount}
                </span>
              </button>

              <button
                id="manager-filter-uploads-btn"
                type="button"
                onClick={() => setFilterType('uploads')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                  filterType === 'uploads'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Lọc các video tải lên cá nhân"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Uploads (Tải lên)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800/80 font-mono">
                  {uploadsCount}
                </span>
              </button>
            </div>

            {/* Search Box */}
            <div className="relative flex-1 min-w-[200px] max-w-xs">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
              <input
                id="manager-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm tiêu đề, mã BVID hoặc tệp..."
                className="w-full bg-slate-950 text-xs text-white placeholder-slate-500 rounded-xl pl-8 pr-7 py-2 border border-slate-800 focus:outline-none focus:border-sky-500 transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-white text-xs"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Time range filters (Tất cả, Trong ngày, Trong tuần, Trong tháng, Trong năm) */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800/60">
            <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-purple-400" />
              Thời gian:
            </span>
            <div className="flex flex-wrap items-center gap-1">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'today', label: 'Trong ngày (24h)' },
                { id: 'week', label: 'Trong tuần (7 ngày)' },
                { id: 'month', label: 'Trong tháng (30 ngày)' },
                { id: 'year', label: 'Trong năm' }
              ].map((opt) => {
                const active = timeFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    id={`manager-time-${opt.id}-btn`}
                    type="button"
                    onClick={() => setTimeFilter(opt.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                      active
                        ? 'bg-purple-600 text-white font-bold shadow-sm'
                        : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row 3: Sorting Controls (Sort by Download Date, Views, Size, Title) & Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800/60">
            {/* Sorting controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
                <span>Sắp xếp:</span>
              </div>

              {/* Quick sort buttons for Download Date & Views */}
              <div className="flex items-center gap-1">
                <button
                  id="sort-date-newest-btn"
                  type="button"
                  onClick={() => setSortBy('date-desc')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                    sortBy === 'date-desc'
                      ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                  title="Sắp xếp theo ngày tải mới nhất trước"
                >
                  <Calendar className="w-3 h-3" />
                  <span>Mới nhất</span>
                </button>

                <button
                  id="sort-views-desc-btn"
                  type="button"
                  onClick={() => setSortBy('views-desc')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                    sortBy === 'views-desc'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                  title="Sắp xếp theo lượt xem nhiều nhất (Theo view)"
                >
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>Theo view</span>
                </button>
              </div>

              {/* Full Sort Dropdown Selector */}
              <div className="flex items-center gap-1">
                <select
                  id="manager-sort-select"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="bg-slate-950 text-xs text-slate-200 border border-slate-800 rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-sky-500 font-medium cursor-pointer"
                  title="Chọn tiêu chí sắp xếp"
                >
                  <option value="date-desc">📅 Ngày tải: Mới nhất (Newest)</option>
                  <option value="date-asc">📅 Ngày tải: Cũ nhất (Oldest)</option>
                  <option value="views-desc">🔥 Lượt xem: Cao nhất (Theo view)</option>
                  <option value="views-asc">🔥 Lượt xem: Thấp nhất</option>
                  <option value="size-desc">💾 Dung lượng: Lớn nhất</option>
                  <option value="size-asc">💾 Dung lượng: Nhỏ nhất</option>
                  <option value="title-asc">🔤 Tiêu đề: A → Z</option>
                  <option value="title-desc">🔤 Tiêu đề: Z → A</option>
                </select>

                {/* Sort Order Invert Button */}
                <button
                  id="manager-sort-order-toggle-btn"
                  type="button"
                  onClick={toggleSortOrder}
                  className="p-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-lg transition-colors"
                  title={isDescending ? 'Đang giảm dần (Nhấn để đảo thứ tự tăng dần)' : 'Đang tăng dần (Nhấn để đảo thứ tự giảm dần)'}
                >
                  {isDescending ? (
                    <ArrowDown className="w-3.5 h-3.5 text-sky-400" />
                  ) : (
                    <ArrowUp className="w-3.5 h-3.5 text-sky-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Clear All Temp Files Button */}
            {videos.some((v) => v.type === 'bilibili') && (
              <div>
                {!confirmClearAll ? (
                  <button
                    id="clear-all-temp-btn"
                    type="button"
                    onClick={() => setConfirmClearAll(true)}
                    className="px-3 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors"
                    title="Xóa toàn bộ video tải tạm thời (giải phóng dung lượng đĩa)"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Dọn sạch tệp tạm</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={handleClearAll}
                      disabled={isClearingAll}
                      className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1 whitespace-nowrap shadow"
                    >
                      {isClearingAll ? 'Đang xóa...' : 'Xác nhận xóa hết'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearAll(false)}
                      className="px-2 py-1 bg-slate-800 text-slate-400 hover:text-white rounded-lg text-xs"
                    >
                      Hủy
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Active Filter & Sort Indicator Summary */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/40 px-3 py-1.5 rounded-lg border border-slate-800/40">
            <div className="flex items-center gap-2">
              <span>
                Hiển thị <strong className="text-white">{filteredAndSortedVideos.length}</strong> / {videos.length} video
              </span>
              <span>•</span>
              <span>
                Bộ lọc: <strong className="text-sky-300">
                  {filterType === 'all' && 'Tất cả (All)'}
                  {filterType === 'downloaded' && 'Đã tải về (Downloaded)'}
                  {filterType === 'uploads' && 'Tải lên (Uploads)'}
                </strong>
              </span>
              <span>•</span>
              <span>
                Sắp xếp: <strong className="text-amber-300">
                  {sortBy === 'date-desc' && 'Ngày tải: Mới nhất trước'}
                  {sortBy === 'date-asc' && 'Ngày tải: Cũ nhất trước'}
                  {sortBy === 'size-desc' && 'Dung lượng: Lớn nhất trước'}
                  {sortBy === 'size-asc' && 'Dung lượng: Nhỏ nhất trước'}
                  {sortBy === 'title-asc' && 'Tiêu đề: A → Z'}
                  {sortBy === 'title-desc' && 'Tiêu đề: Z → A'}
                </strong>
              </span>
            </div>

            {(filterType !== 'all' || searchQuery.trim() || sortBy !== 'date-desc') && (
              <button
                type="button"
                onClick={() => {
                  setFilterType('all');
                  setSearchQuery('');
                  setSortBy('date-desc');
                }}
                className="text-[11px] text-sky-400 hover:text-sky-300 hover:underline flex items-center gap-1"
              >
                <span>Đặt lại bộ lọc</span>
              </button>
            )}
          </div>
        </div>

        {/* Video List */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3.5">
          {filteredAndSortedVideos.length === 0 ? (
            <div className="py-16 text-center text-slate-500 flex flex-col items-center">
              <HardDrive className="w-12 h-12 mb-3 text-slate-600" />
              <p className="font-semibold text-slate-300 text-base">
                {filterType === 'uploads'
                  ? 'Chưa có video tải lên (Uploads) nào'
                  : filterType === 'downloaded'
                  ? 'Chưa có video tải về (Downloaded) nào'
                  : 'Không tìm thấy video nào phù hợp'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md">
                {filterType === 'uploads' ? (
                  <>Bạn có thể nhấn <strong>"Upload video mới"</strong> ở góc trên để tải video cá nhân lên.</>
                ) : filterType === 'downloaded' ? (
                  <>Bạn có thể tải video từ trang chủ hoặc dán link Bilibili để tải video về.</>
                ) : (
                  <>Thử thay đổi từ khóa tìm kiếm hoặc đặt lại các bộ lọc bên trên.</>
                )}
              </p>
              {(filterType !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setFilterType('all');
                    setSearchQuery('');
                  }}
                  className="mt-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-medium transition-colors"
                >
                  Xóa bộ lọc & hiện tất cả
                </button>
              )}
            </div>
          ) : (
            filteredAndSortedVideos.map((video) => {
              const isPersonal = video.type === 'personal';
              const bvid = video.id || video.bvid;

              return (
                <div
                  key={video.filename}
                  id={`managed-video-${video.filename}`}
                  className="p-4 rounded-2xl bg-slate-800/70 border border-slate-700/60 hover:border-slate-600 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 group"
                >
                  {/* Left: Thumbnail & Info */}
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    {/* Thumbnail */}
                    <div
                      onClick={() => onPlayVideo && onPlayVideo(video)}
                      className="relative w-36 sm:w-44 aspect-video rounded-xl bg-slate-950 overflow-hidden flex-shrink-0 cursor-pointer group/thumb border border-slate-700/50 shadow-md"
                    >
                      {video.cover ? (
                        <img
                          src={video.cover}
                          alt={video.title_vi || video.title}
                          className="w-full h-full object-cover group-hover/thumb:scale-105 transition-transform duration-300"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 bg-slate-900">
                          <Film className="w-8 h-8 mb-1" />
                          <span className="text-[10px] text-slate-500">Video</span>
                        </div>
                      )}

                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                        <div className="p-2 bg-sky-500 text-white rounded-full shadow-lg">
                          <Play className="w-4 h-4 fill-white" />
                        </div>
                      </div>

                      {video.duration && (
                        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                          {video.duration}
                        </span>
                      )}

                      {/* Filter category badge */}
                      <span
                        className={`absolute top-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                          isPersonal
                            ? 'bg-purple-600/90 text-white'
                            : 'bg-sky-600/90 text-white'
                        }`}
                      >
                        {isPersonal ? (
                          <>
                            <Upload className="w-2.5 h-2.5" />
                            <span>Uploads</span>
                          </>
                        ) : (
                          <>
                            <Download className="w-2.5 h-2.5" />
                            <span>Downloaded</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Metadata Content */}
                    <div className="min-w-0 flex-1">
                      {/* Tiêu đề video */}
                      <h4
                        onClick={() => onPlayVideo && onPlayVideo(video)}
                        className="font-bold text-white text-sm sm:text-base leading-snug line-clamp-2 hover:text-sky-400 cursor-pointer transition-colors"
                        title={video.title_vi || video.title}
                      >
                        {video.title_vi || video.title}
                      </h4>

                      {video.title_vi && video.title_vi !== video.title && (
                        <p className="text-xs text-slate-400 line-clamp-1 mt-0.5" title={video.title}>
                          Gốc: {video.title}
                        </p>
                      )}

                      {/* Thông số hàng dưới: Mã video, Thời gian tải, Dung lượng */}
                      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs">
                        {/* Phân loại rõ ràng: Uploads vs Downloaded */}
                        <span
                          className={`text-[11px] font-semibold px-2 py-0.5 rounded-md flex items-center gap-1 ${
                            isPersonal
                              ? 'bg-purple-500/10 text-purple-300 border border-purple-500/30'
                              : 'bg-sky-500/10 text-sky-300 border border-sky-500/30'
                          }`}
                        >
                          {isPersonal ? (
                            <>
                              <Upload className="w-3 h-3 text-purple-400" />
                              <span>Tải lên (Uploads)</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3 h-3 text-sky-400" />
                              <span>Đã tải về (Downloaded)</span>
                            </>
                          )}
                        </span>

                        {/* Mã video */}
                        <div className="flex items-center gap-1 bg-slate-900/90 border border-slate-700/80 px-2 py-0.5 rounded-md font-mono text-[11px] text-sky-400">
                          <span>Mã: {bvid}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(bvid, video.filename)}
                            title="Sao chép mã video"
                            className="text-slate-400 hover:text-white transition-colors"
                          >
                            {copiedId === video.filename ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        {/* Thời gian tải / Download Date */}
                        <div className="flex items-center gap-1 text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-sky-400" />
                          <span>
                            {isPersonal ? 'Ngày tải lên:' : 'Ngày tải về:'}{' '}
                            <strong className="text-slate-100">{formatDateTime(video.createdAt)}</strong>
                          </span>
                        </div>

                        {/* Dung lượng file */}
                        <span className="font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {video.formattedSize}
                        </span>

                        {/* Thời gian hết hạn (với video tạm) */}
                        {!isPersonal && (
                          <div className="flex items-center gap-1 text-amber-300">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Tự xóa sau 5h</span>
                          </div>
                        )}
                      </div>

                      {/* Tên tệp tin thực tế */}
                      <p className="text-[11px] text-slate-500 font-mono truncate mt-1.5 max-w-xl" title={video.filename}>
                        Tệp: {video.filename}
                      </p>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 flex-shrink-0 self-end lg:self-center w-full lg:w-auto justify-end pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-700/50">
                    {/* Nút Chỉnh sửa Vietsub & Lồng tiếng AI */}
                    {onOpenEditor && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenEditor(video);
                        }}
                        className="px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600 text-violet-300 hover:text-white border border-violet-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                        title="Chỉnh sửa Vietsub & Lồng tiếng AI cho video này"
                      >
                        <Wand2 className="w-3.5 h-3.5 text-amber-300" />
                        <span>Chỉnh sửa</span>
                      </button>
                    )}

                    {/* Nút Xem video */}
                    <button
                      type="button"
                      onClick={() => onPlayVideo && onPlayVideo(video)}
                      className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 hover:text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors"
                      title="Xem video trực tiếp"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>Xem ngay</span>
                    </button>

                    {/* Nút Soi Shopee */}
                    {onAnalyzeProducts && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onAnalyzeProducts(video);
                        }}
                        className="px-3 py-1.5 bg-orange-500/20 hover:bg-[#ee4d2d] text-orange-300 hover:text-white border border-orange-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                        title="Phân tích sản phẩm trong video để tra cứu Shopee"
                      >
                        <ShoppingBag className="w-3.5 h-3.5 text-orange-400" />
                        <span>Soi Shopee</span>
                      </button>
                    )}

                    {/* Nút Tải về máy */}
                    <a
                      href={video.downloadUrl}
                      download={video.filename}
                      className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm"
                      title="Tải video về máy"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Tải file</span>
                    </a>

                    {/* Nút XÓA VIDEO ở thư mục tạm thời / server */}
                    <button
                      id={`delete-video-btn-${video.filename}`}
                      type="button"
                      onClick={() => handleDeleteFile(video)}
                      disabled={deletingFilename === video.filename}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-colors border border-transparent hover:border-rose-500/30"
                      title="Xóa video này khỏi thư mục"
                    >
                      <Trash2 className={`w-4 h-4 ${deletingFilename === video.filename ? 'animate-pulse text-rose-500' : ''}`} />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>
              Bộ lọc phân loại Uploads vs Downloaded cùng tùy chọn sắp xếp theo Ngày tải giúp dễ dàng tìm kiếm và quản lý kho video.
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

