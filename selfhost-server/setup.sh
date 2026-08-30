#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

RAW_BASE="https://raw.githubusercontent.com/heqi2678-dev/xiaolongxia-ai/main/selfhost-server"
if [ ! -f server.py ]; then curl -sL "$RAW_BASE/server.py" -o server.py; fi
if [ ! -f requirements.txt ]; then curl -sL "$RAW_BASE/requirements.txt" -o requirements.txt; fi

echo "===== 小龙虾AI 自托管视频服务 一键部署 ====="

MODEL_ID="${MODEL_ID:-Wan-AI/Wan2.2-TI2V-5B-Diffusers}"
MODEL_DIR="${MODEL_DIR:-/root/model}"

echo "[1/4] 安装依赖（AutoDL 镜像已带 torch，会跳过）"
pip install -q -r requirements.txt

echo "[2/4] 下载开源视频模型 Wan2.2（约 10GB，首次约 10-30 分钟）"
if [ -d "$MODEL_DIR" ] && [ -n "$(ls -A "$MODEL_DIR")" ]; then
  echo "  模型已存在，跳过下载"
else
  modelscope download --model "$MODEL_ID" --local_dir "$MODEL_DIR"
fi

echo "[3/4] 配置访问密钥（可选，给其他人用时建议设置）"
if [ -z "$API_TOKEN" ]; then
  read -rp "  设置一个访问密钥（直接回车表示不设）: " API_TOKEN
fi

echo "[4/4] 启动服务 + 获取公网地址"
export MODEL_ID MODEL_DIR API_TOKEN
pkill -f "python server.py" 2>/dev/null || true
nohup python server.py > server.log 2>&1 &
sleep 5
if ! curl -sf http://localhost:8000/health > /dev/null; then
  echo "  服务启动失败，日志如下："
  tail -30 server.log
  exit 1
fi
echo "  服务已启动 ✓"

if [ ! -f ./cloudflared ]; then
  echo "  下载 cloudflared（公网隧道工具，多镜像自动尝试）..."
  dl_ok=0
  for url in \
    "https://ghfast.top/https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" \
    "https://gh-proxy.com/https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" \
    "https://gh.llkk.cc/https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64" \
    "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64"; do
    echo "    尝试 $url"
    if curl -sL --connect-timeout 8 --max-time 180 -o cloudflared "$url" && [ -s cloudflared ]; then
      chmod +x cloudflared
      if ./cloudflared --version > /dev/null 2>&1; then dl_ok=1; echo "  cloudflared 下载成功 ✓"; break; fi
    fi
  done
  if [ "$dl_ok" != "1" ]; then
    echo "  cloudflared 下载失败，稍后重试"
  fi
fi
if [ -x ./cloudflared ]; then
  pkill -f "cloudflared tunnel" 2>/dev/null || true
  nohup ./cloudflared tunnel --url http://localhost:8000 > cloudflared.log 2>&1 &
  echo "  等待隧道建立（最长 25 秒）..."
  PUBLIC_URL=""
  for i in $(seq 1 25); do
    sleep 1
    PUBLIC_URL=$(grep -oE "https://[a-z0-9-]+\.trycloudflare\.com" cloudflared.log | head -1)
    [ -n "$PUBLIC_URL" ] && break
  done
  if [ -n "$PUBLIC_URL" ]; then
    echo "  公网地址: $PUBLIC_URL"
  else
    echo "  隧道地址未就绪，稍后执行: grep trycloudflare cloudflared.log"
  fi
else
  echo "  cloudflared 未就绪，跳过隧道步骤"
fi

echo ""
echo "===== 完成 ====="
echo "填入小龙虾AI 设置 → AI 视频生成 → 自定义服务："
echo "  协议：同步式"
echo "  Base URL：${PUBLIC_URL:-看上面 cloudflared.log}"
echo "  模型：Wan2.2"
if [ -n "$API_TOKEN" ]; then echo "  API Key：$API_TOKEN"; fi
echo "自测: curl -X POST ${PUBLIC_URL:-http://localhost:8000}/api/video -H 'Content-Type: application/json' -d '{\"prompt\":\"一只猫在沙滩奔跑\",\"ratio\":\"16:9\",\"resolution\":\"720p\",\"duration\":5}'"
