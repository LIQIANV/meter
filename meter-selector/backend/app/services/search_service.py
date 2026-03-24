"""搜索服务。

该模块封装后端的基础筛选逻辑：
1. 读取全量设备记录。
2. 按结构化字段做精确匹配。
3. 按关键字做模糊包含匹配。

注意：与量程和 MPE 相关的技术判定目前放在前端执行，因此这里返回的是
“条件初筛结果”，而不是最终技术选型结果。
"""

from app.models import SearchRequest
from app.services.data_loader import load_tools_data


SEARCH_FIELDS = [
    "category",
    "sub_category",
    "equipment_name",
    "model_name",
    "manufacturer",
    "measurement_min",
    "measurement_max",
    "accuracy",
    "max_permissible_error",
    "division_value",
    "application_scene",
]


def _matches_exact(actual: str, expected: str) -> bool:
    """判断单个字段是否满足精确匹配。

    约定 expected 为空时表示该条件未启用，因此直接返回 True。这样调用方
    可以连续写多个 if 判断，而不用额外区分“是否传了条件”。
    """
    if not expected:
        return True
    return actual.strip() == expected.strip()


def _matches_keyword(record_values: list[str], keyword: str) -> bool:
    """判断关键字是否命中记录的任一可搜索字段。

    这里采用最简单的“不区分大小写子串匹配”，适合 MVP 阶段快速验证需求。
    """
    if not keyword:
        return True
    normalized_keyword = keyword.strip().lower()
    return any(normalized_keyword in value.lower() for value in record_values if value)


def search_records(query: SearchRequest) -> dict[str, object]:
    """执行后端侧的基础条件搜索。

    这个函数是 /api/search 的核心业务入口。它不会修改数据，只遍历全量记录
    做纯过滤，并把命中的 Pydantic 模型转回字典供前端使用。
    """
    records = load_tools_data().records
    matched_records = []

    for record in records:
        if not _matches_exact(record.category, query.category):
            continue
        if not _matches_exact(record.sub_category, query.sub_category):
            continue
        if not _matches_exact(record.equipment_name, query.equipment_name):
            continue
        if not _matches_exact(record.model_name, query.model):
            continue
        if not _matches_exact(record.manufacturer, query.manufacturer):
            continue

        keyword_values = [str(getattr(record, field, "") or "") for field in SEARCH_FIELDS]
        if not _matches_keyword(keyword_values, query.keyword):
            continue

        matched_records.append(record.model_dump(by_alias=True))

    return {
        "total": len(matched_records),
        "records": matched_records,
    }