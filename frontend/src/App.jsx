import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import VideoGrid from './components/VideoGrid';
import SearchBar from './components/SearchBar';

export default function App() {
    const [videos, setVideos] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [keyword, setKeyword] = useState('');
    const [hasMore, setHasMore] = useState(true);

    // Hàm fetch dữ liệu từ API
    const fetchVideos = async (currentPage, currentKeyword, isNewSearch = false) => {
        if (isLoading) return;
        setIsLoading(true);

        try {
            const res = await axios.get('http://127.0.0.1:8000/api/videos', {
                params: {
                    platform: 'bilibili',
                    keyword: currentKeyword,
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

    // Tải dữ liệu khi page hoặc keyword thay đổi
    useEffect(() => {
        fetchVideos(page, keyword, page === 1);
    }, [page, keyword]);

    // Xử lý khi người dụng tìm kiếm từ khóa mới
    const handleSearch = (newKeyword) => {
        if (newKeyword === keyword) return;
        setVideos([]);
        setHasMore(true);
        setKeyword(newKeyword);
        setPage(1);
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
        <div className="min-h-screen bg-slate-900 text-white">
            {/* Header Bar */}
            <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50 px-6 py-3.5 flex flex-wrap gap-4 justify-between items-center">
                <h1
                    onClick={() => handleSearch('')}
                    className="text-xl font-bold bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent cursor-pointer"
                >
                    🚀 Yuna-VideoFlow
                </h1>

                {/* Thanh tìm kiếm */}
                <SearchBar onSearch={handleSearch} />

                <span className="text-xs bg-sky-500/10 text-sky-400 border border-sky-500/20 px-3 py-1 rounded-full font-medium hidden sm:inline-block">
                    FastAPI + Gemini AI
                </span>
            </header>

            {/* Main Grid Content */}
            <main className="max-w-7xl mx-auto">
                <VideoGrid videos={videos} isLoading={isLoading} />
            </main>
        </div>
    );
}