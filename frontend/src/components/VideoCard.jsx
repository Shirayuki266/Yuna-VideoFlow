import React from 'react';

export default function VideoCard({ video }) {
    if (!video) return null;

    return (
        <div className="bg-slate-800/80 rounded-xl overflow-hidden border border-slate-700/60 hover:border-sky-500/50 transition-all duration-300 flex flex-col group cursor-pointer hover:-translate-y-1 hover:shadow-xl hover:shadow-sky-500/10">
            {/* Thumbnail + Duration */}
            <div className="relative aspect-video w-full bg-slate-950 overflow-hidden">
                <img
                    src={video.cover}
                    alt={video.title_vi || video.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                />
                {video.duration && (
                    <span className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-2 py-0.5 rounded font-mono font-medium">
                        {video.duration}
                    </span>
                )}
            </div>

            {/* Video Details */}
            <div className="p-3.5 flex flex-col flex-1 justify-between">
                {/* 🚨 BẮT BUỘC: Ưu tiên hiển thị title_vi */}
                <h3 className="font-semibold text-white text-sm line-clamp-2 leading-snug group-hover:text-sky-400 transition-colors">
                    {video.title_vi || video.title}
                </h3>

                {/* Author & Stats */}
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400 border-t border-slate-700/40 pt-2.5">
                    <span className="truncate max-w-[130px] font-medium text-slate-300">
                        {video.author || "N/A"}
                    </span>
                    <div className="flex items-center gap-1.5 text-slate-400">
                        <span>▶ {video.play ? Number(video.play).toLocaleString() : 0}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}