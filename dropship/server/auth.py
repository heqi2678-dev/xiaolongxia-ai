#!/usr/bin/python3
"""授权中心：保存各平台店铺授权令牌，并生成 OAuth 授权入口。

自用型应用走标准授权码流程：用户在平台完成授权 → 回调带 code → 后端换取
access_token 并落库。真实换取需要网络，dry_run 下只返回占位结果。
"""
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone


class AuthCenter:
    def __init__(self, store, dry_run=True, http=None):
        self.store = store
        self.dry_run = dry_run
        self._http = http or self._http_post

    def save_token(self, platform, token):
        token = dict(token or {})
        token.setdefault("updatedAt", datetime.now(timezone.utc).replace(microsecond=0).isoformat())
        expires_in = token.get("expiresIn")
        if expires_in and not token.get("expiresAt"):
            token["expiresAt"] = int(time.time()) + int(expires_in)
        return self.store.set_token(platform, token)

    def get_token(self, platform):
        return self.store.get_token(platform)

    def is_authorized(self, platform):
        token = self.get_token(platform)
        if not token:
            return False
        exp = token.get("expiresAt")
        if exp and int(exp) < int(time.time()):
            return False
        return bool(token.get("accessToken"))

    def list_authorized(self):
        return [t["platform"] for t in self.store.list_tokens() if self.is_authorized(t["platform"])]

    def revoke(self, platform):
        return self.store.delete_token(platform)

    @staticmethod
    def _http_post(url, data):
        req = urllib.request.Request(url, data=urllib.parse.urlencode(data).encode("utf-8"))
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode("utf-8"))

    def refresh(self, platform, creds=None):
        """用 refresh_token 换新的 access_token。dry_run 下只顺延过期时间。"""
        creds = creds or {}
        token = self.get_token(platform)
        if not token:
            raise ValueError("未授权: %s" % platform)
        if self.dry_run:
            token["expiresAt"] = int(time.time()) + 3600
            return self.save_token(platform, token)
        if platform == "taobao":
            body = self._http(
                "https://oauth.taobao.com/token",
                {
                    "grant_type": "refresh_token",
                    "refresh_token": token.get("refreshToken", ""),
                    "client_id": creds.get("appKey", ""),
                    "client_secret": creds.get("appSecret", ""),
                },
            )
            return self.save_token(platform, {
                "accessToken": body.get("access_token"),
                "refreshToken": body.get("refresh_token") or token.get("refreshToken"),
                "expiresIn": body.get("expires_in"),
                "shop": token.get("shop", ""),
            })
        raise ValueError("平台 %s 的刷新尚未实现" % platform)

    def ensure_valid(self, platform, creds=None, skew=300):
        """确保令牌有效：临期（默认 300s 内）自动刷新。返回 token 或 None。"""
        token = self.get_token(platform)
        if not token:
            return None
        exp = token.get("expiresAt")
        if exp and int(exp) - int(time.time()) <= skew:
            try:
                return self.refresh(platform, creds)
            except Exception:
                return token
        return token

    def authorize_url(self, platform, redirect_uri, state, creds=None):
        creds = creds or {}
        if platform == "taobao":
            base = "https://oauth.taobao.com/authorize"
            q = {
                "response_type": "code",
                "client_id": creds.get("appKey", ""),
                "redirect_uri": redirect_uri,
                "state": state,
                "view": "web",
            }
        elif platform == "tiktok":
            base = "https://auth.tiktok-shops.com/oauth/authorize"
            q = {
                "app_key": creds.get("appKey", ""),
                "redirect_uri": redirect_uri,
                "state": state,
            }
        else:
            raise ValueError("未知平台: %s" % platform)
        return "%s?%s" % (base, urllib.parse.urlencode(q))

    def exchange_code(self, platform, code, redirect_uri, creds=None):
        creds = creds or {}
        if self.dry_run:
            return self.save_token(
                platform,
                {
                    "accessToken": "dry-" + (code or "")[:8],
                    "refreshToken": "dry-refresh",
                    "expiresIn": 3600,
                    "shop": creds.get("shop", "dry-shop"),
                    "mode": "dry_run",
                },
            )
        if platform == "taobao":
            data = urllib.parse.urlencode(
                {
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": creds.get("appKey", ""),
                    "client_secret": creds.get("appSecret", ""),
                    "redirect_uri": redirect_uri,
                }
            ).encode("utf-8")
            req = urllib.request.Request("https://oauth.taobao.com/token", data=data)
            with urllib.request.urlopen(req, timeout=15) as resp:
                body = json.loads(resp.read().decode("utf-8"))
            token = {
                "accessToken": body.get("access_token"),
                "refreshToken": body.get("refresh_token"),
                "expiresIn": body.get("expires_in"),
                "shop": body.get("taobao_user_nick") or creds.get("shop", ""),
            }
            return self.save_token(platform, token)
        raise ValueError("平台 %s 的 code 换取尚未实现" % platform)
