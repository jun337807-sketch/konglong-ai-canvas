# OpenClaw / 阿里云快速部署清单

这份清单给内部小组试用优先，不追求应用商城级别流程。目标路径建议：

```text
/home/admin/projects/konglong
```

## 1. 拉取项目

如果服务器还没有项目目录：

```bash
cd /home/admin/projects
git clone https://github.com/jun337807-sketch/konglong.git konglong
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

字段填写说明见：

- [服务器 `.env` 填写说明](./env-template-guide.md)

最低必填：

```bash
PORT=3202
NODE_ENV=production
DEFAULT_ADMIN_PASSWORD=换成你的强密码
SESSION_TTL_DAYS=14
```

## 3. 配置三个外部 API

### 火山 TOS

```bash
TOS_ACCESS_KEY_ID=你的火山TOS AK
TOS_ACCESS_KEY_SECRET=你的火山TOS SK
TOS_BUCKET=你的bucket名称
TOS_REGION=cn-beijing
TOS_ENDPOINT=tos-cn-beijing.volces.com
TOS_PUBLIC_BASE_URL=
```

如果你还没有绑定 CDN 或公开域名，`TOS_PUBLIC_BASE_URL` 可以先留空。

### 图片生成 API

```bash
IMAGE_PROVIDER=external-image
IMAGE_API_BASE_URL=你的图片生成API基础地址
IMAGE_API_KEY=你的图片生成API Key
IMAGE_API_SUBMIT_PATH=/v1/images/generations
```

如果你的图片生成接口路径不是 `/v1/images/generations`，只改 `IMAGE_API_SUBMIT_PATH`。

### 视频生成 API

```bash
VIDEO_PROVIDER=volcengine-seedance
VIDEO_API_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VIDEO_API_KEY=你的视频生成API Key
VIDEO_MODEL=doubao-seedance-2-0-260128
VIDEO_WATERMARK=true
```

如果你的视频 API 不是火山 Ark / Seedance，后续只需要调整 provider adapter，不需要重写画布。

## 4. 安装、构建、检查

```bash
npm install
npm run build
npm run prestart:prod
```

自检通过会看到类似：

```text
[preflight] 检查通过，准备以 NODE_ENV=production PORT=3202 启动。
```

## 5. 启动方式 A：直接启动

适合第一次试跑：

```bash
npm run start:prod
```

浏览器访问：

```text
http://你的服务器IP:3202
```

健康检查：

```bash
curl http://127.0.0.1:3202/api/health
```

## 6. 启动方式 B：PM2 守护

适合给小组长期使用：

```bash
npm install -g pm2
npm run pm2:start
pm2 save
```

查看状态：

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

## 9. 当前推荐部署判断

内部小组使用可以先部署试跑。上线前最低确认：

- `.env` 没有提交到 GitHub
- `DEFAULT_ADMIN_PASSWORD` 不是默认值
- 服务器安全组开放了 `3202`
- `3201` 继续留给原来的 `aivideo/backend`
- PDF / Excel 只给可信成员上传
