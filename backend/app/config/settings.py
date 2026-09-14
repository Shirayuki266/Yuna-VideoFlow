import os
from pathlib import Path
from dotenv import load_dotenv

# Ép đường dẫn tuyệt đối tới file backend/.env
BASE_DIR = Path(__file__).resolve().parent.parent.parent
env_path = BASE_DIR / ".env"
load_dotenv(dotenv_path=env_path)

class Config:
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")