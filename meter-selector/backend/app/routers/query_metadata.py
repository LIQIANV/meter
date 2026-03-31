"""查询业务元信息路由。"""

from fastapi import APIRouter

from app.services.query_metadata_service import get_query_metadata
from app.utils.response import success_response


router = APIRouter(prefix="/api", tags=["query-metadata"])


@router.get("/query-metadata")
def query_metadata() -> dict[str, object]:
    """返回左侧表单和右侧 AI 共用的查询业务元信息。"""
    return success_response(data=get_query_metadata())