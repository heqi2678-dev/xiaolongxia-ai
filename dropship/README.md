# 铜龙铺货后端

铺货系统的服务端：接收浏览器扩展采集的商品、管理货源、保存平台授权、按队列调用各平台官方 API 上架。
只用 Python 3 标准库，风格与 `gate/server.py` 一致。

## 架构

```
dropship/
  server/
    config.py          配置加载（环境变量）
    db.py              SQLite 存储层（products / tasks / tokens）
    models.py          统一商品模型：normalize / validate
    adapters/
      base.py          PlatformAdapter 抽象
      mock.py          本地模拟平台（联调与测试用）
      taobao.py        淘宝/天猫适配器（TOP 签名 + 字段映射 + 发布）
    auth.py            授权中心：token 存储 + OAuth 授权码流程 + 自动刷新
    storage.py         图片本地归档（内容哈希去重、路径穿越防护）
    queue.py           发布任务队列：限频 / 重试 / 失败隔离
    api.py             HTTP 路由（纯分发，便于单测）
    app.py             服务入口 + 队列线程
  deploy/              systemd 单元 / 环境变量样例 / 安装脚本
  test_dropship.py     单元测试（不联网）
  extension/           浏览器扩展
```

数据流：**扩展采集 → `POST /api/collect` 入库 → 前端铺货板块选平台发布 → 队列消费 → 平台官方 API 上架**。
采集结果必须先经「AI 加工 + 平台类目映射」，未映射的商品会被校验拦下。

## 运行

```bash
# 从仓库根目录运行
python3 -m dropship.server.app
```

按环境变量配置：

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `DROPSHIP_HOST` | `127.0.0.1` | 监听地址 |
| `DROPSHIP_PORT` | `9150` | 监听端口 |
| `DROPSHIP_DATA_DIR` | `/home/admin/work/dropship-data` | 数据目录 |
| `DROPSHIP_EXT_TOKEN` | 空 | 扩展访问令牌；非空时 `/api/*` 需 `Authorization: Bearer <token>` |
| `DROPSHIP_RATE_PER_MIN` | `30` | 每平台每分钟发布上限 |
| `DROPSHIP_MAX_RETRIES` | `3` | 失败重试次数 |
| `DROPSHIP_DRY_RUN` | `1` | 为 `1` 时不真正调用平台 API（联调用） |
| `DROPSHIP_TAOBAO_APP_KEY` | 空 | 淘宝自用型应用 App Key |
| `DROPSHIP_TAOBAO_APP_SECRET` | 空 | 淘宝自用型应用 App Secret |
| `DROPSHIP_TIKTOK_APP_KEY` | 空 | TikTok Shop 应用 Key |
| `DROPSHIP_TIKTOK_APP_SECRET` | 空 | TikTok Shop 应用 Secret |

## HTTP API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/health` | 健康检查 + 适配器/待办数 |
| POST | `/api/collect` | 采集入库（统一商品原始结构） |
| GET | `/api/products?q=&source=&limit=&offset=` | 货源库列表（关键词 / 来源筛选） |
| GET/PUT/DELETE | `/api/products/{id}` | 读取 / 编辑 / 删除 |
| POST | `/api/products/{id}/publish` | 单个上架 |
| POST | `/api/publish` | 批量上架 `{productIds, platform}` |
| GET | `/api/tasks` / `/api/tasks/{id}` | 发布任务查询 |
| POST | `/api/tasks/{id}/retry` | 失败任务重新排队 |
| POST | `/api/images/localize` | 归档商品图片到本地 `{productId}` |
| GET | `/api/images/{name}` | 读取已归档图片（二进制） |
| GET | `/api/adapters/{platform}/categories` | 平台类目树（`?parent=`） |
| GET | `/api/adapters/{platform}/attributes` | 平台类目属性（`?cid=`） |
| GET | `/api/platforms` | 平台列表 + 授权状态 |
| GET | `/api/auth/{platform}/authorize` | 取授权链接 |
| GET | `/api/auth/{platform}/callback` | OAuth 回调（换 token） |
| POST | `/api/auth/{platform}/revoke` | 撤销授权 |

## 测试

```bash
python3 -m unittest dropship.test_dropship
```

## 部署

部署产物在 `dropship/deploy/`：

```bash
# 在服务器仓库根目录执行
bash dropship/deploy/install.sh
```

脚本会安装 `dropship.service`（指向 `python3 -m dropship.server.app`，绑定 `127.0.0.1:9150`，
与 `xiaolongxia-gate.service` 并存），并把环境变量样例写到 `/etc/xlx-dropship.env`。
首次执行后请编辑该文件填入令牌与平台凭据，再重跑脚本。

真实发布前先在 `DROPSHIP_DRY_RUN=1` 下联调，授权到位后再置 `0`。
后端只监听回环地址，扩展在**用户本机**运行：

- 后端与浏览器同机：扩展直接填 `http://127.0.0.1:9150`
- 后端在远程服务器：通过 SSH 端口转发把服务器 9150 映射到本机，扩展仍填 `http://127.0.0.1:9150`
