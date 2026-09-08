#!/usr/bin/python3
import os
import sys

from server import upsert_user


def main():
    password = (
        os.environ.get("GATE_OWNER_PASSWORD", "").strip()
        or os.environ.get("XIAOLONGXIA_GATE_PASS", "").strip()
    )
    if not password:
        sys.stderr.write("请用环境变量 GATE_OWNER_PASSWORD 指定主人口令，不要写进仓库。\n")
        sys.exit(1)
    upsert_user("zhuren", password, role="owner")
    sys.stdout.write("已写入主人账号 zhuren\n")


if __name__ == "__main__":
    main()
