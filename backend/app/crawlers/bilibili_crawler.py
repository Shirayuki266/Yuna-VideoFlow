import httpx
import random
from typing import List, Dict, Any

class BilibiliCrawler:
    """Crawler Bilibili bất đồng bộ - Lọc sạch rác quảng cáo & bvid rỗng, chuẩn 16 video sạch"""
    
    BASE_SEARCH_URL = "https://api.bilibili.com/x/web-interface/wbi/search/type"
    BASE_HOME_URL = "https://api.bilibili.com/x/web-interface/popular"

    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://www.bilibili.com/"
    }

    # Danh sách từ khóa hot xoay vòng để lấy data gợi ý tươi mới liên tục
    DYNAMIC_TOPICS = ["搞笑", "游戏", "美食", "科技", "动漫", "日常", "数码", "手工", "汽车", "运动"]

    @staticmethod
    def _fix_cover_url(cover_url: str) -> str:
        """Sửa lỗi CDN thiếu HTTPS khiến thumbnail không hiện"""
        if not cover_url:
            return ""
        if cover_url.startswith("//"):
            return "https:" + cover_url
        elif not cover_url.startswith("http"):
            return "https://" + cover_url
        return cover_url

    @staticmethod
    def _format_duration(duration_input: Any) -> str:
        """Format số giây thành MM:SS chuẩn YouTube"""
        if not duration_input:
            return "0:00"
        if isinstance(duration_input, str) and ":" in duration_input:
            return duration_input
        try:
            total_sec = int(duration_input)
            hrs = total_sec // 3600
            mins = (total_sec % 3600) // 60
            secs = total_sec % 60
            return f"{hrs}:{mins:02d}:{secs:02d}" if hrs > 0 else f"{mins}:{secs:02d}"
        except (ValueError, TypeError):
            return str(duration_input)

    @classmethod
    async def fetch_home_recommendations(cls, page: int = 1, count: int = 16) -> List[Dict[str, Any]]:
        """Cào video Gợi ý Trang chủ - Đảm bảo lọc sạch bvid rỗng và trả về đủ count video"""
        # Chọn từ khóa xoay vòng dựa trên số trang và random nhẹ
        topic_idx = (page - 1 + random.randint(0, 3)) % len(cls.DYNAMIC_TOPICS)
        current_topic = cls.DYNAMIC_TOPICS[topic_idx]

        # Thử cào qua Search API theo từ khóa hot trước
        results = await cls.search_videos(keyword=current_topic, page=page, count=count)
        if len(results) >= count:
            return results[:count]

        # Dự phòng gọi endpoint popular (Cào dư 24 item để trừ hao rác)
        fetch_limit = count + 8
        params = {"pn": page, "ps": fetch_limit}
        async with httpx.AsyncClient(headers=cls.HEADERS, timeout=8.0) as client:
            try:
                response = await client.get(cls.BASE_HOME_URL, params=params)
                if response.status_code == 200:
                    data = response.json()
                    raw_list = data.get("data", {}).get("list", [])
                    
                    parsed_results = []
                    for item in raw_list:
                        bvid = item.get("bvid", "").strip()
                        duration_str = cls._format_duration(item.get("duration", 0))

                        # 🚨 BỘ LỌC RÁC: Bỏ qua video thiếu BVID hoặc bài quảng cáo (0:00)
                        if not bvid or duration_str == "0:00":
                            continue

                        parsed_results.append({
                            "bvid": bvid,
                            "title": item.get("title", ""),
                            "cover": cls._fix_cover_url(item.get("pic", "")),
                            "duration": duration_str,
                            "play": item.get("stat", {}).get("view", 0),
                            "like": item.get("stat", {}).get("like", 0),
                            "author": item.get("owner", {}).get("name", "N/A"),
                            "pubdate": item.get("pubdate", 0),
                            "platform": "bilibili"
                        })
                        
                        # Đã đủ số lượng yêu cầu thì dừng ngay
                        if len(parsed_results) == count:
                            break

                    return parsed_results
            except Exception as e:
                print(f"[BILIBILI HOME CRAWL ERROR]: {e}")
        
        return []

    @classmethod
    async def search_videos(cls, keyword: str, page: int = 1, count: int = 16) -> List[Dict[str, Any]]:
        """Cào theo từ khóa tìm kiếm - Lọc rác BVID rỗng"""
        fetch_limit = count + 8
        params = {
            "search_type": "video",
            "keyword": keyword,
            "page": page,
            "page_size": fetch_limit
        }
        async with httpx.AsyncClient(headers=cls.HEADERS, timeout=8.0) as client:
            try:
                response = await client.get(cls.BASE_SEARCH_URL, params=params)
                if response.status_code != 200:
                    return []

                data = response.json()
                raw_list = data.get("data", {}).get("result", [])

                results = []
                for item in raw_list:
                    bvid = item.get("bvid", "").strip()
                    duration_str = cls._format_duration(item.get("duration", "0:00"))

                    # 🚨 BỘ LỌC RÁC: Bỏ qua video thiếu BVID hoặc quảng cáo
                    if not bvid or duration_str == "0:00":
                        continue

                    clean_title = item.get("title", "").replace('<em class="keyword">', '').replace('</em>', '')
                    
                    results.append({
                        "bvid": bvid,
                        "title": clean_title,
                        "cover": cls._fix_cover_url(item.get("pic", "")),
                        "duration": duration_str,
                        "play": item.get("play", 0),
                        "like": item.get("favorites", 0),
                        "author": item.get("author", "N/A"),
                        "pubdate": item.get("pubdate", 0),
                        "platform": "bilibili"
                    })

                    if len(results) == count:
                        break

                return results
            except Exception as e:
                print(f"[BILIBILI SEARCH ERROR]: {e}")
                return []