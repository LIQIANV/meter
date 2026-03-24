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
    if not expected:
        return True
    return actual.strip() == expected.strip()


def _matches_keyword(record_values: list[str], keyword: str) -> bool:
    if not keyword:
        return True
    normalized_keyword = keyword.strip().lower()
    return any(normalized_keyword in value.lower() for value in record_values if value)


def search_records(query: SearchRequest) -> dict[str, object]:
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