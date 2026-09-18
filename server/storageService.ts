import fs from "fs";
import path from "path";
import { DownloadService } from "./downloadService";
import { UploadService } from "./uploadService";

export interface SystemStorageInfo {
  totalBytes: number;
  freeBytes: number;
  availableBytes: number;
  usedBytes: number;
  usedPercentage: number;
  freePercentage: number;
  formattedTotal: string;
  formattedFree: string;
  formattedUsed: string;
  status: "healthy" | "warning" | "critical";
  statusText: string;
}

export interface FolderStorageInfo {
  name: string;
  path: string;
  totalBytes: number;
  formattedTotal: string;
  percentageOfSystem: number;
  percentageOfUsed: number;
  fileCount: number;
  videoCount: number;
  retentionHours?: number;
}

export interface StorageDashboardData {
  system: SystemStorageInfo;
  tempFolder: FolderStorageInfo;
  uploadsFolder: FolderStorageInfo;
  otherUsed: {
    totalBytes: number;
    formattedTotal: string;
    percentageOfUsed: number;
  };
  retentionPolicy: {
    hours: number;
    autoPurgeIntervalMinutes: number;
    description: string;
  };
  timestamp: number;
}

export class StorageService {
  public static formatBytes(bytes: number): string {
    if (bytes <= 0 || isNaN(bytes)) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    const val = bytes / Math.pow(k, i);
    return `${val < 10 && i > 1 ? val.toFixed(2) : val.toFixed(1)} ${sizes[i]}`;
  }

  public static getDirectoryMetrics(dirPath: string): { totalBytes: number; fileCount: number; videoCount: number } {
    let totalBytes = 0;
    let fileCount = 0;
    let videoCount = 0;

    if (!fs.existsSync(dirPath)) {
      return { totalBytes: 0, fileCount: 0, videoCount: 0 };
    }

    try {
      const items = fs.readdirSync(dirPath);
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        try {
          const stats = fs.statSync(fullPath);
          if (stats.isDirectory()) {
            // Recurse one level down (e.g. thumbs folder)
            const subMetrics = this.getDirectoryMetrics(fullPath);
            totalBytes += subMetrics.totalBytes;
            fileCount += subMetrics.fileCount;
            videoCount += subMetrics.videoCount;
          } else if (stats.isFile()) {
            totalBytes += stats.size;
            fileCount++;
            const ext = path.extname(item).toLowerCase();
            if ([".mp4", ".mkv", ".webm", ".mov", ".flv", ".ts"].includes(ext)) {
              videoCount++;
            }
          }
        } catch {
          // Ignore individual file stat error
        }
      }
    } catch (err) {
      console.error(`[STORAGE SERVICE] Failed reading dir ${dirPath}:`, err);
    }

    return { totalBytes, fileCount, videoCount };
  }

  public static getStorageDashboard(): StorageDashboardData {
    const tempDir = DownloadService.TEMP_DIR;
    const uploadsDir = UploadService.UPLOADS_DIR;

    // Ensure directories exist
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

    // 1. System disk stats via fs.statfsSync
    let totalBytes = 500 * 1024 * 1024 * 1024; // 500GB default fallback
    let freeBytes = 450 * 1024 * 1024 * 1024;
    let availableBytes = 450 * 1024 * 1024 * 1024;

    try {
      if (typeof fs.statfsSync === "function") {
        const fsStats = fs.statfsSync(tempDir);
        const bsize = fsStats.bsize || 4096;
        totalBytes = bsize * fsStats.blocks;
        freeBytes = bsize * fsStats.bfree;
        availableBytes = bsize * fsStats.bavail;
      }
    } catch (err) {
      console.warn("[STORAGE SERVICE] statfsSync error, using fallback:", err);
    }

    const usedBytes = Math.max(0, totalBytes - freeBytes);
    const usedPercentage = totalBytes > 0 ? parseFloat(((usedBytes / totalBytes) * 100).toFixed(1)) : 0;
    const freePercentage = totalBytes > 0 ? parseFloat(((freeBytes / totalBytes) * 100).toFixed(1)) : 100;

    let status: "healthy" | "warning" | "critical" = "healthy";
    let statusText = "Hệ thống hoạt động tối ưu, dung lượng dồi dào";
    if (usedPercentage >= 90) {
      status = "critical";
      statusText = "Dung lượng ổ đĩa sắp hết (trên 90%), cần dọn dẹp ngay!";
    } else if (usedPercentage >= 75) {
      status = "warning";
      statusText = "Dung lượng ổ đĩa sử dụng tương đối cao (trên 75%)";
    }

    const system: SystemStorageInfo = {
      totalBytes,
      freeBytes,
      availableBytes,
      usedBytes,
      usedPercentage,
      freePercentage,
      formattedTotal: this.formatBytes(totalBytes),
      formattedFree: this.formatBytes(freeBytes),
      formattedUsed: this.formatBytes(usedBytes),
      status,
      statusText
    };

    // 2. Temp folder metrics
    const tempMetrics = this.getDirectoryMetrics(tempDir);
    const tempPercentageOfSystem = totalBytes > 0 ? parseFloat(((tempMetrics.totalBytes / totalBytes) * 100).toFixed(2)) : 0;
    const tempPercentageOfUsed = usedBytes > 0 ? parseFloat(((tempMetrics.totalBytes / usedBytes) * 100).toFixed(1)) : 0;

    const tempFolder: FolderStorageInfo = {
      name: "Thư mục video tạm (temp_downloads)",
      path: tempDir,
      totalBytes: tempMetrics.totalBytes,
      formattedTotal: this.formatBytes(tempMetrics.totalBytes),
      percentageOfSystem: tempPercentageOfSystem,
      percentageOfUsed: tempPercentageOfUsed,
      fileCount: tempMetrics.fileCount,
      videoCount: tempMetrics.videoCount,
      retentionHours: 5
    };

    // 3. User uploads metrics
    const uploadMetrics = this.getDirectoryMetrics(uploadsDir);
    const uploadPercentageOfSystem = totalBytes > 0 ? parseFloat(((uploadMetrics.totalBytes / totalBytes) * 100).toFixed(2)) : 0;
    const uploadPercentageOfUsed = usedBytes > 0 ? parseFloat(((uploadMetrics.totalBytes / usedBytes) * 100).toFixed(1)) : 0;

    const uploadsFolder: FolderStorageInfo = {
      name: "Thư mục video tải lên (user_uploads)",
      path: uploadsDir,
      totalBytes: uploadMetrics.totalBytes,
      formattedTotal: this.formatBytes(uploadMetrics.totalBytes),
      percentageOfSystem: uploadPercentageOfSystem,
      percentageOfUsed: uploadPercentageOfUsed,
      fileCount: uploadMetrics.fileCount,
      videoCount: uploadMetrics.videoCount
    };

    // 4. Other system used bytes
    const otherUsedBytes = Math.max(0, usedBytes - tempMetrics.totalBytes - uploadMetrics.totalBytes);
    const otherPercentageOfUsed = usedBytes > 0 ? parseFloat(((otherUsedBytes / usedBytes) * 100).toFixed(1)) : 0;

    return {
      system,
      tempFolder,
      uploadsFolder,
      otherUsed: {
        totalBytes: otherUsedBytes,
        formattedTotal: this.formatBytes(otherUsedBytes),
        percentageOfUsed: otherPercentageOfUsed
      },
      retentionPolicy: {
        hours: 5,
        autoPurgeIntervalMinutes: 15,
        description: "Tự động dọn dẹp và thu hồi dung lượng cho các tệp video tạm quá 5 giờ tuổi."
      },
      timestamp: Date.now()
    };
  }
}
