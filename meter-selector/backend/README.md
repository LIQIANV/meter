# Meter Selector MVP

## 目录说明

- app: FastAPI 服务代码
- data: 本地 JSON 数据文件
- scripts: 钉钉同步脚本

## 安装依赖

pip install -r requirements.txt

## 执行同步

Windows PowerShell:

$env:DINGTALK_APP_KEY="your_app_key"
$env:DINGTALK_APP_SECRET="your_app_secret"
$env:DINGTALK_APP_TOKEN="your_app_token"
$env:DINGTALK_TABLE_ID="your_table_id"
$env:DINGTALK_OPERATOR_ID="optional_operator_id"
python scripts/sync_dingtalk_tools.py

也可以使用本地配置文件方式，不把密钥写进源码：

1. 复制 scripts/sync_config.example.json 为 scripts/sync_config.json
2. 将 app_key、app_secret、app_token、table_id 等值填入 sync_config.json
3. 如接口调用必须带 Cookie，可分别填写 access_token_cookie 和 records_cookie
4. 首次分页请求不会发送 nextToken，只有接口返回 hasMore=true 后才会继续携带服务端返回的 nextToken
5. 执行 python scripts/sync_dingtalk_tools.py

## 启动服务

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

如需启用右侧 AI 对话抽取，请额外配置 Qwen 兼容接口：

Windows PowerShell:

$env:QWEN_API_KEY="your_qwen_api_key"
$env:QWEN_MODEL="qwen-plus"
$env:QWEN_BASE_URL="https://dashscope.aliyuncs.com/compatible-mode/v1"

默认协议使用 DashScope 的 OpenAI 兼容路径 /chat/completions。

启动后访问:

- http://127.0.0.1:8000/
- http://127.0.0.1:8000/api/health

新增接口:

- http://127.0.0.1:8000/api/query-metadata
- http://127.0.0.1:8000/api/ai/extract

## 页面内手动更新数据

启动服务后，可在首页表单头部点击“更新数据”按钮。

按钮行为如下:

- 调用后端同步接口触发一次钉钉数据同步
- 同步成功后自动刷新筛选项、全量记录和查询历史
- 同步失败时在页面顶部显示错误提示

## Windows 定时同步

可使用任务计划程序定时执行以下命令:

python d:\Metering_Tools\meter-selector\backend\scripts\sync_dingtalk_tools.py