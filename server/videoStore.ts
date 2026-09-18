import fs from "fs";
import path from "path";

export interface TelegramBackupInfo {
  fileId: string;
  fileUniqueId?: string;
  messageId?: number;
  chatId?: string | number;
  backedUpAt: number;
  fileSize?: number;
  fileName?: string;
  mimeType?: string;
}

export interface StoredVideo {
  id: string; // BVID (e.g. BV1xx411c7mD) or UP_... for personal uploads
  type: "bilibili" | "personal";
  title: string;
  title_vi?: string;
  cover: string;
  duration?: string;
  author?: string;
  filename: string;
  filePath: string;
  downloadUrl: string;
  streamUrl: string;
  fileSizeBytes: number;
  formattedSize: string;
  createdAt: number;
  expiresAt?: number; // 5 hours for bilibili temp videos
  hasLocalFile?: boolean;
  telegram?: TelegramBackupInfo;
}

export class VideoStore {
  private static readonly PRIMARY_STORE_PATH = path.join(process.cwd(), "data", "video_metadata_store.json");
  private static readonly LEGACY_STORE_PATH = path.join(process.cwd(), "temp_downloads", "video_metadata_store.json");

  private static readStore(): Record<string, StoredVideo> {
    try {
      // Check primary path first
      if (fs.existsSync(this.PRIMARY_STORE_PATH)) {
        const raw = fs.readFileSync(this.PRIMARY_STORE_PATH, "utf-8");
        return JSON.parse(raw);
      }
      // Migrate from legacy path if exists
      if (fs.existsSync(this.LEGACY_STORE_PATH)) {
        const raw = fs.readFileSync(this.LEGACY_STORE_PATH, "utf-8");
        const data = JSON.parse(raw);
        this.writeStore(data);
        return data;
      }
    } catch (err) {
      console.error("[VIDEO STORE] Error reading store:", err);
    }
    return {};
  }

  private static writeStore(data: Record<string, StoredVideo>): void {
    try {
      const dir = path.dirname(this.PRIMARY_STORE_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.PRIMARY_STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("[VIDEO STORE] Error writing store:", err);
    }
  }

  public static upsertVideo(video: StoredVideo): void {
    const store = this.readStore();
    video.hasLocalFile = fs.existsSync(video.filePath);
    store[video.id] = video;
    this.writeStore(store);
  }

  public static getVideo(id: string): StoredVideo | null {
    const store = this.readStore();
    const vid = store[id];
    if (!vid) return null;

    const fileExists = fs.existsSync(vid.filePath);
    vid.hasLocalFile = fileExists;

    // If local file is missing but has Telegram backup, KEEP IT!
    if (!fileExists && !vid.telegram) {
      delete store[id];
      this.writeStore(store);
      return null;
    }
    return vid;
  }

  public static getVideoByFilename(filename: string): StoredVideo | null {
    const store = this.readStore();
    for (const id in store) {
      if (store[id].filename === filename) {
        const vid = store[id];
        const fileExists = fs.existsSync(vid.filePath);
        vid.hasLocalFile = fileExists;
        if (!fileExists && !vid.telegram) {
          delete store[id];
          this.writeStore(store);
          return null;
        }
        return vid;
      }
    }
    return null;
  }

  public static getAllVideos(): StoredVideo[] {
    const store = this.readStore();
    const result: StoredVideo[] = [];
    let updated = false;

    for (const id of Object.keys(store)) {
      const vid = store[id];
      const fileExists = fs.existsSync(vid.filePath);
      vid.hasLocalFile = fileExists;

      // Keep videos that have local files OR have Telegram cloud backup
      if (fileExists || vid.telegram) {
        result.push(vid);
      } else {
        delete store[id];
        updated = true;
      }
    }

    if (updated) {
      this.writeStore(store);
    }

    // Sort by createdAt descending (newest first)
    return result.sort((a, b) => b.createdAt - a.createdAt);
  }

  public static deleteLocalFileOnly(id: string): boolean {
    const store = this.readStore();
    const vid = store[id];
    if (!vid) return false;

    let deleted = false;
    try {
      if (fs.existsSync(vid.filePath)) {
        fs.unlinkSync(vid.filePath);
        deleted = true;
      }
    } catch (err) {
      console.error(`[VIDEO STORE] Error deleting physical file ${vid.filePath}:`, err);
    }

    vid.hasLocalFile = false;
    // If it has Telegram backup, retain the record!
    if (vid.telegram) {
      store[id] = vid;
      this.writeStore(store);
    } else {
      delete store[id];
      this.writeStore(store);
    }
    return deleted;
  }

  public static removeVideo(id: string): boolean {
    const store = this.readStore();
    if (store[id]) {
      const vid = store[id];
      try {
        if (fs.existsSync(vid.filePath)) {
          fs.unlinkSync(vid.filePath);
        }
      } catch (err) {
        console.error(`[VIDEO STORE] Error deleting file ${vid.filePath}:`, err);
      }
      delete store[id];
      this.writeStore(store);
      return true;
    }
    return false;
  }

  public static removeByFilename(filename: string): boolean {
    const store = this.readStore();
    for (const id of Object.keys(store)) {
      if (store[id].filename === filename) {
        const vid = store[id];
        try {
          if (fs.existsSync(vid.filePath)) {
            fs.unlinkSync(vid.filePath);
          }
        } catch (err) {
          console.error(`[VIDEO STORE] Error deleting file ${vid.filePath}:`, err);
        }

        // If backed up on Telegram, preserve the video metadata!
        if (vid.telegram) {
          vid.hasLocalFile = false;
          store[id] = vid;
          this.writeStore(store);
        } else {
          delete store[id];
          this.writeStore(store);
        }
        return true;
      }
    }
    return false;
  }

  public static removeAll(forcePurgeEverything: boolean = false): number {
    const store = this.readStore();
    let count = 0;
    const remainingStore: Record<string, StoredVideo> = {};

    for (const id of Object.keys(store)) {
      const vid = store[id];
      try {
        if (fs.existsSync(vid.filePath)) {
          fs.unlinkSync(vid.filePath);
          count++;
        }
      } catch (err) {
        console.error(`[VIDEO STORE] Error deleting file ${vid.filePath}:`, err);
      }

      // If video has Telegram cloud backup and not force purging everything, keep metadata!
      if (!forcePurgeEverything && vid.telegram) {
        vid.hasLocalFile = false;
        remainingStore[id] = vid;
      }
    }

    this.writeStore(remainingStore);
    return count;
  }
}
