"""用于测试钉钉分页拉取接口的简化脚本。

与 backend/scripts/sync_dingtalk_tools.py 相比，这个文件更像是早期验证 API
 调用链路的实验脚本：逻辑简单、配置写死、返回值也没有做结构化清洗。
"""

import requests

def main(arg1,accessToken):
    """按页拉取钉钉记录并返回原始结果字符串。

    这里保留了最基础的分页请求过程，适合快速验证 accessToken 是否可用。
    由于配置硬编码较多，它不适合直接作为生产同步脚本使用。
    """

    access_token = accessToken
    base_id = "OG9lyrgJPzymk9NbUbPY31nDWzN67Mw4"
    sheet_id_or_name = "hERWDMS"
    operator_id = "bHDxoEQKpPHesWTX9eYiSvAiEiE"

    url = f"https://api.dingtalk.com/v1.0/notable/bases/{base_id}/sheets/{sheet_id_or_name}/records/list"

    headers = {
        "x-acs-dingtalk-access-token": access_token,
        "Content-Type": "application/json"
    }

    all_records = []
    next_token = None

    while True:
        body = {
            "maxResults": 100
        }
        if next_token:
            body["nextToken"] = next_token

        resp = requests.post(
            url,
            headers=headers,
            params={"operatorId": operator_id},
            json=body,
            timeout=30
        )
        resp.raise_for_status()
        data = resp.json()

        records = data.get("records", [])
        all_records.extend(records)

        if not data.get("hasMore"):
            break

        next_token = data.get("nextToken")
        if not next_token:
            break

    DingDingAllRecords = str(all_records)

    return {"result" : DingDingAllRecords}