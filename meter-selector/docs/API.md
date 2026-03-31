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
    "models": ["0-150mm"],
    "manufacturers": ["厂家A"]
  }
}
```

## GET /api/query-metadata

返回左侧传统查询与右侧 AI 抽取共用的业务元信息定义。

响应示例:

```json
{
  "success": true,
  "data": {
    "version": "2026-03-25",
    "groups": [
      {
        "key": "device_scope",
        "label": "设备身份",
        "summary": "先锁定计量器具所属专业、品类和具体设备。",
        "fields": ["category", "sub_category", "equipment_name", "model", "manufacturer"]
      }
    ],
    "fields": [
      {
        "key": "category",
        "label": "类别",
        "input_type": "select",
        "placeholder": "请选择类别",
        "description": "一级业务分类，用来缩小到长度类、温度类等专业范围。",
        "ai_aliases": ["类别", "一级分类"],
        "options": ["长度类", "温度类"]
      }
    ]
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
  "keyword": "长度",
  "measurement_requirement": "(5.4-5.7)mm"
}
```

## POST /api/ai/extract

调用 Qwen 兼容接口，把自然语言对话抽取成结构化查询参数。

请求示例:

```json
{
  "message": "我要找长度类的游标卡尺，测量范围大概是 5.4 到 5.7 毫米，最好先别限制厂家。",
  "current_query": {
    "category": "",
    "sub_category": "",
    "equipment_name": "",
    "model": "",
    "manufacturer": "",
    "keyword": "",
    "measurement_requirement": ""
  }
}
```

响应示例:

```json
{
  "success": true,
  "data": {
    "assistant_reply": "已抽取长度类、游标卡尺和测量范围，可直接回填表单继续搜索。",
    "confidence": "medium",
    "query": {
      "category": "长度类",
      "sub_category": "卡尺",
      "equipment_name": "游标卡尺",
      "model": "",
      "manufacturer": "",
      "keyword": "",
      "measurement_requirement": "(5.4-5.7)mm"
    },
    "filled_fields": [
      {"key": "category", "label": "类别", "value": "长度类"}
    ],
    "missing_fields": [
      {"key": "model", "label": "型号"}
    ],
    "follow_up_questions": ["如需缩小结果，是否要限定型号或厂家？"],
    "notes": []
  }
}
```

## POST /api/sync

手动触发一次钉钉数据同步，并刷新本地 tools.json。

响应示例:

```json
{
  "success": true,
  "message": "同步成功",
  "data": {
    "updated_at": "2026-03-25T09:30:00",
    "total": 559,
    "data_file": "D:/Metering_Tools/meter-selector/backend/data/tools.json"
  }
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