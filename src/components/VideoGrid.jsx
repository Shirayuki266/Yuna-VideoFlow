import React from 'react';
import VideoCard from './VideoCard';
import SkeletonCard from './SkeletonCard';

export default function VideoGrid({ videos = [], isLoading = false, onDownloadSuccess, onPlayVideo }) {
    const hasVideos = videos && videos.length > 0;

    return (
        <div className="w-full px-4 py-6">
            {/* 1. Màn hình trống khi không cào được dữ liệu và đã load xong */}
            {!isLoading && !hasVideos && (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                    <svg className="w-16 h-16 mb-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <p className="text-lg font-medium">Không tìm thấy video nào!</p>
                    <p className="text-sm text-slate-500 mt-1">Vui lòng thử lại hoặc đổi từ khóa tìm kiếm khác.</p>
                </div>
            )}

            {/* 2. Responsive Grid 4 Cột */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 w-full">
                {/* Đổ danh sách video hiện có */}
                {hasVideos && videos.map((video, index) => (
                    <VideoCard
                        key={`${video.bvid}-${index}`}
                        video={video}
                        onDownloadSuccess={onDownloadSuccess}
                        onPlayVideo={onPlayVideo}
                    />
                ))}

                {/* Khung xám Skeleton nhấp nháy 16 ô khi đang cào dữ liệu mới */}
                {isLoading &&
                    Array.from({ length: 16 }).map((_, i) => (
                        <SkeletonCard key={`skeleton-${i}`} />
                    ))
                }
            </div>
        </div>
    );
}
