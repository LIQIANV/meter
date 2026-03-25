"""手动触发数据同步的接口。"""

from fastapi import APIRouter

from app.services.sync_service import SyncInProgressError, trigger_sync
from app.utils.response import error_response, success_response


router = APIRouter(prefix="/api", tags=["sync"])


@router.post("/sync")
def sync_data() -> dict[str, object]:
    try:
        result = trigger_sync()
    except SyncInProgressError as exc:
        return error_response(str(exc))

    return success_response(data=result, message="同步成功")