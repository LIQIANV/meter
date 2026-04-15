# 本地接口抽样测试报告

- 生成时间: 2026-04-09 10:36:41
- 测试地址: http://127.0.0.1:8000
- 本地数据总量: 559
- 抽样记录数: 24

## 总览

| 指标 | 数值 |
| --- | --- |
| 总用例数 | 29 |
| 通过数 | 29 |
| 失败数 | 0 |
| 结论 | 通过 |

## 用例明细

| 用例编号 | 用例名称 | 状态 | 耗时(ms) | 说明 |
| --- | --- | --- | ---: | --- |
| API-001 | 健康检查接口 | PASS | 36 | /api/health 返回 success=true，message=ok |
| API-002 | 查询元信息接口 | PASS | 15 | /api/query-metadata 包含 7 个字段，必需键均存在 |
| API-003 | 全局筛选项接口 | PASS | 3 | /api/options 返回类别 4 个、设备名称 54 个 |
| API-004 | 空条件搜索总数校验 | PASS | 29 | 空查询返回 559 条，与 tools.json total 一致 |
| API-101 | 精确搜索命中样本记录 #1 | PASS | 3 | 样本 1 命中 record_id=04j9UDR4y1，返回 1 条，查询={"category": "温度类", "sub_category": "铂电阻", "equipment_name": "A级铂电阻温度传感器", "model": "STT-R-A1-B4-C80-D4-E4/F2/G0/H0-L1-PA-T2-W0-S0", "manufacturer": "北京赛亿凌", "keyword": "", "measurement_requirement": ""} |
| API-102 | 精确搜索命中样本记录 #2 | PASS | 3 | 样本 2 命中 record_id=0B1uMJCbQI，返回 1 条，查询={"category": "力学类", "sub_category": "扭矩", "equipment_name": "扭力螺丝刀（直读式）", "model": "CN500DPSK", "manufacturer": "中村", "keyword": "", "measurement_requirement": ""} |
| API-103 | 精确搜索命中样本记录 #3 | PASS | 3 | 样本 3 命中 record_id=0B2IPAMXgP，返回 1 条，查询={"category": "长度类", "sub_category": "指示表", "equipment_name": "内径千分表", "model": "（10~18）mm", "manufacturer": "成量", "keyword": "", "measurement_requirement": ""} |
| API-104 | 精确搜索命中样本记录 #4 | PASS | 4 | 样本 4 命中 record_id=0JDapxIDqH，返回 1 条，查询={"category": "力学类", "sub_category": "压力", "equipment_name": "压力传感器", "model": "DG2123-B-5", "manufacturer": "森纳士", "keyword": "", "measurement_requirement": ""} |
| API-105 | 精确搜索命中样本记录 #5 | PASS | 2 | 样本 5 命中 record_id=0KE4sKmzcE，返回 1 条，查询={"category": "长度类", "sub_category": "指示表", "equipment_name": "内径百分表", "model": "（6~10）mm", "manufacturer": "上量", "keyword": "", "measurement_requirement": ""} |
| API-106 | 精确搜索命中样本记录 #6 | PASS | 3 | 样本 6 命中 record_id=0KY7jECGUK，返回 1 条，查询={"category": "力学类", "sub_category": "流量", "equipment_name": "浮子流量计（气体）", "model": "RK1250-12-B-1/4-Air-5L/min", "manufacturer": "KOFLOC", "keyword": "", "measurement_requirement": ""} |
| API-107 | 精确搜索命中样本记录 #7 | PASS | 2 | 样本 7 命中 record_id=0MLz3EQJty，返回 1 条，查询={"category": "力学类", "sub_category": "压力", "equipment_name": "压力传感器", "model": "DG2123-C-5", "manufacturer": "森纳士", "keyword": "", "measurement_requirement": ""} |
| API-108 | 精确搜索命中样本记录 #8 | PASS | 3 | 样本 8 命中 record_id=0e9bN9dgwJ，返回 1 条，查询={"category": "力学类", "sub_category": "流量", "equipment_name": "浮子流量计（气体）", "model": "LZB-4DKF、(0.3~3) L/min空气", "manufacturer": "成丰", "keyword": "", "measurement_requirement": ""} |
| API-109 | 精确搜索命中样本记录 #9 | PASS | 3 | 样本 9 命中 record_id=0hkKKZyeK5，返回 1 条，查询={"category": "力学类", "sub_category": "扭矩", "equipment_name": "开口扭矩扳手（预制式）", "model": "CL5N×8D", "manufacturer": "东日", "keyword": "", "measurement_requirement": ""} |
| API-110 | 精确搜索命中样本记录 #10 | PASS | 3 | 样本 10 命中 record_id=0tyW13ZU3o，返回 8 条，查询={"category": "电学类", "sub_category": "电学仪表", "equipment_name": "数显电压表", "model": "HB4740-V/HB5740-V", "manufacturer": "汇邦", "keyword": "", "measurement_requirement": ""} |
| API-111 | 精确搜索命中样本记录 #11 | PASS | 3 | 样本 11 命中 record_id=0yEYxps8KU，返回 1 条，查询={"category": "力学类", "sub_category": "压力", "equipment_name": "不锈钢耐震压力表", "model": "YTFN-60HZT/0~40MPa/1.0级", "manufacturer": "上海精普", "keyword": "", "measurement_requirement": ""} |
| API-112 | 精确搜索命中样本记录 #12 | PASS | 2 | 样本 12 命中 record_id=19qSxx7AI9，返回 1 条，查询={"category": "力学类", "sub_category": "流量", "equipment_name": "浮子流量计（气体）", "model": "LZB-3WB(F)、(0.16~1.6) L/min空气", "manufacturer": "成丰", "keyword": "", "measurement_requirement": ""} |
| API-113 | 精确搜索命中样本记录 #13 | PASS | 2 | 样本 13 命中 record_id=1LMixjTIwA，返回 1 条，查询={"category": "长度类", "sub_category": "指示表", "equipment_name": "数显百分表", "model": "（0~50）mm", "manufacturer": "哈量", "keyword": "", "measurement_requirement": ""} |
| API-114 | 精确搜索命中样本记录 #14 | PASS | 3 | 样本 14 命中 record_id=1M6pR3eCxB，返回 1 条，查询={"category": "力学类", "sub_category": "扭矩", "equipment_name": "扭矩扳手（直读式）", "model": "DB6N4-S", "manufacturer": "东日", "keyword": "", "measurement_requirement": ""} |
| API-115 | 精确搜索命中样本记录 #15 | PASS | 2 | 样本 15 命中 record_id=1TjbB0ekXD，返回 1 条，查询={"category": "温度类", "sub_category": "铂电阻", "equipment_name": "A级铂电阻温度传感器", "model": "STT-C1-A1-B5-C200-D6-M16-E3-L0-PA-T3-S0", "manufacturer": "北京赛亿凌", "keyword": "", "measurement_requirement": ""} |
| API-116 | 精确搜索命中样本记录 #16 | PASS | 3 | 样本 16 命中 record_id=1XZA7I0Qy7，返回 1 条，查询={"category": "长度类", "sub_category": "千分尺", "equipment_name": "内径千分尺", "model": "（75~100）mm", "manufacturer": "青量", "keyword": "", "measurement_requirement": ""} |
| API-117 | 精确搜索命中样本记录 #17 | PASS | 3 | 样本 17 命中 record_id=1n1o8q6niR，返回 1 条，查询={"category": "电学类", "sub_category": "电源", "equipment_name": "直流电源", "model": "QJ3020E", "manufacturer": "宁波久源", "keyword": "", "measurement_requirement": ""} |
| API-118 | 精确搜索命中样本记录 #18 | PASS | 2 | 样本 18 命中 record_id=1x5cOIj2nM，返回 8 条，查询={"category": "电学类", "sub_category": "综合测试仪", "equipment_name": "交流耐电压绝缘测试仪", "model": "AN9632X-1", "manufacturer": "艾诺", "keyword": "", "measurement_requirement": ""} |
| API-119 | 精确搜索命中样本记录 #19 | PASS | 4 | 样本 19 命中 record_id=20EuUCaCyY，返回 1 条，查询={"category": "力学类", "sub_category": "扭矩", "equipment_name": "扭力螺丝刀（预制式）", "model": "CN200LTDK", "manufacturer": "中村", "keyword": "", "measurement_requirement": ""} |
| API-120 | 精确搜索命中样本记录 #20 | PASS | 3 | 样本 20 命中 record_id=22lQ4e4mxL，返回 1 条，查询={"category": "力学类", "sub_category": "压力", "equipment_name": "不锈钢耐震压力表", "model": "YTFN-60HZT/0~4MPa/1.6级", "manufacturer": "上海精普", "keyword": "", "measurement_requirement": ""} |
| API-121 | 精确搜索命中样本记录 #21 | PASS | 4 | 样本 21 命中 record_id=246lK7hDVq，返回 1 条，查询={"category": "力学类", "sub_category": "质量", "equipment_name": "电子天平", "model": "MP12001", "manufacturer": "舜宇恒平", "keyword": "", "measurement_requirement": ""} |
| API-122 | 精确搜索命中样本记录 #22 | PASS | 2 | 样本 22 命中 record_id=26v0bO6OrC，返回 1 条，查询={"category": "力学类", "sub_category": "流量", "equipment_name": "浮子流量计（气体）", "model": "LZB-4DKF、(0.6~6) L/min空气", "manufacturer": "成丰", "keyword": "", "measurement_requirement": ""} |
| API-123 | 精确搜索命中样本记录 #23 | PASS | 3 | 样本 23 命中 record_id=28oG0LWq8J，返回 1 条，查询={"category": "力学类", "sub_category": "压力", "equipment_name": "不锈钢耐震压力表", "model": "YTFN-60HZT/0~40MPa/1.6级", "manufacturer": "上海精普", "keyword": "", "measurement_requirement": ""} |
| API-124 | 精确搜索命中样本记录 #24 | PASS | 4 | 样本 24 命中 record_id=2F2W9zC9pw，返回 1 条，查询={"category": "力学类", "sub_category": "流量", "equipment_name": "浮子流量计（水）", "model": "LZB-6DKF、(60~600) ml/min水", "manufacturer": "成丰", "keyword": "", "measurement_requirement": ""} |
| API-900 | 查询日志接口 | PASS | 6 | /api/search-logs 成功记录本次查询，result_total=1 |
