from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"
DATA_FILE = DATA_DIR / "tools.json"
SEARCH_LOG_FILE = DATA_DIR / "search_logs.jsonl"
FRONTEND_DIR = PROJECT_DIR / "frontend"


class Settings:
    app_name = "Meter Selector MVP"
    api_prefix = "/api"
    data_file = DATA_FILE
    search_log_file = SEARCH_LOG_FILE
    frontend_dir = FRONTEND_DIR
    cors_origins = ["*"]


settings = Settings()