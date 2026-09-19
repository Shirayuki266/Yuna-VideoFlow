import fs from "fs";
import path from "path";
import { exec } from "child_process";
import util from "util";
import { VideoStore } from "./videoStore";
import { DownloadService } from "./downloadService";

const execPromise = util.promisify(exec);

export interface ExtractedFrame {
  id: string;
  index: number;
  timestamp: number; // in seconds
  timeFormatted: string; // "MM:SS"
  imageUrl: string;
  dataUrl?: string; // base64 data url if needed
  width?: number;
  height?: number;
}

export class FrameExtractorService {
  public static readonly FRAMES_DIR = path.join(process.cwd(), "public", "temp_frames");

  public static init(): void {
    if (!fs.existsSync(this.FRAMES_DIR)) {
      fs.mkdirSync(this.FRAMES_DIR, { recursive: true });
    }
  }

  public static formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  /**
   * Resolve a local file path for a video given its ID or filename or URL
   */
  public static resolveLocalVideoPath(videoIdOrPath: string): string | null {
    if (!videoIdOrPath) return null;

    // 1. Direct path check
    if (fs.existsSync(videoIdOrPath) && fs.statSync(videoIdOrPath).isFile()) {
      return videoIdOrPath;
    }

    // 2. Check VideoStore
    const stored = VideoStore.getVideo(videoIdOrPath);
    if (stored && stored.filePath && fs.existsSync(stored.filePath)) {
      return stored.filePath;
    }

    // 3. Check DownloadService temp directory
    const tempPath = path.join(DownloadService.TEMP_DIR, path.basename(videoIdOrPath));
    if (fs.existsSync(tempPath)) {
      return tempPath;
    }

    // Check temp with .mp4
    if (!videoIdOrPath.endsWith(".mp4")) {
      const tempWithExt = path.join(DownloadService.TEMP_DIR, `${path.basename(videoIdOrPath)}.mp4`);
      if (fs.existsSync(tempWithExt)) {
        return tempWithExt;
      }
    }

    // 4. Search in downloads and uploads directories
    const candidateDirs = [
      path.join(process.cwd(), "downloads"),
      path.join(process.cwd(), "uploads"),
      DownloadService.TEMP_DIR
    ];

    for (const dir of candidateDirs) {
      if (!fs.existsSync(dir)) continue;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        if (file.includes(videoIdOrPath) && file.endsWith(".mp4")) {
          return path.join(dir, file);
        }
      }
    }

    return null;
  }

  /**
   * Get duration of video using ffprobe
   */
  public static async getVideoDuration(videoPath: string): Promise<number> {
    try {
      const cmd = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
      const { stdout } = await execPromise(cmd, { timeout: 10000 });
      const duration = parseFloat(stdout.trim());
      return isNaN(duration) || duration <= 0 ? 60 : duration;
    } catch {
      return 60; // default fallback 60s
    }
  }

  /**
   * Extract multiple keyframes from a video file using ffmpeg
   */
  public static async extractFrames(params: {
    videoPath: string;
    sessionId?: string;
    frameCount?: number; // e.g. 12
    intervalSeconds?: number; // e.g. every 5s
    customTimestamps?: number[];
  }): Promise<ExtractedFrame[]> {
    this.init();

    const { videoPath } = params;
    if (!fs.existsSync(videoPath)) {
      throw new Error(`Tệp video không tồn tại trên hệ thống: ${videoPath}`);
    }

    const duration = await this.getVideoDuration(videoPath);
    const count = Math.min(30, Math.max(4, params.frameCount || 12));
    const sessionId = params.sessionId || `session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const sessionDir = path.join(this.FRAMES_DIR, sessionId);

    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    // Determine timestamps
    let timestamps: number[] = [];
    if (params.customTimestamps && params.customTimestamps.length > 0) {
      timestamps = params.customTimestamps;
    } else if (params.intervalSeconds && params.intervalSeconds > 0) {
      for (let t = 1; t < duration; t += params.intervalSeconds) {
        timestamps.push(Math.round(t * 10) / 10);
        if (timestamps.length >= 30) break;
      }
    } else {
      // Calculate evenly spaced intervals
      // Avoid 0.0s (often black screen or title card), start slightly in
      const start = Math.min(1.5, duration * 0.03);
      const end = Math.max(start + 1, duration * 0.97);
      const step = (end - start) / Math.max(1, count - 1);

      for (let i = 0; i < count; i++) {
        const t = Math.round((start + i * step) * 10) / 10;
        if (t <= duration) {
          timestamps.push(t);
        }
      }
    }

    if (timestamps.length === 0) {
      timestamps = [1, Math.min(duration, 5)];
    }

    const frames: ExtractedFrame[] = [];

    // Extract each frame with ffmpeg
    for (let i = 0; i < timestamps.length; i++) {
      const ts = timestamps[i];
      const frameFileName = `frame_${(i + 1).toString().padStart(3, "0")}.jpg`;
      const outPath = path.join(sessionDir, frameFileName);

      try {
        // Fast seek before -i
        const cmd = `ffmpeg -ss ${ts} -i "${videoPath}" -vframes 1 -q:v 2 -vf "scale=854:-1" -y "${outPath}"`;
        await execPromise(cmd, { timeout: 8000 });

        if (fs.existsSync(outPath)) {
          const stats = fs.statSync(outPath);
          if (stats.size > 500) {
            frames.push({
              id: `${sessionId}_frame_${i + 1}`,
              index: i + 1,
              timestamp: ts,
              timeFormatted: this.formatTime(ts),
              imageUrl: `/temp_frames/${sessionId}/${frameFileName}`
            });
          }
        }
      } catch (err: any) {
        console.warn(`[FRAME EXTRACT NOTICE]: Failed to extract frame at ${ts}s:`, err?.message || err);
      }
    }

    // Cleanup older sessions (> 2 hours)
    this.cleanupOldSessions();

    return frames;
  }

  /**
   * Capture a single frame at a specific timestamp
   */
  public static async captureSingleFrame(videoPath: string, timestamp: number): Promise<ExtractedFrame> {
    this.init();
    if (!fs.existsSync(videoPath)) {
      throw new Error("Không tìm thấy tệp video để chụp khung hình.");
    }

    const sessionId = `snapshot_${Date.now()}`;
    const sessionDir = path.join(this.FRAMES_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    const frameFileName = `snapshot_${Math.round(timestamp)}s.jpg`;
    const outPath = path.join(sessionDir, frameFileName);
    const cmd = `ffmpeg -ss ${timestamp} -i "${videoPath}" -vframes 1 -q:v 2 -vf "scale=960:-1" -y "${outPath}"`;
    await execPromise(cmd, { timeout: 8000 });

    if (!fs.existsSync(outPath)) {
      throw new Error("Không thể chụp khung hình tại thời điểm này.");
    }

    return {
      id: `${sessionId}_snap`,
      index: 1,
      timestamp,
      timeFormatted: this.formatTime(timestamp),
      imageUrl: `/temp_frames/${sessionId}/${frameFileName}`
    };
  }

  /**
   * Periodically remove frame sessions older than 2 hours
   */
  public static cleanupOldSessions(): void {
    try {
      if (!fs.existsSync(this.FRAMES_DIR)) return;
      const now = Date.now();
      const maxAgeMs = 2 * 60 * 60 * 1000; // 2 hours

      const entries = fs.readdirSync(this.FRAMES_DIR);
      for (const entry of entries) {
        const fullPath = path.join(this.FRAMES_DIR, entry);
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isDirectory() && now - stats.mtimeMs > maxAgeMs) {
            fs.rmSync(fullPath, { recursive: true, force: true });
          }
        } catch {}
      }
    } catch (e) {
      console.warn("[FRAME EXTRACT CLEANUP NOTICE]:", e);
    }
  }
}
