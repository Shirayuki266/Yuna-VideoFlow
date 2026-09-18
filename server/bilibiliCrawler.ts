export interface VideoItem {
  bvid: string;
  title: string;
  title_vi?: string;
  cover: string;
  duration: string;
  play: number;
  like: number;
  author: string;
  pubdate: number;
  platform: string;
}

export class BilibiliCrawler {
  private static readonly BASE_SEARCH_URL = "https://api.bilibili.com/x/web-interface/wbi/search/type";
  private static readonly BASE_HOME_URL = "https://api.bilibili.com/x/web-interface/popular";

  private static readonly HEADERS: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.bilibili.com/"
  };

  private static readonly DYNAMIC_TOPICS = ["搞笑", "游戏", "美食", "科技", "动漫", "日常", "数码", "手工", "汽车", "运动"];

  public static fixCoverUrl(coverUrl?: string): string {
    if (!coverUrl) return "";
    if (coverUrl.startsWith("//")) return "https:" + coverUrl;
    if (!coverUrl.startsWith("http")) return "https://" + coverUrl;
    return coverUrl;
  }

  public static formatDuration(durationInput: any): string {
    if (!durationInput) return "0:00";
    if (typeof durationInput === "string" && durationInput.includes(":")) {
      return durationInput;
    }
    try {
      const totalSec = parseInt(String(durationInput), 10);
      if (isNaN(totalSec)) return String(durationInput);
      const hrs = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      const pad = (n: number) => n.toString().padStart(2, "0");
      return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`;
    } catch {
      return String(durationInput);
    }
  }

  public static async fetchHomeRecommendations(
    page: number = 1,
    count: number = 16,
    order: string = "totalrank",
    timeRange: string = "all"
  ): Promise<VideoItem[]> {
    // If user requested custom sorting (pubdate / click) or time filter, use topic search with parameters
    if (order !== "totalrank" || (timeRange && timeRange !== "all")) {
      const topicIdx = Math.abs(page - 1 + Math.floor(Math.random() * 4)) % this.DYNAMIC_TOPICS.length;
      const currentTopic = this.DYNAMIC_TOPICS[topicIdx];
      return await this.searchVideos(currentTopic, page, count, order, timeRange);
    }

    const topicIdx = Math.abs(page - 1 + Math.floor(Math.random() * 4)) % this.DYNAMIC_TOPICS.length;
    const currentTopic = this.DYNAMIC_TOPICS[topicIdx];

    const results = await this.searchVideos(currentTopic, page, count, order, timeRange);
    if (results.length >= count) {
      return results.slice(0, count);
    }

    const fetchLimit = count + 8;
    const url = `${this.BASE_HOME_URL}?pn=${page}&ps=${fetchLimit}`;
    try {
      const response = await fetch(url, {
        headers: this.HEADERS,
        signal: AbortSignal.timeout(8000)
      });

      if (response.ok) {
        const data = await response.json();
        const rawList = data?.data?.list || [];

        const parsedResults: VideoItem[] = [];
        for (const item of rawList) {
          const bvid = (item.bvid || "").trim();
          const durationStr = this.formatDuration(item.duration);

          if (!bvid || durationStr === "0:00") {
            continue;
          }

          parsedResults.push({
            bvid,
            title: item.title || "",
            cover: this.fixCoverUrl(item.pic || ""),
            duration: durationStr,
            play: item.stat?.view ?? 0,
            like: item.stat?.like ?? 0,
            author: item.owner?.name || "N/A",
            pubdate: item.pubdate ?? 0,
            platform: "bilibili"
          });

          if (parsedResults.length === count) {
            break;
          }
        }

        return parsedResults;
      }
    } catch (e) {
      console.error("[BILIBILI HOME CRAWL ERROR]:", e);
    }

    return results;
  }

  public static async searchVideos(
    keyword: string,
    page: number = 1,
    count: number = 16,
    order: string = "totalrank",
    timeRange: string = "all"
  ): Promise<VideoItem[]> {
    const isTimeFiltered = timeRange && timeRange !== "all";
    // When time filtering is requested, request a larger page size so we still have plenty of results
    const fetchLimit = isTimeFiltered ? 45 : Math.min(50, count + 8);

    // Normalize order parameter for Bilibili
    let bilibiliOrder = "totalrank";
    if (order === "pubdate") bilibiliOrder = "pubdate";
    else if (order === "click") bilibiliOrder = "click";
    else if (order === "stow") bilibiliOrder = "stow";

    // If timeRange is set (e.g. today/week) but order is default totalrank,
    // sorting by pubdate gives more recent videos within that range
    if (isTimeFiltered && order === "totalrank") {
      bilibiliOrder = "pubdate";
    }

    const url = `${this.BASE_SEARCH_URL}?search_type=video&keyword=${encodeURIComponent(keyword)}&page=${page}&page_size=${fetchLimit}&order=${bilibiliOrder}`;

    try {
      const response = await fetch(url, {
        headers: this.HEADERS,
        signal: AbortSignal.timeout(8000)
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json();
      const rawList = data?.data?.result || [];

      // Calculate min timestamp for timeRange in seconds
      const nowSec = Math.floor(Date.now() / 1000);
      let minPubdateSec = 0;
      if (timeRange === "today") {
        minPubdateSec = nowSec - 24 * 60 * 60; // past 24 hours
      } else if (timeRange === "week") {
        minPubdateSec = nowSec - 7 * 24 * 60 * 60; // past 7 days
      } else if (timeRange === "month") {
        minPubdateSec = nowSec - 30 * 24 * 60 * 60; // past 30 days
      } else if (timeRange === "year") {
        minPubdateSec = nowSec - 365 * 24 * 60 * 60; // past 365 days
      }

      const results: VideoItem[] = [];
      for (const item of rawList) {
        const bvid = (item.bvid || "").trim();
        const durationStr = this.formatDuration(item.duration);

        if (!bvid || durationStr === "0:00") {
          continue;
        }

        const pubdate = item.pubdate || item.senddate || 0;

        // Apply time range filter if specified
        if (minPubdateSec > 0 && pubdate > 0 && pubdate < minPubdateSec) {
          continue;
        }

        const cleanTitle = (item.title || "")
          .replace(/<em class="keyword">/g, "")
          .replace(/<\/em>/g, "");

        results.push({
          bvid,
          title: cleanTitle,
          cover: this.fixCoverUrl(item.pic || ""),
          duration: durationStr,
          play: item.play ?? 0,
          like: item.favorites ?? 0,
          author: item.author || "N/A",
          pubdate,
          platform: "bilibili"
        });

        if (results.length === count) {
          break;
        }
      }

      // If we filtered by time, sort results according to requested order
      if (order === "click") {
        results.sort((a, b) => (b.play || 0) - (a.play || 0));
      } else if (order === "pubdate") {
        results.sort((a, b) => (b.pubdate || 0) - (a.pubdate || 0));
      }

      return results;
    } catch (e) {
      console.error("[BILIBILI SEARCH ERROR]:", e);
      return [];
    }
  }
}
