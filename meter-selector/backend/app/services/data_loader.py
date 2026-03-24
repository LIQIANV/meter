import json
from functools import lru_cache
from pathlib import Path

from app.config import settings
from app.models import ToolsDataFile


class DataLoadError(Exception):
    pass


@lru_cache(maxsize=1)
def _load_tools_data_cached(file_path: str, modified_time: float) -> ToolsDataFile:
    with Path(file_path).open("r", encoding="utf-8") as file:
        payload = json.load(file)
    return ToolsDataFile.model_validate(payload)


def load_tools_data() -> ToolsDataFile:
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