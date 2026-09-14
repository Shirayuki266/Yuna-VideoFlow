import sys
import os
import webbrowser
import threading
import io

# 🚨 ÉP HỆ THỐNG PYTHON VÀ TERMINAL WINDOWS DÙNG CHUẨN UTF-8
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

# Tắt hoàn toàn việc sinh file __pycache__ rác ở mọi tiến trình
sys.dont_write_bytecode = True

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.append(BASE_DIR)

import uvicorn
from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
from app.api.search_router import router as search_router

app = FastAPI(title="Yuna-VideoFlow Web Engine", version="2.0")

# Cấu hình CORS cho phép React Frontend gọi API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Gắn Router Cào & Dịch vào ứng dụng
app.include_router(search_router)

# Trang chủ mặc định hiển thị giao diện chào mừng thay vì lỗi 404
@app.get("/", response_class=HTMLResponse)
async def root_welcome():
    return """
    <html>
        <head>
            <title>Yuna-VideoFlow Engine</title>
            <style>
                body { font-family: Arial, sans-serif; text-align: center; padding-top: 50px; background-color: #0f172a; color: white; }
                a { color: #38bdf8; font-size: 20px; text-decoration: none; font-weight: bold; }
                a:hover { text-decoration: underline; }
                .card { background: #1e293b; display: inline-block; padding: 30px 50px; border-radius: 12px; border: 1px solid #334155; }
            </style>
        </head>
        <body>
            <div class="card">
                <h1>🚀 Yuna-VideoFlow Web Engine Server</h1>
                <p>Backend Cào & Dịch Video đang chạy tại cổng <b>8000</b></p>
                <p>👉 <a href="/docs" target="_blank">Mở Giao Diện Test Swagger UI (/docs)</a></p>
            </div>
        </body>
    </html>
    """

def open_browser():
    """Tự động mở trình duyệt nhảy tới Swagger UI"""
    webbrowser.open("http://127.0.0.1:8000/docs")

if __name__ == "__main__":
    # Dùng threading.Timer để mở browser sau 1.5s, không bị lỗi DeprecationWarning của asyncio
    threading.Timer(1.5, open_browser).start()

    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)