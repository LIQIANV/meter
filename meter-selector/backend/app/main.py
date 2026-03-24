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
    return JSONResponse(status_code=500, content=error_response(str(exc)))


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(status_code=422, content=error_response(f"请求参数不合法: {exc.errors()}"))


app.include_router(health_router)
app.include_router(options_router)
app.include_router(search_router)

frontend_dir = settings.frontend_dir
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")