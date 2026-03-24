from fastapi import APIRouter

from app.services.options_service import get_options
from app.utils.response import success_response


router = APIRouter(prefix="/api", tags=["options"])


@router.get("/options")
def options() -> dict[str, object]:
    return success_response(data=get_options())