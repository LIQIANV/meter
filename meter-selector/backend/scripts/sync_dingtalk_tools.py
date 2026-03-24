import json
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from tempfile import NamedTemporaryFile
from typing import Any

import requests


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "data" / "tools.json"
CONFIG_FILE = BASE_DIR / "scripts" / "sync_config.json"

FIELD_ALIASES = {
    "record_id": "record_id",
    "一级分类": "一级分类",
    "二级分类": "二级分类",
    "名称": "名称",
    "型号": "型号",
    "生产厂家": "生产厂家",
    "测量下限": "测量下限",
    "测量上限": "测量上限",
    "准确度": "准确度",
    "最大允许误差": "最大允许误差",
    "分度值": "分度值",
    "应用场景": "应用场景",
    "图片": "图片",
}


def configure_logging() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


def load_local_config() -> dict[str, Any]:
    if not CONFIG_FILE.exists():
        return {}

    with CONFIG_FILE.open("r", encoding="utf-8") as file:
        payload = json.load(file)

    if not isinstance(payload, dict):
        raise RuntimeError("sync_config.json 格式错误，根节点必须是对象。")

    return payload


def get_required_setting(config: dict[str, Any], key: str, env_name: str) -> str:
    value = config.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()

    env_value = os.getenv(env_name, "").strip()
    if env_value:
        return env_value

    raise RuntimeError(f"缺少配置: {key}，也未设置环境变量 {env_name}")


def get_optional_setting(config: dict[str, Any], key: str, env_name: str, default: str = "") -> str:
    value = config.get(key)
    if isinstance(value, str) and value.strip():
        return value.strip()

    env_value = os.getenv(env_name, "").strip()
    if env_value:
        return env_value

    return default


def fetch_access_token(app_key: str, app_secret: str, cookie: str = "") -> str:
    headers = {"Content-Type": "application/json"}
    if cookie:
        headers["Cookie"] = cookie

    response = requests.post(
        "https://api.dingtalk.com/v1.0/oauth2/accessToken",
        headers=headers,
        json={"appKey": app_key, "appSecret": app_secret},
        timeout=30,
    )
    response.raise_for_status()
    payload = response.json()
    access_token = payload.get("accessToken")
    if not access_token:
        raise RuntimeError(f"获取 access_token 失败: {payload}")
    return access_token


def list_records_paged(
    access_token: str,
    app_token: str,
    table_id: str,
    operator_id: str | None,
    cookie: str = "",
) -> list[dict[str, Any]]:
    url = f"https://api.dingtalk.com/v1.0/notable/bases/{app_token}/sheets/{table_id}/records/list"
    headers = {
        "x-acs-dingtalk-access-token": access_token,
        "Content-Type": "application/json",
    }
    if cookie:
        headers["Cookie"] = cookie

    all_records: list[dict[str, Any]] = []
    next_token: str | None = None
    retried_without_next_token = False

    while True:
        body: dict[str, Any] = {"maxResults": 100}
        if next_token:
            body["nextToken"] = next_token

        params = {"operatorId": operator_id} if operator_id else None
        response = requests.post(url, headers=headers, params=params, json=body, timeout=30)
        if response.status_code == 400 and next_token:
            try:
                error_payload = response.json()
            except ValueError:
                error_payload = {}

            message = str(error_payload.get("message", ""))
            if "Expired nextToken" in message and not retried_without_next_token:
                logging.warning("nextToken 已过期，自动回退到第一页重新拉取。")
                next_token = None
                retried_without_next_token = True
                continue

        response.raise_for_status()
        payload = response.json()

        records = payload.get("records", [])
        all_records.extend(records)
        logging.info("已拉取记录数: %s", len(all_records))

        if not payload.get("hasMore"):
            break

        next_token = payload.get("nextToken")
        if not next_token:
            break

    return all_records


def stringify_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (int, float, bool)):
        return str(value)
    if isinstance(value, dict):
        for key in ("name", "text", "title", "label", "value", "url"):
            if key in value and value[key] not in (None, ""):
                return stringify_value(value[key])
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, list):
        parts = [stringify_value(item) for item in value]
        parts = [part for part in parts if part]
        return "、".join(parts)
    return str(value)


def extract_image_url(value: Any) -> str:
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict) and item.get("url"):
                return str(item["url"])
            text = stringify_value(item)
            if text.startswith("http"):
                return text
        return ""
    text = stringify_value(value)
    return text if text.startswith("http") else ""


def normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    fields = record.get("fields", {}) or {}
    max_error = stringify_value(fields.get("最大允许误差") or fields.get("MPE") or fields.get("准确度"))
    accuracy = stringify_value(fields.get("准确度") or max_error)

    normalized = {
        "record_id": stringify_value(record.get("recordId") or record.get("id") or ""),
        "一级分类": stringify_value(fields.get("一级分类")),
        "二级分类": stringify_value(fields.get("二级分类")),
        "名称": stringify_value(fields.get("名称")),
        "型号": stringify_value(fields.get("型号")),
        "生产厂家": stringify_value(fields.get("生产厂家")),
        "测量下限": stringify_value(fields.get("测量下限")),
        "测量上限": stringify_value(fields.get("测量上限")),
        "准确度": accuracy,
        "最大允许误差": max_error,
        "分度值": stringify_value(fields.get("分度值")),
        "应用场景": stringify_value(fields.get("应用场景")),
        "图片": extract_image_url(fields.get("图片")),
        "原始字段": fields,
    }

    for key in FIELD_ALIASES.values():
        normalized.setdefault(key, "")

    return normalized


def write_json_atomic(payload: dict[str, Any], target_file: Path) -> None:
    target_file.parent.mkdir(parents=True, exist_ok=True)
    with NamedTemporaryFile("w", delete=False, dir=target_file.parent, suffix=".tmp", encoding="utf-8") as temp_file:
        json.dump(payload, temp_file, ensure_ascii=False, indent=2)
        temp_path = Path(temp_file.name)
    temp_path.replace(target_file)


def build_payload(records: list[dict[str, Any]]) -> dict[str, Any]:
    normalized_records = [normalize_record(record) for record in records]
    return {
        "updated_at": datetime.now().isoformat(timespec="seconds"),
        "total": len(normalized_records),
        "records": normalized_records,
    }


def main() -> int:
    configure_logging()
    try:
        config = load_local_config()
        app_key = get_required_setting(config, "app_key", "DINGTALK_APP_KEY")
        app_secret = get_required_setting(config, "app_secret", "DINGTALK_APP_SECRET")
        app_token = get_required_setting(config, "app_token", "DINGTALK_APP_TOKEN")
        table_id = get_required_setting(config, "table_id", "DINGTALK_TABLE_ID")
        operator_id = get_optional_setting(config, "operator_id", "DINGTALK_OPERATOR_ID") or None
        access_token_cookie = get_optional_setting(config, "access_token_cookie", "DINGTALK_ACCESS_TOKEN_COOKIE")
        records_cookie = get_optional_setting(config, "records_cookie", "DINGTALK_RECORDS_COOKIE")

        logging.info("开始获取 access_token")
        access_token = fetch_access_token(app_key, app_secret, access_token_cookie)
        logging.info("开始分页拉取钉钉记录")
        records = list_records_paged(
            access_token,
            app_token,
            table_id,
            operator_id,
            records_cookie,
        )
        payload = build_payload(records)
        write_json_atomic(payload, DATA_FILE)
        logging.info("同步完成，已写入 %s 条记录到 %s", payload["total"], DATA_FILE)
        return 0
    except Exception as exc:
        logging.exception("同步失败: %s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())