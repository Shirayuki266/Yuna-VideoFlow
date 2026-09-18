import React from 'react';
import {
  Clock,
  Flame,
  Sparkles,
  Calendar,
  RotateCcw,
  Filter,
  Check,
  Zap,
  TrendingUp,
  SlidersHorizontal
} from 'lucide-react';

export default function SearchFilterBar({
  order = 'totalrank',
  timeRange = 'all',
  onOrderChange,
  onTimeRangeChange,
  onResetFilters,
  totalResults = 0,
  keyword = '',
  isLoading = false
}) {
  const isFiltered = order !== 'totalrank' || timeRange !== 'all';

  const orderOptions = [
    {
      id: 'totalrank',
      label: 'Mặc định',
      description: 'Đề xuất & Liên quan nhất',
      icon: Sparkles,
      color: 'sky'
    },
    {
      id: 'pubdate',
      label: 'Mới nhất',
      description: 'Vừa đăng gần đây',
      icon: Clock,
      color: 'emerald'
    },
    {
      id: 'click',
      label: 'Theo view',
      description: 'Lượt xem cao nhất',
      icon: Flame,
      color: 'amber'
    }
  ];

  const timeRangeOptions = [
    { id: 'all', label: 'Tất cả', icon: Calendar, badge: 'Mọi lúc' },
    { id: 'today', label: 'Trong ngày', icon: Zap, badge: '24h qua' },
    { id: 'week', label: 'Trong tuần', icon: Calendar, badge: '7 ngày qua' },
    { id: 'month', label: 'Trong tháng', icon: Calendar, badge: '30 ngày qua' },
    { id: 'year', label: 'Trong năm', icon: Calendar, badge: '365 ngày qua' }
  ];

  return (
    <div
      id="search-filter-bar"
      className="bg-slate-900/90 border border-slate-800 rounded-2xl p-3.5 sm:p-4 mb-5 shadow-lg shadow-black/20 backdrop-blur"
    >
      <div className="flex flex-col gap-3">
        {/* Row 1: Section Header & Active Status */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-sky-500/10 text-sky-400 rounded-lg border border-sky-500/20">
              <SlidersHorizontal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
                Bộ Lọc & Sắp Xếp Video
                {isLoading && (
                  <span className="text-[10px] text-sky-400 animate-pulse font-normal">
                    (Đang tải...)
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-slate-400">
                Tìm kiếm chính xác theo thời gian tải (trong ngày/tuần/tháng/năm) và theo view hoặc mới nhất
              </p>
            </div>
          </div>

          {/* Reset Filters Button */}
          {isFiltered && (
            <button
              id="reset-search-filters-btn"
              type="button"
              onClick={onResetFilters}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700/80"
              title="Đặt lại tất cả bộ lọc về mặc định"
            >
              <RotateCcw className="w-3 h-3 text-sky-400" />
              <span>Đặt lại bộ lọc</span>
            </button>
          )}
        </div>

        {/* Row 2: Sort Order Options (Mới nhất, Theo view, Mặc định) */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 min-w-[70px] flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-sky-400" />
            Sắp xếp:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {orderOptions.map((opt) => {
              const Icon = opt.icon;
              const isActive = order === opt.id;
              return (
                <button
                  key={opt.id}
                  id={`filter-order-${opt.id}-btn`}
                  type="button"
                  onClick={() => onOrderChange(opt.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                    isActive
                      ? opt.id === 'click'
                        ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                        : opt.id === 'pubdate'
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                        : 'bg-sky-600 text-white font-bold shadow-md shadow-sky-600/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                  }`}
                  title={opt.description}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{opt.label}</span>
                  {isActive && <Check className="w-3 h-3 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 3: Time Range Filter (Trong ngày, Trong tuần, Trong tháng, Trong năm, Tất cả) */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs font-medium text-slate-400 min-w-[70px] flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-purple-400" />
            Thời gian:
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {timeRangeOptions.map((opt) => {
              const Icon = opt.icon;
              const isActive = timeRange === opt.id;
              return (
                <button
                  key={opt.id}
                  id={`filter-timerange-${opt.id}-btn`}
                  type="button"
                  onClick={() => onTimeRangeChange(opt.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all ${
                    isActive
                      ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                  }`}
                  title={`Lọc video đăng ${opt.badge}`}
                >
                  <Icon className="w-3.5 h-3.5 text-slate-400 group-hover:text-white" />
                  <span>{opt.label}</span>
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isActive ? 'bg-purple-700 text-purple-100' : 'bg-slate-900 text-slate-400'
                    }`}
                  >
                    {opt.badge}
                  </span>
                  {isActive && <Check className="w-3 h-3 ml-0.5" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Summary Indicator line */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800/60 mt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span>Đang tìm kiếm:</span>
            <strong className="text-sky-300">
              {keyword ? `"${keyword}"` : 'Khám phá video'}
            </strong>
            <span>•</span>
            <span>Sắp xếp:</span>
            <strong className="text-amber-300">
              {order === 'pubdate' && '🕒 Mới nhất'}
              {order === 'click' && '🔥 Theo view (Nhiều lượt xem nhất)'}
              {order === 'totalrank' && '⚡ Mặc định'}
            </strong>
            <span>•</span>
            <span>Khoảng thời gian:</span>
            <strong className="text-purple-300">
              {timeRange === 'all' && '🌐 Tất cả thời gian'}
              {timeRange === 'today' && '⚡ Trong ngày (24 giờ qua)'}
              {timeRange === 'week' && '🗓️ Trong tuần (7 ngày qua)'}
              {timeRange === 'month' && '🌙 Trong tháng (30 ngày qua)'}
              {timeRange === 'year' && '📆 Trong năm (365 ngày qua)'}
            </strong>
          </div>

          {totalResults > 0 && (
            <span className="text-slate-400 font-mono text-[10px]">
              Hiển thị {totalResults} video
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
