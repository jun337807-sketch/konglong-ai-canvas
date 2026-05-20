# 服务器 `.env` 填写说明

这份文档只说明字段怎么填。不要把真实 `.env`、API Key、TOS 密钥提交到 GitHub。

## 最小可启动配置

```bash
PORT=3202
NODE_ENV=production
CORS_ORIGIN=
DEFAULT_ADMIN_PASSWORD=请改成强密码
SESSION_TTL_DAYS=14
```

说明：
- `PORT=3202`：避开你服务器已有的 `3201`。
- `CORS_ORIGIN=`：同源部署时留空即可。
- `DEFAULT_ADMIN_PASSWORD`：首次初始化 SQLite 时创建 `admin` 用户，生产必须填写强密码。

首次登录：

```text
用户名：admin
密码：DEFAULT_ADMIN_PASSWORD 中填写的密码
```

## 火山 TOS 对象存储

用于保存上传文件、生成图片、生成视频，以及视频参考素材的公网化。

```bash
TOS_ACCESS_KEY_ID=你的火山TOS AccessKey ID
TOS_ACCESS_KEY_SECRET=你的火山TOS AccessKey Secret
TOS_BUCKET=konglong
TOS_REGION=cn-beijing
TOS_ENDPOINT=tos-cn-beijing.volces.com
TOS_PUBLIC_BASE_URL=
```

建议：
- 如果没有 CDN 或自定义域名，`TOS_PUBLIC_BASE_URL` 可先留空，系统会使用 `https://桶名.endpoint`。
- Bucket 需要能让第三方视频 API 访问参考素材 URL，否则图生视频/全能参考会失败。

## TOS 转存开关

```bash
ASSET_INGEST_TO_TOS=true
ASSET_INGEST_MAX_BYTES=209715200
VIDEO_REFERENCE_INGEST_TO_TOS=true
```

说明：
- `ASSET_INGEST_TO_TOS=true`：生成结果会尝试转存到 TOS，后续复用更稳定。
- `VIDEO_REFERENCE_INGEST_TO_TOS=true`：提交视频任务前，参考图/视频会先转存到 TOS，并使用安全英文文件名，避免第三方 API 不识别中文文件名或临时地址。
- 初次排错时也可以设为 `false`，但正式给小组使用建议打开。

## 图片生成 API

你的图片服务是第三方 OpenAI 兼容服务，推荐配置：

```bash
IMAGE_PROVIDER=openai-compatible
IMAGE_API_BASE_URL=https://api.duolapi.cn
IMAGE_API_KEY=你的图片生成API Key
IMAGE_API_SUBMIT_PATH=/v1/images/generations
IMAGE_API_EDIT_PATH=/v1/images/edits
IMAGE_RESPONSE_FORMAT=b64_json
IMAGE_MODEL=gpt-image-2
IMAGE_MODEL_KONGLONG_IMAGE=gpt-image-2
IMAGE_MODEL_KONGLONG_BANANA_2=gemini-3.1-flash-image-preview
IMAGE_MODEL_KONGLONG_BANANA_2_2K=gemini-3.1-flash-image-preview-2k
IMAGE_MODEL_KONGLONG_BANANA_2_4K=gemini-3.1-flash-image-preview-4k
IMAGE_MODEL_KONGLONG_BANANA_PRO=gemini-3-pro-image-preview
IMAGE_MODEL_KONGLONG_MJ=mj_imagine
IMAGE_MJ_API_BASE_URL=https://api.duolapi.cn
IMAGE_MJ_SUBMIT_PATH=/mj/submit/imagine
IMAGE_MJ_TASK_PATH_TEMPLATE=/mj/task/{taskId}/fetch
```

前端模型映射：
- `KONGLONG Image` → `IMAGE_MODEL_KONGLONG_IMAGE`
- `KONGLONG Banana 2` → 按清晰度自动选择 `IMAGE_MODEL_KONGLONG_BANANA_2 / IMAGE_MODEL_KONGLONG_BANANA_2_2K / IMAGE_MODEL_KONGLONG_BANANA_2_4K`
- `KONGLONG Banana pro` → `IMAGE_MODEL_KONGLONG_BANANA_PRO`
- `KONGLONG MJ` → `IMAGE_MODEL_KONGLONG_MJ`，并使用 MidJourney Proxy 协议 `/mj/submit/imagine` + `/mj/task/{taskId}/fetch`

没有参考图时走 `/v1/images/generations`；有上游参考图时走 `/v1/images/edits`。

## 视频生成 API

对应前端 `Seedance 2.0 VIP / 全能参考`。

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

说明：
- `VIDEO_API_AUTH_MODE=monthly-key` 使用 `X-Monthly-Key` 请求头。
- 如果服务商要求 Bearer，则改成 `VIDEO_API_AUTH_MODE=bearer`。
- 月付通道只支持 `r_sd2`。
- 当前分辨率只支持 `480p` / `720p`，前端如果选了更高画质，后端会降级为 `720p`。
- 视频失败会返回中文错误，例如 Key 无效、Key 过期、并发满、上游繁忙等。

## 推荐第一阶段 `.env`

```bash
PORT=3202
NODE_ENV=production
CORS_ORIGIN=
DEFAULT_ADMIN_PASSWORD=请改成强密码
SESSION_TTL_DAYS=14

GEMINI_API_KEY=

TOS_ACCESS_KEY_ID=你的火山TOS AK
TOS_ACCESS_KEY_SECRET=你的火山TOS SK
TOS_BUCKET=konglong
TOS_REGION=cn-beijing
TOS_ENDPOINT=tos-cn-beijing.volces.com
TOS_PUBLIC_BASE_URL=

ASSET_INGEST_TO_TOS=true
ASSET_INGEST_MAX_BYTES=209715200
VIDEO_REFERENCE_INGEST_TO_TOS=true

IMAGE_PROVIDER=openai-compatible
IMAGE_API_BASE_URL=https://api.duolapi.cn
IMAGE_API_KEY=你的图片生成API Key
IMAGE_API_SUBMIT_PATH=/v1/images/generations
IMAGE_API_EDIT_PATH=/v1/images/edits
IMAGE_RESPONSE_FORMAT=b64_json
IMAGE_MODEL=gpt-image-2
IMAGE_MODEL_KONGLONG_IMAGE=gpt-image-2
IMAGE_MODEL_KONGLONG_BANANA_2=gemini-3.1-flash-image-preview
IMAGE_MODEL_KONGLONG_BANANA_2_2K=gemini-3.1-flash-image-preview-2k
IMAGE_MODEL_KONGLONG_BANANA_2_4K=gemini-3.1-flash-image-preview-4k
IMAGE_MODEL_KONGLONG_BANANA_PRO=gemini-3-pro-image-preview
IMAGE_MODEL_KONGLONG_MJ=mj_imagine
IMAGE_MJ_API_BASE_URL=https://api.duolapi.cn
IMAGE_MJ_SUBMIT_PATH=/mj/submit/imagine
IMAGE_MJ_TASK_PATH_TEMPLATE=/mj/task/{taskId}/fetch

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

## 常见问题

### 生成视频时提示参考素材不可访问

检查：
- TOS Bucket 是否公开可读，或是否能被第三方视频 API 访问。
- `TOS_PUBLIC_BASE_URL` 是否正确。
- `VIDEO_REFERENCE_INGEST_TO_TOS=true` 是否已设置。

### 视频 API 不识别中文图片名

系统会给视频参考素材使用 `ref_1.jpg`、`ref_2.mp4` 这类安全英文名；如果原始 URL 含中文，建议打开：

```bash
VIDEO_REFERENCE_INGEST_TO_TOS=true
```

### 图片/视频 API 调用失败

优先检查：
- `IMAGE_API_BASE_URL` / `IMAGE_API_KEY`
- `VIDEO_API_BASE_URL` / `VIDEO_API_KEY`
- 服务器是否能访问外部 API
- Key 是否过期、禁用、并发满
