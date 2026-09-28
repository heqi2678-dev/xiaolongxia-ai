#!/usr/bin/python3
"""电商工作台 · 真机凭证冒烟（自检工具）。

用途：在配置 1688 / 抖店凭证后，快速确认适配器是否已启用、能否真实调用。

用法（在 gate 目录内运行）：

    python3 -m ecom.smoke_cli
    python3 -m ecom.smoke_cli --offer https://detail.1688.com/offer/123456.html
    python3 -m ecom.smoke_cli --offer 123456

说明：
- 只读取环境变量判断启用状态，绝不打印凭证值；
- 不带 --offer 时只做「启用状态自检」，不发起外网请求；
- 带 --offer 时用 1688 真机适配器拉取单个商品，打印标题与价格做冒烟。
"""
import argparse
import os
import sys

REQUIRED = {
    "1688": ["ECOM_1688_APPKEY", "ECOM_1688_APPSECRET", "ECOM_1688_ACCESS_TOKEN"],
    "taobao": ["ECOM_TAOBAO_APPKEY", "ECOM_TAOBAO_APPSECRET"],
    "douyin": ["ECOM_DOUYIN_APPKEY", "ECOM_DOUYIN_APPSECRET"],
}
OPTIONAL = {
    "1688": ["ECOM_1688_BASE_URL"],
    "taobao": ["ECOM_TAOBAO_BASE_URL"],
    "douyin": ["ECOM_DOUYIN_BASE_URL"],
}


DEFAULT_ENV_FILE = "/home/admin/work/xiaolongxia-gate-data/ecom.env"


def load_env_file(path):
    """从 KEY=VALUE 文本文件载入环境变量；已存在的环境变量不覆盖。"""
    if not path or not os.path.exists(path):
        return False
    with open(path, "r", encoding="utf-8") as handle:
        for raw in handle:
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            key = key.strip()
            value = value.strip().strip("'\"")
            if key and not os.environ.get(key):
                os.environ[key] = value
    return True


def _mark(present):
    return "已配置" if present else "未配置"


def report_env():
    print("== 凭证自检（只显示是否配置，不显示值）==")
    for platform, keys in REQUIRED.items():
        print("[%s]" % platform)
        for key in keys:
            print("  %-26s %s" % (key, _mark(bool(os.environ.get(key)))))
        for key in OPTIONAL.get(platform, []):
            print("  %-26s %s（可选）" % (key, _mark(bool(os.environ.get(key)))))
    print()


def report_adapters():
    from ecom import jobs

    jobs.ensure_adapters()
    from ecom import registry

    sources = registry.REGISTRY.sources()
    targets = registry.REGISTRY.targets()
    print("== 适配器注册状态 ==")
    print("  源(采集): " + ", ".join(sources))
    print("  目标(铺货): " + ", ".join(targets))
    enabled = []
    if "1688" in sources:
        enabled.append("1688")
    if "taobao" in targets:
        enabled.append("taobao")
    if "douyin" in targets:
        enabled.append("douyin")
    if enabled:
        print("真机已启用: " + ", ".join(enabled))
    else:
        print("真机未启用：仅 mock 可用（配置凭证后重启服务即可自动启用）")
    print()


def smoke_taobao_categories():
    from ecom.adapters import target_taobao
    from ecom.registry import EcomError

    print("== 淘宝类目树冒烟 ==")
    adapter = target_taobao.TargetTaobaoAdapter()
    token = os.environ.get("ECOM_TAOBAO_ACCESS_TOKEN") or "app-only"
    try:
        tree = adapter.fetch_category_tree({"shop_auth": {"access_token": token}})
    except EcomError as exc:
        print("失败：%s" % exc)
        return 1
    except Exception as exc:  # noqa: BLE001
        print("失败（未知错误）：%s" % exc)
        return 1
    leaves = _count_leaves(tree)
    print("成功：一级类目 %s 个，叶子类目 %s 个" % (len(tree), leaves))
    return 0


def _count_leaves(nodes):
    total = 0
    for node in nodes or []:
        children = node.get("children") or []
        if children:
            total += _count_leaves(children)
        else:
            total += 1
    return total


def smoke_offer(offer):
    from ecom.adapters import source_1688
    from ecom.registry import EcomError

    print("== 1688 单商品冒烟 ==")
    adapter = source_1688.Source1688Adapter()
    try:
        product = adapter.fetch_product(offer)
    except EcomError as exc:
        print("失败：%s" % exc)
        return 1
    except Exception as exc:  # noqa: BLE001
        print("失败（未知错误）：%s" % exc)
        return 1
    print("成功：")
    print("  offer_id : %s" % product.get("source_id") or product.get("offer_id") or "-")
    print("  title    : %s" % (product.get("title") or "-"))
    print("  price    : %s" % (product.get("price") if product.get("price") is not None else "-"))
    print("  skus     : %s" % len(product.get("skus") or []))
    print("  images   : %s" % len(product.get("images") or []))
    return 0


def main(argv=None):
    parser = argparse.ArgumentParser(description="电商真机凭证冒烟自检")
    parser.add_argument("--offer", help="1688 商品链接或 offerId，用于单商品冒烟")
    parser.add_argument("--taobao", action="store_true", help="拉取淘宝可发布类目树做冒烟")
    parser.add_argument(
        "--env-file",
        default=DEFAULT_ENV_FILE,
        help="环境变量文件路径，默认 %s" % DEFAULT_ENV_FILE,
    )
    args = parser.parse_args(argv)

    loaded = load_env_file(args.env_file)
    print("== 环境变量文件 ==")
    print("  %s（%s）" % (args.env_file, "已载入" if loaded else "不存在，回退到进程环境"))
    print()

    report_env()
    report_adapters()
    if args.offer:
        return smoke_offer(args.offer)
    if args.taobao:
        return smoke_taobao_categories()
    print("提示：加 --offer <1688链接或offerId> 可做一次真实采集冒烟；加 --taobao 可拉取淘宝类目树。")
    return 0


if __name__ == "__main__":
    sys.exit(main())
