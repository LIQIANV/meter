from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ToolRecord(BaseModel):
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
    model_config = ConfigDict(extra="ignore")

    updated_at: str
    total: int
    records: list[ToolRecord]


class SearchRequest(BaseModel):
    category: str = ""
    sub_category: str = ""
    equipment_name: str = ""
    model: str = ""
    manufacturer: str = ""
    keyword: str = ""
    measurement_requirement: str = ""


class OptionsData(BaseModel):
    categories: list[str]
    sub_categories: list[str]
    equipment_names: list[str]
    manufacturers: list[str]


class SearchData(BaseModel):
    total: int
    records: list[dict[str, Any]]