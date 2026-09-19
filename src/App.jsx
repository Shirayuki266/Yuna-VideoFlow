import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import VideoGrid from './components/VideoGrid';
import SearchFilterBar from './components/SearchFilterBar';
import LinkDownloader from './components/LinkDownloader';
import TempFilesModal from './components/TempFilesModal';
import VideoManagerModal from './components/VideoManagerModal';
import VideoUploaderModal from './components/VideoUploaderModal';
import VideoPlayerModal from './components/VideoPlayerModal';
import StorageMonitorDashboard from './components/StorageMonitorDashboard';
import VideoEditorModal from './components/VideoEditorModal';
import ProductAnalysisModal from './components/ProductAnalysisModal';
import { FolderDown, FolderKanban, Upload, Sparkles, CheckCircle2, HardDrive, Wand2, ShoppingBag } from 'lucide-react';

export default function App() {
    const [videos, setVideos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [keyword, setKeyword] = useState('');
    const [hasMore, setHasMore] = useState(true);

    // Filter states for search and recommendations
    // order: 'totalrank' (mặc định) | 'pubdate' (mới nhất) | 'click' (theo view)
    const [order, setOrder] = useState('totalrank');
    // timeRange: 'all' | 'today' (trong ngày) | 'week' (trong tuần) | 'month' (trong tháng) | 'year' (trong năm)
    const [timeRange, setTimeRange] = useState('all');

    // Modals
    const [isTempModalOpen, setIsTempModalOpen] = useState(false);
    const [isManagerModalOpen, setIsManagerModalOpen] = useState(false);
    const [isUploaderModalOpen, setIsUploaderModalOpen] = useState(false);
    const [isStorageModalOpen, setIsStorageModalOpen] = useState(false);
    const [isEditorModalOpen, setIsEditorModalOpen] = useState(false);
    const [editorVideo, setEditorVideo] = useState(null);
    const [playingVideo, setPlayingVideo] = useState(null);

    // Modal Phân tích Sản Phẩm Video & Tra cứu Shopee
    const [isProductModalOpen, setIsProductModalOpen] = useState(false);
    const [productModalVideo, setProductModalVideo] = useState(null);

    const handleOpenProductAnalysis = (video = null) => {
        setProductModalVideo(video);
        setIsProductModalOpen(true);
    };

    const handleOpenEditor = (video = null) => {
        setEditorVideo(video);
        setIsEditorModalOpen(true);
    };

    // Counts & Storage Stats
    const [tempFilesCount, setTempFilesCount] = useState(0);
    const [managedVideosCount, setManagedVideosCount] = useState(0);
    const [storageStats, setStorageStats] = useState(null);
    const [toastMessage, setToastMessage] = useState('');

    // Fetch counts and storage stats for header badges
    const refreshCounts = async () => {
        try {
            const [tempRes, managedRes, storageRes] = await Promise.all([
                axios.get('/api/downloads/list'),
                axios.get('/api/videos/managed'),
                axios.get('/api/storage/stats').catch(() => ({ data: { success: false } }))
            ]);

            if (tempRes.data.success) {
                setTempFilesCount(tempRes.data.data?.length || 0);
            }
            if (managedRes.data.success) {
                setManagedVideosCount(managedRes.data.data?.length || 0);
            }
            if (storageRes.data?.success) {
                setStorageStats(storageRes.data.data);
            }
        } catch {
            // Ignore background error
        }
    };

    useEffect(() => {
        refreshCounts();
        const interval = setInterval(refreshCounts, 30000);
        return () => clearInterval(interval);
    }, []);

    const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => {
            setToastMessage('');
        }, 4000);
    };

    const handleDownloadSuccess = (downloadData) => {
        refreshCounts();
        showToast(`Đã tải xong: ${downloadData.filename} (${downloadData.formattedSize})`);
    };

    const handleUploadSuccess = (uploadedData) => {
        refreshCounts();
        showToast(`Đã tải lên video thành công: ${uploadedData.title}`);
        // Tự động mở modal Quản lý Video để người dùng thấy video mới
        setIsManagerModalOpen(true);
    };

    // Hàm fetch dữ liệu từ API có hỗ trợ keyword, order, timeRange
    const fetchVideos = async (
        currentPage,
        currentKeyword,
        currentOrder = order,
        currentTimeRange = timeRange,
        isNewSearch = false
    ) => {
        if (isLoading) return;
        setIsLoading(true);

        try {
            const res = await axios.get('/api/videos', {
                params: {
                    platform: 'bilibili',
                    keyword: currentKeyword,
                    order: currentOrder,
                    timeRange: currentTimeRange,
                    page: currentPage,
                    count: 16
                }
            });

            const newVideos = res.data.data || [];

            if (newVideos.length < 16) {
                setHasMore(false);
            }

            setVideos(prev => isNewSearch ? newVideos : [...prev, ...newVideos]);
        } catch (err) {
            console.error("Lỗi khi tải video:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // Tải dữ liệu khi page, keyword, order hoặc timeRange thay đổi
    useEffect(() => {
        fetchVideos(page, keyword, order, timeRange, page === 1);
    }, [page, keyword, order, timeRange]);

    // Xử lý khi người dùng tìm kiếm từ khóa mới
    const handleSearch = (newKeyword) => {
        const trimmed = newKeyword.trim();
        if (trimmed === keyword) return;
        setVideos([]);
        setHasMore(true);
        setKeyword(trimmed);
        setPage(1);
    };

    // Thay đổi sắp xếp: 'totalrank' (mặc định) | 'pubdate' (mới nhất) | 'click' (theo view)
    const handleOrderChange = (newOrder) => {
        if (newOrder === order) return;
        setVideos([]);
        setHasMore(true);
        setOrder(newOrder);
        setPage(1);
    };

    // Thay đổi khoảng thời gian: 'all' | 'today' | 'week' | 'month' | 'year'
    const handleTimeRangeChange = (newTimeRange) => {
        if (newTimeRange === timeRange) return;
        setVideos([]);
        setHasMore(true);
        setTimeRange(newTimeRange);
        setPage(1);
    };

    // Đặt lại tất cả bộ lọc về mặc định
    const handleResetFilters = () => {
        setVideos([]);
        setHasMore(true);
        setOrder('totalrank');
        setTimeRange('all');
        setPage(1);
    };

    // Đặt lại toàn bộ tìm kiếm & bộ lọc, làm mới video khi người dùng không hài lòng
    const handleMasterReset = () => {
        setKeyword('');
        setOrder('totalrank');
        setTimeRange('all');
        setVideos([]);
        setHasMore(true);
        setPage(1);
        fetchVideos(1, '', 'totalrank', 'all', true);
        showToast('Đã đặt lại tìm kiếm & bộ lọc, làm mới danh sách video!');
    };

    // Lắng nghe sự kiện cuộn trang (Infinite Scroll)
    const handleScroll = useCallback(() => {
        if (isLoading || !hasMore) return;

        // Cuộn gần tới đáy trang (cách 300px) thì trigger load thêm
        if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 300) {
            setPage(prevPage => prevPage + 1);
        }
    }, [isLoading, hasMore]);

    useEffect(() => {
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, [handleScroll]);

    return (
        <div className="min-h-screen bg-slate-900 text-white selection:bg-sky-500 selection:text-white">
            {/* Header Bar */}
            <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-40 px-4 sm:px-6 py-3 flex flex-wrap gap-3 sm:gap-4 justify-between items-center shadow-lg shadow-black/20">
                <div className="flex items-center gap-3">
                    <h1
                        onClick={handleMasterReset}
                        className="text-lg sm:text-xl font-bold bg-gradient-to-r from-sky-400 via-blue-400 to-indigo-400 bg-clip-text text-transparent cursor-pointer flex items-center gap-2"
                        title="Bấm để về trang chủ & làm mới video"
                    >
                        🚀 Yuna-VideoFlow
                    </h1>
                    <span className="text-[11px] bg-sky-500/10 text-sky-400 border border-sky-500/20 px-2.5 py-0.5 rounded-full font-medium hidden md:inline-flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Gemini Dịch thuật
                    </span>
                </div>

                {/* Actions: Chỉnh Sửa Video, Soi Sản Phẩm Shopee, Quản lý Video, Upload Cá Nhân, Tệp tạm */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* 0. Nút Soi Sản Phẩm Shopee AI */}
                    <button
                        id="open-product-analysis-btn"
                        onClick={() => handleOpenProductAnalysis()}
                        className="px-3 py-1.5 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-500 hover:from-orange-500 hover:to-amber-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-orange-950/40 ring-1 ring-orange-400/30 active:scale-95 cursor-pointer"
                        title="Phân tích sản phẩm trong video để tra cứu thông tin & tìm kiếm Shopee với độ tương quan cao"
                    >
                        <ShoppingBag className="w-4 h-4 text-amber-200" />
                        <span className="hidden sm:inline">Soi Shopee AI</span>
                        <span className="sm:hidden">Shopee</span>
                    </button>

                    {/* 1. Nút Chỉnh Sửa Video (Vietsub & Lồng Tiếng AI) */}
                    <button
                        id="open-video-editor-btn"
                        onClick={() => handleOpenEditor()}
                        className="px-3.5 py-1.5 bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-md shadow-violet-950/40 ring-1 ring-violet-400/30 active:scale-95"
                        title="Chỉnh sửa video: Vietsub phụ đề tự động bằng AI và lồng tiếng giọng AI"
                    >
                        <Wand2 className="w-4 h-4 text-amber-300" />
                        <span className="hidden sm:inline">Chỉnh Sửa Video</span>
                        <span className="sm:hidden">Studio</span>
                    </button>

                    {/* 2. Nút Quản lý Video */}
                    <button
                        id="open-video-manager-btn"
                        onClick={() => setIsManagerModalOpen(true)}
                        className="px-3.5 py-1.5 bg-sky-600/20 hover:bg-sky-600 text-sky-300 hover:text-white border border-sky-500/40 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                        title="Quản lý video: thời gian tải, tiêu đề, ảnh bìa, mã video & xóa video"
                    >
                        <FolderKanban className="w-4 h-4" />
                        <span className="hidden sm:inline">Quản Lý Video</span>
                        {managedVideosCount > 0 && (
                            <span className="bg-sky-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.2 rounded-full ml-0.5">
                                {managedVideosCount}
                            </span>
                        )}
                    </button>

                    {/* 3. Nút Upload Video Cá Nhân */}
                    <button
                        id="open-video-uploader-btn"
                        onClick={() => setIsUploaderModalOpen(true)}
                        className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all shadow-sm"
                        title="Tải video cá nhân từ máy tính của bạn lên"
                    >
                        <Upload className="w-4 h-4" />
                        <span className="hidden md:inline">Upload Video</span>
                    </button>

                    {/* 3. Nút Thư mục tạm thời */}
                    <button
                        id="open-temp-files-btn"
                        onClick={() => setIsTempModalOpen(true)}
                        className="relative px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 hover:border-slate-600 text-slate-300 text-xs font-medium rounded-xl flex items-center gap-1.5 transition-all shadow-sm"
                        title="Xem và xóa các video tạm thời đã tải về máy chủ (tự động xóa sau 5 giờ)"
                    >
                        <FolderDown className="w-4 h-4 text-amber-400" />
                        <span className="hidden lg:inline">Tệp tạm</span>
                        {tempFilesCount > 0 && (
                            <span className="bg-amber-500 text-slate-950 font-bold text-[10px] px-1.5 py-0.2 rounded-full">
                                {tempFilesCount}
                            </span>
                        )}
                    </button>

                    {/* 4. Nút Bảng Giám Sát Bộ Nhớ & Ổ Đĩa Hệ Thống */}
                    <button
                        id="open-storage-dashboard-btn"
                        onClick={() => setIsStorageModalOpen(true)}
                        className="px-3 py-1.5 bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-300 hover:text-white border border-emerald-500/30 hover:border-emerald-500/50 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
                        title="Bảng giám sát bộ nhớ: dung lượng thư mục video tạm thời và tài nguyên ổ đĩa hệ thống"
                    >
                        <HardDrive className="w-4 h-4 text-emerald-400" />
                        <span className="hidden xl:inline">Giám Sát Ổ Đĩa</span>
                        {storageStats?.tempFolder && (
                            <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-mono px-1.5 py-0.2 rounded-full hidden sm:inline border border-emerald-500/30">
                                {storageStats.tempFolder.formattedTotal}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            {/* Toast alert */}
            {toastMessage && (
                <div className="fixed bottom-5 right-5 z-50 bg-slate-800 border border-emerald-500/50 text-emerald-300 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2.5 text-xs animate-in slide-in-from-bottom duration-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                    <span>{toastMessage}</span>
                </div>
            )}

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-6">
                {/* 1. Lấy & Tải Video từ Link Bilibili */}
                <LinkDownloader
                    onDownloadSuccess={handleDownloadSuccess}
                    onPlayVideo={setPlayingVideo}
                    onAnalyzeProducts={handleOpenProductAnalysis}
                />

                {/* 2. Thanh Tìm Kiếm, Bộ Lọc & Sắp Xếp Video (Tích Hợp Cùng Nút Reset) */}
                <SearchFilterBar
                    keyword={keyword}
                    onSearch={handleSearch}
                    order={order}
                    timeRange={timeRange}
                    onOrderChange={handleOrderChange}
                    onTimeRangeChange={handleTimeRangeChange}
                    onResetFilters={handleResetFilters}
                    onMasterReset={handleMasterReset}
                    totalResults={videos.length}
                    isLoading={isLoading}
                />

                {/* 3. Tiêu đề lưới video */}
                <div className="flex items-center justify-between px-1 mb-2">
                    <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                        {keyword ? (
                            <>Kết quả tìm kiếm cho: <span className="text-sky-400 font-semibold">"{keyword}"</span></>
                        ) : (
                            <>🔥 Video Đề Xuất Bilibili (Dịch Tiếng Việt)</>
                        )}
                    </h2>
                    <span className="text-xs text-slate-400">
                        {videos.length > 0 ? `${videos.length} video` : ''}
                    </span>
                </div>

                {/* 4. Lưới video (có nút kiểm tra trùng lặp & tải trực tiếp từng video, nút Soi Shopee) */}
                <VideoGrid
                    videos={videos}
                    isLoading={isLoading}
                    onDownloadSuccess={handleDownloadSuccess}
                    onPlayVideo={setPlayingVideo}
                    onAnalyzeProducts={handleOpenProductAnalysis}
                />
            </main>

            {/* 1. Modal Quản Lý Video Đầy Đủ (Thời gian tải, Tiêu đề, Thumbnails, Mã video, Xóa tệp) */}
            <VideoManagerModal
                isOpen={isManagerModalOpen}
                onClose={() => setIsManagerModalOpen(false)}
                onPlayVideo={setPlayingVideo}
                onOpenEditor={handleOpenEditor}
                onOpenUploader={() => setIsUploaderModalOpen(true)}
                onListChange={() => refreshCounts()}
                onAnalyzeProducts={handleOpenProductAnalysis}
            />

            {/* 2. Modal Tải Lên Video Cá Nhân */}
            <VideoUploaderModal
                isOpen={isUploaderModalOpen}
                onClose={() => setIsUploaderModalOpen(false)}
                onUploadSuccess={handleUploadSuccess}
            />

            {/* 3. Modal Xem Video Trực Tiếp */}
            <VideoPlayerModal
                video={playingVideo}
                onClose={() => setPlayingVideo(null)}
                onOpenEditor={handleOpenEditor}
                onAnalyzeProducts={handleOpenProductAnalysis}
            />

            {/* 4. Modal Quản lý Tệp tạm thời (Xóa tệp tạm thời 5 tiếng) */}
            <TempFilesModal
                isOpen={isTempModalOpen}
                onClose={() => setIsTempModalOpen(false)}
                onPlayVideo={setPlayingVideo}
                onOpenEditor={handleOpenEditor}
                onFilesChange={() => refreshCounts()}
                onOpenStorageDashboard={() => {
                    setIsTempModalOpen(false);
                    setIsStorageModalOpen(true);
                }}
            />

            {/* 5. Modal Bảng Giám Sát Dung Lượng & Ổ Đĩa Hệ Thống */}
            <StorageMonitorDashboard
                isOpen={isStorageModalOpen}
                onClose={() => setIsStorageModalOpen(false)}
                onOpenTempFiles={() => {
                    setIsStorageModalOpen(false);
                    setIsTempModalOpen(true);
                }}
                onStorageChange={(newStats) => setStorageStats(newStats)}
            />

            {/* 6. Studio Chỉnh Sửa Video (Vietsub Phụ Đề & Lồng Tiếng AI) */}
            {isEditorModalOpen && (
                <VideoEditorModal
                    isOpen={isEditorModalOpen}
                    onClose={() => setIsEditorModalOpen(false)}
                    initialVideo={editorVideo}
                    onVideoEdited={() => refreshCounts()}
                />
            )}

            {/* 7. Modal Phân Tích Sản Phẩm Video & Tra Cứu Shopee AI */}
            <ProductAnalysisModal
                isOpen={isProductModalOpen}
                onClose={() => {
                    setIsProductModalOpen(false);
                    setProductModalVideo(null);
                }}
                initialVideo={productModalVideo}
                allVideos={videos}
            />
        </div>
    );
}
