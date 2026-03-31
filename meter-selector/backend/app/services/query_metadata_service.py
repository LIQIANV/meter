"""查询业务元信息服务。

这个模块把“表单字段是什么、业务上代表什么、AI 应该如何理解这些字段”
统一定义成一份元数据，供两个入口复用：
1. 前端左侧传统搜索表单，用来渲染标签、提示和字段说明。
2. 右侧 AI 抽取接口，用来提示大模型按同一套业务语义输出结构化条件。
"""

from copy import deepcopy

from app.services.options_service import get_options


QUERY_GROUPS = [
    {
        "key": "device_scope",
        "label": "设备身份",
        "summary": "先锁定计量器具所属专业、品类和具体设备。",
        "fields": ["category", "sub_category", "equipment_name", "model", "manufacturer"],
    },
    {
        "key": "measurement_rule",
        "label": "量值要求",
        "summary": "用测量对象要求范围触发量程覆盖和 MPE 技术筛选。",
        "fields": ["measurement_requirement"],
    },
    {
        "key": "retrieval_hint",
        "label": "辅助检索",
        "summary": "当描述比较模糊时，用关键字补充应用场景、用途和关键词线索。",
        "fields": ["keyword"],
    },
]


QUERY_FIELDS = [
    {
        "key": "category",
        "label": "类别",
        "group": "device_scope",
        "input_type": "select",
        "placeholder": "请选择类别",
        "description": "一级业务分类，用来缩小到长度类、温度类等专业范围。",
        "ai_aliases": ["类别", "一级分类", "专业类别", "器具大类"],
        "examples": ["长度类", "温度类"],
    },
    {
        "key": "sub_category",
        "label": "二级分类",
        "group": "device_scope",
        "input_type": "select",
        "placeholder": "请先选择类别",
        "description": "在同一专业类别下继续细分器具类型，例如卡尺、千分尺。",
        "ai_aliases": ["二级分类", "细分类别", "器具类型"],
        "examples": ["卡尺", "温度计"],
    },
    {
        "key": "equipment_name",
        "label": "设备名称",
        "group": "device_scope",
        "input_type": "select",
        "placeholder": "请先选择二级分类",
        "description": "具体设备名称，通常是工作人员口中的器具名称。",
        "ai_aliases": ["设备名称", "器具名称", "仪器名称"],
        "examples": ["游标卡尺", "数字温度计"],
    },
    {
        "key": "model",
        "label": "型号",
        "group": "device_scope",
        "input_type": "select",
        "placeholder": "请先选择设备名称",
        "description": "设备的规格型号，例如 0-150mm、0-25mm。",
        "ai_aliases": ["型号", "规格", "量程型号"],
        "examples": ["0-150mm", "0-25mm"],
    },
    {
        "key": "manufacturer",
        "label": "厂家",
        "group": "device_scope",
        "input_type": "select",
        "placeholder": "请先选择型号",
        "description": "生产厂家，用于进一步锁定候选品牌或供应商。",
        "ai_aliases": ["厂家", "制造商", "品牌", "生产厂家"],
        "examples": ["厂家A"],
    },
    {
        "key": "measurement_requirement",
        "label": "测量对象要求范围",
        "group": "measurement_rule",
        "input_type": "text",
        "placeholder": "例如：(5.4-5.7)mm 或 10±1mm，可留空做条件查询",
        "description": "支持区间和中心值±偏差两种写法；填写后会执行量程覆盖和 MPE 计算，是技术选型的核心约束。",
        "ai_aliases": ["测量范围", "测量对象范围", "被测范围", "量值要求"],
        "examples": ["(5.4-5.7)mm", "(20~25)℃", "10±1mm"],
    },
    {
        "key": "keyword",
        "label": "关键字",
        "group": "retrieval_hint",
        "input_type": "text",
        "placeholder": "选填，可搜索应用场景、型号、厂家等",
        "description": "承接模糊描述，例如用途、应用场景、行业词或暂时无法结构化的条件。",
        "ai_aliases": ["关键字", "用途", "应用场景", "检索词"],
        "examples": ["实验室长度测量", "现场点检"],
    },
]


def get_query_metadata() -> dict[str, object]:
    """返回查询表单的业务元信息。

    元信息本身是静态定义，但部分字段需要挂载运行时下拉选项，因此这里
    会把 options_service 的结果一并合并到字段定义里。
    """
    options = get_options()
    option_map = {
        "category": options["categories"],
        "sub_category": options["sub_categories"],
        "equipment_name": options["equipment_names"],
        "model": options["models"],
        "manufacturer": options["manufacturers"],
    }

    fields = []
    for field in QUERY_FIELDS:
        field_payload = deepcopy(field)
        if field_payload["input_type"] == "select":
            field_payload["options"] = option_map.get(field_payload["key"], [])
        fields.append(field_payload)

    return {
        "version": "2026-03-26",
        "groups": deepcopy(QUERY_GROUPS),
        "fields": fields,
    }


def get_query_field_map() -> dict[str, dict[str, object]]:
    """把字段元信息转换成按 key 索引的字典，方便服务层快速查询。"""
    return {field["key"]: field for field in get_query_metadata()["fields"]}