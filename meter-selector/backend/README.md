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

如需启用右侧 AI 对话抽取，请额外配置 Dify Chatflow：

Windows PowerShell:

$env:DIFY_API_KEY="your_dify_api_key"
$env:DIFY_BASE_URL="https://your-dify-host/v1"
$env:DIFY_USER="meter-selector-backend"

如果未配置 DIFY_API_KEY，右侧 AI 抽取功能会返回错误，但左侧传统搜索仍可正常使用。

启动后访问:

- http://127.0.0.1:8000/
- http://127.0.0.1:8000/api/health

新增接口:

- http://127.0.0.1:8000/api/query-metadata
- http://127.0.0.1:8000/api/ai/extract

## 本地抽样接口测试

当服务已经通过 uvicorn 启动后，可以直接运行抽样接口测试脚本。

Windows PowerShell:

d:/Metering_Tools/.venv/Scripts/python.exe scripts/run_sample_api_tests.py

可选参数:

- --base-url: 指定待测服务地址，默认 http://127.0.0.1:8000
- --sample-size: 抽样记录数，默认 24
- --report-path: 报告输出路径，默认 backend/reports/api-test-report.md

执行后会：

1. 读取 data/tools.json 中的少量样本数据。
2. 调用 /api/health、/api/options、/api/query-metadata、/api/search、/api/search-logs。
3. 生成 Markdown 测试报告，报告中包含汇总表与用例明细表。

## 页面内手动更新数据

启动服务后，可在首页表单头部点击“更新数据”按钮。

按钮行为如下:

- 调用后端同步接口触发一次钉钉数据同步
- 同步成功后自动刷新筛选项、全量记录和查询历史
- 同步失败时在页面顶部显示错误提示

## Windows 定时同步

可使用任务计划程序定时执行以下命令:

python d:\Metering_Tools\meter-selector\backend\scripts\sync_dingtalk_tools.py

## Docker 部署

项目已经支持把后端和前端一起打成单个镜像，容器启动后直接访问 8000 端口即可。

### 目录说明

- 镜像构建上下文: meter-selector
- 后端代码目录: backend
- 前端静态资源目录: frontend
- 持久化数据目录: backend/data

### 方式一：直接用 docker build 和 docker run

在 meter-selector 目录执行：

```powershell
docker build -t meter-selector:latest .
docker run -d --name meter-selector \
	-p 8000:8000 \
	-v ${PWD}/backend/data:/app/backend/data \
	-v ${PWD}/backend/scripts/sync_config.json:/app/backend/scripts/sync_config.json:ro \
	-e DIFY_API_KEY="your_dify_api_key" \
	-e DIFY_BASE_URL="https://your-dify-host/v1" \
	-e DINGTALK_APP_KEY="your_app_key" \
	-e DINGTALK_APP_SECRET="your_app_secret" \
	-e DINGTALK_APP_TOKEN="your_app_token" \
	-e DINGTALK_TABLE_ID="your_table_id" \
	meter-selector:latest
```

说明：

- backend/data 挂载到宿主机，用于保留 tools.json 和 search_logs.jsonl。
- 如果你更希望把钉钉配置放在环境变量里，也可以不挂载 sync_config.json。
- 容器启动后访问 http://服务器IP:8000/。

### 方式二：使用 docker compose

项目根目录已提供 docker-compose.yml，推荐服务器上直接使用：

```powershell
docker compose up -d --build
```

如需传环境变量，先在服务器 shell 中导出，或在同目录放一个 .env 文件，例如：

```dotenv
DIFY_API_KEY=your_dify_api_key
DIFY_BASE_URL=https://your-dify-host/v1
DIFY_TIMEOUT=45
DIFY_USER=meter-selector-backend
DINGTALK_APP_KEY=your_app_key
DINGTALK_APP_SECRET=your_app_secret
DINGTALK_APP_TOKEN=your_app_token
DINGTALK_TABLE_ID=your_table_id
DINGTALK_OPERATOR_ID=
DINGTALK_ACCESS_TOKEN_COOKIE=
DINGTALK_RECORDS_COOKIE=
```

常用命令：

```powershell
docker compose ps
docker compose logs -f
docker compose restart
docker compose down
```

### 服务器部署建议

1. 服务器先安装 Docker 和 Docker Compose。
2. 把整个 meter-selector 目录上传到服务器。
3. 按需修改 backend/scripts/sync_config.json，或者改为使用环境变量注入钉钉配置。
4. 在服务器的 meter-selector 目录执行 docker compose up -d --build。
5. 用 http://127.0.0.1:8000/api/health 检查服务状态。
6. 如需对外开放，放到 Nginx 或云服务器安全组后面暴露 8000 或反向代理到 80/443。

### 升级发布

代码更新后，在服务器重新执行：

```powershell
docker compose up -d --build
```

这会重新构建镜像并用新容器替换旧容器，backend/data 中的数据会被保留。