from typing import Any


def success_response(data: Any | None = None, message: str = "ok") -> dict[str, Any]:
    payload: dict[str, Any] = {"success": True, "message": message}
    if data is not None:
        payload["data"] = data
    return payload


def error_response(message: str) -> dict[str, Any]:
    return {"success": False, "message": message}