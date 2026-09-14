import React from 'react';

export default function SkeletonCard() {
    return (
        <div className="bg-slate-800/60 rounded-xl overflow-hidden border border-slate-700/40 animate-pulse flex flex-col">
            {/* Thumbnail Skeleton */}
            <div className="aspect-video w-full bg-slate-700/50"></div>

            {/* Details Skeleton */}
            <div className="p-3.5 flex flex-col gap-2.5">
                <div className="h-4 bg-slate-700/50 rounded w-full"></div>
                <div className="h-4 bg-slate-700/50 rounded w-3/4"></div>

                <div className="mt-2 pt-2.5 flex justify-between border-t border-slate-700/30">
                    <div className="h-3 bg-slate-700/50 rounded w-1/3"></div>
                    <div className="h-3 bg-slate-700/50 rounded w-1/4"></div>
                </div>
            </div>
        </div>
    );
}