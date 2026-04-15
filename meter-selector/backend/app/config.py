"""项目配置集中定义。

这个文件把后端会用到的重要路径与应用级配置统一收口，避免在各个
模块里重复拼接路径。当前项目没有引入复杂的环境配置体系，因此用
一个简单的 Settings 类承载静态配置即可。
"""

import os
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent.parent
PROJECT_DIR = BASE_DIR.parent
DATA_DIR = BASE_DIR / "data"
DATA_FILE = DATA_DIR / "tools.json"
SEARCH_LOG_FILE = DATA_DIR / "search_logs.jsonl"
FRONTEND_DIR = PROJECT_DIR / "frontend"


class Settings:
    """应用运行时配置对象。

    这里没有使用 pydantic-settings，而是用最小实现保存当前 MVP 所需的
    常量配置，例如 API 前缀、数据文件位置、查询日志文件位置以及前端
    静态资源目录。
    """

    app_name = "Meter Selector MVP"
    api_prefix = "/api"
    base_dir = BASE_DIR
    data_file = DATA_FILE
    search_log_file = SEARCH_LOG_FILE
    frontend_dir = FRONTEND_DIR
    cors_origins = ["*"]
    dify_base_url = os.getenv("DIFY_BASE_URL", "http://aiportal.sanhuagroup.com/v1").rstrip("/")
    dify_api_key = os.getenv("DIFY_API_KEY", "app-lADIp6HQyZtJhfq6hN6tq6uJ").strip()
    dify_timeout = int(os.getenv("DIFY_TIMEOUT", "45"))
    dify_user = os.getenv("DIFY_USER", "meter-selector-backend").strip()


settings = Settings()