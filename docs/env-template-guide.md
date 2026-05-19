# 服务器 `.env` 填写说明

这份文档只说明字段怎么填。不要把真实 `.env` 提交到 GitHub，也不需要把真实密钥发给任何人。

## 最小可启动配置

内部小组先试跑时，至少填写：

```bash
PORT=3202
NODE_ENV=production
CORS_ORIGIN=
DEFAULT_ADMIN_PASSWORD=换成你的强密码
SESSION_TTL_DAYS=14
```

说明：

- `PORT=3202`：避开你服务器上已有的 `3201`。
- `CORS_ORIGIN=`：同源部署时留空即可。
- `DEFAULT_ADMIN_PASSWORD`：首次启动创建 `admin` 用户时使用。生产环境不允许留空。

首次登录：

```text
用户名：admin
密码：DEFAULT_ADMIN_PASSWORD 中填写的密码
```

## 火山 TOS 对象存储

用于保存上传文件、生成图片、生成视频等资产。

```bash
TOS_ACCESS_KEY_ID=你的火山TOS AccessKey ID
TOS_ACCESS_KEY_SECRET=你的火山TOS AccessKey Secret
TOS_BUCKET=你的bucket名称
TOS_REGION=cn-beijing
TOS_ENDPOINT=tos-cn-beijing.volces.com
TOS_PUBLIC_BASE_URL=
```

填写建议：

- `TOS_ACCESS_KEY_ID` / `TOS_ACCESS_KEY_SECRET`：只填在服务器 `.env`，不要放前端。
- `TOS_BUCKET`：填写你在火山对象存储里创建的 bucket 名。
- `TOS_REGION`：按 bucket 所在地域填写，例如北京通常是 `cn-beijing`。
- `TOS_ENDPOINT`：北京区域通常是 `tos-cn-beijing.volces.com`。
- `TOS_PUBLIC_BASE_URL`：
  - 如果你有 CDN 或自定义公开域名，填完整地址，例如 `https://cdn.example.com`
  - 如果暂时没有，可以先留空。

相关开关：

```bash
ASSET_INGEST_TO_TOS=false
ASSET_INGEST_MAX_BYTES=209715200
```

- `ASSET_INGEST_TO_TOS=false`：生成结果先记录外部 URL，最适合第一阶段试跑。
- `ASSET_INGEST_TO_TOS=true`：生成结果会尝试转存到 TOS，适合确认 TOS 配置无误后开启。
- `ASSET_INGEST_MAX_BYTES`：单个外部生成文件最大转存体积，默认约 200MB。

## 图片生成 API

后端统一入口是：

```text
POST /api/generation/image
```

服务器 `.env` 中填写：

```bash
IMAGE_PROVIDER=external-image
IMAGE_API_BASE_URL=你的图片生成API基础地址
IMAGE_API_KEY=你的图片生成API Key
IMAGE_API_SUBMIT_PATH=/v1/images/generations
```

怎么判断怎么填：

- 如果你的图片 API 完整地址是：

```text
https://api.example.com/v1/images/generations
```

则填写：

```bash
IMAGE_API_BASE_URL=https://api.example.com
IMAGE_API_SUBMIT_PATH=/v1/images/generations
```

- 如果你的图片 API 完整地址是：

```text
https://image.example.com/generate
```

则填写：

```bash
IMAGE_API_BASE_URL=https://image.example.com
IMAGE_API_SUBMIT_PATH=/generate
```

注意：

- `IMAGE_API_KEY` 只放服务器。
- 如果图片 API 的请求/响应格式不是 OpenAI 风格，后续只需要改 `server/providers/imageProvider.ts`，不需要重写画布。

## 视频生成 API

后端统一入口是：

```text
POST /api/generation/video
GET  /api/generation/video/:providerTaskId
```

火山 Ark / Seedance 风格配置：

```bash
VIDEO_PROVIDER=volcengine-seedance
VIDEO_API_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VIDEO_API_KEY=你的视频生成API Key
VIDEO_MODEL=doubao-seedance-2-0-260128
VIDEO_WATERMARK=true
```

说明：

- `VIDEO_API_KEY`：填写你的视频生成服务 Key。
- `VIDEO_MODEL`：填写实际使用的视频模型名。
- `VIDEO_WATERMARK=true`：是否带水印，按团队需求调整。

如果你的视频 API 不是火山 Ark / Seedance：

- 先保留画布前端不动。
- 后续只改 `server/providers/videoProvider.ts` 适配请求和查询格式。
- 任务仍会落入 `tasks`，操作记录仍会进入 `operation_logs`。

## Gemini / AI Studio 兼容字段

```bash
GEMINI_API_KEY=
```

如果当前阶段主要走你自己的图片/视频 API，可以先留空。  
如果后续某些 AI Studio 原始能力仍需要 Gemini，再补上。

## 推荐第一阶段 `.env`

内部试跑建议先这样：

```bash
PORT=3202
NODE_ENV=production
CORS_ORIGIN=
DEFAULT_ADMIN_PASSWORD=换成你的强密码
SESSION_TTL_DAYS=14

GEMINI_API_KEY=

TOS_ACCESS_KEY_ID=你的火山TOS AK
TOS_ACCESS_KEY_SECRET=你的火山TOS SK
TOS_BUCKET=你的bucket名称
TOS_REGION=cn-beijing
TOS_ENDPOINT=tos-cn-beijing.volces.com
TOS_PUBLIC_BASE_URL=

ASSET_INGEST_TO_TOS=false
ASSET_INGEST_MAX_BYTES=209715200

IMAGE_PROVIDER=external-image
IMAGE_API_BASE_URL=你的图片生成API基础地址
IMAGE_API_KEY=你的图片生成API Key
IMAGE_API_SUBMIT_PATH=你的图片生成提交路径

VIDEO_PROVIDER=volcengine-seedance
VIDEO_API_BASE_URL=https://ark.cn-beijing.volces.com/api/v3
VIDEO_API_KEY=你的视频生成API Key
VIDEO_MODEL=doubao-seedance-2-0-260128
VIDEO_WATERMARK=true
```

## 常见错误

### 启动时报 `DEFAULT_ADMIN_PASSWORD is required`

说明生产环境没有设置管理员初始密码。  
解决：在 `.env` 中填写：

```bash
DEFAULT_ADMIN_PASSWORD=你的强密码
```

### 页面能打开，但图片/视频生成失败

优先检查：

- `IMAGE_API_BASE_URL`
- `IMAGE_API_KEY`
- `IMAGE_API_SUBMIT_PATH`
- `VIDEO_API_BASE_URL`
- `VIDEO_API_KEY`
- 服务器是否能访问外部 API

### 资产上传失败

优先检查：

- `TOS_ACCESS_KEY_ID`
- `TOS_ACCESS_KEY_SECRET`
- `TOS_BUCKET`
- `TOS_REGION`
- `TOS_ENDPOINT`

### 生成成功，但没有转存到 TOS

检查：

```bash
ASSET_INGEST_TO_TOS=false
```

如果它是 `false`，这是正常行为。确认 TOS 可用后再改成：

```bash
ASSET_INGEST_TO_TOS=true
```
