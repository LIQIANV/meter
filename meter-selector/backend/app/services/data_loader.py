"""本地数据文件加载服务。

本项目的后端没有数据库，所有设备数据都来自 tools.json。本模块负责：
1. 读取本地 JSON 文件。
2. 用 Pydantic 校验文件结构。
3. 基于文件修改时间做简单缓存，避免每次请求都反复反序列化。
"""

import json
from functools import lru_cache
from pathlib import Path

from app.config import settings
from app.models import ToolsDataFile


class DataLoadError(Exception):
    """表示本地数据文件不可用的业务异常。"""

    pass


@lru_cache(maxsize=1)
def _load_tools_data_cached(file_path: str, modified_time: float) -> ToolsDataFile:
    """按“文件路径 + 修改时间”缓存已解析的数据文件。

    由于 lru_cache 只能按函数参数做缓存，所以这里显式传入 modified_time。
    只要 tools.json 被覆盖写入，修改时间就会变化，从而触发重新加载。
    """
    with Path(file_path).open("r", encoding="utf-8") as file:
        payload = json.load(file)
    return ToolsDataFile.model_validate(payload)


def load_tools_data() -> ToolsDataFile:
    """加载并返回当前有效的 tools.json 数据。

    这是 service 层对外暴露的统一入口。其他模块不需要关心缓存、文件路径
    或异常转换，只要调用这个函数即可得到经过 Pydantic 校验的数据对象。
    """
    data_file = settings.data_file
    if not data_file.exists():
        raise DataLoadError("数据文件不存在，请先执行同步脚本生成 tools.json。")

    modified_time = data_file.stat().st_mtime
    try:
        return _load_tools_data_cached(str(data_file), modified_time)
    except json.JSONDecodeError as exc:
        raise DataLoadError("数据文件格式错误，无法解析 tools.json。") from exc
    except ValueError as exc:
        raise DataLoadError("数据文件结构不符合预期。") from exc