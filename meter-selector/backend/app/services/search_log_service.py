import json
from datetime import datetime
from pathlib import Path
from typing import Any

from app.config import settings
from app.models import SearchRequest


def log_search_query(
    query: SearchRequest,
    result_total: int,
    client_ip: str = "",
    user_agent: str = "",
) -> None:
    log_file: Path = settings.search_log_file
    log_file.parent.mkdir(parents=True, exist_ok=True)

    payload: dict[str, Any] = {
        "searched_at": datetime.now().isoformat(timespec="seconds"),
        "client_ip": client_ip,
        "user_agent": user_agent,
        "query": query.model_dump(),
        "result_total": result_total,
    }

    with log_file.open("a", encoding="utf-8") as file:
        file.write(json.dumps(payload, ensure_ascii=False) + "\n")


def read_recent_search_logs(limit: int = 20) -> list[dict[str, Any]]:
    log_file: Path = settings.search_log_file
    if not log_file.exists():
        return []

    with log_file.open("r", encoding="utf-8") as file:
        lines = [line.strip() for line in file if line.strip()]

    recent_lines = lines[-limit:]
    recent_logs = [json.loads(line) for line in recent_lines]
    recent_logs.reverse()
    return recent_logs