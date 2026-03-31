"""请求体、响应体和数据文件结构定义。

FastAPI 与 Pydantic 的配合方式是：
1. 路由函数用模型声明输入输出结构。
2. service 层使用模型接收和校验内部数据。
3. 钉钉同步后的 JSON 文件也通过模型保证结构稳定。
"""

from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ToolRecord(BaseModel):
    """单条计量器具记录。

    数据源里的字段名是中文，因此这里通过 alias 把外部字段名映射为
    Python 中更容易操作的英文属性名。这样后端在写逻辑时更清晰，而
    对外输出时又可以继续保留原始中文字段。
    """

    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    record_id: str = ""
    category: str = Field(default="", alias="一级分类")
    sub_category: str = Field(default="", alias="二级分类")
    equipment_name: str = Field(default="", alias="名称")
    model_name: str = Field(default="", alias="型号")
    manufacturer: str = Field(default="", alias="生产厂家")
    measurement_min: str = Field(default="", alias="测量下限")
    measurement_max: str = Field(default="", alias="测量上限")
    accuracy: str = Field(default="", alias="准确度")
    max_permissible_error: str = Field(default="", alias="最大允许误差")
    division_value: str = Field(default="", alias="分度值")
    application_scene: str = Field(default="", alias="应用场景")
    image: str = Field(default="", alias="图片")
    raw_fields: dict[str, Any] = Field(default_factory=dict, alias="原始字段")


class ToolsDataFile(BaseModel):
    """本地 tools.json 文件的整体结构。"""

    model_config = ConfigDict(extra="ignore")

    updated_at: str
    total: int
    records: list[ToolRecord]


class SearchRequest(BaseModel):
    """搜索接口请求模型。

    这个模型描述前端提交给 /api/search 的结构化筛选条件。所有字段都
    允许为空字符串，这意味着前端可以只填写部分条件，service 层会把
    空字符串视为“不过滤该字段”。
    """

    category: str = ""
    sub_category: str = ""
    equipment_name: str = ""
    model: str = ""
    manufacturer: str = ""
    keyword: str = ""
    measurement_requirement: str = ""


class OptionsData(BaseModel):
    """下拉筛选项返回结构。"""

    categories: list[str]
    sub_categories: list[str]
    equipment_names: list[str]
    models: list[str]
    manufacturers: list[str]


class SearchData(BaseModel):
    """搜索结果返回结构。"""

    total: int
    records: list[dict[str, Any]]


class AIExtractRequest(BaseModel):
    """AI 参数抽取请求模型。

    前端会把右侧对话区中的自然语言描述发送到后端，同时附带当前左侧
    表单状态，便于模型在“补充已有条件”和“明确清空旧条件”之间做出
    更合理的判断。
    """

    message: str = ""
    current_query: SearchRequest = Field(default_factory=SearchRequest)