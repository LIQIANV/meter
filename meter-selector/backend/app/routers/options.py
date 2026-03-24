"""筛选项路由。

这个路由暴露给前端初始化页面时使用，用来生成各个下拉框的候选值。
"""

from fastapi import APIRouter

from app.services.options_service import get_options
from app.utils.response import success_response


router = APIRouter(prefix="/api", tags=["options"])


@router.get("/options")
def options() -> dict[str, object]:
    """返回前端筛选表单所需的全量下拉选项。

    路由层本身不做计算，只调用 options_service 汇总数据并统一包装响应。
    这样路由职责保持单一，便于你把 FastAPI 看成“HTTP 入口层”。
    """
    return success_response(data=get_options())