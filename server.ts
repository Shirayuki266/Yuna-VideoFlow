import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { BilibiliCrawler } from "./server/bilibiliCrawler";
import { GeminiService } from "./server/geminiService";
import { DownloadService } from "./server/downloadService";
import { UploadService } from "./server/uploadService";
import { VideoStore } from "./server/videoStore";
import { StorageService } from "./server/storageService";
import { TelegramService } from "./server/telegramService";
import { EditorService } from "./server/editorService";
import { FrameExtractorService } from "./server/frameExtractorService";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  const geminiService = new GeminiService();

  // Initialize download service, upload service, frame extractor, and stores
  DownloadService.init();
  UploadService.init();
  FrameExtractorService.init();

  const uploader = UploadService.getMulterStorage();

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ extended: true, limit: "50mb" }));

  // Static serving for temporary extracted frames
  app.use("/temp_frames", express.static(FrameExtractorService.FRAMES_DIR));

  // Health endpoint
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Check if a video (BVID or Link) has already been downloaded
  app.get("/api/download/check", (req, res) => {
    try {
      const linkOrBvid = String(req.query.bvid || req.query.link || "").trim();
      const bvid = DownloadService.extractBvid(linkOrBvid) || linkOrBvid;
      if (!bvid) {
        return res.json({ exists: false });
      }

      const checkResult = DownloadService.checkIfDownloaded(bvid);
      return res.json(checkResult);
    } catch (err: any) {
      console.error("[API DOWNLOAD CHECK ERROR]:", err);
      return res.status(500).json({ exists: false, error: err.message });
    }
  });

  // Resolve link/bvid to preview metadata before download
  app.get("/api/video/resolve", async (req, res) => {
    try {
      const linkOrBvid = String(req.query.link || req.query.bvid || "").trim();
      const bvid = DownloadService.extractBvid(linkOrBvid);
      if (!bvid) {
        return res.status(400).json({ error: "Link hoặc mã BV không hợp lệ." });
      }

      const meta = await DownloadService.getVideoMetadata(bvid, geminiService);
      const isDownloaded = DownloadService.checkIfDownloaded(bvid);

      return res.json({
        success: true,
        data: meta,
        alreadyDownloaded: isDownloaded.exists,
        downloadedData: isDownloaded.data
      });
    } catch (err: any) {
      console.error("[API VIDEO RESOLVE ERROR]:", err);
      return res.status(500).json({ error: err.message || "Lỗi khi phân tích thông tin video." });
    }
  });

  // Analyze video to identify products & correlate Shopee + internet search
  app.post("/api/video/analyze-products", async (req, res) => {
    try {
      let title = String(req.body.title || "").trim();
      let titleVi = String(req.body.titleVi || "").trim();
      let description = String(req.body.description || "").trim();
      let author = String(req.body.author || "").trim();
      let coverUrl = String(req.body.coverUrl || req.body.cover || "").trim();
      let localThumbPath = String(req.body.localThumbPath || "").trim();
      let tags: string[] = Array.isArray(req.body.tags) ? req.body.tags : [];

      const linkOrBvid = String(req.body.link || req.body.bvid || "").trim();
      const extractedBvid = DownloadService.extractBvid(linkOrBvid);

      if (extractedBvid && (!title || !coverUrl)) {
        try {
          const meta = await DownloadService.getVideoMetadata(extractedBvid, geminiService);
          if (meta) {
            if (!title) title = meta.title;
            if (!titleVi) titleVi = meta.title_vi;
            if (!description) description = meta.desc || "";
            if (!author) author = meta.author || "";
            if (!coverUrl) coverUrl = meta.cover || "";
            if (meta.tags && meta.tags.length > 0) tags = meta.tags;
          }
        } catch (metaErr: any) {
          console.warn("[PRODUCT RESOLVE BVID WARN]:", metaErr?.message || metaErr);
        }
      }

      if (req.body.videoId) {
        const stored = VideoStore.getVideo(String(req.body.videoId));
        if (stored) {
          if (!title) title = stored.title;
          if (!titleVi) titleVi = stored.title_vi;
          if (!author) author = stored.author || "";
          if (!coverUrl && stored.cover) coverUrl = stored.cover;
          if (!localThumbPath && stored.thumbnailPath) localThumbPath = stored.thumbnailPath;
        }
      }

      if (!title && !titleVi) {
        return res.status(400).json({ error: "Vui lòng cung cấp tiêu đề hoặc liên kết video để phân tích sản phẩm." });
      }

      const frameImage = req.body.frameImage;
      const frameTimestamp = req.body.frameTimestamp ? Number(req.body.frameTimestamp) : undefined;
      const frameTimestampStr = req.body.frameTimestampStr;

      console.log(`[API PRODUCT ANALYSIS] Analyzing video products for: "${titleVi || title}" ${frameTimestampStr ? `(Frame: ${frameTimestampStr})` : ""}...`);
      const analysis = await geminiService.analyzeVideoProducts({
        title,
        titleVi,
        description,
        author,
        coverUrl,
        localThumbPath,
        frameImage,
        frameTimestamp,
        frameTimestampStr,
        tags,
        model: req.body.model
      });

      return res.json({ success: true, data: analysis });
    } catch (err: any) {
      console.warn("[API PRODUCT ANALYSIS NOTICE]:", err?.message || err);
      const fallback = geminiService.generateFallbackProductAnalysis({
        title: req.body.title || "",
        titleVi: req.body.titleVi,
        coverUrl: req.body.coverUrl,
        description: req.body.description,
        author: req.body.author,
        frameTimestampStr: req.body.frameTimestampStr,
        frameImage: req.body.frameImage
      });
      return res.json({ success: true, data: fallback });
    }
  });

  // Extract keyframe image series from video
  app.post("/api/video/extract-frames", async (req, res) => {
    try {
      const { videoId, videoPath: rawPath, frameCount, intervalSeconds, customTimestamps } = req.body;
      let targetPath = rawPath;

      if (!targetPath && videoId) {
        targetPath = FrameExtractorService.resolveLocalVideoPath(videoId);
      }

      if (!targetPath || !fs.existsSync(targetPath)) {
        return res.status(404).json({
          error: "Không tìm thấy tệp video trên máy chủ để cắt khung hình. Bạn có thể sử dụng tính năng trích xuất khung hình trực tiếp bằng Trình duyệt (HTML5 Canvas)!"
        });
      }

      console.log(`[FRAME EXTRACTION] Extracting frames for video: ${targetPath} (Count: ${frameCount || 12})...`);
      const frames = await FrameExtractorService.extractFrames({
        videoPath: targetPath,
        frameCount: frameCount ? Number(frameCount) : 12,
        intervalSeconds: intervalSeconds ? Number(intervalSeconds) : undefined,
        customTimestamps: Array.isArray(customTimestamps) ? customTimestamps : undefined
      });

      return res.json({
        success: true,
        count: frames.length,
        frames
      });
    } catch (err: any) {
      console.warn("[FRAME EXTRACTION ERROR]:", err?.message || err);
      return res.status(500).json({
        error: err.message || "Lỗi khi trích xuất khung hình từ video."
      });
    }
  });

  // Capture a single frame from video at a specific timestamp
  app.post("/api/video/capture-frame", async (req, res) => {
    try {
      const { videoId, videoPath: rawPath, timestamp } = req.body;
      let targetPath = rawPath;

      if (!targetPath && videoId) {
        targetPath = FrameExtractorService.resolveLocalVideoPath(videoId);
      }

      if (!targetPath || !fs.existsSync(targetPath)) {
        return res.status(404).json({
          error: "Không tìm thấy tệp video trên máy chủ để chụp khung hình."
        });
      }

      const ts = typeof timestamp === "number" ? timestamp : parseFloat(timestamp) || 1;
      const frame = await FrameExtractorService.captureSingleFrame(targetPath, ts);

      return res.json({
        success: true,
        frame
      });
    } catch (err: any) {
      console.warn("[FRAME CAPTURE ERROR]:", err?.message || err);
      return res.status(500).json({
        error: err.message || "Lỗi khi chụp khung hình từ video."
      });
    }
  });

  // Process video download (both audio + video combined)
  app.post("/api/download/process", async (req, res) => {
    try {
      const linkOrBvid = String(req.body.link || req.body.bvid || "").trim();
      const forceRedownload = Boolean(req.body.force);
      const bvid = DownloadService.extractBvid(linkOrBvid);
      if (!bvid) {
        return res.status(400).json({ error: "Vui lòng cung cấp link Bilibili hợp lệ hoặc mã BVID (ví dụ: BV1xx411c7mD)." });
      }

      // Pre-check if video has already been downloaded, unless explicitly forced
      if (!forceRedownload) {
        const check = DownloadService.checkIfDownloaded(bvid);
        if (check.exists && check.data) {
          return res.json({
            success: true,
            alreadyDownloaded: true,
            message: "Video này đã được tải trước đó trong thư mục lưu trữ.",
            data: check.data
          });
        }
      }

      console.log(`[API DOWNLOAD REQUEST] Processing download for ${bvid}...`);
      const result = await DownloadService.downloadVideo(bvid, geminiService);
      return res.json({ success: true, alreadyDownloaded: false, data: result });
    } catch (err: any) {
      console.error("[API DOWNLOAD PROCESS ERROR]:", err);
      return res.status(500).json({ error: err.message || "Lỗi trong quá trình tải và ghép video." });
    }
  });

  // Stream or serve downloaded temporary file
  app.get("/api/download/file/:filename", (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = path.join(DownloadService.TEMP_DIR, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Tệp video không tồn tại hoặc đã bị xóa do quá thời hạn 5 tiếng." });
      }

      // Check if browser requested download attachment or inline playback
      const isInline = req.query.inline === "true";
      if (isInline) {
        return res.sendFile(filePath);
      }

      return res.download(filePath, filename);
    } catch (err: any) {
      console.error("[API FILE SERVE ERROR]:", err);
      return res.status(500).json({ error: "Không thể phục vụ tệp video." });
    }
  });

  // Delete a single temporary file
  app.delete("/api/download/file/:filename", (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const success = DownloadService.deleteTemporaryFile(filename);
      if (success) {
        return res.json({ success: true, message: `Đã xóa tệp ${filename} thành công.` });
      } else {
        return res.status(404).json({ success: false, error: "Tệp không tồn tại hoặc đã bị xóa trước đó." });
      }
    } catch (err: any) {
      console.error("[API DELETE FILE ERROR]:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Clear all temporary files
  app.post("/api/downloads/delete-all", (_req, res) => {
    try {
      const count = DownloadService.clearAllTemporaryFiles();
      return res.json({ success: true, count, message: `Đã dọn sạch ${count} tệp tạm thời.` });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Storage monitor dashboard statistics
  app.get("/api/storage/stats", (_req, res) => {
    try {
      const stats = StorageService.getStorageDashboard();
      return res.json({ success: true, data: stats });
    } catch (err: any) {
      console.error("[API STORAGE STATS ERROR]:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // Manually trigger cleanup of expired temporary files and return updated stats
  app.post("/api/storage/cleanup-expired", (_req, res) => {
    try {
      DownloadService.cleanupOldFiles();
      const stats = StorageService.getStorageDashboard();
      return res.json({
        success: true,
        message: "Đã dọn dẹp các tệp tạm thời hết hạn (quá 5 giờ) thành công.",
        data: stats
      });
    } catch (err: any) {
      console.error("[API STORAGE CLEANUP ERROR]:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // List temporary files and countdown
  app.get("/api/downloads/list", (_req, res) => {
    try {
      const list = DownloadService.listTemporaryFiles();
      return res.json({ success: true, data: list, retentionHours: 5 });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // All managed videos (Bilibili downloads + Personal uploads)
  app.get("/api/videos/managed", (_req, res) => {
    try {
      // Sync bilibili temp files with store
      DownloadService.listTemporaryFiles();
      const allVideos = VideoStore.getAllVideos();
      return res.json({ success: true, data: allVideos });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // Upload personal video
  app.post("/api/upload/video", uploader.single("video") as any, async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "Vui lòng chọn một tệp video để tải lên." });
      }

      const customTitle = req.body.title ? String(req.body.title).trim() : undefined;
      const registered = await UploadService.registerUploadedFile(req.file, customTitle);

      return res.json({
        success: true,
        message: "Tải lên video cá nhân thành công!",
        data: registered
      });
    } catch (err: any) {
      console.error("[API UPLOAD ERROR]:", err);
      return res.status(500).json({ error: err.message || "Lỗi khi xử lý video tải lên." });
    }
  });

  // Serve personal uploaded video
  app.get("/api/upload/file/:filename", (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = path.join(UploadService.UPLOADS_DIR, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "Tệp video cá nhân không tồn tại." });
      }

      const isInline = req.query.inline === "true";
      if (isInline) {
        return res.sendFile(filePath);
      }

      return res.download(filePath, filename);
    } catch (err: any) {
      console.error("[API SERVE UPLOAD ERROR]:", err);
      return res.status(500).json({ error: "Không thể phục vụ tệp video." });
    }
  });

  // Serve personal uploaded video thumbnail
  app.get("/api/upload/thumb/:filename", (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const thumbPath = path.join(UploadService.THUMBS_DIR, filename);

      if (!fs.existsSync(thumbPath)) {
        return res.status(404).send("Not found");
      }

      return res.sendFile(thumbPath);
    } catch {
      return res.status(404).send("Not found");
    }
  });

  // Delete personal uploaded video
  app.delete("/api/upload/file/:filename", (req, res) => {
    try {
      const filename = path.basename(req.params.filename);
      const filePath = path.join(UploadService.UPLOADS_DIR, filename);

      let deleted = false;
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted = true;
      }

      VideoStore.removeByFilename(filename);

      return res.json({ success: true, deleted, message: "Đã xóa video cá nhân thành công." });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  });

  // -------------------------------------------------------------
  // Telegram Cloud Storage Endpoints
  // -------------------------------------------------------------
  // 1. Get Telegram Bot & Backup Status
  app.get("/api/telegram/status", async (_req, res) => {
    try {
      const status = await TelegramService.getStatus();
      return res.json({ success: true, data: status });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Upload/Backup Video to Telegram
  app.post("/api/telegram/upload", async (req, res) => {
    try {
      const { videoId, deleteLocalAfter } = req.body;
      if (!videoId) {
        return res.status(400).json({ success: false, error: "Thiếu videoId cần tải lên Telegram." });
      }

      const result = await TelegramService.uploadVideo(videoId, !!deleteLocalAfter);
      return res.json({ success: true, ...result });
    } catch (err: any) {
      console.error("[TELEGRAM UPLOAD ERROR]:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Restore Video from Telegram to Local Server
  app.post("/api/telegram/restore", async (req, res) => {
    try {
      const { videoId } = req.body;
      if (!videoId) {
        return res.status(400).json({ success: false, error: "Thiếu videoId cần lấy về từ Telegram." });
      }

      const restored = await TelegramService.restoreVideoToLocal(videoId);
      return res.json({
        success: true,
        message: "Đã lấy video từ Telegram về máy chủ thành công!",
        data: restored
      });
    } catch (err: any) {
      console.error("[TELEGRAM RESTORE ERROR]:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. Delete only local server file while keeping Telegram cloud backup & metadata
  app.post("/api/telegram/delete-local", (req, res) => {
    try {
      const { videoId } = req.body;
      if (!videoId) {
        return res.status(400).json({ success: false, error: "Thiếu videoId." });
      }

      const result = TelegramService.deleteLocalCopy(videoId);
      return res.json(result);
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. Stream video directly from Telegram or Local (for playback even if local file was deleted)
  app.get("/api/telegram/stream/:id", async (req, res) => {
    try {
      const videoId = req.params.id;
      const video = VideoStore.getVideo(videoId);
      if (!video) {
        return res.status(404).send("Video không tồn tại");
      }

      // If local file still exists, serve directly with support for Range requests
      if (video.hasLocalFile && fs.existsSync(video.filePath)) {
        return res.sendFile(video.filePath);
      }

      // If video is backed up on Telegram, stream from Telegram
      if (!video.telegram?.fileId) {
        return res.status(404).send("Tệp video cục bộ đã bị xóa và chưa được sao lưu lên Telegram.");
      }

      const directUrl = await TelegramService.getDirectFileUrl(video.telegram.fileId);
      const remoteRes = await fetch(directUrl);
      if (!remoteRes.ok || !remoteRes.body) {
        return res.status(502).send("Không thể truyền phát video từ máy chủ Telegram.");
      }

      res.setHeader("Content-Type", "video/mp4");
      if (video.telegram.fileSize) {
        res.setHeader("Content-Length", video.telegram.fileSize);
      }

      const reader = remoteRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch (err: any) {
      console.error("[TELEGRAM STREAM ERROR]:", err);
      if (!res.headersSent) {
        res.status(500).send("Lỗi khi phát video từ Telegram: " + err.message);
      }
    }
  });

  // 6. Download video directly to user's computer (attachment)
  app.get("/api/telegram/download/:id", async (req, res) => {
    try {
      const videoId = req.params.id;
      const video = VideoStore.getVideo(videoId);
      if (!video) {
        return res.status(404).json({ error: "Không tìm thấy video." });
      }

      // If local file exists, send download directly
      if (video.hasLocalFile && fs.existsSync(video.filePath)) {
        return res.download(video.filePath, video.filename);
      }

      // If backed up on Telegram, pipe download with attachment header
      if (!video.telegram?.fileId) {
        return res.status(404).json({ error: "Tệp video không tồn tại trên máy chủ lẫn Telegram." });
      }

      const directUrl = await TelegramService.getDirectFileUrl(video.telegram.fileId);
      const remoteRes = await fetch(directUrl);
      if (!remoteRes.ok || !remoteRes.body) {
        return res.status(502).json({ error: "Lỗi kết nối máy chủ Telegram." });
      }

      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(video.filename)}"`);
      res.setHeader("Content-Type", "video/mp4");
      if (video.telegram.fileSize) {
        res.setHeader("Content-Length", video.telegram.fileSize);
      }

      const reader = remoteRes.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
      res.end();
    } catch (err: any) {
      console.error("[TELEGRAM DOWNLOAD ERROR]:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: err.message });
      }
    }
  });

  // -------------------------------------------------------------
  // Video Editor Endpoints (Vietsub, AI Dubbing & Projects)
  // -------------------------------------------------------------
  // 0. Get available Gemini AI modules
  app.get("/api/gemini/modules", (_req, res) => {
    try {
      const modules = geminiService.getModules();
      return res.json({ success: true, data: modules });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 1. Get selectable videos for editor
  app.get("/api/editor/videos", (_req, res) => {
    try {
      const videos = EditorService.getSelectableVideos();
      return res.json({ success: true, data: videos });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 2. Get saved editor project by videoId
  app.get("/api/editor/project/:videoId", (req, res) => {
    try {
      const { videoId } = req.params;
      const project = EditorService.getProject(videoId);
      return res.json({ success: true, data: project });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 3. Save editor project (subtitles, styling, dubbing config)
  app.post("/api/editor/project/:videoId", (req, res) => {
    try {
      const { videoId } = req.params;
      const saved = EditorService.saveProject(videoId, req.body);
      return res.json({ success: true, data: saved });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 4. AI Vietsub Generator using Gemini
  app.post("/api/editor/ai-vietsub", async (req, res) => {
    try {
      const { title, description, durationSeconds, style, languageHint, model } = req.body;
      if (!title) {
        return res.status(400).json({ success: false, error: "Thiếu tiêu đề video để tạo Vietsub." });
      }

      const subtitles = await geminiService.generateVietsub({
        title,
        description,
        durationSeconds: Number(durationSeconds) || 60,
        style: style || "tự nhiên, cuốn hút",
        languageHint,
        model
      });

      return res.json({ success: true, data: subtitles, modelUsed: model || "auto" });
    } catch (err: any) {
      console.error("[AI VIETSUB ERROR]:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 5. AI Translate Subtitles using Gemini
  app.post("/api/editor/ai-translate", async (req, res) => {
    try {
      const { items, model } = req.body;
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: "Danh sách phụ đề cần dịch không hợp lệ." });
      }

      const translated = await geminiService.translateSubtitles(items, model);
      return res.json({ success: true, data: translated, modelUsed: model || "auto" });
    } catch (err: any) {
      console.error("[AI TRANSLATE SUBS ERROR]:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  // 6. Gemini Cloud AI Text-To-Speech / Dubbing
  app.post("/api/editor/gemini-tts", async (req, res) => {
    try {
      const { text, model, voiceName, style } = req.body;
      if (!text) {
        return res.status(400).json({ success: false, error: "Thiếu văn bản để lồng tiếng." });
      }

      const result = await geminiService.generateSpeech({
        text,
        model,
        voiceName,
        style
      });

      return res.json(result);
    } catch (err: any) {
      console.error("[GEMINI TTS ERROR]:", err);
      return res.json({
        success: false,
        fallbackToBrowser: true,
        message: err.message || "Lỗi tạo giọng đọc Gemini, chuyển sang Trình Duyệt."
      });
    }
  });

  // Video search & recommendation endpoint
  app.get("/api/videos", async (req, res) => {
    try {
      const platform = String(req.query.platform || "bilibili");
      const keyword = String(req.query.keyword || "").trim();
      const page = Math.max(1, parseInt(String(req.query.page || "1"), 10) || 1);
      const count = Math.min(50, Math.max(1, parseInt(String(req.query.count || "16"), 10) || 16));
      const order = String(req.query.order || "totalrank"); // 'totalrank' | 'pubdate' | 'click'
      const timeRange = String(req.query.timeRange || "all"); // 'all' | 'today' | 'week' | 'month' | 'year'

      // 1. Fetch raw videos
      let rawVideos = [];
      if (keyword) {
        rawVideos = await BilibiliCrawler.searchVideos(keyword, page, count, order, timeRange);
      } else {
        rawVideos = await BilibiliCrawler.fetchHomeRecommendations(page, count, order, timeRange);
      }

      if (!rawVideos || rawVideos.length === 0) {
        return res.json({ platform, page, count: 0, order, timeRange, data: [] });
      }

      // 2. Collect original titles
      const originalTitles = rawVideos.map(v => v.title || "");

      // 3. Batch translate titles via Gemini
      const translatedTitles = await geminiService.translateTitlesBatch(originalTitles);

      // 4. Attach Vietnamese titles
      for (let i = 0; i < rawVideos.length; i++) {
        if (i < translatedTitles.length && translatedTitles[i]) {
          rawVideos[i].title_vi = translatedTitles[i];
        } else {
          rawVideos[i].title_vi = rawVideos[i].title;
        }
      }

      return res.json({
        platform,
        page,
        count: rawVideos.length,
        data: rawVideos
      });
    } catch (err: any) {
      console.error("[API VIDEOS ERROR]:", err);
      return res.status(500).json({ error: "Internal server error", message: err?.message || String(err) });
    }
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
