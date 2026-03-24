"""搜索相关路由。

这里定义两个接口：
1. /search：按表单条件查询设备记录。
2. /search-logs：读取最近的查询历史。
"""

from fastapi import APIRouter, Request

from app.models import SearchRequest
from app.services.search_log_service import log_search_query, read_recent_search_logs
from app.services.search_service import search_records
from app.utils.response import success_response


router = APIRouter(prefix="/api", tags=["search"])


@router.post("/search")
def search(request: Request, payload: SearchRequest) -> dict[str, object]:
    """执行一次结构化搜索并记录查询日志。

    FastAPI 会先把请求体自动解析为 SearchRequest，再把 request 对象注入
    进来。这里先调用 service 层完成筛选，再从 Request 中提取客户端 IP
    和 User-Agent 作为附加审计信息写入日志文件。
    """
    result = search_records(payload)
    client_ip = request.client.host if request.client else ""
    user_agent = request.headers.get("user-agent", "")
    log_search_query(payload, int(result.get("total", 0)), client_ip, user_agent)
    return success_response(data=result)


@router.get("/search-logs")
def search_logs(limit: int = 20) -> dict[str, object]:
    """读取最近的查询历史。

    路由会先把 limit 约束在 1 到 100 之间，避免前端一次性请求过多日志。
    这种轻量参数规整逻辑放在路由层是合理的，因为它属于接口边界控制。
    """
    normalized_limit = max(1, min(limit, 100))
    return success_response(data={"records": read_recent_search_logs(normalized_limit)})