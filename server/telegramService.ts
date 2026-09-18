import fs from "fs";
import path from "path";
import { VideoStore, StoredVideo, TelegramBackupInfo } from "./videoStore";

export interface TelegramStatusResult {
  isConfigured: boolean;
  botTokenSet: boolean;
  chatIdSet: boolean;
  botInfo?: {
    id: number;
    username?: string;
    firstName?: string;
  };
  error?: string;
  totalBackedUpVideos: number;
}

export class TelegramService {
  private static getBotToken(): string {
    return (process.env.TELEGRAM_BOT_TOKEN || "").trim();
  }

  private static getChatId(): string {
    return (process.env.TELEGRAM_CHAT_ID || "").trim();
  }

  /**
   * Check connection status of Telegram Bot
   */
  public static async getStatus(): Promise<TelegramStatusResult> {
    const token = this.getBotToken();
    const chatId = this.getChatId();
    const allVideos = VideoStore.getAllVideos();
    const totalBackedUpVideos = allVideos.filter((v) => !!v.telegram?.fileId).length;

    if (!token || !chatId) {
      return {
        isConfigured: false,
        botTokenSet: !!token,
        chatIdSet: !!chatId,
        totalBackedUpVideos,
        error: "Chưa cấu hình TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID trong biến môi trường (.env)."
      };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = (await res.json()) as any;

      if (data.ok && data.result) {
        return {
          isConfigured: true,
          botTokenSet: true,
          chatIdSet: true,
          botInfo: {
            id: data.result.id,
            username: data.result.username,
            firstName: data.result.first_name
          },
          totalBackedUpVideos
        };
      } else {
        return {
          isConfigured: false,
          botTokenSet: true,
          chatIdSet: true,
          totalBackedUpVideos,
          error: data.description || "Token Telegram Bot không hợp lệ hoặc đã hết hạn."
        };
      }
    } catch (err: any) {
      return {
        isConfigured: false,
        botTokenSet: true,
        chatIdSet: true,
        totalBackedUpVideos,
        error: `Lỗi kết nối tới Telegram API: ${err.message}`
      };
    }
  }

  /**
   * Upload video to Telegram chat / channel
   * @param videoId ID of video (BVID or UP_...)
   * @param deleteLocalAfter Whether to delete the local file after successful upload to save disk space
   */
  public static async uploadVideo(
    videoId: string,
    deleteLocalAfter: boolean = false
  ): Promise<{ success: boolean; video: StoredVideo; message: string }> {
    const token = this.getBotToken();
    const chatId = this.getChatId();

    if (!token || !chatId) {
      throw new Error("Vui lòng thiết lập TELEGRAM_BOT_TOKEN và TELEGRAM_CHAT_ID trong Settings (.env) để tải video lên Telegram.");
    }

    const video = VideoStore.getVideo(videoId);
    if (!video) {
      throw new Error(`Không tìm thấy thông tin video có mã ID: ${videoId}`);
    }

    if (!fs.existsSync(video.filePath)) {
      throw new Error(`Tệp video trên máy chủ không còn tồn tại (${video.filename}). Nếu video đã lưu trên Telegram, hãy chọn 'Lấy về'.`);
    }

    const stat = fs.statSync(video.filePath);
    const fileSizeMB = (stat.size / (1024 * 1024)).toFixed(1);

    // Telegram Bot API standard file upload ceiling is 50MB
    const MAX_TELEGRAM_BOT_BYTES = 50 * 1024 * 1024;
    if (stat.size > MAX_TELEGRAM_BOT_BYTES) {
      throw new Error(
        `Dung lượng tệp (${fileSizeMB} MB) vượt quá giới hạn 50 MB của Telegram Bot API. Vui lòng chọn video dưới 50 MB.`
      );
    }

    // Build caption safely (max 1024 chars)
    let caption = `🎬 ${video.title_vi || video.title}\n`;
    if (video.title_vi && video.title !== video.title_vi) {
      caption += `📝 Gốc: ${video.title}\n`;
    }
    caption += `🆔 Mã: ${video.id}\n`;
    caption += `📦 Kích thước: ${video.formattedSize || `${fileSizeMB} MB`}\n`;
    if (video.duration) caption += `⏱️ Thời lượng: ${video.duration}\n`;
    if (video.author) caption += `👤 Tác giả: ${video.author}\n`;
    caption += `📅 Ngày lưu: ${new Date().toLocaleString("vi-VN")}\n`;
    caption += `#YunaVideoFlow #${video.type === "bilibili" ? "Bilibili" : "Upload"}`;

    if (caption.length > 1000) {
      caption = caption.substring(0, 995) + "...";
    }

    // Send video to Telegram via native FormData + Blob streaming
    const form = new FormData();
    form.append("chat_id", chatId);
    const blob = await fs.openAsBlob(video.filePath);
    form.append("video", blob, video.filename);
    form.append("caption", caption);
    form.append("supports_streaming", "true");

    const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendVideo`, {
      method: "POST",
      body: form
    });

    let sendData = (await sendRes.json()) as any;

    // If sendVideo fails with format issue, attempt sendDocument fallback
    if (!sendData.ok) {
      const docForm = new FormData();
      docForm.append("chat_id", chatId);
      const docBlob = await fs.openAsBlob(video.filePath);
      docForm.append("document", docBlob, video.filename);
      docForm.append("caption", caption);

      const docRes = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
        method: "POST",
        body: docForm
      });
      sendData = (await docRes.json()) as any;
    }

    if (!sendData.ok) {
      throw new Error(`Telegram API từ chối tải tệp: ${sendData.description || "Lỗi không xác định"}`);
    }

    const resultMsg = sendData.result;
    const filePayload = resultMsg.video || resultMsg.document;
    const fileId = filePayload?.file_id;
    const fileUniqueId = filePayload?.file_unique_id;

    if (!fileId) {
      throw new Error("Không nhận được file_id từ phản hồi của Telegram.");
    }

    const backupInfo: TelegramBackupInfo = {
      fileId,
      fileUniqueId,
      messageId: resultMsg.message_id,
      chatId,
      backedUpAt: Date.now(),
      fileSize: filePayload?.file_size || stat.size,
      fileName: filePayload?.file_name || video.filename,
      mimeType: filePayload?.mime_type || "video/mp4"
    };

    video.telegram = backupInfo;

    // If user requested to delete local copy after upload to save server disk space
    if (deleteLocalAfter) {
      try {
        if (fs.existsSync(video.filePath)) {
          fs.unlinkSync(video.filePath);
        }
      } catch (delErr) {
        console.warn(`[TELEGRAM] Could not delete local copy ${video.filePath}:`, delErr);
      }
      video.hasLocalFile = false;
    } else {
      video.hasLocalFile = true;
    }

    VideoStore.upsertVideo(video);

    return {
      success: true,
      video,
      message: deleteLocalAfter
        ? `Đã đẩy video lên Telegram thành công và giải phóng dung lượng ổ đĩa cục bộ!`
        : `Đã sao lưu video lên Telegram thành công!`
    };
  }

  /**
   * Get direct download/streaming URL from Telegram for a given file_id
   */
  public static async getDirectFileUrl(fileId: string): Promise<string> {
    const token = this.getBotToken();
    if (!token) {
      throw new Error("Chưa cấu hình TELEGRAM_BOT_TOKEN.");
    }

    const res = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const data = (await res.json()) as any;

    if (!data.ok || !data.result?.file_path) {
      throw new Error(`Không lấy được đường dẫn tệp từ Telegram: ${data.description || "Tệp không tồn tại"}`);
    }

    return `https://api.telegram.org/file/bot${token}/${data.result.file_path}`;
  }

  /**
   * Restore video from Telegram back into local server storage
   */
  public static async restoreVideoToLocal(videoId: string): Promise<StoredVideo> {
    const video = VideoStore.getVideo(videoId);
    if (!video) {
      throw new Error(`Không tìm thấy video có ID: ${videoId}`);
    }

    if (!video.telegram?.fileId) {
      throw new Error("Video này chưa từng được sao lưu lên Telegram.");
    }

    if (fs.existsSync(video.filePath)) {
      video.hasLocalFile = true;
      VideoStore.upsertVideo(video);
      return video;
    }

    const fileUrl = await this.getDirectFileUrl(video.telegram.fileId);
    const response = await fetch(fileUrl);
    if (!response.ok || !response.body) {
      throw new Error(`Lỗi khi tải video từ máy chủ Telegram: ${response.statusText}`);
    }

    const dir = path.dirname(video.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const fileStream = fs.createWriteStream(video.filePath);
    // Node.js web stream pipe
    const reader = response.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      fileStream.write(Buffer.from(value));
    }
    fileStream.end();

    await new Promise<void>((resolve, reject) => {
      fileStream.on("finish", () => resolve());
      fileStream.on("error", (err) => reject(err));
    });

    video.hasLocalFile = true;
    VideoStore.upsertVideo(video);
    return video;
  }

  /**
   * Delete only local copy on server while permanently keeping Telegram cloud copy & metadata
   */
  public static deleteLocalCopy(videoId: string): { success: boolean; message: string } {
    const video = VideoStore.getVideo(videoId);
    if (!video) {
      throw new Error("Không tìm thấy video.");
    }
    if (!video.telegram) {
      throw new Error("Video này chưa được lưu trên Telegram. Không thể xóa tệp cục bộ vì sẽ mất video.");
    }

    VideoStore.deleteLocalFileOnly(videoId);
    return {
      success: true,
      message: "Đã xóa tệp trên ổ đĩa máy chủ. Thông tin video và bản sao lưu trên Telegram vẫn được bảo toàn nguyên vẹn!"
    };
  }
}
