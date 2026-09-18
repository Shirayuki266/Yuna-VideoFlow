import React, { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import {
  X,
  Sparkles,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Download,
  Save,
  Check,
  Languages,
  Mic,
  Sliders,
  Type,
  FileVideo,
  Clock,
  ExternalLink,
  ChevronRight,
  Upload,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Bot,
  Radio,
  Zap,
  Cpu,
  Flame,
  Headphones,
  MessageSquareText,
  LogOut
} from 'lucide-react';

export const DEFAULT_GEMINI_MODULES = [
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    category: "vietsub",
    badge: "Khuyên Dùng Vietsub",
    description: "Mô hình Flash thế hệ 3.6 chuẩn mới nhất, tốc độ cực nhanh, bám sát ngữ cảnh video và Tiếng Việt tự nhiên.",
    recommendedFor: "Dịch phụ đề video, làm Vietsub chuẩn, phản hồi tức thì",
    isAudioCapable: false
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    category: "vietsub",
    badge: "Thế Hệ 3.8 Mới",
    description: "Mô hình Flash thế hệ 3.8 thông minh với khả năng hiểu sâu ngữ cảnh video, dịch thuật văn phong mượt mà.",
    recommendedFor: "Dịch thuật phong cách đời thực, phụ đề diễn cảm",
    isAudioCapable: false
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    category: "vietsub",
    badge: "Siêu Nhẹ & Tiết Kiệm",
    description: "Mô hình siêu nhẹ, độ trễ tối thiểu, tối ưu hóa cho các video ngắn và phụ đề nhanh chóng.",
    recommendedFor: "Tạo Vietsub nhanh cho video ngắn Shorts/Reels/TikTok",
    isAudioCapable: false
  },
  {
    id: "gemini-flash-latest",
    name: "Gemini Flash Latest",
    category: "vietsub",
    badge: "Bản Cập Nhật Mới",
    description: "Phiên bản Flash cập nhật liên tục từ Google AI Studio, tối ưu hoá xử lý đa ngữ.",
    recommendedFor: "Xử lý đa ngữ và tự động căn chỉnh mốc thời gian",
    isAudioCapable: false
  },
  {
    id: "gemini-3.5-transcribe",
    name: "Gemini 3.5 Transcribe",
    category: "vietsub",
    badge: "Đồng Bộ Timecode",
    description: "Mô hình trích xuất âm thanh và đồng bộ hóa mốc thời gian (start - end) chuẩn xác từng phân đoạn.",
    recommendedFor: "Bóc băng video & chia mốc thời gian phụ đề",
    isAudioCapable: false
  },
  {
    id: "gemini-3.1-flash-tts-preview",
    name: "Gemini 3.1 Flash TTS Preview",
    category: "dubbing",
    badge: "Studio TTS Chuẩn",
    description: "Mô hình Text-To-Speech chính thức của Google AI, tạo âm thanh lồng tiếng chuẩn phòng thu với các giọng đọc AI biểu cảm.",
    recommendedFor: "Lồng tiếng AI giọng đọc chuyên nghiệp",
    isAudioCapable: true
  }
];

export const GEMINI_VOICES = [
  { id: 'Zephyr', name: 'Zephyr (Nữ)', desc: 'Trong trẻo, cuốn hút, truyền cảm', tag: 'Phổ biến' },
  { id: 'Puck', name: 'Puck (Nam)', desc: 'Trẻ trung, năng động, tươi vui', tag: 'Shorts/Reels' },
  { id: 'Charon', name: 'Charon (Nam)', desc: 'Trầm ấm, uy tín, tài liệu/review', tag: 'Review/Phim' },
  { id: 'Kore', name: 'Kore (Nữ)', desc: 'Dịu dàng, tâm sự, sâu lắng', tag: 'Kể chuyện' },
  { id: 'Fenrir', name: 'Fenrir (Nam)', desc: 'Mạnh mẽ, kịch tính, hùng tráng', tag: 'Hành động' }
];

export default function VideoEditorModal({ isOpen, onClose, initialVideo = null, onVideoEdited }) {
  // Selected video state
  const [selectedVideo, setSelectedVideo] = useState(initialVideo);
  const [selectableVideos, setSelectableVideos] = useState([]);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(!initialVideo);
  const [pickerSearch, setPickerSearch] = useState('');

  // Video playback & timeline state
  const videoRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Tabs: 'subtitles' | 'dubbing' | 'styling'
  const [activeTab, setActiveTab] = useState('subtitles');

  // Gemini Modules state
  const [geminiModules, setGeminiModules] = useState(DEFAULT_GEMINI_MODULES);
  const [selectedVietsubModel, setSelectedVietsubModel] = useState('gemini-3.6-flash');
  const [selectedDubbingModel, setSelectedDubbingModel] = useState('gemini-3.1-flash-tts-preview');
  const [dubbingEngine, setDubbingEngine] = useState('gemini'); // 'gemini' | 'browser'
  const [geminiVoice, setGeminiVoice] = useState('Zephyr');
  const [isGeneratingGeminiAudio, setIsGeneratingGeminiAudio] = useState(false);
  const [cachedAudio, setCachedAudio] = useState({});

  // Subtitles state
  const [subtitles, setSubtitles] = useState([]);
  const [activeSubtitle, setActiveSubtitle] = useState(null);
  const [isGeneratingVietsub, setIsGeneratingVietsub] = useState(false);
  const [vietsubStyle, setVietsubStyle] = useState('natural');

  // Subtitle styling state
  const [subtitleStyle, setSubtitleStyle] = useState({
    fontSize: 20,
    color: '#facc15', // yellow
    bgColor: 'rgba(0, 0, 0, 0.75)',
    position: 'bottom', // 'bottom' | 'top' | 'middle'
    stroke: true
  });

  // AI Dubbing state
  const [availableVoices, setAvailableVoices] = useState([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState('');
  const [voiceRate, setVoiceRate] = useState(1.0);
  const [voicePitch, setVoicePitch] = useState(1.0);
  const [isDubbingEnabled, setIsDubbingEnabled] = useState(true);
  const [autoDuck, setAutoDuck] = useState(true);
  const [originalVolume, setOriginalVolume] = useState(0.2); // 20% by default for clear dubbing
  const [isOriginalMuted, setIsOriginalMuted] = useState(false);
  const [aiVolume, setAiVolume] = useState(1.0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const lastSpokenSubIdRef = useRef(null);

  // Saving state
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3500);
  };

  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    if (onClose) onClose();
  };

  // Escape key handler and scroll lock
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        if (isPickerOpen && selectedVideo) {
          setIsPickerOpen(false);
        } else {
          handleClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isPickerOpen, selectedVideo]);

  // Fetch modules from server
  useEffect(() => {
    axios.get('/api/gemini/modules')
      .then(res => {
        if (res.data?.success && Array.isArray(res.data.data) && res.data.data.length > 0) {
          setGeminiModules(res.data.data);
        }
      })
      .catch(() => {});
  }, []);

  // Load available videos when modal opens
  const fetchSelectableVideos = async () => {
    setIsLoadingVideos(true);
    try {
      const res = await axios.get('/api/editor/videos');
      if (res.data.success) {
        setSelectableVideos(res.data.data || []);
      }
    } catch (err) {
      console.error('Failed to load selectable videos:', err);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  useEffect(() => {
    fetchSelectableVideos();
  }, []);

  // Update selected video if initialVideo changes
  useEffect(() => {
    if (initialVideo) {
      setSelectedVideo(initialVideo);
      setIsPickerOpen(false);
    }
  }, [initialVideo]);

  // Load saved project for the selected video
  useEffect(() => {
    if (!selectedVideo?.id) return;

    const loadProject = async () => {
      try {
        const res = await axios.get(`/api/editor/project/${selectedVideo.id}`);
        if (res.data.success && res.data.data) {
          const p = res.data.data;
          if (p.subtitles && p.subtitles.length > 0) {
            setSubtitles(p.subtitles);
          } else {
            // Seed with an initial sample subtitle if empty
            initDefaultSubtitles();
          }
          if (p.subtitleStyle) {
            setSubtitleStyle((prev) => ({ ...prev, ...p.subtitleStyle }));
          }
          if (p.dubbing) {
            setIsDubbingEnabled(p.dubbing.enabled ?? true);
            if (p.dubbing.rate) setVoiceRate(p.dubbing.rate);
            if (p.dubbing.pitch) setVoicePitch(p.dubbing.pitch);
            if (p.dubbing.originalAudioVolume !== undefined) {
              setOriginalVolume(p.dubbing.originalAudioVolume);
            }
            if (p.dubbing.autoDuck !== undefined) {
              setAutoDuck(p.dubbing.autoDuck);
            }
          }
        } else {
          initDefaultSubtitles();
        }
      } catch {
        initDefaultSubtitles();
      }
    };

    const initDefaultSubtitles = () => {
      const vidTitle = selectedVideo.title_vi || selectedVideo.title || 'Video';
      setSubtitles([
        {
          id: 'sub_1',
          start: 0.5,
          end: 4.5,
          text: `Chào mừng bạn đến với: ${vidTitle.slice(0, 60)}`
        },
        {
          id: 'sub_2',
          start: 5.0,
          end: 9.0,
          text: 'Video đã sẵn sàng để tạo Vietsub tự động và lồng tiếng AI.'
        }
      ]);
    };

    loadProject();
  }, [selectedVideo?.id]);

  // Initialize browser Speech Synthesis voices
  useEffect(() => {
    const updateVoices = () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        const voices = window.speechSynthesis.getVoices();
        setAvailableVoices(voices);

        // Auto-select Vietnamese voice if available
        const viVoice = voices.find(
          (v) =>
            v.lang.toLowerCase().includes('vi') ||
            v.name.toLowerCase().includes('vietnam') ||
            v.name.toLowerCase().includes('tiếng việt')
        );
        if (viVoice) {
          setSelectedVoiceURI(viVoice.voiceURI);
        } else if (voices.length > 0 && !selectedVoiceURI) {
          setSelectedVoiceURI(voices[0].voiceURI);
        }
      }
    };

    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }

    return () => {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Sync video audio volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = isOriginalMuted ? 0 : originalVolume;
    }
  }, [originalVolume, isOriginalMuted]);

  // Find active subtitle matching currentTime
  useEffect(() => {
    const found = subtitles.find(
      (s) => currentTime >= s.start && currentTime <= s.end
    );
    setActiveSubtitle(found || null);

    // AI Dubbing synchronized speech trigger
    if (
      isDubbingEnabled &&
      isPlaying &&
      found &&
      found.id !== lastSpokenSubIdRef.current &&
      found.text.trim()
    ) {
      lastSpokenSubIdRef.current = found.id;
      playOrSpeakText(found.text);
    }
  }, [currentTime, subtitles, isDubbingEnabled, isPlaying, dubbingEngine, selectedDubbingModel, geminiVoice, cachedAudio]);

  // Browser speech synthesis function
  const speakText = (text, onFinish) => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      window.speechSynthesis.cancel(); // cancel any ongoing speech

      const utterance = new SpeechSynthesisUtterance(text);
      if (selectedVoiceURI) {
        const voiceObj = availableVoices.find((v) => v.voiceURI === selectedVoiceURI);
        if (voiceObj) utterance.voice = voiceObj;
      }
      utterance.rate = voiceRate;
      utterance.pitch = voicePitch;
      utterance.volume = aiVolume;

      utterance.onstart = () => {
        setIsSpeaking(true);
        // Audio ducking: lower video volume if enabled
        if (autoDuck && videoRef.current && !isOriginalMuted) {
          videoRef.current.volume = Math.min(originalVolume, 0.08);
        }
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        // Restore video volume
        if (autoDuck && videoRef.current && !isOriginalMuted) {
          videoRef.current.volume = originalVolume;
        }
        if (onFinish) onFinish();
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        if (autoDuck && videoRef.current && !isOriginalMuted) {
          videoRef.current.volume = originalVolume;
        }
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('Speech synthesis error:', err);
    }
  };

  // Dual-engine speech player: Gemini Cloud Audio or Browser Speech
  const playOrSpeakText = async (text, onFinish) => {
    if (!text || !text.trim()) return;

    if (dubbingEngine === 'gemini') {
      const cacheKey = `${selectedDubbingModel}_${geminiVoice}_${text.trim()}`;
      if (cachedAudio[cacheKey]) {
        try {
          const item = cachedAudio[cacheKey];
          const audio = new Audio(`data:${item.mimeType};base64,${item.base64}`);
          audio.volume = aiVolume;
          setIsSpeaking(true);
          if (autoDuck && videoRef.current && !isOriginalMuted) {
            videoRef.current.volume = Math.min(originalVolume, 0.08);
          }
          audio.onended = () => {
            setIsSpeaking(false);
            if (autoDuck && videoRef.current && !isOriginalMuted) {
              videoRef.current.volume = originalVolume;
            }
            if (onFinish) onFinish();
          };
          audio.onerror = () => {
            setIsSpeaking(false);
            if (autoDuck && videoRef.current && !isOriginalMuted) {
              videoRef.current.volume = originalVolume;
            }
          };
          await audio.play();
          return;
        } catch (err) {
          console.warn('Cached audio playback error:', err);
        }
      }

      setIsGeneratingGeminiAudio(true);
      try {
        const res = await axios.post('/api/editor/gemini-tts', {
          text,
          model: selectedDubbingModel,
          voiceName: geminiVoice
        });

        if (res.data?.success && res.data.audioBase64) {
          const item = {
            base64: res.data.audioBase64,
            mimeType: res.data.mimeType || 'audio/wav'
          };
          setCachedAudio((prev) => ({ ...prev, [cacheKey]: item }));
          const audio = new Audio(`data:${item.mimeType};base64,${item.base64}`);
          audio.volume = aiVolume;
          setIsSpeaking(true);
          if (autoDuck && videoRef.current && !isOriginalMuted) {
            videoRef.current.volume = Math.min(originalVolume, 0.08);
          }
          audio.onended = () => {
            setIsSpeaking(false);
            if (autoDuck && videoRef.current && !isOriginalMuted) {
              videoRef.current.volume = originalVolume;
            }
            if (onFinish) onFinish();
          };
          audio.onerror = () => {
            setIsSpeaking(false);
            if (autoDuck && videoRef.current && !isOriginalMuted) {
              videoRef.current.volume = originalVolume;
            }
          };
          await audio.play();
          return;
        }
      } catch (err) {
        console.warn('Gemini cloud audio fallback to browser synthesis:', err);
      } finally {
        setIsGeneratingGeminiAudio(false);
      }
    }

    // Fallback to browser synthesis
    speakText(text, onFinish);
  };

  const handlePreviewVoice = (customText) => {
    const sample = customText || activeSubtitle?.text || 'Xin chào! Đây là giọng đọc AI lồng tiếng tiếng Việt cực chuẩn từ Gemini.';
    playOrSpeakText(sample);
  };

  // Video playback handlers
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
  };

  const seekTo = (seconds) => {
    if (videoRef.current) {
      videoRef.current.currentTime = seconds;
      setCurrentTime(seconds);
    }
  };

  // Subtitle editing functions
  const handleAddSubtitle = () => {
    const newStart = Math.max(0, Math.round(currentTime * 10) / 10);
    const newEnd = Math.round((newStart + 3.0) * 10) / 10;
    const newSub = {
      id: `sub_${Date.now()}`,
      start: newStart,
      end: newEnd,
      text: 'Nhập nội dung phụ đề tiếng Việt...'
    };
    const updated = [...subtitles, newSub].sort((a, b) => a.start - b.start);
    setSubtitles(updated);
    showToast('Đã thêm một dòng phụ đề mới tại thời điểm hiện tại');
  };

  const handleUpdateSubtitle = (id, field, value) => {
    setSubtitles((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const handleDeleteSubtitle = (id) => {
    setSubtitles((prev) => prev.filter((s) => s.id !== id));
  };

  // AI Vietsub Generator
  const handleGenerateVietsub = async () => {
    if (!selectedVideo) return;
    setIsGeneratingVietsub(true);

    try {
      const res = await axios.post('/api/editor/ai-vietsub', {
        title: selectedVideo.title_vi || selectedVideo.title,
        description: selectedVideo.title,
        durationSeconds: duration || selectedVideo.durationSeconds || 60,
        style: vietsubStyle,
        model: selectedVietsubModel
      });

      if (res.data.success && Array.isArray(res.data.data)) {
        setSubtitles(res.data.data);
        const moduleName = geminiModules.find((m) => m.id === selectedVietsubModel)?.name || selectedVietsubModel;
        showToast(`AI (${moduleName}) đã tạo thành công ${res.data.data.length} phân đoạn Vietsub!`);
      } else {
        showToast('Không thể tạo phụ đề. Đang dùng kịch bản phụ đề mẫu.');
      }
    } catch (err) {
      console.error('Error generating Vietsub:', err);
      showToast('Lỗi khi gọi AI tạo Vietsub. Vui lòng thử lại!');
    } finally {
      setIsGeneratingVietsub(false);
    }
  };

  // Translate existing subtitles to Vietnamese
  const handleTranslateExistingSubs = async () => {
    if (subtitles.length === 0) {
      showToast('Chưa có phụ đề nào để dịch.');
      return;
    }
    setIsGeneratingVietsub(true);
    try {
      const res = await axios.post('/api/editor/ai-translate', {
        items: subtitles,
        model: selectedVietsubModel
      });
      if (res.data.success && Array.isArray(res.data.data)) {
        setSubtitles(res.data.data);
        const moduleName = geminiModules.find((m) => m.id === selectedVietsubModel)?.name || selectedVietsubModel;
        showToast(`Đã dịch toàn bộ phụ đề sang Tiếng Việt bằng ${moduleName}!`);
      }
    } catch (err) {
      console.error('Error translating subtitles:', err);
      showToast('Lỗi khi dịch phụ đề.');
    } finally {
      setIsGeneratingVietsub(false);
    }
  };

  // Save project
  const handleSaveProject = async () => {
    if (!selectedVideo?.id) return;
    setIsSaving(true);
    try {
      const payload = {
        subtitles,
        subtitleStyle,
        dubbing: {
          enabled: isDubbingEnabled,
          engine: dubbingEngine,
          geminiModel: selectedDubbingModel,
          geminiVoice,
          voiceName: selectedVoiceURI,
          rate: voiceRate,
          pitch: voicePitch,
          originalAudioVolume: originalVolume,
          aiAudioVolume: aiVolume,
          autoDuck
        }
      };
      await axios.post(`/api/editor/project/${selectedVideo.id}`, payload);
      showToast('Đã lưu dự án chỉnh sửa thành công!');
      if (onVideoEdited) onVideoEdited();
    } catch (err) {
      console.error('Failed to save project:', err);
      showToast('Lỗi khi lưu dự án.');
    } finally {
      setIsSaving(false);
    }
  };

  // Export SRT
  const handleExportSRT = () => {
    if (subtitles.length === 0) {
      showToast('Không có phụ đề để xuất file.');
      return;
    }

    const formatTimeSRT = (sec) => {
      const totalMs = Math.floor(sec * 1000);
      const hours = Math.floor(totalMs / 3600000);
      const minutes = Math.floor((totalMs % 3600000) / 60000);
      const seconds = Math.floor((totalMs % 60000) / 1000);
      const ms = totalMs % 1000;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
    };

    let srtContent = '';
    subtitles.forEach((s, idx) => {
      srtContent += `${idx + 1}\n`;
      srtContent += `${formatTimeSRT(s.start)} --> ${formatTimeSRT(s.end)}\n`;
      srtContent += `${s.text}\n\n`;
    });

    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(selectedVideo?.title_vi || selectedVideo?.title || 'vietsub').slice(0, 40)}_vietsub.srt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã tải xuống file phụ đề .SRT!');
  };

  // Export VTT
  const handleExportVTT = () => {
    if (subtitles.length === 0) {
      showToast('Không có phụ đề để xuất file.');
      return;
    }

    const formatTimeVTT = (sec) => {
      const totalMs = Math.floor(sec * 1000);
      const hours = Math.floor(totalMs / 3600000);
      const minutes = Math.floor((totalMs % 3600000) / 60000);
      const seconds = Math.floor((totalMs % 60000) / 1000);
      const ms = totalMs % 1000;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
    };

    let vttContent = 'WEBVTT\n\n';
    subtitles.forEach((s, idx) => {
      vttContent += `${idx + 1}\n`;
      vttContent += `${formatTimeVTT(s.start)} --> ${formatTimeVTT(s.end)}\n`;
      vttContent += `${s.text}\n\n`;
    });

    const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(selectedVideo?.title_vi || selectedVideo?.title || 'vietsub').slice(0, 40)}_vietsub.vtt`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Đã tải xuống file phụ đề .VTT!');
  };

  // Upload custom video directly from local device
  const handleLocalFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    const customVid = {
      id: `local_${Date.now()}`,
      title: file.name.replace(/\.[^/.]+$/, ''),
      title_vi: file.name.replace(/\.[^/.]+$/, ''),
      filename: file.name,
      streamUrl: objectUrl,
      downloadUrl: objectUrl,
      source: 'personal',
      hasLocalFile: true
    };

    setSelectedVideo(customVid);
    setIsPickerOpen(false);
    showToast(`Đã nạp video từ máy: ${file.name}`);
  };

  // Filtered list for video picker
  const filteredVideos = useMemo(() => {
    if (!pickerSearch.trim()) return selectableVideos;
    const q = pickerSearch.toLowerCase();
    return selectableVideos.filter(
      (v) =>
        (v.title_vi && v.title_vi.toLowerCase().includes(q)) ||
        (v.title && v.title.toLowerCase().includes(q)) ||
        (v.filename && v.filename.toLowerCase().includes(q))
    );
  }, [selectableVideos, pickerSearch]);

  const formatSec = (s) => {
    const mins = Math.floor(s / 60);
    const secs = Math.floor(s % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isPickerOpen) {
          handleClose();
        }
      }}
    >
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 bg-slate-800/70 border-b border-slate-700/70 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-xl text-white shadow-md flex-shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-white truncate">
                  Studio Chỉnh Sửa Video
                </h2>
                <span className="text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                  Vietsub & Lồng Tiếng AI
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate max-w-md sm:max-w-xl">
                {selectedVideo ? (selectedVideo.title_vi || selectedVideo.title) : 'Chưa chọn video'}
              </p>
            </div>
          </div>

          {/* Quick actions */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setIsPickerOpen(true)}
              className="px-3 py-1.5 bg-slate-700/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-600/50"
              title="Chọn video khác để chỉnh sửa"
            >
              <FileVideo className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Đổi Video</span>
            </button>

            <button
              onClick={handleSaveProject}
              disabled={isSaving || !selectedVideo}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              title="Lưu kịch bản Vietsub và cài đặt lồng tiếng"
            >
              {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              <span>Lưu Dự Án</span>
            </button>

            <button
              onClick={handleClose}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors border border-slate-700/60"
              title="Thoát Studio (Phím Esc)"
            >
              <X className="w-4 h-4" />
              <span className="hidden sm:inline">Thoát (Esc)</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 flex flex-col lg:flex-row gap-5">
          
          {/* Left Column: Video Player with Realtime Subtitle Overlay & Audio Controls */}
          <div className="lg:w-7/12 flex flex-col gap-3">
            {/* Video Container with Dynamic Subtitle Overlay */}
            <div className="relative bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-xl flex items-center justify-center aspect-video group">
              {selectedVideo?.streamUrl ? (
                <video
                  ref={videoRef}
                  src={selectedVideo.streamUrl}
                  className="w-full h-full object-contain"
                  onTimeUpdate={handleTimeUpdate}
                  onLoadedMetadata={handleLoadedMetadata}
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onEnded={() => setIsPlaying(false)}
                  controls={false}
                />
              ) : (
                <div className="text-center p-6 text-slate-400">
                  <FileVideo className="w-12 h-12 mx-auto text-slate-600 mb-2" />
                  <p className="text-sm font-medium">Chưa có video được chọn</p>
                  <button
                    onClick={() => setIsPickerOpen(true)}
                    className="mt-3 px-4 py-2 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-xl"
                  >
                    Chọn video để bắt đầu
                  </button>
                </div>
              )}

              {/* Dynamic Live Subtitle Overlay */}
              {activeSubtitle && (
                <div
                  className={`absolute left-0 right-0 px-4 pointer-events-none flex justify-center ${
                    subtitleStyle.position === 'top'
                      ? 'top-4'
                      : subtitleStyle.position === 'middle'
                      ? 'top-1/2 -translate-y-1/2'
                      : 'bottom-8'
                  }`}
                >
                  <div
                    style={{
                      fontSize: `${subtitleStyle.fontSize}px`,
                      color: subtitleStyle.color,
                      backgroundColor: subtitleStyle.bgColor,
                      textShadow: subtitleStyle.stroke
                        ? '0 0 4px #000, 0 0 8px #000, 1px 1px 2px #000'
                        : 'none'
                    }}
                    className="max-w-[90%] text-center font-bold px-3 py-1.5 rounded-lg leading-snug transition-all animate-in fade-in duration-150 backdrop-blur-xs"
                  >
                    {activeSubtitle.text}
                  </div>
                </div>
              )}

              {/* Speaking Indicator Badge */}
              {isSpeaking && (
                <div className="absolute top-3 left-3 bg-violet-600/90 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-lg animate-pulse backdrop-blur-sm">
                  <Mic className="w-3.5 h-3.5" />
                  <span>AI Đang Lồng Tiếng...</span>
                </div>
              )}
            </div>

            {/* Custom Interactive Player Controls */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-xl p-3 flex flex-col gap-2.5">
              {/* Timeline Progress Slider */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono text-slate-400 w-10 text-right">
                  {formatSec(currentTime)}
                </span>
                <input
                  type="range"
                  min={0}
                  max={duration || 100}
                  step={0.1}
                  value={currentTime}
                  onChange={(e) => seekTo(parseFloat(e.target.value))}
                  className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                />
                <span className="text-[11px] font-mono text-slate-400 w-10">
                  {formatSec(duration)}
                </span>
              </div>

              {/* Playback Controls & Volume Balancer */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    onClick={togglePlay}
                    className="p-2 bg-violet-600 hover:bg-violet-500 text-white rounded-xl shadow transition-transform active:scale-95"
                    title={isPlaying ? 'Tạm dừng' : 'Phát video'}
                  >
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>

                  <button
                    onClick={() => seekTo(0)}
                    className="p-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-xl transition-colors"
                    title="Về đầu video"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>

                  {/* Playback speed */}
                  <select
                    value={playbackRate}
                    onChange={(e) => {
                      const rate = parseFloat(e.target.value);
                      setPlaybackRate(rate);
                      if (videoRef.current) videoRef.current.playbackRate = rate;
                    }}
                    className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg px-2 py-1.5 focus:outline-none"
                    title="Tốc độ phát video"
                  >
                    <option value={0.5}>0.5x</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1}>1.0x (Chuẩn)</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2.0x</option>
                  </select>
                </div>

                {/* Audio Balance: Original Video vs AI Dubbing */}
                <div className="flex items-center gap-3 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-slate-700/60">
                  {/* Original Audio Volume */}
                  <div className="flex items-center gap-1.5" title="Âm lượng âm thanh gốc trong video">
                    <button
                      onClick={() => setIsOriginalMuted(!isOriginalMuted)}
                      className="text-slate-400 hover:text-white"
                    >
                      {isOriginalMuted || originalVolume === 0 ? (
                        <VolumeX className="w-4 h-4 text-rose-400" />
                      ) : (
                        <Volume2 className="w-4 h-4 text-slate-300" />
                      )}
                    </button>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">Gốc:</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={isOriginalMuted ? 0 : originalVolume}
                      onChange={(e) => {
                        setIsOriginalMuted(false);
                        setOriginalVolume(parseFloat(e.target.value));
                      }}
                      className="w-14 sm:w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-sky-400"
                    />
                    <span className="text-[10px] font-mono text-slate-400 w-7">
                      {Math.round((isOriginalMuted ? 0 : originalVolume) * 100)}%
                    </span>
                  </div>

                  <div className="w-px h-4 bg-slate-700" />

                  {/* AI Dubbing Volume */}
                  <div className="flex items-center gap-1.5" title="Âm lượng giọng đọc AI lồng tiếng">
                    <Mic className="w-3.5 h-3.5 text-violet-400" />
                    <span className="text-[11px] text-slate-400 hidden sm:inline">AI:</span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={aiVolume}
                      onChange={(e) => setAiVolume(parseFloat(e.target.value))}
                      className="w-14 sm:w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-400"
                    />
                    <span className="text-[10px] font-mono text-violet-300 w-7">
                      {Math.round(aiVolume * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Export bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-800/40 rounded-xl border border-slate-800 text-xs">
              <span className="text-slate-400 font-medium">Xuất tệp phụ đề:</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleExportSRT}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-sky-400" />
                  <span>Xuất .SRT</span>
                </button>
                <button
                  onClick={handleExportVTT}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg font-medium flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Xuất .VTT</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Tabbed Controls (Vietsub, Dubbing, Subtitle Style) */}
          <div className="lg:w-5/12 flex flex-col bg-slate-800/40 rounded-2xl border border-slate-700/60 overflow-hidden flex-1">
            
            {/* Tab Bar */}
            <div className="flex items-center border-b border-slate-700/80 bg-slate-900/60 p-1 gap-1">
              <button
                onClick={() => setActiveTab('subtitles')}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'subtitles'
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Languages className="w-4 h-4" />
                <span>Vietsub ({subtitles.length})</span>
              </button>

              <button
                onClick={() => setActiveTab('dubbing')}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'dubbing'
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mic className="w-4 h-4" />
                <span>Lồng Tiếng AI</span>
              </button>

              <button
                onClick={() => setActiveTab('styling')}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  activeTab === 'styling'
                    ? 'bg-violet-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Type className="w-4 h-4" />
                <span>Kiểu Sub</span>
              </button>
            </div>

            {/* TAB 1: VIETSUB PHỤ ĐỀ */}
            {activeTab === 'subtitles' && (
              <div className="p-3 sm:p-4 flex flex-col gap-3 flex-1 overflow-y-auto">
                {/* AI Module & Generation Action Bar */}
                <div className="bg-gradient-to-br from-violet-950/50 via-slate-900 to-indigo-950/40 border border-violet-700/40 rounded-xl p-3 sm:p-3.5 flex flex-col gap-3 shadow-md">
                  
                  {/* Gemini Module Selection */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-violet-300 flex items-center gap-1.5">
                        <Bot className="w-4 h-4 text-violet-400" />
                        Mô hình Gemini AI Vietsub
                      </span>
                      {(() => {
                        const curMod = geminiModules.find((m) => m.id === selectedVietsubModel);
                        return curMod?.badge ? (
                          <span className="text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full">
                            {curMod.badge}
                          </span>
                        ) : null;
                      })()}
                    </div>

                    <select
                      value={selectedVietsubModel}
                      onChange={(e) => setSelectedVietsubModel(e.target.value)}
                      className="w-full bg-slate-950 text-slate-200 text-xs rounded-lg p-2 border border-violet-700/60 focus:outline-none focus:border-violet-400 font-medium"
                    >
                      {geminiModules.filter(m => m.category === 'vietsub').map((mod) => (
                        <option key={mod.id} value={mod.id}>
                          {mod.name} {mod.badge ? `[${mod.badge}]` : ''}
                        </option>
                      ))}
                    </select>

                    {/* Model Details Card */}
                    {(() => {
                      const curMod = geminiModules.find((m) => m.id === selectedVietsubModel);
                      if (!curMod) return null;
                      return (
                        <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800 text-[11px] text-slate-300 flex flex-col gap-1">
                          <p className="text-slate-400 leading-relaxed">{curMod.description}</p>
                          {curMod.recommendedFor && (
                            <span className="text-violet-400 font-medium text-[10px]">
                              🎯 Tối ưu: {curMod.recommendedFor}
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Style selector and Action Buttons */}
                  <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/80">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-slate-400">Phong cách dịch:</span>
                      <select
                        value={vietsubStyle}
                        onChange={(e) => setVietsubStyle(e.target.value)}
                        className="bg-slate-950 text-slate-300 text-[11px] rounded-lg px-2.5 py-1 border border-slate-700 focus:outline-none"
                      >
                        <option value="natural">Tự nhiên & Cuốn hút (Hội thoại đời thực)</option>
                        <option value="funny">Hài hước dí dỏm (Shorts/Reels/TikTok)</option>
                        <option value="review">Kể chuyện / Review tóm tắt phim</option>
                        <option value="detailed">Chuẩn xác, chi tiết & học thuật</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleGenerateVietsub}
                        disabled={isGeneratingVietsub || !selectedVideo}
                        className="flex-1 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow-md transition-all"
                      >
                        {isGeneratingVietsub ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="w-3.5 h-3.5" />
                        )}
                        <span>Tạo Vietsub với Gemini</span>
                      </button>

                      <button
                        onClick={handleTranslateExistingSubs}
                        disabled={isGeneratingVietsub || subtitles.length === 0}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 rounded-xl text-xs font-medium border border-slate-700 flex items-center gap-1"
                        title="Dịch nội dung phụ đề hiện tại sang tiếng Việt"
                      >
                        <Languages className="w-3.5 h-3.5 text-sky-400" />
                        <span>Dịch Sub</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Subtitle list controls */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold text-slate-300">
                    Dòng phụ đề ({subtitles.length})
                  </span>
                  <button
                    onClick={handleAddSubtitle}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 border border-slate-700 rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Thêm dòng ({formatSec(currentTime)})</span>
                  </button>
                </div>

                {/* Subtitle Cards List */}
                <div className="flex flex-col gap-2 flex-1 overflow-y-auto max-h-[380px] pr-1">
                  {subtitles.length === 0 ? (
                    <div className="text-center py-8 text-slate-500 text-xs">
                      Chưa có dòng phụ đề nào. Bấm "Tạo Vietsub với Gemini" hoặc "Thêm dòng" để bắt đầu.
                    </div>
                  ) : (
                    subtitles.map((sub, index) => {
                      const isActive = activeSubtitle?.id === sub.id;
                      return (
                        <div
                          key={sub.id || index}
                          className={`p-2.5 rounded-xl border transition-all flex flex-col gap-2 ${
                            isActive
                              ? 'bg-violet-950/30 border-violet-500 shadow-md'
                              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
                          }`}
                        >
                          {/* Timing header */}
                          <div className="flex items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-slate-500 text-[10px]">#{index + 1}</span>
                              <div className="flex items-center gap-1 bg-slate-950 px-2 py-0.5 rounded-md border border-slate-800 font-mono text-slate-300">
                                <input
                                  type="number"
                                  step={0.1}
                                  value={sub.start}
                                  onChange={(e) =>
                                    handleUpdateSubtitle(sub.id, 'start', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-11 bg-transparent text-center focus:outline-none focus:text-white"
                                />
                                <span className="text-slate-600">→</span>
                                <input
                                  type="number"
                                  step={0.1}
                                  value={sub.end}
                                  onChange={(e) =>
                                    handleUpdateSubtitle(sub.id, 'end', parseFloat(e.target.value) || 0)
                                  }
                                  className="w-11 bg-transparent text-center focus:outline-none focus:text-white"
                                />
                                <span className="text-[10px] text-slate-500">giây</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1">
                              {/* Seek to timestamp */}
                              <button
                                onClick={() => seekTo(sub.start)}
                                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-sky-400 rounded"
                                title="Nhảy video đến mốc thời gian này"
                              >
                                <Play className="w-3 h-3" />
                              </button>

                              {/* Speak this sub with AI */}
                              <button
                                onClick={() => playOrSpeakText(sub.text)}
                                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-violet-400 rounded"
                                title="Nghe thử câu này bằng giọng AI"
                              >
                                <Mic className="w-3 h-3" />
                              </button>

                              {/* Delete sub */}
                              <button
                                onClick={() => handleDeleteSubtitle(sub.id)}
                                className="p-1 hover:bg-slate-800 text-slate-400 hover:text-rose-400 rounded"
                                title="Xóa dòng phụ đề"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {/* Subtitle text input */}
                          <textarea
                            rows={2}
                            value={sub.text}
                            onChange={(e) => handleUpdateSubtitle(sub.id, 'text', e.target.value)}
                            className="w-full bg-slate-950 text-slate-200 text-xs rounded-lg p-2 border border-slate-800 focus:outline-none focus:border-violet-500 transition-colors resize-none"
                            placeholder="Nhập nội dung phụ đề tiếng Việt..."
                          />
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: LỒNG TIẾNG GIỌNG AI */}
            {activeTab === 'dubbing' && (
              <div className="p-3 sm:p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
                {/* Master Switch */}
                <div className="flex items-center justify-between p-3 bg-violet-950/30 border border-violet-800/40 rounded-xl">
                  <div>
                    <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Mic className="w-4 h-4 text-violet-400" />
                      Lồng Tiếng AI Đồng Bộ Theo Video
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      Tự động đọc phụ đề tiếng Việt khi video chạy đến từng phân đoạn
                    </p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isDubbingEnabled}
                      onChange={(e) => setIsDubbingEnabled(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-600"></div>
                  </label>
                </div>

                {/* Engine Selector: Gemini Cloud Audio vs Browser Web Speech */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold text-slate-300">
                    Động cơ lồng tiếng:
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDubbingEngine('gemini')}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                        dubbingEngine === 'gemini'
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 border-violet-400 text-white shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Bot className="w-3.5 h-3.5" />
                      <span>Gemini Cloud Audio</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDubbingEngine('browser')}
                      className={`py-2 px-3 rounded-xl border text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                        dubbingEngine === 'browser'
                          ? 'bg-gradient-to-r from-violet-600 to-indigo-600 border-violet-400 text-white shadow-md'
                          : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Radio className="w-3.5 h-3.5" />
                      <span>Trình Duyệt (Nội Bộ)</span>
                    </button>
                  </div>
                </div>

                {/* ENGINE 1: GEMINI CLOUD AUDIO SETTINGS */}
                {dubbingEngine === 'gemini' && (
                  <div className="bg-slate-900/80 border border-violet-800/40 rounded-xl p-3 sm:p-3.5 flex flex-col gap-3">
                    {/* Gemini Dubbing Model */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-violet-300 flex items-center gap-1">
                          <Cpu className="w-3.5 h-3.5" />
                          Mô hình Gemini Lồng Tiếng:
                        </label>
                        {(() => {
                          const curMod = geminiModules.find((m) => m.id === selectedDubbingModel);
                          return curMod?.badge ? (
                            <span className="text-[10px] font-semibold bg-violet-500/20 text-violet-300 border border-violet-500/30 px-2 py-0.5 rounded-full">
                              {curMod.badge}
                            </span>
                          ) : null;
                        })()}
                      </div>

                      <select
                        value={selectedDubbingModel}
                        onChange={(e) => setSelectedDubbingModel(e.target.value)}
                        className="bg-slate-950 border border-violet-700/60 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-violet-400 font-medium"
                      >
                        {geminiModules.filter(m => m.category === 'dubbing' || m.isAudioCapable).map((mod) => (
                          <option key={mod.id} value={mod.id}>
                            {mod.name} {mod.badge ? `[${mod.badge}]` : ''}
                          </option>
                        ))}
                      </select>

                      {(() => {
                        const curMod = geminiModules.find((m) => m.id === selectedDubbingModel);
                        if (!curMod) return null;
                        return (
                          <p className="text-[11px] text-slate-400 bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                            {curMod.description}
                          </p>
                        );
                      })()}
                    </div>

                    {/* Gemini Voice Persona */}
                    <div className="flex flex-col gap-1.5 pt-2 border-t border-slate-800">
                      <label className="text-xs font-semibold text-slate-300 flex items-center gap-1">
                        <Headphones className="w-3.5 h-3.5 text-violet-400" />
                        Chất giọng AI (Persona):
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {GEMINI_VOICES.map((v) => {
                          const isSel = geminiVoice === v.id;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              onClick={() => setGeminiVoice(v.id)}
                              className={`p-2 rounded-xl border text-left flex flex-col gap-0.5 transition-all ${
                                isSel
                                  ? 'bg-violet-950/50 border-violet-500 shadow-md'
                                  : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-xs font-bold ${isSel ? 'text-violet-300' : 'text-slate-300'}`}>
                                  {v.name}
                                </span>
                                <span className="text-[9px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                                  {v.tag}
                                </span>
                              </div>
                              <span className="text-[10px] text-slate-400">{v.desc}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ENGINE 2: BROWSER WEB SPEECH SETTINGS */}
                {dubbingEngine === 'browser' && (
                  <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 sm:p-3.5 flex flex-col gap-3">
                    {/* Voice Selection */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-slate-300">
                        Chọn giọng đọc máy (Tiếng Việt):
                      </label>
                      <select
                        value={selectedVoiceURI}
                        onChange={(e) => setSelectedVoiceURI(e.target.value)}
                        className="bg-slate-950 border border-slate-700 text-white text-xs rounded-xl p-2.5 focus:outline-none focus:border-violet-500"
                      >
                        {availableVoices.length === 0 ? (
                          <option value="">Giọng đọc mặc định hệ thống (Tiếng Việt)</option>
                        ) : (
                          availableVoices.map((v) => (
                            <option key={v.voiceURI} value={v.voiceURI}>
                              {v.name} ({v.lang})
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    {/* Speech rate and pitch */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      {/* Speed */}
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Tốc độ đọc:</span>
                          <span className="font-mono text-violet-400 font-bold">{voiceRate}x</span>
                        </div>
                        <input
                          type="range"
                          min={0.75}
                          max={1.6}
                          step={0.05}
                          value={voiceRate}
                          onChange={(e) => setVoiceRate(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Chậm (0.75x)</span>
                          <span>Chuẩn (1.0x)</span>
                          <span>Nhanh (1.6x)</span>
                        </div>
                      </div>

                      {/* Pitch */}
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800 flex flex-col gap-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-400">Cao độ (Pitch):</span>
                          <span className="font-mono text-violet-400 font-bold">{voicePitch}</span>
                        </div>
                        <input
                          type="range"
                          min={0.8}
                          max={1.3}
                          step={0.05}
                          value={voicePitch}
                          onChange={(e) => setVoicePitch(parseFloat(e.target.value))}
                          className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>Trầm (0.8)</span>
                          <span>Tự nhiên (1.0)</span>
                          <span>Thanh (1.3)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Audio Ducking & Volume Balancing */}
                <div className="bg-slate-900/70 p-3 rounded-xl border border-slate-800 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold text-slate-300">
                        Tự động giảm âm thanh gốc khi AI nói (Audio Ducking)
                      </span>
                      <p className="text-[10px] text-slate-500">
                        Hạ âm lượng video xuống còn 8% để người xem nghe rõ giọng lồng tiếng
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoDuck}
                        onChange={(e) => setAutoDuck(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                </div>

                {/* Voice preview button */}
                <button
                  onClick={() => handlePreviewVoice()}
                  disabled={isGeneratingGeminiAudio}
                  className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-violet-300 border border-violet-500/40 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm disabled:opacity-50"
                >
                  {isGeneratingGeminiAudio ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                  <span>
                    {isGeneratingGeminiAudio
                      ? 'Đang tạo âm thanh Gemini...'
                      : `Nghe Thử Giọng Đọc (${dubbingEngine === 'gemini' ? `Gemini ${geminiVoice}` : 'Trình Duyệt'})`}
                  </span>
                </button>
              </div>
            )}

            {/* TAB 3: KIỂU DÁNG PHỤ ĐỀ */}
            {activeTab === 'styling' && (
              <div className="p-3 sm:p-5 flex flex-col gap-4 flex-1 overflow-y-auto">
                {/* Font Size */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-300 font-medium">Cỡ chữ phụ đề:</span>
                    <span className="font-mono text-violet-400 font-bold">{subtitleStyle.fontSize} px</span>
                  </div>
                  <input
                    type="range"
                    min={14}
                    max={34}
                    step={1}
                    value={subtitleStyle.fontSize}
                    onChange={(e) =>
                      setSubtitleStyle((prev) => ({ ...prev, fontSize: parseInt(e.target.value, 10) }))
                    }
                    className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500">
                    <span>Nhỏ (14px)</span>
                    <span>Vừa (20px)</span>
                    <span>Lớn (34px)</span>
                  </div>
                </div>

                {/* Subtitle Color Palette */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-slate-300 font-medium">Màu chữ phụ đề:</span>
                  <div className="flex items-center gap-2">
                    {[
                      { hex: '#facc15', label: 'Vàng kim' },
                      { hex: '#ffffff', label: 'Trắng' },
                      { hex: '#38bdf8', label: 'Xanh lam' },
                      { hex: '#4ade80', label: 'Xanh ngọc' },
                      { hex: '#f43f5e', label: 'Hồng đỏ' }
                    ].map((c) => (
                      <button
                        key={c.hex}
                        onClick={() => setSubtitleStyle((prev) => ({ ...prev, color: c.hex }))}
                        className={`w-8 h-8 rounded-full border-2 transition-transform ${
                          subtitleStyle.color === c.hex ? 'scale-110 border-white shadow-md' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.label}
                      />
                    ))}
                  </div>
                </div>

                {/* Background Box */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-slate-300 font-medium">Khung nền phụ đề:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'rgba(0, 0, 0, 0.75)', label: 'Hộp Đen 75%' },
                      { id: 'rgba(0, 0, 0, 0.4)', label: 'Hộp Trong Suốt' },
                      { id: 'transparent', label: 'Không Nền' }
                    ].map((bg) => (
                      <button
                        key={bg.id}
                        onClick={() => setSubtitleStyle((prev) => ({ ...prev, bgColor: bg.id }))}
                        className={`py-2 px-2 text-xs rounded-xl border text-center transition-colors ${
                          subtitleStyle.bgColor === bg.id
                            ? 'bg-violet-600/30 border-violet-500 text-white font-semibold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {bg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subtitle Position */}
                <div className="flex flex-col gap-2">
                  <span className="text-xs text-slate-300 font-medium">Vị trí hiển thị:</span>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'bottom', label: 'Dưới đáy' },
                      { id: 'middle', label: 'Ở giữa' },
                      { id: 'top', label: 'Phía trên' }
                    ].map((pos) => (
                      <button
                        key={pos.id}
                        onClick={() => setSubtitleStyle((prev) => ({ ...prev, position: pos.id }))}
                        className={`py-2 px-2 text-xs rounded-xl border text-center transition-colors ${
                          subtitleStyle.position === pos.id
                            ? 'bg-violet-600/30 border-violet-500 text-white font-semibold'
                            : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Video Picker Modal Drawer (When selecting another video) */}
        {isPickerOpen && (
          <div className="absolute inset-0 z-50 bg-slate-950/90 backdrop-blur-md p-4 sm:p-6 flex flex-col animate-in fade-in duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <FileVideo className="w-5 h-5 text-violet-400" />
                <h3 className="text-base font-bold text-white">Chọn Video Để Chỉnh Sửa</h3>
              </div>
              <button
                onClick={() => {
                  if (selectedVideo) setIsPickerOpen(false);
                  else onClose();
                }}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Picker search & Upload custom file */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 my-3">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Tìm theo tiêu đề video hoặc tên tệp..."
                  className="w-full bg-slate-900 text-xs text-white placeholder-slate-500 rounded-xl pl-9 pr-3 py-2 border border-slate-800 focus:outline-none focus:border-violet-500"
                />
              </div>

              {/* Upload local file */}
              <label className="cursor-pointer px-3.5 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 shadow transition-all">
                <Upload className="w-3.5 h-3.5" />
                <span>Nạp Video Từ Máy Tính</span>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleLocalFileSelect}
                  className="hidden"
                />
              </label>
            </div>

            {/* Video List */}
            <div className="flex-1 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 pr-1">
              {isLoadingVideos ? (
                <div className="col-span-full py-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Đang tải danh sách video...</span>
                </div>
              ) : filteredVideos.length === 0 ? (
                <div className="col-span-full py-12 text-center text-slate-500 text-xs">
                  Không tìm thấy video nào. Hãy tải một video từ máy tính của bạn lên để bắt đầu chỉnh sửa!
                </div>
              ) : (
                filteredVideos.map((vid) => (
                  <div
                    key={vid.id}
                    onClick={() => {
                      setSelectedVideo(vid);
                      setIsPickerOpen(false);
                    }}
                    className={`p-2.5 rounded-xl border cursor-pointer transition-all flex gap-3 ${
                      selectedVideo?.id === vid.id
                        ? 'bg-violet-950/40 border-violet-500 shadow-md ring-1 ring-violet-500'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700 hover:bg-slate-850'
                    }`}
                  >
                    {/* Thumbnail */}
                    <div className="w-24 h-16 bg-slate-950 rounded-lg overflow-hidden flex-shrink-0 relative border border-slate-800">
                      {vid.cover ? (
                        <img
                          src={vid.cover}
                          alt=""
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-600">
                          <FileVideo className="w-6 h-6" />
                        </div>
                      )}
                      {vid.duration && (
                        <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] font-mono px-1 rounded">
                          {vid.duration}
                        </span>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex-1 min-w-0 flex flex-col justify-between">
                      <div>
                        <h4 className="text-xs font-semibold text-white line-clamp-2" title={vid.title_vi || vid.title}>
                          {vid.title_vi || vid.title}
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono truncate block mt-0.5">
                          {vid.filename}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[10px] text-violet-400 font-semibold uppercase">
                          {vid.source}
                        </span>
                        {vid.formattedSize && (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {vid.formattedSize}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* Toast Alert */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-800 border border-violet-500 text-violet-200 px-4 py-2.5 rounded-xl shadow-2xl flex items-center gap-2 text-xs animate-in slide-in-from-bottom duration-200">
            <CheckCircle2 className="w-4 h-4 text-violet-400 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
}
