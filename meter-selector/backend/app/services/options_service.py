"""筛选项构建服务。

该模块从全量设备记录中提取前端表单需要的唯一值集合。
"""

from app.services.data_loader import load_tools_data


def _sorted_unique(values: list[str]) -> list[str]:
    """对字符串列表去重、去空白并排序。

    前端下拉项需要稳定顺序和干净值，这个工具函数把重复值、空字符串和
    纯空白项都清理掉，避免每个字段都重复写一遍清洗逻辑。
    """
    return sorted({value.strip() for value in values if value and value.strip()})


def get_options() -> dict[str, list[str]]:
    """根据全量记录生成表单下拉选项。

    这里返回的是“平铺后的全局选项”，前端初始化页面时会先拿到这些基础
    值，再结合完整记录构造联动下拉数据结构。
    """
    records = load_tools_data().records
    return {
        "categories": _sorted_unique([record.category for record in records]),
        "sub_categories": _sorted_unique([record.sub_category for record in records]),
        "equipment_names": _sorted_unique([record.equipment_name for record in records]),
        "manufacturers": _sorted_unique([record.manufacturer for record in records]),
    }