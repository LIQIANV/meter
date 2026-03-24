"""查询日志服务。

项目把用户查询记录写入 JSON Lines 文件，既便于追加，也便于按行读取。
这个模块负责写日志和读取最近日志。
"""

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
    """把一次查询请求追加写入日志文件。

    每次搜索都会记录查询时间、来源信息、原始查询参数和结果数量。采用
    JSON Lines 形式可以避免整文件反复读写，适合这种只追加的小型日志场景。
    """
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
    """读取最近 N 条查询日志。

    读取时会先按行载入，再截取最后 limit 条，并反转顺序让最新记录排在前面，
    这样前端历史弹窗可以直接按“最近搜索优先”展示。
    """
    log_file: Path = settings.search_log_file
    if not log_file.exists():
        return []

    with log_file.open("r", encoding="utf-8") as file:
        lines = [line.strip() for line in file if line.strip()]

    recent_lines = lines[-limit:]
    recent_logs = [json.loads(line) for line in recent_lines]
    recent_logs.reverse()
    return recent_logs