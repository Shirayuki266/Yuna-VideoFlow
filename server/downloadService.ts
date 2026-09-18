import fs from "fs";
import path from "path";
import axios from "axios";
import { spawn } from "child_process";
import { pipeline } from "stream";
import { promisify } from "util";
import { GeminiService } from "./geminiService";
import { VideoStore, StoredVideo } from "./videoStore";

const streamPipeline = promisify(pipeline);

export interface VideoMetadata {
  bvid: string;
  aid?: number;
  cid: number;
  title: string;
  title_vi?: string;
  cover: string;
  duration: string;
  author: string;
  play: number;
  pubdate: number;
}

export interface DownloadResult {
  bvid: string;
  title: string;
  title_vi?: string;
  filename: string;
  downloadUrl: string;
  fileSizeBytes: number;
  formattedSize: string;
  createdAt: number;
  expiresAt: number;
}

export class DownloadService {
  public static readonly TEMP_DIR = path.join(process.cwd(), "temp_downloads");
  public static readonly RETENTION_MS = 5 * 60 * 60 * 1000; // 5 hours

  private static inProgressDownloads = new Map<string, Promise<DownloadResult>>();

  public static init() {
    if (!fs.existsSync(this.TEMP_DIR)) {
      fs.mkdirSync(this.TEMP_DIR, { recursive: true });
      console.log(`[DOWNLOAD SERVICE] Created temp directory at ${this.TEMP_DIR}`);
    }

    // Run cleanup on startup
    this.cleanupOldFiles();

    // Schedule cleanup every 15 minutes
    setInterval(() => {
      this.cleanupOldFiles();
    }, 15 * 60 * 1000);
  }

  public static cleanupOldFiles(): void {
    try {
      if (!fs.existsSync(this.TEMP_DIR)) return;
      const files = fs.readdirSync(this.TEMP_DIR);
      const now = Date.now();
      let deletedCount = 0;

      for (const file of files) {
        const filePath = path.join(this.TEMP_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          const ageMs = now - stats.mtimeMs;
          if (ageMs > this.RETENTION_MS) {
            fs.unlinkSync(filePath);
            deletedCount++;
            console.log(`[CLEANUP] Deleted expired file (${Math.round(ageMs / 3600000)}h old): ${file}`);
          }
        } catch (fileErr) {
          console.error(`[CLEANUP ERROR] Failed to inspect/delete ${file}:`, fileErr);
        }
      }

      if (deletedCount > 0) {
        console.log(`[CLEANUP SUMMARY] Cleaned up ${deletedCount} file(s) older than 5 hours.`);
      }
    } catch (err) {
      console.error("[CLEANUP ERROR]:", err);
    }
  }

  public static extractBvid(input: string): string | null {
    if (!input) return null;
    const trimmed = input.trim();
    const bvMatch = trimmed.match(/BV[0-9a-zA-Z]{10}/i);
    if (bvMatch) {
      return bvMatch[0];
    }
    return null;
  }

  public static sanitizeFilename(name: string): string {
    return name
      .replace(/[\/\\?%*:|"<>]/g, "_")
      .replace(/\s+/g, "_")
      .slice(0, 80);
  }

  public static formatBytes(bytes: number): string {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }

  private static runFfmpeg(args: string[], timeoutMs: number = 300000): Promise<void> {
    return new Promise((resolve, reject) => {
      const proc = spawn("ffmpeg", args);
      let stderr = "";

      const timer = setTimeout(() => {
        proc.kill("SIGKILL");
        reject(new Error("Quá thời gian xử lý video (timeout 5 phút)."));
      }, timeoutMs);

      proc.stderr.on("data", (chunk) => {
        stderr = (stderr + chunk.toString()).slice(-2000);
      });

      proc.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });

      proc.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`ffmpeg kết thúc với mã lỗi ${code}: ${stderr.slice(-300)}`));
        }
      });
    });
  }

  public static async getVideoMetadata(bvid: string, geminiService?: GeminiService): Promise<VideoMetadata> {
    const url = `https://api.bilibili.com/x/web-interface/view?bvid=${encodeURIComponent(bvid)}`;
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.bilibili.com/"
      },
      timeout: 10000
    });

    const data = response.data;
    if (data.code !== 0 || !data.data) {
      throw new Error(`Video không tồn tại hoặc lỗi Bilibili: ${data.message || data.code}`);
    }

    const videoData = data.data;
    const cid = videoData.cid || (videoData.pages && videoData.pages[0]?.cid);
    if (!cid) {
      throw new Error("Không thể tìm thấy CID của video.");
    }

    let title_vi = videoData.title;
    if (geminiService) {
      try {
        const translated = await geminiService.translateTitlesBatch([videoData.title]);
        if (translated && translated[0]) {
          title_vi = translated[0];
        }
      } catch (gemErr) {
        console.warn("[DOWNLOAD METADATA]: Gemini translation skipped:", gemErr);
      }
    }

    const totalSec = videoData.duration || 0;
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    const pad = (n: number) => n.toString().padStart(2, "0");
    const durationStr = hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;

    return {
      bvid: videoData.bvid,
      aid: videoData.aid,
      cid,
      title: videoData.title,
      title_vi,
      cover: videoData.pic,
      duration: durationStr,
      author: videoData.owner?.name || "N/A",
      play: videoData.stat?.view || 0,
      pubdate: videoData.pubdate || 0
    };
  }

  public static async downloadVideo(bvid: string, geminiService?: GeminiService): Promise<DownloadResult> {
    // If a download for this bvid is already in flight, reuse the promise
    if (this.inProgressDownloads.has(bvid)) {
      return this.inProgressDownloads.get(bvid)!;
    }

    const downloadPromise = this.performDownload(bvid, geminiService);
    this.inProgressDownloads.set(bvid, downloadPromise);

    try {
      const result = await downloadPromise;
      return result;
    } finally {
      this.inProgressDownloads.delete(bvid);
    }
  }

  private static async performDownload(bvid: string, geminiService?: GeminiService): Promise<DownloadResult> {
    const meta = await this.getVideoMetadata(bvid, geminiService);
    const safeTitle = this.sanitizeFilename(meta.title_vi || meta.title);
    const outputFilename = `${bvid}_${safeTitle}.mp4`;
    const outputPath = path.join(this.TEMP_DIR, outputFilename);

    // If file already exists and is non-empty, check its age and return it
    if (fs.existsSync(outputPath)) {
      const stats = fs.statSync(outputPath);
      if (stats.size > 1024) {
        // Refresh mtime so it gets another 5 hours
        fs.utimesSync(outputPath, new Date(), new Date());
        const existingStored: StoredVideo = {
          id: bvid,
          type: "bilibili",
          title: meta.title,
          title_vi: meta.title_vi,
          cover: meta.cover,
          duration: meta.duration,
          author: meta.author,
          filename: outputFilename,
          filePath: outputPath,
          downloadUrl: `/api/download/file/${encodeURIComponent(outputFilename)}`,
          streamUrl: `/api/download/file/${encodeURIComponent(outputFilename)}?inline=true`,
          fileSizeBytes: stats.size,
          formattedSize: this.formatBytes(stats.size),
          createdAt: stats.birthtimeMs || stats.mtimeMs,
          expiresAt: Date.now() + this.RETENTION_MS
        };
        VideoStore.upsertVideo(existingStored);

        return {
          bvid,
          title: meta.title,
          title_vi: meta.title_vi,
          filename: outputFilename,
          downloadUrl: `/api/download/file/${encodeURIComponent(outputFilename)}`,
          fileSizeBytes: stats.size,
          formattedSize: this.formatBytes(stats.size),
          createdAt: stats.birthtimeMs || stats.mtimeMs,
          expiresAt: Date.now() + this.RETENTION_MS
        };
      }
    }

    // Fetch playurl
    const playUrlEndpoint = `https://api.bilibili.com/x/player/playurl?bvid=${bvid}&cid=${meta.cid}&qn=64&fnval=16`;
    const playRes = await axios.get(playUrlEndpoint, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.bilibili.com/"
      },
      timeout: 10000
    });

    const playData = playRes.data;
    if (playData.code !== 0 || !playData.data) {
      throw new Error(`Không lấy được luồng video từ Bilibili (code: ${playData.code})`);
    }

    const dash = playData.data.dash;
    const tempPartPath = path.join(this.TEMP_DIR, `${bvid}_temp_${Date.now()}.mp4`);
    const customHeaders = "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\nReferer: https://www.bilibili.com/\r\n";

    if (dash && dash.video && dash.video.length > 0 && dash.audio && dash.audio.length > 0) {
      // Pick best compatible video stream (h264/avc1 preferred, fallback first)
      const videoStream = dash.video.find((v: any) => v.codecs && v.codecs.startsWith("avc1")) || dash.video[0];
      // Pick best audio stream
      const audioStream = dash.audio[0];

      const vUrl = videoStream.baseUrl || videoStream.base_url;
      const aUrl = audioStream.baseUrl || audioStream.base_url;

      if (!vUrl || !aUrl) {
        throw new Error("Không tìm thấy link luồng video hoặc âm thanh từ Bilibili DASH.");
      }

      console.log(`[DOWNLOAD] Starting ffmpeg muxing for ${bvid} (Video + Audio)...`);

      let directSuccess = false;
      try {
        // Direct stream muxing without shell (no shell escaping issues, exact CRLF headers)
        await this.runFfmpeg([
          "-y",
          "-headers", customHeaders,
          "-i", vUrl,
          "-headers", customHeaders,
          "-i", aUrl,
          "-c", "copy",
          "-movflags", "+faststart",
          tempPartPath
        ]);
        directSuccess = true;
      } catch (directErr: any) {
        console.warn(`[DOWNLOAD WARNING] Direct ffmpeg stream failed, falling back to buffered download: ${directErr?.message}`);
        if (fs.existsSync(tempPartPath)) {
          fs.unlinkSync(tempPartPath);
        }
      }

      // If direct stream reading failed, use Axios streams to download chunks then merge locally
      if (!directSuccess) {
        const tempVPath = path.join(this.TEMP_DIR, `${bvid}_v_${Date.now()}.m4s`);
        const tempAPath = path.join(this.TEMP_DIR, `${bvid}_a_${Date.now()}.m4s`);

        try {
          const reqHeaders = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://www.bilibili.com/"
          };

          console.log(`[DOWNLOAD FALLBACK] Downloading video and audio streams via Axios...`);
          const [vRes, aRes] = await Promise.all([
            axios.get(vUrl, { headers: reqHeaders, responseType: "stream", timeout: 60000 }),
            axios.get(aUrl, { headers: reqHeaders, responseType: "stream", timeout: 60000 })
          ]);

          await Promise.all([
            streamPipeline(vRes.data, fs.createWriteStream(tempVPath)),
            streamPipeline(aRes.data, fs.createWriteStream(tempAPath))
          ]);

          console.log(`[DOWNLOAD FALLBACK] Streams downloaded, merging with ffmpeg locally...`);
          await this.runFfmpeg([
            "-y",
            "-i", tempVPath,
            "-i", tempAPath,
            "-c", "copy",
            "-movflags", "+faststart",
            tempPartPath
          ]);
        } catch (fallbackErr: any) {
          if (fs.existsSync(tempPartPath)) fs.unlinkSync(tempPartPath);
          throw new Error(`Lỗi tải và ghép video: ${fallbackErr?.message || fallbackErr}`);
        } finally {
          if (fs.existsSync(tempVPath)) fs.unlinkSync(tempVPath);
          if (fs.existsSync(tempAPath)) fs.unlinkSync(tempAPath);
        }
      }
    } else if (playData.data.durl && playData.data.durl.length > 0) {
      // Fallback single stream (FLV or direct MP4 with combined audio/video)
      const directUrl = playData.data.durl[0].url;
      console.log(`[DOWNLOAD] Single stream detected for ${bvid}, downloading with ffmpeg...`);

      try {
        await this.runFfmpeg([
          "-y",
          "-headers", customHeaders,
          "-i", directUrl,
          "-c", "copy",
          "-movflags", "+faststart",
          tempPartPath
        ]);
      } catch (ffmpegErr: any) {
        if (fs.existsSync(tempPartPath)) fs.unlinkSync(tempPartPath);
        throw new Error(`Lỗi tải luồng đơn với ffmpeg: ${ffmpegErr?.message || ffmpegErr}`);
      }
    } else {
      throw new Error("Không tìm thấy định dạng luồng phát phù hợp từ Bilibili.");
    }

    // Rename completed file atomically
    fs.renameSync(tempPartPath, outputPath);

    const stats = fs.statSync(outputPath);
    console.log(`[DOWNLOAD SUCCESS] Saved ${outputFilename} (${this.formatBytes(stats.size)}) - Will retain for 5h.`);

    const newStored: StoredVideo = {
      id: bvid,
      type: "bilibili",
      title: meta.title,
      title_vi: meta.title_vi,
      cover: meta.cover,
      duration: meta.duration,
      author: meta.author,
      filename: outputFilename,
      filePath: outputPath,
      downloadUrl: `/api/download/file/${encodeURIComponent(outputFilename)}`,
      streamUrl: `/api/download/file/${encodeURIComponent(outputFilename)}?inline=true`,
      fileSizeBytes: stats.size,
      formattedSize: this.formatBytes(stats.size),
      createdAt: Date.now(),
      expiresAt: Date.now() + this.RETENTION_MS
    };
    VideoStore.upsertVideo(newStored);

    return {
      bvid,
      title: meta.title,
      title_vi: meta.title_vi,
      filename: outputFilename,
      downloadUrl: `/api/download/file/${encodeURIComponent(outputFilename)}`,
      fileSizeBytes: stats.size,
      formattedSize: this.formatBytes(stats.size),
      createdAt: Date.now(),
      expiresAt: Date.now() + this.RETENTION_MS
    };
  }

  public static checkIfDownloaded(bvid: string): { exists: boolean; data?: StoredVideo } {
    if (!bvid) return { exists: false };
    const cleanBvid = this.extractBvid(bvid) || bvid.trim();

    // 1. Check in VideoStore
    const stored = VideoStore.getVideo(cleanBvid);
    if (stored && fs.existsSync(stored.filePath)) {
      return { exists: true, data: stored };
    }

    // 2. Fallback scan TEMP_DIR for file matching prefix `${cleanBvid}_`
    if (fs.existsSync(this.TEMP_DIR)) {
      const files = fs.readdirSync(this.TEMP_DIR);
      const match = files.find(f => f.startsWith(`${cleanBvid}_`) && f.endsWith(".mp4") && !f.includes("_temp_"));
      if (match) {
        const filePath = path.join(this.TEMP_DIR, match);
        try {
          const stats = fs.statSync(filePath);
          if (stats.size > 1024) {
            const reconstructed: StoredVideo = {
              id: cleanBvid,
              type: "bilibili",
              title: match.replace(`${cleanBvid}_`, "").replace(/\.mp4$/, ""),
              cover: "",
              filename: match,
              filePath,
              downloadUrl: `/api/download/file/${encodeURIComponent(match)}`,
              streamUrl: `/api/download/file/${encodeURIComponent(match)}?inline=true`,
              fileSizeBytes: stats.size,
              formattedSize: this.formatBytes(stats.size),
              createdAt: stats.mtimeMs,
              expiresAt: stats.mtimeMs + this.RETENTION_MS
            };
            VideoStore.upsertVideo(reconstructed);
            return { exists: true, data: reconstructed };
          }
        } catch {
          // ignore
        }
      }
    }

    return { exists: false };
  }

  public static deleteTemporaryFile(filename: string): boolean {
    const safeFilename = path.basename(filename);
    const filePath = path.join(this.TEMP_DIR, safeFilename);

    let deleted = false;
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath);
        deleted = true;
      } catch (err) {
        console.error(`[DOWNLOAD SERVICE] Error deleting ${filePath}:`, err);
      }
    }

    VideoStore.removeByFilename(safeFilename);
    return deleted;
  }

  public static clearAllTemporaryFiles(): number {
    this.cleanupOldFiles();
    if (!fs.existsSync(this.TEMP_DIR)) return 0;
    const files = fs.readdirSync(this.TEMP_DIR);
    let count = 0;

    for (const f of files) {
      if (f.endsWith(".mp4") || f.endsWith(".m4s") || f.endsWith(".json")) {
        try {
          fs.unlinkSync(path.join(this.TEMP_DIR, f));
          count++;
        } catch (err) {
          console.error(`[CLEAR ALL] Failed to delete ${f}:`, err);
        }
      }
    }

    VideoStore.removeAll();
    return count;
  }

  public static listTemporaryFiles() {
    this.cleanupOldFiles();
    if (!fs.existsSync(this.TEMP_DIR)) return [];
    const files = fs.readdirSync(this.TEMP_DIR);
    const now = Date.now();

    return files
      .filter(f => f.endsWith(".mp4") && !f.includes("_temp_"))
      .map(file => {
        const filePath = path.join(this.TEMP_DIR, file);
        try {
          const stats = fs.statSync(filePath);
          const ageMs = now - stats.mtimeMs;
          const remainingMs = Math.max(0, this.RETENTION_MS - ageMs);

          // Get rich metadata if available
          const stored = VideoStore.getVideoByFilename(file);

          // Extract bvid from filename if not in store
          const bvMatch = file.match(/^(BV[0-9a-zA-Z]{10})_/);
          const bvid = stored?.id || (bvMatch ? bvMatch[1] : "");

          return {
            id: bvid || file,
            bvid,
            filename: file,
            title: stored?.title || file.replace(/\.mp4$/, ""),
            title_vi: stored?.title_vi,
            cover: stored?.cover || "",
            duration: stored?.duration,
            author: stored?.author || "Bilibili",
            sizeBytes: stats.size,
            formattedSize: this.formatBytes(stats.size),
            downloadUrl: `/api/download/file/${encodeURIComponent(file)}`,
            streamUrl: `/api/download/file/${encodeURIComponent(file)}?inline=true`,
            createdAt: stored?.createdAt || stats.birthtimeMs || stats.mtimeMs,
            ageMinutes: Math.round(ageMs / 60000),
            remainingHours: (remainingMs / 3600000).toFixed(1),
            expiresAt: stats.mtimeMs + this.RETENTION_MS
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
}
