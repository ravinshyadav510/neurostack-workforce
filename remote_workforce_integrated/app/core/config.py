import os
from pathlib import Path
from dotenv import load_dotenv

env_path = Path(__file__).resolve().parent.parent.parent / ".env"
if env_path.exists():
    load_dotenv(env_path)

SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-secret-key-in-production")
DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./remote_task_system.db")
CORS_ORIGINS: list[str] = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:8000").split(",")
    if origin.strip()
]
SEED_DB: bool = os.getenv("SEED_DB", "true").lower() in ("true", "1", "yes")
PORT: int = int(os.getenv("PORT", "8000"))
