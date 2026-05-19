# OpenClaw / 阿里云快速部署清单

目标目录建议：

```text
/home/admin/projects/konglong
```

## 1. 拉取项目

```bash
cd /home/admin/projects
git clone https://github.com/jun337807-sketch/konglong-ai-canvas.git konglong
cd /home/admin/projects/konglong
```

如果已经拉取过：

```bash
cd /home/admin/projects/konglong
git pull
```

## 2. 创建 `.env`

```bash
cp .env.example .env
nano .env
```

字段说明见：

- [服务器 `.env` 填写说明](./env-template-guide.md)

最低必填：

```bash
PORT=3202
NODE_ENV=production
DEFAULT_ADMIN_PASSWORD=请改成强密码
SESSION_TTL_DAYS=14
```

## 3. 配置三个外部能力

### 火山 TOS

```bash
TOS_ACCESS_KEY_ID=你的火山TOS AK
TOS_ACCESS_KEY_SECRET=你的火山TOS SK
TOS_BUCKET=konglong
TOS_REGION=cn-beijing
TOS_ENDPOINT=tos-cn-beijing.volces.com
TOS_PUBLIC_BASE_URL=
ASSET_INGEST_TO_TOS=true
VIDEO_REFERENCE_INGEST_TO_TOS=true
```

### 图片生成 API

```bash
IMAGE_PROVIDER=openai-compatible
IMAGE_API_BASE_URL=https://api.duolapi.cn
IMAGE_API_KEY=你的图片生成API Key
IMAGE_API_SUBMIT_PATH=/v1/images/generations
IMAGE_API_EDIT_PATH=/v1/images/edits
IMAGE_RESPONSE_FORMAT=b64_json
IMAGE_MODEL_KONGLONG_IMAGE=gpt-image-2-fast
IMAGE_MODEL_KONGLONG_BANANA_2=gemini-3.1-flash-image-preview-4k
IMAGE_MODEL_KONGLONG_BANANA_PRO=gemini-3-pro-image-preview
```

### 视频生成 API

```bash
VIDEO_PROVIDER=mjapi-monthly
VIDEO_API_BASE_URL=https://api.mjapi.cc.cd
VIDEO_API_KEY=你的视频月付Key
VIDEO_API_AUTH_MODE=monthly-key
VIDEO_API_SUBMIT_PATH=/v1/monthly/generate
VIDEO_API_QUERY_PATH=/v1/monthly/task
VIDEO_MODEL=r_sd2
VIDEO_RESOLUTION=720p
VIDEO_WATERMARK=true
VIDEO_REFERENCE_INGEST_TO_TOS=true
```

说明：视频节点的全能参考会把上游图片/视频转成 `files` 提交；为避免中文文件名识别失败，建议保持 `VIDEO_REFERENCE_INGEST_TO_TOS=true`。

## 4. 安装、构建、自检

```bash
npm install
npm run build
npm run prestart:prod
```

## 5. 启动

第一次试跑：

```bash
npm run start:prod
```

访问：

```text
http://服务器IP:3202
```

健康检查：

```bash
curl http://127.0.0.1:3202/api/health
```

## 6. PM2 守护运行

```bash
npm install -g pm2
npm run pm2:start
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

## 7. 更新项目

```bash
cd /home/admin/projects/konglong
git pull
npm install
npm run build
npm run pm2:restart
```

## 8. 数据备份

SQLite 数据库位置：

```text
data/konglong.sqlite
```

手动备份：

```bash
cp data/konglong.sqlite data/konglong.sqlite.$(date +%Y%m%d%H%M%S).bak
```

## 9. 上线前确认

- `.env` 没有提交到 GitHub
- `DEFAULT_ADMIN_PASSWORD` 不是默认值
- 安全组开放了 `3202`
- `3201` 留给原来的 `aivideo/backend`
- TOS Bucket 的公开访问策略能让第三方视频 API 拉取参考素材