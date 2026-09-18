import fs from "fs";
import path from "path";
import { VideoStore, StoredVideo } from "./videoStore";
import { DownloadService } from "./downloadService";

export interface SubtitleItem {
  id: string;
  start: number; // in seconds
  end: number;   // in seconds
  text: string;  // Vietnamese subtitle
  originalText?: string;
}

export interface SubtitleStyle {
  fontSize: number;  // 14 to 36
  color: string;     // hex or color
  bgColor: string;   // hex or rgba
  position: "bottom" | "top" | "middle";
  stroke: boolean;
}

export interface DubbingConfig {
  enabled: boolean;
  voiceName?: string;
  rate: number;                // 0.75 to 1.75
  pitch: number;               // 0.8 to 1.3
  originalAudioVolume: number; // 0.0 to 1.0 (e.g. 0.15 for audio ducking, 0 for mute)
  aiAudioVolume: number;       // 0.0 to 1.0
  autoDuck: boolean;           // Auto lower original video volume when AI speaks
}

export interface VideoEditorProject {
  videoId: string;
  subtitles: SubtitleItem[];
  subtitleStyle: SubtitleStyle;
  dubbing: DubbingConfig;
  updatedAt: number;
}

export interface SelectableVideo {
  id: string;
  title: string;
  title_vi?: string;
  cover?: string;
  duration?: string;
  durationSeconds?: number;
  source: "bilibili" | "personal" | "temp";
  filename: string;
  streamUrl: string;
  downloadUrl: string;
  formattedSize?: string;
  hasLocalFile?: boolean;
}

export class EditorService {
  private static readonly PROJECTS_PATH = path.join(process.cwd(), "data", "video_editor_projects.json");

  private static readProjects(): Record<string, VideoEditorProject> {
    try {
      if (fs.existsSync(this.PROJECTS_PATH)) {
        const raw = fs.readFileSync(this.PROJECTS_PATH, "utf-8");
        return JSON.parse(raw);
      }
    } catch (err) {
      console.error("[EDITOR STORE] Error reading editor projects:", err);
    }
    return {};
  }

  private static writeProjects(data: Record<string, VideoEditorProject>): void {
    try {
      const dir = path.dirname(this.PROJECTS_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.PROJECTS_PATH, JSON.stringify(data, null, 2), "utf-8");
    } catch (err) {
      console.error("[EDITOR STORE] Error saving editor projects:", err);
    }
  }

  public static getProject(videoId: string): VideoEditorProject | null {
    const projects = this.readProjects();
    return projects[videoId] || null;
  }

  public static saveProject(videoId: string, projectData: Partial<VideoEditorProject>): VideoEditorProject {
    const projects = this.readProjects();
    const existing = projects[videoId];

    const defaultStyle: SubtitleStyle = {
      fontSize: 20,
      color: "#ffffff",
      bgColor: "rgba(0, 0, 0, 0.75)",
      position: "bottom",
      stroke: true
    };

    const defaultDubbing: DubbingConfig = {
      enabled: false,
      voiceName: "",
      rate: 1.0,
      pitch: 1.0,
      originalAudioVolume: 0.2, // 20% background ducking
      aiAudioVolume: 1.0,
      autoDuck: true
    };

    const updated: VideoEditorProject = {
      videoId,
      subtitles: projectData.subtitles || existing?.subtitles || [],
      subtitleStyle: { ...defaultStyle, ...(existing?.subtitleStyle || {}), ...(projectData.subtitleStyle || {}) },
      dubbing: { ...defaultDubbing, ...(existing?.dubbing || {}), ...(projectData.dubbing || {}) },
      updatedAt: Date.now()
    };

    projects[videoId] = updated;
    this.writeProjects(projects);
    return updated;
  }

  /**
   * Aggregate all available videos that can be selected for editing:
   * 1. Managed videos (Bilibili downloads & uploaded videos)
   * 2. Active temp files
   */
  public static getSelectableVideos(): SelectableVideo[] {
    const result: SelectableVideo[] = [];
    const seenIds = new Set<string>();

    // 1. From VideoStore
    const managedVideos = VideoStore.getAllVideos();
    for (const v of managedVideos) {
      if (!seenIds.has(v.id)) {
        seenIds.add(v.id);
        result.push({
          id: v.id,
          title: v.title,
          title_vi: v.title_vi,
          cover: v.cover,
          duration: v.duration,
          durationSeconds: this.parseDurationToSeconds(v.duration),
          source: v.type === "personal" ? "personal" : "bilibili",
          filename: v.filename,
          streamUrl: v.hasLocalFile === false && v.telegram?.fileId
            ? `/api/telegram/stream/${v.id}`
            : v.streamUrl,
          downloadUrl: v.downloadUrl,
          formattedSize: v.formattedSize,
          hasLocalFile: v.hasLocalFile
        });
      }
    }

    // 2. From Temp Downloads
    const tempFiles = DownloadService.listTemporaryFiles();
    for (const tf of tempFiles) {
      if (!tf) continue;
      const tempId = `temp_${tf.filename}`;
      if (!seenIds.has(tempId)) {
        seenIds.add(tempId);
        result.push({
          id: tempId,
          title: tf.title_vi || tf.title || tf.filename.replace(/\.mp4$/i, ""),
          source: "temp",
          filename: tf.filename,
          streamUrl: tf.streamUrl,
          downloadUrl: tf.downloadUrl,
          formattedSize: tf.formattedSize,
          hasLocalFile: true
        });
      }
    }

    return result;
  }

  private static parseDurationToSeconds(durationStr?: string): number {
    if (!durationStr) return 60;
    const parts = durationStr.split(":").map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return parts[0] * 60 + parts[1];
    }
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    }
    return 60;
  }
}
