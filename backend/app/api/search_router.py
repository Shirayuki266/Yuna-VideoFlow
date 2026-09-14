from fastapi import APIRouter, Query
from app.crawlers.bilibili_crawler import BilibiliCrawler
from app.services.gemini_service import GeminiService

router = APIRouter()
gemini_service = GeminiService()

@router.get("/api/videos")
async def get_videos(
    platform: str = Query("bilibili"),
    keyword: str = Query(""),
    page: int = Query(1, ge=1), # Ghìm điều kiện page >= 1
    count: int = Query(16, ge=1, le=50) # Giới hạn count từ 1 đến 50
):
    clean_keyword = keyword.strip()

    # 1. Cào dữ liệu từ Bilibili (Search hoặc Gợi ý trang chủ)
    if clean_keyword:
        raw_videos = await BilibiliCrawler.search_videos(keyword=clean_keyword, page=page, count=count)
    else:
        raw_videos = await BilibiliCrawler.fetch_home_recommendations(page=page, count=count)

    if not raw_videos:
        return {"platform": platform, "page": page, "count": 0, "data": []}

    # 2. Gom danh sách tiêu đề gốc an toàn (tránh KeyError)
    original_titles = [v.get("title", "") for v in raw_videos]
    
    # 3. Dịch Batching qua Gemini
    translated_titles = await gemini_service.translate_titles_batch(original_titles)

    # 4. Gắn tiêu đề tiếng Việt vào kết quả
    for idx, video in enumerate(raw_videos):
        if idx < len(translated_titles) and translated_titles[idx]:
            video["title_vi"] = translated_titles[idx]
        else:
            video["title_vi"] = video.get("title", "")

    return {
        "platform": platform,
        "page": page,
        "count": len(raw_videos),
        "data": raw_videos
    }