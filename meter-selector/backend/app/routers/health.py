from fastapi import APIRouter

from app.utils.response import success_response


router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str | bool]:
    return success_response(message="ok")