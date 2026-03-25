"""FastAPI 应用入口。

这个文件只负责应用装配，不承载具体业务逻辑：
1. 创建 FastAPI 实例。
2. 注册跨域中间件。
3. 注册统一异常处理。
4. 挂载各业务路由。
5. 在根路径托管前端静态资源。
"""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers.health import router as health_router
from app.routers.options import router as options_router
from app.routers.search import router as search_router
from app.routers.sync import router as sync_router
from app.services.data_loader import DataLoadError
from app.utils.response import error_response


app = FastAPI(title=settings.app_name)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(DataLoadError)
async def handle_data_load_error(_: Request, exc: DataLoadError) -> JSONResponse:
    """把数据文件加载失败统一转换成标准 JSON 响应。

    FastAPI 允许为指定异常类型注册全局异常处理器。当前项目中，
    当 tools.json 缺失、损坏或结构不符预期时，service 层会抛出
    DataLoadError，这里负责把异常拦截下来并返回给前端统一格式。
    """
    return JSONResponse(status_code=500, content=error_response(str(exc)))


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    """处理请求体验证失败的情况。

    当前端传入的 JSON 结构与 Pydantic 模型不匹配时，FastAPI 会在进入
    路由函数之前抛出 RequestValidationError。这里将原始错误详情拼接成
    更容易观察的提示文本，便于前端直接展示。
    """
    return JSONResponse(status_code=422, content=error_response(f"请求参数不合法: {exc.errors()}"))


app.include_router(health_router)
app.include_router(options_router)
app.include_router(search_router)
app.include_router(sync_router)

frontend_dir = settings.frontend_dir
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")