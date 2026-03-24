from fastapi import APIRouter, Request

from app.models import SearchRequest
from app.services.search_log_service import log_search_query, read_recent_search_logs
from app.services.search_service import search_records
from app.utils.response import success_response


router = APIRouter(prefix="/api", tags=["search"])


@router.post("/search")
def search(request: Request, payload: SearchRequest) -> dict[str, object]:
    result = search_records(payload)
    client_ip = request.client.host if request.client else ""
    user_agent = request.headers.get("user-agent", "")
    log_search_query(payload, int(result.get("total", 0)), client_ip, user_agent)
    return success_response(data=result)


@router.get("/search-logs")
def search_logs(limit: int = 20) -> dict[str, object]:
    normalized_limit = max(1, min(limit, 100))
    return success_response(data={"records": read_recent_search_logs(normalized_limit)})