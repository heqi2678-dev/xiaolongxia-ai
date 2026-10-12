#!/usr/bin/env bash
# 铜龙铺货后端部署脚本（在服务器上以具有 sudo 权限的用户执行）
# 用法：bash dropship/deploy/install.sh
set -euo pipefail

REPO_DIR="/home/admin/work/xiaolongxia-ai"
UNIT_SRC="${REPO_DIR}/dropship/deploy/dropship.service"
UNIT_DST="/etc/systemd/system/dropship.service"
ENV_SRC="${REPO_DIR}/dropship/deploy/dropship.env.example"
ENV_DST="/etc/xlx-dropship.env"

# 1. 准备环境变量文件（已存在则不覆盖，避免冲掉真实凭据）
if [ ! -f "${ENV_DST}" ]; then
  sudo cp "${ENV_SRC}" "${ENV_DST}"
  echo "已写入 ${ENV_DST}，请填入令牌与平台凭据后重跑本脚本"
fi

# 2. 安装 systemd 单元
sudo cp "${UNIT_SRC}" "${UNIT_DST}"
sudo systemctl daemon-reload
sudo systemctl enable dropship.service
sudo systemctl restart dropship.service

# 3. 健康检查
sleep 1
curl -fsS "http://127.0.0.1:9150/health" && echo
echo "dropship.service 已启动。查看日志：journalctl -u dropship.service -f"
