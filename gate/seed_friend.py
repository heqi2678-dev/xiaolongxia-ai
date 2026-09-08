#!/usr/bin/python3
import os
import sys

from server import set_friend_password


def main():
    password = os.environ.get("GATE_FRIEND_PASSWORD", "").strip()
    if not password:
        sys.stderr.write("请用环境变量 GATE_FRIEND_PASSWORD 指定朋友口令，不要写进仓库。\n")
        sys.exit(1)
    set_friend_password(password)
    sys.stdout.write("已写入朋友共用口令\n")


if __name__ == "__main__":
    main()
