# 阿里云轻量服务器部署说明

本文档面向当前目标环境：Alibaba Cloud Linux 3.2104、Node.js 22、Express + SQLite、火山 TOS、小规模团队协作。

如果你只想先部署给内部小组试用，可以优先看：

- [OpenClaw / 阿里云快速部署清单](./openclaw-quickstart.md)
- [服务器 `.env` 填写说明](./env-template-guide.md)

## 1. 推荐端口

当前服务器状态：

- `3201`：已有 `aivideo/backend` 占用
- `3202`：空闲，推荐用于本项目
- `3203`：空闲，备用

建议本项目使用：

```bash
PORT=3202
```

## 2. 通过 OpenClaw / 服务器拉取项目

如果你已经把代码推到 GitHub，例如：

```text
https://github.com/jun337807-sketch/konglong-ai-canvas.git
```

在服务器中执行：

```bash
cd /home/admin/projects
git clone https://github.com/jun337807-sketch/konglong-ai-canvas.git konglong
cd /home/admin/projects/konglong
```

如果目录已存在，更新代码：

```bash
cd /home/admin/projects/konglong
git pull
```

> OpenClaw 如果有 Git 拉取界面，本质也是执行 clone / pull。目标目录建议保持为 `/home/admin/projects/konglong`。

## 3. 安装依赖

```bash
npm install
```

如果服务器内存紧张，可以先关闭不必要进程。当前机器内存约 1.8GB，安装依赖时会有压力，但 Node 22 可以运行本项目。

> 如果安装过程中内存吃紧，优先确保没有其它构建任务在跑；本项目已经移除了未使用的 `sqlite/sqlite3`，只保留 `better-sqlite3`。

## 4. 配置环境变量

复制示例文件：

```bash
cp .env.example .env
nano .env
```

最低需要关注这些字段：

```bash
PORT=3202
NODE_ENV=production
CORS_ORIGIN=
DEFAULT_ADMIN_PASSWORD=请改成强密码
SESSION_TTL_DAYS=14

GEMINI_API_KEY=你的 Gemini Key，如暂时不用可留空

TOS_ACCESS_KEY_ID=你的火山 TOS AK
TOS_ACCESS_KEY_SECRET=你的火山 TOS SK
TOS_BUCKET=konglong
TOS_REGION=cn-beijing
TOS_ENDPOINT=tos-cn-beijing.volces.com
TOS_PUBLIC_BASE_URL=

IMAGE_PROVIDER=openai-compatible
IMAGE_API_BASE_URL=https://api.duolapi.cn
IMAGE_API_KEY=你的图片生成 API Key
IMAGE_API_SUBMIT_PATH=/v1/images/generations

VIDEO_PROVIDER=mjapi-monthly
VIDEO_API_BASE_URL=https://api.mjapi.cc.cd
VIDEO_API_KEY=你的视频月付 Key
VIDEO_API_AUTH_MODE=monthly-key
VIDEO_API_SUBMIT_PATH=/v1/monthly/generate
VIDEO_API_QUERY_PATH=/v1/monthly/task
VIDEO_MODEL=r_sd2
VIDEO_RESOLUTION=720p
VIDEO_WATERMARK=true

ASSET_INGEST_TO_TOS=false
ASSET_INGEST_MAX_BYTES=209715200
```

说明：

- `CORS_ORIGIN` 同源部署可留空；如果前端和后端分开部署，填写前端访问域名。
- `DEFAULT_ADMIN_PASSWORD` 只在首次创建 SQLite 默认 admin 用户时生效；生产环境必须填写，否则服务会拒绝启动。
- `SESSION_TTL_DAYS` 控制登录 session 有效天数。
- `ASSET_INGEST_TO_TOS=false` 表示生成结果先记录外部 URL。
- 如果改成 `true`，生成成功后会尝试把外部图片/视频转存到 TOS；失败不会影响生成结果返回。

## 5. 构建

```bash
npm run build
```

构建产物在：

```text
dist/
```

其中：

- 前端静态资源：`dist/index.html` 与 `dist/assets/*`
- 后端入口：`dist/server.cjs`

## 6. 启动方式 A：直接运行

```bash
npm run start:prod
```

或者显式指定端口：

```bash
PORT=3202 NODE_ENV=production npm run start:prod
```

访问：

```text
http://服务器IP:3202
```

## 7. 启动方式 B：PM2（可选）

如果你愿意安装 PM2：

```bash
npm install -g pm2
```

启动：

```bash
PORT=3202 NODE_ENV=production npm run pm2:start
pm2 save
```

查看：

```bash
pm2 list
pm2 logs konglong-ai-canvas
```

重启：

```bash
npm run pm2:restart
```

停止：

```bash
pm2 stop konglong-ai-canvas
```

说明：

- PM2 配置文件是 `ecosystem.config.cjs`。
- 默认进程名是 `konglong-ai-canvas`。
- 默认端口是 `3202`。
- `max_memory_restart` 设置为 `900M`，适合你当前 1.8GB 内存的小机器。

## 8. SQLite 数据位置

服务启动后会自动创建：

```text
data/konglong.sqlite
```

建议定期备份：

```bash
cp data/konglong.sqlite data/konglong.sqlite.$(date +%Y%m%d%H%M%S).bak
```

## 9. 默认账号

首次启动时会创建：

```text
用户名：admin
密码：来自 DEFAULT_ADMIN_PASSWORD
```

生产环境必须设置强密码；开发环境没有设置时才会回退到 `admin`。

## 10. 常用健康检查

```bash
curl http://127.0.0.1:3202/api/health
```

正常返回：

```json
{"status":"ok"}
```

## 11. 更新部署

```bash
cd /home/admin/projects/konglong
git pull
npm install
npm run build
npm run pm2:restart
```

如果你没有用 PM2，而是直接运行，需要先停止旧进程再启动：

```bash
PORT=3202 NODE_ENV=production npm run start:prod
```

## 12. 一次性部署命令参考

如果你只是想先让内部小组试用，可以按下面顺序执行：

```bash
cd /home/admin/projects
git clone https://github.com/jun337807-sketch/konglong-ai-canvas.git konglong
cd /home/admin/projects/konglong
cp .env.example .env
nano .env
npm install
npm run build
npm run start:prod
```

如果你使用 PM2 守护：

```bash
cd /home/admin/projects/konglong
npm install -g pm2
npm run pm2:start
pm2 save
```

启动前自检可以单独运行：

```bash
npm run prestart:prod
```

它会检查：

- 是否已经构建出 `dist/server.cjs`
- 是否设置了生产管理员密码
- 端口是否为数字
- 是否存在数据目录
- TOS / 图片 API / 视频 API 是否配置完整

## 13. 目前架构边界

当前已经具备：

- React + Vite 前端
- Express 后端
- SQLite 持久化
- 本地用户表
- 登录 session 持久化
- workspace / canvas / assets / tasks / operation_logs
- 火山 TOS 上传服务
- 图片/视频 provider adapter
- 生成任务落库
- 生成结果可选转存 TOS

仍建议后续继续补强：

- 更完整的权限模型
- provider 队列和重试策略
- Nginx 反向代理与 HTTPS
- SQLite 定时备份

