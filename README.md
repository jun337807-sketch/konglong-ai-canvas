# 恐龙 AI 无限画布

这是从 Google AI Studio Build 导出的 AI 视频创作画布项目。当前目标不是重写 UI，而是在保留现有前端交互的基础上，逐步迁移到可自部署的 React + Express + SQLite/PostgreSQL 架构。

## 当前能力

- React + Vite 前端
- Express 后端
- SQLite 本地持久化
- 本地账号登录与 session
- 工作区、画布文档、资产、任务、操作日志
- 图片 / 视频生成 provider adapter
- 火山引擎 TOS 对象存储接入边界

## 本地运行

```bash
npm install
cp .env.example .env
npm run dev
```

开发环境如果没有设置 `DEFAULT_ADMIN_PASSWORD`，首次初始化会创建 `admin / admin`；生产环境必须在 `.env` 中显式设置 `DEFAULT_ADMIN_PASSWORD`。

## 阿里云 / OpenClaw 部署

建议先看极简清单：

- [docs/openclaw-quickstart.md](docs/openclaw-quickstart.md)
- [docs/env-template-guide.md](docs/env-template-guide.md)

完整部署说明：

- [docs/deploy-alibaba.md](docs/deploy-alibaba.md)
- [docs/security-notes.md](docs/security-notes.md)

你的服务器当前建议使用 `3202` 或 `3203`，避免占用已有 `aivideo/backend` 的 `3201`。

## 重要环境变量

- `PORT`：后端监听端口，建议 `3202`
- `NODE_ENV`：生产部署设置为 `production`
- `CORS_ORIGIN`：同源部署可留空；前后端分域时填写前端域名
- `DEFAULT_ADMIN_PASSWORD`：生产环境必填
- `SESSION_TTL_DAYS`：登录 session 有效天数
- `TOS_ACCESS_KEY_ID` / `TOS_ACCESS_KEY_SECRET`：火山 TOS 密钥
- `IMAGE_API_BASE_URL` / `IMAGE_API_KEY`：图片生成服务
- `VIDEO_API_BASE_URL` / `VIDEO_API_KEY`：视频生成服务

不要把真实密钥提交到 GitHub。
