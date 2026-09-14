import React, { useState } from 'react';
import { Search } from 'lucide-react';

export default function SearchBar({ onSearch }) {
    const [term, setTerm] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        onSearch(term);
    };

    return (
        <form onSubmit={handleSubmit} className="relative w-full max-w-md">
            <input
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Tìm kiếm video Bilibili..."
                className="w-full bg-slate-800 text-sm text-white placeholder-slate-400 rounded-full py-2 pl-10 pr-4 border border-slate-700 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
            />
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <button type="submit" className="hidden">Tìm</button>
        </form>
    );
}