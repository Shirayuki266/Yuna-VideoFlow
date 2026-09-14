import json
import asyncio
from google import genai
from google.genai import types
from app.config.settings import Config

class GeminiService:
    def __init__(self):
        self.api_key = Config.GEMINI_API_KEY
        if not self.api_key:
            print("\n[GEMINI WARNING]: Chưa tìm thấy GEMINI_API_KEY trong file .env!\n")
        
        self.client = genai.Client(api_key=self.api_key)
        self.model_name = "models/gemini-3.1-flash-lite"

    async def translate_titles_batch(self, titles: list[str]) -> list[str]:
        """Dịch hàng loạt 16 tiêu đề cùng lúc qua Gemini API"""
        if not titles or not self.api_key:
            return titles

        prompt = (
            "Bạn là chuyên gia dịch thuật tiêu đề video ngắn.\n"
            "Hãy dịch toàn bộ danh sách tiêu đề tiếng Trung/Anh sau sang tiếng Việt tự nhiên, hấp dẫn phong cách YouTube Shorts/Reels:\n"
            f"{json.dumps(titles, ensure_ascii=False)}\n\n"
            "YÊU CẦU ĐẦU RA:\n"
            f"Chỉ trả về ĐÚNG MỘT MẢNG JSON chứa chính xác {len(titles)} chuỗi đã dịch tương ứng. "
            'Không thêm lời dẫn, không dùng codeblock markdown. Ví dụ: ["Tiêu đề 1", "Tiêu đề 2"]'
        )

        try:
            # 🛑 TẮT HOÀN TOÀN TOOLS/AFC VÀ ÉP OUTPUT JSON
            # Giúp bỏ hoàn toàn Warning AFC vô duyên và không bị crash ngầm
            config = types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
                tools=[]  # Ép mảng tools rỗng để tắt Automatic Function Calling
            )

            # Chạy qua thread riêng tránh block luồng Async của FastAPI
            response = await asyncio.to_thread(
                self.client.models.generate_content,
                model=self.model_name,
                contents=prompt,
                config=config
            )

            raw_text = response.text.strip()
            clean_text = raw_text.replace("```json", "").replace("```", "").strip()
            
            translated_list = json.loads(clean_text)

            if isinstance(translated_list, list) and len(translated_list) == len(titles):
                print(f"\n[GEMINI SUCCESS]: Dịch thành công {len(translated_list)} tiêu đề sang Tiếng Việt!\n")
                return translated_list
            else:
                print(f"[GEMINI WARNING]: Số lượng dịch không khớp ({len(translated_list)}/{len(titles)}). Dùng title gốc.")
                return titles

        except Exception as e:
            # In lỗi chi tiết ra console nếu Key hỏng hoặc bị chặn
            print(f"\n[GEMINI ERROR CRITICAL]: {e}\n")
            return titles