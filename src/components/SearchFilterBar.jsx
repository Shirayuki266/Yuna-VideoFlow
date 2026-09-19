import React, { useState, useEffect } from 'react';
import {
  Search,
  X,
  Clock,
  Flame,
  Sparkles,
  Calendar,
  RotateCcw,
  RefreshCw,
  TrendingUp,
  SlidersHorizontal,
  Zap,
  Check,
  FilterX
} from 'lucide-react';

export default function SearchFilterBar({
  keyword = '',
  onSearch,
  order = 'totalrank',
  timeRange = 'all',
  onOrderChange,
  onTimeRangeChange,
  onResetFilters,
  onMasterReset,
  totalResults = 0,
  isLoading = false
}) {
  const [searchTerm, setSearchTerm] = useState(keyword || '');

  // Synchronize internal search term with external keyword prop
  useEffect(() => {
    setSearchTerm(keyword || '');
  }, [keyword]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch(searchTerm);
  };

  const handleClearSearch = () => {
    setSearchTerm('');
    onSearch('');
  };

  const handleFullReset = () => {
    setSearchTerm('');
    if (onMasterReset) {
      onMasterReset();
    } else if (onResetFilters) {
      onSearch('');
      onResetFilters();
    }
  };

  const isFiltered = Boolean(keyword) || order !== 'totalrank' || timeRange !== 'all';

  const orderOptions = [
    {
      id: 'totalrank',
      label: 'Mặc định',
      description: 'Đề xuất & Liên quan nhất',
      icon: Sparkles
    },
    {
      id: 'pubdate',
      label: 'Mới nhất',
      description: 'Vừa đăng gần đây',
      icon: Clock
    },
    {
      id: 'click',
      label: 'Theo view',
      description: 'Nhiều lượt xem nhất',
      icon: Flame
    }
  ];

  const timeRangeOptions = [
    { id: 'all', label: 'Tất cả', icon: Calendar, badge: 'Mọi lúc' },
    { id: 'today', label: 'Trong ngày', icon: Zap, badge: '24h' },
    { id: 'week', label: 'Trong tuần', icon: Calendar, badge: '7 ngày' },
    { id: 'month', label: 'Trong tháng', icon: Calendar, badge: '30 ngày' },
    { id: 'year', label: 'Trong năm', icon: Calendar, badge: '1 năm' }
  ];

  return (
    <div
      id="search-filter-bar"
      className="bg-slate-900/95 border border-slate-800 rounded-2xl p-4 sm:p-5 mb-6 shadow-xl shadow-black/30 backdrop-blur space-y-4"
    >
      {/* ================= Row 1: Integrated Search Input & Reset Buttons ================= */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        {/* Main Search Input Form */}
        <form onSubmit={handleSubmit} className="relative flex-1 flex items-center">
          <div className="relative w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              id="main-search-input"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm video Bilibili (anime, âm nhạc, công nghệ, vlog...)..."
              className="w-full bg-slate-950/90 text-sm text-white placeholder-slate-400 rounded-xl py-2.5 pl-10 pr-24 border border-slate-700/80 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all shadow-inner"
            />

            {/* Clear input button */}
            {searchTerm && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-12 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Xóa từ khóa tìm kiếm"
              >
                <X className="w-4 h-4" />
              </button>
            )}

            {/* Submit button inside or right of input */}
            <button
              type="submit"
              disabled={isLoading}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold rounded-lg transition-all shadow cursor-pointer active:scale-95 disabled:opacity-50 flex items-center gap-1"
            >
              <span>Tìm</span>
            </button>
          </div>
        </form>

        {/* Action Buttons: Reset All Button (Nút Reset khi không hài lòng) */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            id="master-reset-btn"
            type="button"
            onClick={handleFullReset}
            disabled={isLoading}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-md active:scale-95 ${
              isFiltered
                ? 'bg-gradient-to-r from-rose-600/90 to-amber-600/90 hover:from-rose-500 hover:to-amber-500 text-white ring-1 ring-amber-400/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700'
            }`}
            title="Đặt lại toàn bộ từ khóa, bộ lọc và làm mới lại danh sách video"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>Reset (Làm mới)</span>
          </button>
        </div>
      </div>

      {/* ================= Row 2 & 3: Filter & Sort Controls ================= */}
      <div className="pt-2 border-t border-slate-800/80 grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
        {/* Left: Sắp xếp (5 cols) */}
        <div className="lg:col-span-5 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 min-w-[65px] flex items-center gap-1">
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
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
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

        {/* Right: Thời gian đăng (7 cols) */}
        <div className="lg:col-span-7 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-400 min-w-[65px] flex items-center gap-1">
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
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-purple-600 text-white font-bold shadow-md shadow-purple-600/20'
                      : 'bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700'
                  }`}
                  title={`Lọc video đăng ${opt.badge}`}
                >
                  <Icon className="w-3 h-3 text-slate-400" />
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
      </div>

      {/* ================= Row 4: Summary Indicator line ================= */}
      <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 bg-slate-950/70 px-3.5 py-2 rounded-xl border border-slate-800/70">
        <div className="flex flex-wrap items-center gap-2">
          <span>Tìm kiếm:</span>
          <strong className="text-sky-300">
            {keyword ? `"${keyword}"` : 'Tất cả video'}
          </strong>
          <span>•</span>
          <span>Sắp xếp:</span>
          <strong className="text-amber-300">
            {order === 'pubdate' && '🕒 Mới nhất'}
            {order === 'click' && '🔥 Theo view (Nhiều view nhất)'}
            {order === 'totalrank' && '⚡ Mặc định'}
          </strong>
          <span>•</span>
          <span>Thời gian:</span>
          <strong className="text-purple-300">
            {timeRange === 'all' && '🌐 Mọi lúc'}
            {timeRange === 'today' && '⚡ 24h qua'}
            {timeRange === 'week' && '🗓️ 7 ngày qua'}
            {timeRange === 'month' && '🌙 30 ngày qua'}
            {timeRange === 'year' && '📆 1 năm qua'}
          </strong>
        </div>

        <div className="flex items-center gap-3">
          {isLoading ? (
            <span className="text-sky-400 animate-pulse flex items-center gap-1 font-medium">
              <RefreshCw className="w-3 h-3 animate-spin" /> Đang tải video...
            </span>
          ) : (
            totalResults > 0 && (
              <span className="text-slate-400 font-mono text-[10px]">
                Hiển thị {totalResults} video
              </span>
            )
          )}

          {/* Reset Filters quick link if active */}
          {isFiltered && (
            <button
              type="button"
              onClick={handleFullReset}
              className="text-[11px] text-rose-400 hover:text-rose-300 underline flex items-center gap-1 transition-colors cursor-pointer"
            >
              <FilterX className="w-3 h-3" />
              <span>Xóa bộ lọc & Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
