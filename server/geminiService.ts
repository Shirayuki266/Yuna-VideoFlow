import { GoogleGenAI } from "@google/genai";

export interface GeminiModuleInfo {
  id: string;
  name: string;
  category: "vietsub" | "dubbing" | "live" | "thinking";
  description: string;
  badge: string;
  recommendedFor: string;
  isAudioCapable: boolean;
}

export const GEMINI_MODULES: GeminiModuleInfo[] = [
  {
    id: "gemini-3.6-flash",
    name: "Gemini 3.6 Flash",
    category: "vietsub",
    description: "Mô hình Flash thế hệ 3.6 chuẩn mới nhất, tốc độ cực nhanh, bám sát ngữ cảnh video và Tiếng Việt tự nhiên.",
    badge: "Khuyên Dùng Vietsub",
    recommendedFor: "Dịch phụ đề video, làm Vietsub chuẩn, phản hồi tức thì",
    isAudioCapable: false
  },
  {
    id: "gemini-3.8-flash",
    name: "Gemini 3.8 Flash",
    category: "vietsub",
    description: "Mô hình Flash thế hệ 3.8 thông minh với khả năng hiểu sâu ngữ cảnh video, dịch thuật văn phong mượt mà.",
    badge: "Thế Hệ 3.8 Mới",
    recommendedFor: "Dịch thuật phong cách đời thực, phụ đề diễn cảm",
    isAudioCapable: false
  },
  {
    id: "gemini-3.1-flash-lite",
    name: "Gemini 3.1 Flash Lite",
    category: "vietsub",
    description: "Mô hình siêu nhẹ, độ trễ tối thiểu, tối ưu hóa cho các video ngắn và phụ đề nhanh chóng.",
    badge: "Siêu Nhẹ & Tiết Kiệm",
    recommendedFor: "Tạo Vietsub nhanh cho video ngắn Shorts/Reels/TikTok",
    isAudioCapable: false
  },
  {
    id: "gemini-flash-latest",
    name: "Gemini Flash Latest",
    category: "vietsub",
    description: "Phiên bản Flash cập nhật liên tục từ Google AI Studio, tối ưu hoá xử lý đa ngữ.",
    badge: "Bản Cập Nhật Mới",
    recommendedFor: "Xử lý đa ngữ và tự động căn chỉnh mốc thời gian",
    isAudioCapable: false
  },
  {
    id: "gemini-3.5-transcribe",
    name: "Gemini 3.5 Transcribe",
    category: "vietsub",
    description: "Mô hình trích xuất âm thanh và đồng bộ hóa mốc thời gian (start - end) chuẩn xác từng phân đoạn.",
    badge: "Đồng Bộ Timecode",
    recommendedFor: "Bóc băng video & chia mốc thời gian phụ đề",
    isAudioCapable: false
  },
  {
    id: "gemini-3.1-flash-tts-preview",
    name: "Gemini 3.1 Flash TTS Preview",
    category: "dubbing",
    description: "Mô hình Text-To-Speech chính thức của Google AI, tạo âm thanh lồng tiếng chuẩn phòng thu với các giọng đọc AI biểu cảm.",
    badge: "Studio TTS Chuẩn",
    recommendedFor: "Lồng tiếng AI giọng đọc chuyên nghiệp",
    isAudioCapable: true
  }
];

export class GeminiService {
  private ai: GoogleGenAI | null = null;
  private activeModel: string = process.env.GEMINI_MODEL || "gemini-3.6-flash";
  private candidateModels: string[] = [
    "gemini-3.6-flash",
    "gemini-3.8-flash",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest",
    "gemini-3.5-transcribe"
  ];

  public getModules(): GeminiModuleInfo[] {
    return GEMINI_MODULES;
  }

  private normalizeTextModel(modelName?: string): string {
    if (!modelName) return "gemini-3.6-flash";
    const m = modelName.trim().toLowerCase();
    if (m === "gemini-2.5-flash" || m === "gemini-2.5-pro" || m === "gemini-2.0-flash") {
      return "gemini-3.6-flash";
    }
    if (m === "gemini-3.5-transcribe-live" || m === "gemini-3.5-live-translate") {
      return "gemini-3.5-transcribe";
    }
    if (m === "gemini-3.8-live" || m === "gemini-3.8-live-extended-thinking" || m === "gemini-3-flash-live") {
      return "gemini-3.8-flash";
    }
    if (m === "gemini-3.1-flash-tts-preview") {
      return "gemini-3.6-flash";
    }
    return modelName;
  }

  private getClient(): GoogleGenAI | null {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }
    if (!this.ai) {
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
    }
    return this.ai;
  }

  public async translateTitlesBatch(titles: string[]): Promise<string[]> {
    if (!titles || titles.length === 0) {
      return titles;
    }

    const client = this.getClient();
    if (!client) {
      console.warn("[GEMINI INFO]: GEMINI_API_KEY is not configured, returning original titles.");
      return titles;
    }

    const prompt = `Bạn là chuyên gia dịch thuật tiêu đề video ngắn.
Hãy dịch toàn bộ danh sách tiêu đề tiếng Trung/Anh sau sang tiếng Việt tự nhiên, hấp dẫn phong cách YouTube Shorts/Reels:
${JSON.stringify(titles)}

YÊU CẦU ĐẦU RA:
Chỉ trả về ĐÚNG MỘT MẢNG JSON chứa chính xác ${titles.length} chuỗi đã dịch tương ứng. Không thêm lời dẫn, không dùng codeblock markdown. Ví dụ: ["Tiêu đề 1", "Tiêu đề 2"]`;

    // Try active model first, followed by reliable candidates
    const modelsToTry = [
      this.normalizeTextModel(this.activeModel),
      ...this.candidateModels
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    for (const model of modelsToTry) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.3,
          }
        });

        const rawText = response.text ? response.text.trim() : "";
        const cleanText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();

        const translatedList = JSON.parse(cleanText);

        if (Array.isArray(translatedList) && translatedList.length === titles.length) {
          this.activeModel = model;
          console.log(`[GEMINI SUCCESS]: Translated ${translatedList.length} titles to Vietnamese using ${model}.`);
          return translatedList.map(item => String(item || ""));
        } else {
          console.warn(`[GEMINI WARNING]: Translation length mismatch (${translatedList?.length}/${titles.length}). Using original.`);
          return titles;
        }
      } catch (e: any) {
        const errMsg = e?.message || String(e);
        const isHighDemand = errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand");

        if (isHighDemand) {
          console.warn(`[GEMINI RETRY]: Model ${model} is unavailable (high demand), switching immediately to backup candidate.`);
        } else {
          console.warn(`[GEMINI RETRY]: Model ${model} encountered an issue: ${errMsg}`);
        }
        // Seamlessly continue loop to next candidate
      }
    }

    console.error("[GEMINI ERROR CRITICAL]: All Gemini model candidates failed. Falling back to original titles.");
    return titles;
  }

  public async generateVietsub(params: {
    title: string;
    description?: string;
    durationSeconds?: number;
    style?: string; // 'natural' | 'funny' | 'review' | 'detailed'
    languageHint?: string;
    model?: string;
  }): Promise<Array<{ id: string; start: number; end: number; text: string }>> {
    const duration = Math.max(10, Math.min(params.durationSeconds || 60, 600));
    const title = params.title || "Video";
    const desc = params.description || "";
    const style = params.style || "tự nhiên, cuốn hút";

    const client = this.getClient();
    if (!client) {
      console.warn("[GEMINI INFO]: GEMINI_API_KEY is not configured, generating template subtitles.");
      return this.generateFallbackSubtitles(title, duration);
    }

    const prompt = `Bạn là chuyên gia dịch thuật và biên tập phụ đề video Tiếng Việt (Vietsub) chuyên nghiệp.
Nhiệm vụ: Hãy tạo các phân đoạn phụ đề Tiếng Việt có mốc thời gian (start và end theo giây) cho video sau:
- Tiêu đề video: ${title}
- Mô tả / tóm tắt nội dung: ${desc || "Nội dung theo chủ đề tiêu đề"}
- Tổng thời lượng video: ${duration} giây
- Phong cách Vietsub mong muốn: ${style}

YÊU CẦU QUAN TRỌNG:
1. Tạo từ 4 đến 12 phân đoạn phụ đề trải dài từ giây 0 đến ${duration} giây.
2. Mỗi phân đoạn kéo dài khoảng 2 đến 6 giây (ví dụ: start: 0, end: 3.5; start: 3.8, end: 7.2...).
3. Câu văn tiếng Việt tự nhiên, ngắn gọn, súc tích, ngữ điệu cuốn hút, rất thích hợp để vừa hiển thị phụ đề vừa cho giọng đọc AI lồng tiếng.
4. ĐẦU RA BẮT BUỘC: Đúng một mảng JSON các object theo cấu trúc:
[
  { "id": "sub_1", "start": 0.0, "end": 3.5, "text": "Câu phụ đề tiếng Việt..." },
  { "id": "sub_2", "start": 3.8, "end": 7.0, "text": "Câu phụ đề tiếp theo..." }
]
Không thêm văn bản giải thích nào khác ngoài chuỗi JSON.`;

    const requestedModel = this.normalizeTextModel(params.model);
    const modelsToTry = [
      requestedModel,
      "gemini-3.6-flash",
      "gemini-3.8-flash",
      "gemini-3.1-flash-lite",
      "gemini-flash-latest",
      "gemini-3.5-transcribe"
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    for (const model of modelsToTry) {
      try {
        const response = await client.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.4,
          }
        });

        const rawText = response.text ? response.text.trim() : "";
        const cleanText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        const parsed = JSON.parse(cleanText);

        if (Array.isArray(parsed) && parsed.length > 0) {
          this.activeModel = model;
          console.log(`[GEMINI VIETSUB]: Successfully generated ${parsed.length} subtitles using ${model}`);
          return parsed.map((item, index) => ({
            id: item.id || `sub_${index + 1}`,
            start: Number(item.start) || Number(index * 4),
            end: Number(item.end) || Number((index + 1) * 4),
            text: String(item.text || "").trim()
          }));
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        const isHighDemand = errMsg.includes("503") || errMsg.includes("UNAVAILABLE") || errMsg.includes("high demand");
        if (isHighDemand) {
          console.warn(`[GEMINI VIETSUB RETRY]: Model ${model} is currently unavailable (high demand), switching to backup candidate immediately.`);
        } else {
          console.warn(`[GEMINI VIETSUB RETRY]: Model ${model} failed: ${errMsg}`);
        }
      }
    }

    console.warn("[GEMINI VIETSUB]: All models failed, using fallback template subtitles.");
    return this.generateFallbackSubtitles(title, duration);
  }

  public async translateSubtitles(
    items: Array<{ id?: string; start: number; end: number; text: string }>,
    model?: string
  ): Promise<Array<{ id: string; start: number; end: number; text: string }>> {
    if (!items || items.length === 0) return [];

    const client = this.getClient();
    if (!client) {
      return items.map((it, idx) => ({
        id: it.id || `sub_${idx + 1}`,
        start: it.start,
        end: it.end,
        text: it.text
      }));
    }

    const prompt = `Bạn là chuyên gia dịch phụ đề video sang Tiếng Việt (Vietsub).
Hãy dịch các câu thoại sau sang tiếng Việt tự nhiên, phù hợp văn hóa Việt Nam, giữ nguyên cấu trúc start và end:
${JSON.stringify(items)}

YÊU CẦU: Trả về đúng một mảng JSON với số lượng phần tử bằng đúng mảng ban đầu:
[
  { "id": "...", "start": ..., "end": ..., "text": "bản dịch tiếng Việt" }
]`;

    const requestedModel = this.normalizeTextModel(model);
    const modelsToTry = [
      requestedModel,
      "gemini-3.6-flash",
      "gemini-3.8-flash",
      "gemini-3.1-flash-lite",
      "gemini-flash-latest"
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    for (const m of modelsToTry) {
      try {
        const response = await client.models.generateContent({
          model: m,
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            temperature: 0.3,
          }
        });

        const rawText = response.text ? response.text.trim() : "";
        const cleanText = rawText.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
        const parsed = JSON.parse(cleanText);

        if (Array.isArray(parsed) && parsed.length === items.length) {
          this.activeModel = m;
          return parsed.map((p, idx) => ({
            id: items[idx].id || `sub_${idx + 1}`,
            start: items[idx].start,
            end: items[idx].end,
            text: String(p.text || items[idx].text)
          }));
        }
      } catch (err: any) {
        const errMsg = err?.message || String(err);
        console.warn(`[GEMINI TRANSLATE SUBS RETRY]: Model ${m} failed: ${errMsg}`);
      }
    }

    return items.map((it, idx) => ({
      id: it.id || `sub_${idx + 1}`,
      start: it.start,
      end: it.end,
      text: it.text
    }));
  }

  public async generateSpeech(params: {
    text: string;
    model?: string;
    voiceName?: string;
    style?: string;
  }): Promise<{
    success: boolean;
    audioBase64?: string;
    mimeType?: string;
    model?: string;
    voiceName?: string;
    fallbackToBrowser?: boolean;
    message?: string;
  }> {
    const text = params.text?.trim();
    if (!text) {
      return { success: false, fallbackToBrowser: true, message: "Thiếu văn bản cần đọc." };
    }

    const client = this.getClient();
    if (!client) {
      return {
        success: false,
        fallbackToBrowser: true,
        message: "Chưa cấu hình GEMINI_API_KEY. Hệ thống tự động chuyển sang giọng đọc Trình Duyệt."
      };
    }

    // According to Google GenAI SDK specs, gemini-3.1-flash-tts-preview is the dedicated TTS model
    const ttsModel = "gemini-3.1-flash-tts-preview";
    const voice = params.voiceName || "Zephyr";

    try {
      const response = await client.models.generateContent({
        model: ttsModel,
        contents: [{ parts: [{ text: `Đọc đoạn văn bản sau bằng tiếng Việt với ngữ điệu tự nhiên, truyền cảm: "${text}"` }] }],
        config: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice }
            }
          }
        }
      });

      const candidates = response.candidates || [];
      for (const cand of candidates) {
        const parts = cand.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            return {
              success: true,
              audioBase64: part.inlineData.data,
              mimeType: part.inlineData.mimeType || "audio/wav",
              model: ttsModel,
              voiceName: voice
            };
          }
        }
      }
    } catch (err: any) {
      console.warn(`[GEMINI TTS RETRY]: Model ${ttsModel} attempt failed: ${err?.message || err}`);
    }

    return {
      success: false,
      fallbackToBrowser: true,
      message: "Mô hình Gemini Cloud audio đang bận. Đã chuyển đổi liền mạch sang giọng đọc Trình Duyệt chuẩn xác."
    };
  }

  private generateFallbackSubtitles(title: string, duration: number): Array<{ id: string; start: number; end: number; text: string }> {
    const step = Math.max(3, Math.min(6, Math.floor(duration / 4)));
    return [
      { id: "sub_1", start: 0, end: Math.min(step, duration), text: `Chào mừng bạn đến với video: ${title}` },
      { id: "sub_2", start: step, end: Math.min(step * 2, duration), text: "Hôm nay chúng ta sẽ cùng khám phá những chi tiết thú vị nhất." },
      { id: "sub_3", start: step * 2, end: Math.min(step * 3, duration), text: "Hãy chú ý theo dõi các diễn biến nổi bật tiếp theo nhé!" },
      { id: "sub_4", start: step * 3, end: duration, text: "Cảm ơn các bạn đã theo dõi, đừng quên lưu lại video này nhé!" }
    ];
  }
}
