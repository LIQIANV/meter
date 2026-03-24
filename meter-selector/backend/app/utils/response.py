"""统一响应结构工具。

当前项目约定所有接口都返回 success/message/data 三段式结构，方便前端
统一处理成功与失败状态。
"""

from typing import Any


def success_response(data: Any | None = None, message: str = "ok") -> dict[str, Any]:
    """构造成功响应。

    当 data 为空时只返回 success 和 message，避免产生多余的 null 字段。
    """
    payload: dict[str, Any] = {"success": True, "message": message}
    if data is not None:
        payload["data"] = data
    return payload


def error_response(message: str) -> dict[str, Any]:
    """构造失败响应。"""
    return {"success": False, "message": message}