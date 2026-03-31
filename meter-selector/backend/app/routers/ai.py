"""AI 参数抽取路由。"""

from fastapi import APIRouter

from app.models import AIExtractRequest
from app.services.ai_service import extract_query_with_dify
from app.utils.response import error_response, success_response


router = APIRouter(prefix="/api", tags=["ai"])


@router.post("/ai/extract")
def extract_query(payload: AIExtractRequest) -> dict[str, object]:
    """调用 Dify Chatflow 把自然语言需求抽取成结构化查询参数。"""
    try:
        result = extract_query_with_dify(payload.message, payload.current_query)
    except RuntimeError as exc:
        return error_response(str(exc))

    return success_response(data=result)