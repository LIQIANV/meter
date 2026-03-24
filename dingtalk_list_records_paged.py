import requests

def main(arg1,accessToken):

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