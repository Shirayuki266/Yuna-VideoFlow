import React, { useState, useEffect, useRef } from 'react';
import { Search, X, SlidersHorizontal, Clock, Flame, Calendar, Sparkles, Check, RotateCcw } from 'lucide-react';

export default function SearchBar({
  onSearch,
  initialTerm = '',
  order = 'totalrank',
  timeRange = 'all',
  onOrderChange,
  onTimeRangeChange,
  onResetFilters
}) {
  const [term, setTerm] = useState(initialTerm);
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    setTerm(initialTerm);
  }, [initialTerm]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsFilterMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setIsFilterMenuOpen(false);
    onSearch(term);
  };

  const handleClear = () => {
    setTerm('');
    onSearch('');
  };

  const isFiltered = order !== 'totalrank' || timeRange !== 'all';

  return (
    <div className="relative w-full max-w-md" ref={menuRef}>
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <input
          id="main-search-input"
          type="text"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Tìm kiếm video Bilibili (anime, nhạc, hài...)"
          className="w-full bg-slate-800/90 text-sm text-white placeholder-slate-400 rounded-full py-2 pl-9 pr-20 border border-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all shadow-inner"
        />

        {/* Search Icon */}
        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 pointer-events-none" />

        {/* Right side controls inside input */}
        <div className="absolute right-1.5 flex items-center gap-1">
          {/* Clear button */}
          {term && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-slate-700 transition-colors"
              title="Xóa từ khóa"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Quick Filter toggle button */}
          <button
            id="search-filter-dropdown-toggle-btn"
            type="button"
            onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
            className={`p-1.5 rounded-full transition-all flex items-center justify-center ${
              isFiltered
                ? 'bg-sky-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="Lọc theo mới nhất, theo view, trong ngày/tuần/tháng/năm"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            {isFiltered && (
              <span className="w-1.5 h-1.5 bg-amber-300 rounded-full absolute -top-0.5 -right-0.5"></span>
            )}
          </button>
        </div>

        <button type="submit" className="hidden">Tìm</button>
      </form>

      {/* Dropdown Menu for Filters directly under search bar */}
      {isFilterMenuOpen && (
        <div
          id="search-filter-dropdown-menu"
          className="absolute top-full mt-2 left-0 right-0 z-50 bg-slate-900 border border-slate-700 rounded-2xl p-3.5 shadow-2xl shadow-black/80 flex flex-col gap-3 backdrop-blur"
        >
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <span className="text-xs font-semibold text-white flex items-center gap-1.5">
              <SlidersHorizontal className="w-3.5 h-3.5 text-sky-400" />
              Tùy chọn tìm kiếm & Lọc
            </span>
            {isFiltered && onResetFilters && (
              <button
                type="button"
                onClick={() => {
                  onResetFilters();
                  setIsFilterMenuOpen(false);
                }}
                className="text-[11px] text-sky-400 hover:text-sky-300 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Mặc định
              </button>
            )}
          </div>

          {/* Sort Order */}
          <div>
            <span className="text-[11px] font-medium text-slate-400 block mb-1.5">
              Sắp xếp theo:
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'totalrank', label: 'Mặc định', icon: Sparkles },
                { id: 'pubdate', label: 'Mới nhất', icon: Clock },
                { id: 'click', label: 'Theo view', icon: Flame }
              ].map((opt) => {
                const Icon = opt.icon;
                const active = order === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      if (onOrderChange) onOrderChange(opt.id);
                    }}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1 transition-all ${
                      active
                        ? 'bg-sky-600 text-white font-bold shadow'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    <Icon className="w-3 h-3" />
                    <span>{opt.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Time Range */}
          <div>
            <span className="text-[11px] font-medium text-slate-400 block mb-1.5">
              Khoảng thời gian:
            </span>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'all', label: 'Tất cả' },
                { id: 'today', label: 'Trong ngày' },
                { id: 'week', label: 'Trong tuần' },
                { id: 'month', label: 'Trong tháng' },
                { id: 'year', label: 'Trong năm' }
              ].map((opt) => {
                const active = timeRange === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      if (onTimeRangeChange) onTimeRangeChange(opt.id);
                    }}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium transition-all text-center ${
                      active
                        ? 'bg-purple-600 text-white font-bold shadow'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Action button */}
          <div className="pt-1 flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setIsFilterMenuOpen(false);
                onSearch(term);
              }}
              className="px-3 py-1.5 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5" />
              Áp dụng & Tìm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
