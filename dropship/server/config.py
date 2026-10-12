#!/usr/bin/python3
"""铺货后端配置。全部走环境变量，默认值面向生产部署目录。"""
import os
from pathlib import Path


def load_config(env=None):
    env = os.environ if env is None else env
    base = Path(env.get("DROPSHIP_DATA_DIR", "/home/admin/work/dropship-data"))
    return {
        "host": env.get("DROPSHIP_HOST", "127.0.0.1"),
        "port": int(env.get("DROPSHIP_PORT", "9150")),
        "data_dir": str(base),
        "db_path": str(base / "dropship.sqlite3"),
        "images_dir": str(base / "images"),
        "ext_token": env.get("DROPSHIP_EXT_TOKEN", ""),
        "rate_per_min": int(env.get("DROPSHIP_RATE_PER_MIN", "30")),
        "max_retries": int(env.get("DROPSHIP_MAX_RETRIES", "3")),
        "oauth_redirect": env.get("DROPSHIP_OAUTH_REDIRECT", ""),
        "dry_run": env.get("DROPSHIP_DRY_RUN", "1") not in ("0", "false", "False"),
        "app_creds": {
            "taobao": {
                "appKey": env.get("DROPSHIP_TAOBAO_APP_KEY", ""),
                "appSecret": env.get("DROPSHIP_TAOBAO_APP_SECRET", ""),
            },
            "tiktok": {
                "appKey": env.get("DROPSHIP_TIKTOK_APP_KEY", ""),
                "appSecret": env.get("DROPSHIP_TIKTOK_APP_SECRET", ""),
            },
        },
    }


def ensure_dirs(cfg):
    Path(cfg["data_dir"]).mkdir(parents=True, exist_ok=True)
    Path(cfg["images_dir"]).mkdir(parents=True, exist_ok=True)
    return cfg
