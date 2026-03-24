from app.services.data_loader import load_tools_data


def _sorted_unique(values: list[str]) -> list[str]:
    return sorted({value.strip() for value in values if value and value.strip()})


def get_options() -> dict[str, list[str]]:
    records = load_tools_data().records
    return {
        "categories": _sorted_unique([record.category for record in records]),
        "sub_categories": _sorted_unique([record.sub_category for record in records]),
        "equipment_names": _sorted_unique([record.equipment_name for record in records]),
        "manufacturers": _sorted_unique([record.manufacturer for record in records]),
    }