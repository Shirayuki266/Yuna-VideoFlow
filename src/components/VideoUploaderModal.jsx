import React, { useState, useRef } from 'react';
import axios from 'axios';
import { Upload, X, Film, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export default function VideoUploaderModal({ isOpen, onClose, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [customTitle, setCustomTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;

    // Check if video type
    const validExts = ['.mp4', '.mkv', '.webm', '.mov', '.avi', '.flv', '.ts'];
    const hasValidExt = validExts.some(ext => selectedFile.name.toLowerCase().endsWith(ext));

    if (!selectedFile.type.startsWith('video/') && !hasValidExt) {
      setErrorMessage('Vui lòng chọn định dạng tệp video (.mp4, .mkv, .webm, .mov, .avi, .flv).');
      return;
    }

    // Check 500MB limit
    if (selectedFile.size > 500 * 1024 * 1024) {
      setErrorMessage('Dung lượng tệp vượt quá giới hạn cho phép (tối đa 500MB).');
      return;
    }

    setErrorMessage('');
    setFile(selectedFile);
    if (!customTitle) {
      setCustomTitle(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file || isUploading) return;

    setIsUploading(true);
    setUploadProgress(0);
    setErrorMessage('');

    const formData = new FormData();
    formData.append('video', file);
    if (customTitle.trim()) {
      formData.append('title', customTitle.trim());
    }

    try {
      const res = await axios.post('/api/upload/video', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setUploadProgress(percent);
          }
        },
      });

      if (res.data.success) {
        setIsUploading(false);
        if (onUploadSuccess) {
          onUploadSuccess(res.data.data);
        }
        onClose();
      } else {
        throw new Error(res.data.error || 'Tải lên thất bại.');
      }
    } catch (err) {
      console.error('Lỗi khi tải lên video:', err);
      setIsUploading(false);
      setErrorMessage(err.response?.data?.error || err.message || 'Lỗi khi tải lên video cá nhân.');
    }
  };

  const formatSize = (bytes) => {
    if (!bytes) return '0 B';
    const mb = (bytes / (1024 * 1024)).toFixed(1);
    return `${mb} MB`;
  };

  return (
    <div
      id="video-uploader-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="bg-slate-900 border border-slate-700/80 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-white text-base">Tải Lên Video Cá Nhân</h3>
              <p className="text-xs text-slate-400">
                Tự động tạo thumbnail, mã quản lý và lưu trữ trong thư viện
              </p>
            </div>
          </div>

          <button
            id="uploader-close-btn"
            type="button"
            onClick={onClose}
            disabled={isUploading}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleUpload} className="p-5 space-y-4">
          {/* Drag & Drop Area */}
          <div
            id="upload-drop-zone"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragOver
                ? 'border-purple-500 bg-purple-500/10'
                : file
                ? 'border-emerald-500/60 bg-emerald-500/5'
                : 'border-slate-700 hover:border-slate-500 bg-slate-950/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,.mp4,.mkv,.webm,.mov,.avi,.flv"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileSelect(e.target.files[0]);
                }
              }}
            />

            {file ? (
              <div className="flex flex-col items-center">
                <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-full mb-2">
                  <Film className="w-6 h-6" />
                </div>
                <p className="font-semibold text-white text-sm truncate max-w-full px-2">
                  {file.name}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Dung lượng: <span className="text-emerald-400 font-mono">{formatSize(file.size)}</span>
                </p>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setFile(null);
                  }}
                  className="mt-2 text-xs text-rose-400 hover:text-rose-300 underline"
                >
                  Chọn tệp khác
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <div className="p-3 bg-slate-800 text-purple-400 rounded-full mb-3">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="font-medium text-slate-200 text-sm">
                  Kéo thả video vào đây hoặc <span className="text-purple-400 font-semibold">chọn từ máy tính</span>
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Hỗ trợ MP4, MKV, WebM, MOV, AVI (Tối đa 500 MB)
                </p>
              </div>
            )}
          </div>

          {/* Title Input */}
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Tiêu đề video
            </label>
            <input
              id="upload-video-title-input"
              type="text"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="Nhập tiêu đề hoặc để mặc định tên tệp"
              disabled={isUploading}
              className="w-full bg-slate-950 text-sm text-white placeholder-slate-500 rounded-xl px-4 py-2.5 border border-slate-700 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
            />
          </div>

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-xs text-slate-300">
                <span className="flex items-center gap-1 text-purple-400 font-medium">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang tải lên và trích xuất ảnh bìa...
                </span>
                <span className="font-mono">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full transition-all duration-300 rounded-full"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Notice */}
          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Footer Submit */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-medium transition-colors"
            >
              Hủy
            </button>
            <button
              id="upload-submit-btn"
              type="submit"
              disabled={!file || isUploading}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-slate-800 disabled:text-slate-600 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-lg shadow-purple-600/20"
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Đang tải lên...
                </>
              ) : (
                <>
                  <Upload className="w-3.5 h-3.5" />
                  Tải lên ngay
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
