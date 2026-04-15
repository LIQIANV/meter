"""对本地已启动的 FastAPI 服务执行小规模接口回归测试，并输出 Markdown 报告。

使用方式示例:

    d:/Metering_Tools/.venv/Scripts/python.exe scripts/run_sample_api_tests.py

脚本特点:
1. 从 data/tools.json 中抽样若干条记录，生成稳定的精确查询用例。
2. 调用本地已启动的 HTTP 服务，验证 health、options、query-metadata、search、search-logs。
3. 生成适合直接查看或归档的 Markdown 报告。
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import requests


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_FILE = BASE_DIR / "data" / "tools.json"
DEFAULT_REPORT_PATH = BASE_DIR / "reports" / "api-test-report.md"
DEFAULT_BASE_URL = "http://127.0.0.1:8000"
DEFAULT_SAMPLE_SIZE = 24
DEFAULT_TIMEOUT = 8.0


@dataclass
class TestCaseResult:
    """保存单条测试用例结果，用于最终汇总成报告。"""

    case_id: str
    case_name: str
    status: str
    duration_ms: int
    detail: str


def parse_args() -> argparse.Namespace:
    """解析命令行参数。"""
    parser = argparse.ArgumentParser(description="对本地 FastAPI 服务执行抽样接口测试并生成 Markdown 报告")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL, help=f"待测试服务地址，默认 {DEFAULT_BASE_URL}")
    parser.add_argument(
        "--sample-size",
        type=int,
        default=DEFAULT_SAMPLE_SIZE,
        help=f"抽样记录数，默认 {DEFAULT_SAMPLE_SIZE}",
    )
    parser.add_argument(
        "--report-path",
        default=str(DEFAULT_REPORT_PATH),
        help=f"Markdown 报告输出路径，默认 {DEFAULT_REPORT_PATH}",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=DEFAULT_TIMEOUT,
        help=f"单次 HTTP 请求超时时间（秒），默认 {DEFAULT_TIMEOUT}",
    )
    return parser.parse_args()


def read_tools_payload() -> dict[str, Any]:
    """读取本地 tools.json，作为测试样本来源。"""
    with DATA_FILE.open("r", encoding="utf-8") as file:
        return json.load(file)


def pick_sample_records(records: list[dict[str, Any]], sample_size: int) -> list[dict[str, Any]]:
    """选取稳定、可用于精确查询的样本记录。

    优先选择关键信息较完整的记录，避免用例因为空字段过多而缺少辨识度。
    这里不做随机抽样，保持每次执行结果尽量稳定。
    """
    complete_records = [
        record
        for record in records
        if str(record.get("一级分类", "")).strip()
        and str(record.get("二级分类", "")).strip()
        and str(record.get("名称", "")).strip()
    ]

    unique_records: list[dict[str, Any]] = []
    seen_keys: set[tuple[str, str, str, str, str]] = set()
    for record in complete_records:
        key = (
            str(record.get("一级分类", "")).strip(),
            str(record.get("二级分类", "")).strip(),
            str(record.get("名称", "")).strip(),
            str(record.get("型号", "")).strip(),
            str(record.get("生产厂家", "")).strip(),
        )
        if key in seen_keys:
            continue
        seen_keys.add(key)
        unique_records.append(record)
        if len(unique_records) >= sample_size:
            break

    return unique_records


def build_exact_query(record: dict[str, Any]) -> dict[str, str]:
    """把一条记录转换成 /api/search 可接受的精确查询条件。"""
    return {
        "category": str(record.get("一级分类", "") or ""),
        "sub_category": str(record.get("二级分类", "") or ""),
        "equipment_name": str(record.get("名称", "") or ""),
        "model": str(record.get("型号", "") or ""),
        "manufacturer": str(record.get("生产厂家", "") or ""),
        "keyword": "",
        "measurement_requirement": "",
    }


def markdown_escape(value: Any) -> str:
    """对 Markdown 表格中的文本做最小转义。"""
    text = str(value if value is not None else "")
    return text.replace("|", r"\|").replace("\n", "<br>")


def format_json_text(payload: dict[str, Any]) -> str:
    """把字典转成适合放在报告中的单行文本。"""
    return markdown_escape(json.dumps(payload, ensure_ascii=False))


class ApiTestRunner:
    """执行接口测试并收集结果。"""

    def __init__(self, base_url: str, timeout: float, tools_payload: dict[str, Any]) -> None:
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.tools_payload = tools_payload
        self.session = requests.Session()
        self.results: list[TestCaseResult] = []

    def request(self, method: str, path: str, **kwargs: Any) -> requests.Response:
        """统一发起 HTTP 请求。"""
        url = f"{self.base_url}{path}"
        return self.session.request(method=method, url=url, timeout=self.timeout, **kwargs)

    def run_case(self, case_id: str, case_name: str, callback: Any) -> None:
        """执行单条测试用例，记录成功或失败信息。"""
        started = time.perf_counter()
        try:
            detail = callback()
            status = "PASS"
        except Exception as exc:  # noqa: BLE001 - 测试脚本需要把异常完整记入报告
            detail = str(exc)
            status = "FAIL"
        duration_ms = int((time.perf_counter() - started) * 1000)
        self.results.append(
            TestCaseResult(
                case_id=case_id,
                case_name=case_name,
                status=status,
                duration_ms=duration_ms,
                detail=detail,
            )
        )

    def assert_json_success(self, response: requests.Response) -> dict[str, Any]:
        """验证项目统一 JSON 响应格式。"""
        if response.status_code != 200:
            raise AssertionError(f"HTTP {response.status_code}: {response.text[:200]}")

        payload = response.json()
        if not payload.get("success"):
            raise AssertionError(f"业务返回失败: {payload}")
        return payload

    def test_health(self) -> str:
        """验证健康检查接口。"""
        payload = self.assert_json_success(self.request("GET", "/api/health"))
        message = str(payload.get("message", ""))
        if message != "ok":
            raise AssertionError(f"/api/health 返回 message 非 ok: {payload}")
        return "/api/health 返回 success=true，message=ok"

    def test_query_metadata(self) -> str:
        """验证查询元信息接口的核心字段存在。"""
        payload = self.assert_json_success(self.request("GET", "/api/query-metadata"))
        data = payload.get("data") or {}
        fields = data.get("fields") or []
        if not isinstance(fields, list) or not fields:
            raise AssertionError("query-metadata.fields 为空")

        keys = {str(item.get("key", "")) for item in fields if isinstance(item, dict)}
        required_keys = {"category", "sub_category", "equipment_name", "model", "manufacturer", "keyword", "measurement_requirement"}
        missing_keys = sorted(required_keys - keys)
        if missing_keys:
            raise AssertionError(f"query-metadata 缺少字段: {missing_keys}")

        return f"/api/query-metadata 包含 {len(fields)} 个字段，必需键均存在"

    def test_options(self) -> str:
        """验证筛选项接口至少能返回类别与设备基础选项。"""
        payload = self.assert_json_success(self.request("GET", "/api/options"))
        data = payload.get("data") or {}
        categories = data.get("categories") or []
        equipment_names = data.get("equipment_names") or []
        if not categories:
            raise AssertionError("/api/options.categories 为空")
        if not equipment_names:
            raise AssertionError("/api/options.equipment_names 为空")
        return f"/api/options 返回类别 {len(categories)} 个、设备名称 {len(equipment_names)} 个"

    def test_search_all(self) -> str:
        """验证空查询至少能取回与本地数据一致的总数。"""
        expected_total = int(self.tools_payload.get("total", 0))
        payload = self.assert_json_success(
            self.request(
                "POST",
                "/api/search",
                json={
                    "category": "",
                    "sub_category": "",
                    "equipment_name": "",
                    "model": "",
                    "manufacturer": "",
                    "keyword": "",
                    "measurement_requirement": "",
                },
            )
        )
        data = payload.get("data") or {}
        actual_total = int(data.get("total", -1))
        if actual_total != expected_total:
            raise AssertionError(f"空查询总数不一致: 服务={actual_total}, 本地数据={expected_total}")
        return f"空查询返回 {actual_total} 条，与 tools.json total 一致"

    def test_search_exact_record(self, record: dict[str, Any], case_index: int) -> str:
        """验证精确条件查询至少命中样本记录本身。"""
        query = build_exact_query(record)
        payload = self.assert_json_success(self.request("POST", "/api/search", json=query))
        data = payload.get("data") or {}
        records = data.get("records") or []
        record_ids = {str(item.get("record_id", "")) for item in records if isinstance(item, dict)}
        expected_record_id = str(record.get("record_id", ""))
        if expected_record_id not in record_ids:
            raise AssertionError(
                "未命中样本记录: "
                f"record_id={expected_record_id}, 查询={query}, 返回 total={data.get('total')}"
            )
        return (
            f"样本 {case_index} 命中 record_id={expected_record_id}，"
            f"返回 {data.get('total', 0)} 条，查询={format_json_text(query)}"
        )

    def test_search_logs(self, record: dict[str, Any]) -> str:
        """先发一次查询，再校验日志接口包含对应查询条件。"""
        query = build_exact_query(record)
        self.assert_json_success(self.request("POST", "/api/search", json=query))
        payload = self.assert_json_success(self.request("GET", "/api/search-logs?limit=20"))
        records = payload.get("data", {}).get("records") or []
        matched_entry = next(
            (
                entry
                for entry in records
                if isinstance(entry, dict)
                and isinstance(entry.get("query"), dict)
                and entry.get("query") == query
            ),
            None,
        )
        if matched_entry is None:
            raise AssertionError(f"/api/search-logs 最近 20 条中未找到查询: {query}")
        return f"/api/search-logs 成功记录本次查询，result_total={matched_entry.get('result_total', '未知')}"

    def run(self, sample_records: list[dict[str, Any]]) -> list[TestCaseResult]:
        """按既定顺序执行所有测试。"""
        self.run_case("API-001", "健康检查接口", self.test_health)
        self.run_case("API-002", "查询元信息接口", self.test_query_metadata)
        self.run_case("API-003", "全局筛选项接口", self.test_options)
        self.run_case("API-004", "空条件搜索总数校验", self.test_search_all)

        for index, record in enumerate(sample_records, start=1):
            case_id = f"API-{100 + index:03d}"
            case_name = f"精确搜索命中样本记录 #{index}"
            self.run_case(case_id, case_name, lambda current=record, current_index=index: self.test_search_exact_record(current, current_index))

        if sample_records:
            self.run_case("API-900", "查询日志接口", lambda: self.test_search_logs(sample_records[0]))

        return self.results


def build_markdown_report(
    results: list[TestCaseResult],
    base_url: str,
    sample_size: int,
    tools_payload: dict[str, Any],
) -> str:
    """构造 Markdown 测试报告文本。"""
    generated_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    total_count = len(results)
    passed_count = sum(1 for item in results if item.status == "PASS")
    failed_count = total_count - passed_count
    status_text = "通过" if failed_count == 0 else "失败"
    failed_results = [item for item in results if item.status == "FAIL"]

    lines = [
        "# 本地接口抽样测试报告",
        "",
        f"- 生成时间: {generated_at}",
        f"- 测试地址: {base_url}",
        f"- 本地数据总量: {tools_payload.get('total', 0)}",
        f"- 抽样记录数: {sample_size}",
        "",
        "## 总览",
        "",
        "| 指标 | 数值 |",
        "| --- | --- |",
        f"| 总用例数 | {total_count} |",
        f"| 通过数 | {passed_count} |",
        f"| 失败数 | {failed_count} |",
        f"| 结论 | {status_text} |",
        "",
        "## 用例明细",
        "",
        "| 用例编号 | 用例名称 | 状态 | 耗时(ms) | 说明 |",
        "| --- | --- | --- | ---: | --- |",
    ]

    for result in results:
        lines.append(
            "| {case_id} | {case_name} | {status} | {duration_ms} | {detail} |".format(
                case_id=markdown_escape(result.case_id),
                case_name=markdown_escape(result.case_name),
                status=markdown_escape(result.status),
                duration_ms=result.duration_ms,
                detail=markdown_escape(result.detail),
            )
        )

    if failed_results:
        lines.extend(
            [
                "",
                "## 失败项",
                "",
                "| 用例编号 | 用例名称 | 失败原因 |",
                "| --- | --- | --- |",
            ]
        )
        for result in failed_results:
            lines.append(
                "| {case_id} | {case_name} | {detail} |".format(
                    case_id=markdown_escape(result.case_id),
                    case_name=markdown_escape(result.case_name),
                    detail=markdown_escape(result.detail),
                )
            )

    return "\n".join(lines) + "\n"


def write_report(report_path: Path, content: str) -> None:
    """写出 Markdown 报告文件。"""
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(content, encoding="utf-8")


def main() -> int:
    """程序入口。"""
    args = parse_args()
    tools_payload = read_tools_payload()
    records = tools_payload.get("records") or []
    sample_records = pick_sample_records(records, max(1, args.sample_size))

    runner = ApiTestRunner(base_url=args.base_url, timeout=args.timeout, tools_payload=tools_payload)
    results = runner.run(sample_records)

    report_content = build_markdown_report(
        results=results,
        base_url=args.base_url,
        sample_size=len(sample_records),
        tools_payload=tools_payload,
    )
    report_path = Path(args.report_path)
    write_report(report_path, report_content)

    failed_count = sum(1 for item in results if item.status == "FAIL")
    print(f"测试完成，总用例 {len(results)} 条，失败 {failed_count} 条")
    print(f"报告已生成: {report_path}")
    return 1 if failed_count else 0


if __name__ == "__main__":
    sys.exit(main())