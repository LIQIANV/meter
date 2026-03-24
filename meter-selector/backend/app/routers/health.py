"""健康检查路由。

该模块提供最简单的 FastAPI 路由示例，用于验证服务是否正常启动。
"""

from fastapi import APIRouter

from app.utils.response import success_response


router = APIRouter(prefix="/api", tags=["health"])


@router.get("/health")
def health_check() -> dict[str, str | bool]:
    """返回服务健康状态。

    这个接口没有业务依赖，不读取数据文件，通常用于启动后探活或联调
    时快速判断 FastAPI 进程是否存活。
    """
    return success_response(message="ok")