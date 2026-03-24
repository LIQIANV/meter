# API 文档

## GET /api/health

返回服务健康状态。

响应示例:

```json
{
  "success": true,
  "message": "ok"
}
```

## GET /api/options

返回全局筛选项。

响应示例:

```json
{
  "success": true,
  "data": {
    "categories": ["长度类"],
    "sub_categories": ["卡尺"],
    "equipment_names": ["游标卡尺"],
    "manufacturers": ["厂家A"]
  }
}
```

## POST /api/search

按结构化字段和关键字过滤记录。

请求示例:

```json
{
  "category": "长度类",
  "sub_category": "卡尺",
  "equipment_name": "游标卡尺",
  "model": "0-150mm",
  "manufacturer": "厂家A",
  "keyword": "长度"
}
```

响应示例:

```json
{
  "success": true,
  "data": {
    "total": 1,
    "records": [
      {
        "record_id": "rec_xxx",
        "一级分类": "长度类",
        "二级分类": "卡尺",
        "名称": "游标卡尺",
        "型号": "0-150mm",
        "生产厂家": "厂家A",
        "测量下限": "0mm",
        "测量上限": "150mm",
        "准确度": "±0.02mm",
        "最大允许误差": "±0.02mm",
        "分度值": "0.01mm",
        "应用场景": "长度测量",
        "图片": "https://example.com/image.png"
      }
    ]
  }
}
```