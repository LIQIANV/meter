"""从钉钉多维表分页同步设备数据到本地 JSON 文件。"""

import logging
import sys
from app.services.sync_service import configure_sync_logging, sync_tools_data


def main() -> int:
    configure_sync_logging()
    try:
        sync_tools_data()
        return 0
    except Exception as exc:
        logging.exception("同步失败: %s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())