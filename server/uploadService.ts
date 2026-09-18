import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import multer from "multer";
import { VideoStore, StoredVideo } from "./videoStore";

export class UploadService {
  public static readonly UPLOADS_DIR = path.join(process.cwd(), "user_uploads");
  public static readonly THUMBS_DIR = path.join(process.cwd(), "user_uploads", "thumbs");

  public static init(): void {
    if (!fs.existsSync(this.UPLOADS_DIR)) {
      fs.mkdirSync(this.UPLOADS_DIR, { recursive: true });
    }
    if (!fs.existsSync(this.THUMBS_DIR)) {
      fs.mkdirSync(this.THUMBS_DIR, { recursive: true });
    }
  }

  public static getMulterStorage() {
    this.init();
    const storage = multer.diskStorage({
      destination: (_req, _file, cb) => {
        cb(null, UploadService.UPLOADS_DIR);
      },
      filename: (_req, file, cb) => {
        const ext = path.extname(file.originalname) || ".mp4";
        const baseName = path.basename(file.originalname, ext)
          .replace(/[\/\\?%*:|"<>]/g, "_")
          .replace(/\s+/g, "_")
          .slice(0, 50);
        const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        cb(null, `UP_${uniqueSuffix}_${baseName}${ext}`);
      }
    });

    return multer({
      storage,
      limits: {
        fileSize: 1024 * 1024 * 500 // 500 MB max
      },
      fileFilter: (_req, file, cb) => {
        const allowedExtensions = [".mp4", ".mkv", ".webm", ".mov", ".avi", ".flv", ".ts"];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext) || file.mimetype.startsWith("video/")) {
          cb(null, true);
        } else {
          cb(new Error("Chỉ chấp nhận các tệp video (.mp4, .mkv, .webm, .mov, .avi, .flv)."));
        }
      }
    });
  }

  public static async generateThumbnail(videoPath: string, thumbPath: string): Promise<boolean> {
    return new Promise((resolve) => {
      // Try to seek 1 second in, if fails or too short, fallback to first frame
      const proc = spawn("ffmpeg", [
        "-y",
        "-ss", "00:00:01",
        "-i", videoPath,
        "-frames:v", "1",
        "-q:v", "2",
        thumbPath
      ]);

      proc.on("close", (code) => {
        if (code === 0 && fs.existsSync(thumbPath)) {
          resolve(true);
        } else {
          // Fallback to start of video
          const fallbackProc = spawn("ffmpeg", [
            "-y",
            "-i", videoPath,
            "-frames:v", "1",
            "-q:v", "2",
            thumbPath
          ]);
          fallbackProc.on("close", (code2) => {
            resolve(code2 === 0 && fs.existsSync(thumbPath));
          });
          fallbackProc.on("error", () => resolve(false));
        }
      });

      proc.on("error", () => resolve(false));
    });
  }

  public static async registerUploadedFile(
    file: Express.Multer.File,
    customTitle?: string
  ): Promise<StoredVideo> {
    const videoId = `UP_${Date.now()}`;
    const filename = file.filename;
    const filePath = file.path;

    // Generate thumbnail
    const thumbFilename = `${videoId}_thumb.jpg`;
    const thumbPath = path.join(this.THUMBS_DIR, thumbFilename);
    const thumbSuccess = await this.generateThumbnail(filePath, thumbPath);

    const coverUrl = thumbSuccess
      ? `/api/upload/thumb/${encodeURIComponent(thumbFilename)}`
      : ""; // empty fallback will use default placeholder in UI

    const displayName = customTitle?.trim() || file.originalname.replace(/\.[^/.]+$/, "");

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return "0 Bytes";
      const k = 1024;
      const sizes = ["Bytes", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    const storedVideo: StoredVideo = {
      id: videoId,
      type: "personal",
      title: displayName,
      title_vi: displayName,
      cover: coverUrl,
      author: "Bạn (Video cá nhân)",
      filename,
      filePath,
      downloadUrl: `/api/upload/file/${encodeURIComponent(filename)}`,
      streamUrl: `/api/upload/file/${encodeURIComponent(filename)}?inline=true`,
      fileSizeBytes: file.size,
      formattedSize: formatBytes(file.size),
      createdAt: Date.now()
    };

    VideoStore.upsertVideo(storedVideo);
    console.log(`[UPLOAD] Registered personal video: ${displayName} (${filename})`);
    return storedVideo;
  }
}
