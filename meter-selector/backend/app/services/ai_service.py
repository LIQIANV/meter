"""Dify Chatflow 参数抽取服务。

该模块负责把工作人员在右侧对话区输入的自然语言需求，转换成左侧结构化
选型表单可直接消费的查询参数。整体流程分为三步：
1. 组装业务元信息、当前表单值和用户话术，调用 Dify Chatflow。
2. 解析模型返回的 JSON，并归一化为 SearchRequest 结构。
3. 尝试把模型输出映射到当前数据集中的真实选项，减少前端回填失败。
"""

from __future__ import annotations

import json
from difflib import get_close_matches
from typing import Any

import requests

from app.config import settings
from app.models import SearchRequest
from app.services.options_service import get_options
from app.services.query_metadata_service import get_query_field_map, get_query_metadata


QUERY_KEYS = [
    "category",
    "sub_category",
    "equipment_name",
    "model",
    "manufacturer",
    "keyword",
    "measurement_requirement",
]


def extract_query_with_dify(message: str, current_query: SearchRequest) -> dict[str, Any]:
    """调用 Dify Chatflow 提取查询参数，并返回适合前端消费的结构。

    如果接口未配置或返回格式异常，会抛出 RuntimeError，由路由层统一返回
    标准错误响应。这样左侧传统搜索仍可独立工作，不受 AI 功能影响。
    """
    if not settings.dify_api_key:
        raise RuntimeError("未配置 DIFY_API_KEY，当前只能使用左侧传统搜索。")

    metadata = get_query_metadata()
    options = get_options()
    raw_result = call_dify_extract_api(message, current_query, metadata)
    query = normalize_query_payload(raw_result.get("query"), current_query)
    resolved_query, unresolved_fields = resolve_query_values(query, options)
    field_map = get_query_field_map()

    filled_fields = []
    missing_fields = []
    for key in QUERY_KEYS:
        field_label = str(field_map.get(key, {}).get("label", key))
        value = resolved_query.get(key, "")
        if value:
            filled_fields.append({"key": key, "label": field_label, "value": value})
        else:
            missing_fields.append({"key": key, "label": field_label})

    assistant_reply = str(raw_result.get("assistant_reply") or "").strip()
    if not assistant_reply:
        assistant_reply = build_default_reply(filled_fields, missing_fields, unresolved_fields)

    follow_up_questions = [
        str(item).strip()
        for item in raw_result.get("follow_up_questions", [])
        if str(item).strip()
    ]
    notes = [str(item).strip() for item in raw_result.get("notes", []) if str(item).strip()]

    for item in unresolved_fields:
        notes.append(f"{item['label']} 暂未能精确映射到现有选项，已保留为原始描述: {item['value']}")

    confidence = str(raw_result.get("confidence") or "medium").strip().lower()
    if confidence not in {"high", "medium", "low"}:
        confidence = "medium"

    return {
        "assistant_reply": assistant_reply,
        "query": resolved_query,
        "filled_fields": filled_fields,
        "missing_fields": missing_fields,
        "follow_up_questions": follow_up_questions,
        "notes": notes,
        "confidence": confidence,
    }


def call_dify_extract_api(
    message: str,
    current_query: SearchRequest,
    metadata: dict[str, Any],
) -> dict[str, Any]:
    """调用 Dify Chatflow 的 chat-messages 接口。

    由于系统提示词已经迁移到 Dify 的 LLM 节点，这里保留“每次动态构造的
    user_prompt”作为 query 发送，避免再依赖 Dify Start 节点额外定义 inputs
    变量，减少迁移成本。
    """
    prompt = build_extraction_prompt(message, current_query, metadata)
    response = requests.post(
        f"{settings.dify_base_url}/chat-messages",
        headers={
            "Authorization": f"Bearer {settings.dify_api_key}",
            "Content-Type": "application/json",
        },
        json={
            "inputs": {},
            "query": prompt,
            "response_mode": "blocking",
            "conversation_id": "",
            "user": settings.dify_user,
        },
        timeout=settings.dify_timeout,
    )

    try:
        response.raise_for_status()
    except requests.RequestException as exc:
        detail = response.text[:500] if response.text else str(exc)
        raise RuntimeError(f"Dify 调用失败: {detail}") from exc

    payload = response.json()
    content = extract_dify_answer(payload)
    if not content:
        raise RuntimeError("Dify 返回内容为空，无法提取查询参数。")

    try:
        return parse_json_content(content)
    except json.JSONDecodeError as exc:
        raise RuntimeError(f"Dify 返回的 JSON 无法解析: {content[:300]}") from exc


def build_extraction_prompt(
    message: str,
    current_query: SearchRequest,
    metadata: dict[str, Any],
) -> str:
    """构造发送给 Dify Chatflow 的动态 user_prompt。

    Dify 侧已经承载 system prompt，这里只传本次需要解析的数据载荷：
    用户原话、当前表单状态以及字段元信息。由于这些内容每次都可能变化，
    仍然需要在每次请求时动态构造，而不适合写成固定字符串。
    """
    user_prompt = {
        "message": message.strip(),
        "current_query": current_query.model_dump(),
        "query_metadata": metadata,
    }

    return json.dumps(user_prompt, ensure_ascii=False)


def extract_dify_answer(payload: dict[str, Any]) -> str:
    """从 Dify Chatflow 的 blocking 响应中提取 answer 文本。"""
    answer = payload.get("answer", "")
    return str(answer).strip() if answer else ""


def parse_json_content(content: str) -> dict[str, Any]:
    """解析模型返回的 JSON 内容。

    有些兼容接口可能仍会返回 ```json 包裹的文本，这里做一次兜底清洗。
    """
    cleaned = content.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        cleaned = cleaned.replace("json", "", 1).strip()

    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        start = cleaned.find("{")
        end = cleaned.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise
        return json.loads(cleaned[start : end + 1])


def normalize_query_payload(payload: Any, current_query: SearchRequest) -> dict[str, str]:
    """把模型返回的 query 归一化为固定字段集合。"""
    raw_payload = payload if isinstance(payload, dict) else {}
    current_payload = current_query.model_dump()
    normalized: dict[str, str] = {}

    for key in QUERY_KEYS:
        if key in raw_payload:
            value = raw_payload.get(key)
        else:
            value = current_payload.get(key, "")
        normalized[key] = "" if value is None else str(value).strip()

    return normalized


def resolve_query_values(
    query: dict[str, str],
    options: dict[str, list[str]],
) -> tuple[dict[str, str], list[dict[str, str]]]:
    """尽量把模型输出映射到当前数据集中的真实选项。

    这样即使模型输出带了少量口语化表达，左侧下拉框仍有较高概率成功回填。
    """
    resolved = dict(query)
    unresolved: list[dict[str, str]] = []
    select_fields = {
        "category": options.get("categories", []),
        "sub_category": options.get("sub_categories", []),
        "equipment_name": options.get("equipment_names", []),
        "model": options.get("models", []),
        "manufacturer": options.get("manufacturers", []),
    }
    field_map = get_query_field_map()

    for key, candidates in select_fields.items():
        value = resolved.get(key, "")
        if not value:
            continue

        matched = match_option(value, candidates)
        if matched:
            resolved[key] = matched
            continue

        unresolved.append(
            {
                "key": key,
                "label": str(field_map.get(key, {}).get("label", key)),
                "value": value,
            }
        )
        resolved[key] = ""
        resolved["keyword"] = merge_keyword(resolved.get("keyword", ""), value)

    return resolved, unresolved


def match_option(value: str, candidates: list[str]) -> str:
    """在候选项中匹配最合适的值。

    匹配顺序依次为：
    1. 忽略大小写的完全相等。
    2. 子串唯一命中。
    3. difflib 近似匹配。
    """
    if not value:
        return ""

    normalized_value = normalize_text(value)
    if not normalized_value:
        return ""

    normalized_map = {normalize_text(item): item for item in candidates if item}
    if normalized_value in normalized_map:
        return normalized_map[normalized_value]

    contains_matches = [item for item in candidates if normalized_value in normalize_text(item) or normalize_text(item) in normalized_value]
    if len(contains_matches) == 1:
        return contains_matches[0]

    close_matches = get_close_matches(normalized_value, list(normalized_map.keys()), n=1, cutoff=0.72)
    if close_matches:
        return normalized_map[close_matches[0]]

    return ""


def normalize_text(value: str) -> str:
    """归一化匹配文本，减少空格和大小写差异带来的影响。"""
    return (
        str(value)
        .strip()
        .lower()
        .replace("（", "(")
        .replace("）", ")")
        .replace(" ", "")
    )


def merge_keyword(current_keyword: str, extra_value: str) -> str:
    """把无法结构化的值并入关键字字段，保留检索线索。"""
    values = [item.strip() for item in [current_keyword, extra_value] if item and item.strip()]
    unique_values: list[str] = []
    for item in values:
        if item not in unique_values:
            unique_values.append(item)
    return " ".join(unique_values)


def build_default_reply(
    filled_fields: list[dict[str, str]],
    missing_fields: list[dict[str, str]],
    unresolved_fields: list[dict[str, str]],
) -> str:
    """当模型未给出自然语言回复时，生成一个默认说明。"""
    if not filled_fields:
        return "我暂时没有抽取出稳定的结构化条件，建议补充器具类别、名称或测量范围。"

    filled_text = "、".join(item["label"] for item in filled_fields)
    if unresolved_fields:
        unresolved_text = "、".join(item["label"] for item in unresolved_fields)
        return f"已抽取 {filled_text}，其中 {unresolved_text} 暂未精确匹配，已回退到关键字检索。"

    if missing_fields:
        missing_text = "、".join(item["label"] for item in missing_fields[:3])
        return f"已完成参数抽取并回填 {filled_text}。如需更精确，可继续补充 {missing_text}。"

    return f"已完成参数抽取并回填 {filled_text}，可以直接执行搜索。"