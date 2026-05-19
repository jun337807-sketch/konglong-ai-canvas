# 安全审计记录

本文档记录当前 `npm audit` 剩余风险，以及为什么暂时不使用 `npm audit fix --force`。

## 已处理

- 自动更新锁文件中的安全补丁版本：
  - `vite`：`6.4.2`
  - `protobufjs`：`7.6.0`
  - `ws`：`8.20.1`
  - `postcss`：`8.5.15`
  - `@xmldom/xmldom`：`0.8.13`
- 移除未使用的 `sqlite` / `sqlite3` 依赖。
  - 当前后端数据库使用 `better-sqlite3`。
  - 这能减少服务器安装原生依赖时的内存压力。

## 剩余风险

### 1. `@volcengine/tos-sdk` 传递依赖旧 `axios`

来源：

- `@volcengine/tos-sdk`
- `axios`
- `axios-adapter-uniapp`

`npm audit` 显示当前没有自动修复版本。

当前缓解方式：

- TOS SDK 只在后端服务中使用。
- 不把 TOS 密钥暴露给前端。
- 不允许用户任意传入 TOS endpoint / bucket / key。
- 外部生成资源转存 TOS 默认关闭：`ASSET_INGEST_TO_TOS=false`。

后续建议：

- 定期检查火山 TOS SDK 是否发布修复版本。
- 如长期无修复，可考虑改为服务端签名直传或用官方 REST API 自行封装最小能力。

### 2. `pdfjs-dist` 需要跨大版本升级

当前版本用于前端解析 PDF 剧本文档。`npm audit fix --force` 会升级到 `pdfjs-dist@5.x`，属于破坏性升级，可能影响现有 PDF 导入能力。

后续建议：

- 单独开一轮迁移：升级 `pdfjs-dist` 到 5.x，并验证 PDF 导入。
- 或把 PDF 解析迁移到后端隔离进程，限制文件大小和解析时间。

### 3. `xlsx` 暂无 npm 自动修复

当前版本用于前端解析 Excel 剧本文档。`npm audit` 显示无自动修复版本。

后续建议：

- 限制上传文件大小。
- 只允许可信团队成员上传。
- 中期替换为更可控的解析方案，或将 Excel 解析迁移到后端隔离处理。

### 4. `tar` 来自 `pdfjs-dist` 的可选依赖链

来源链条：

```text
pdfjs-dist -> canvas -> @mapbox/node-pre-gyp -> tar
```

该风险与 PDF 依赖升级绑定，建议和 `pdfjs-dist` 5.x 迁移一起处理。

## 当前上线判断

对于小规模团队内网/受控访问场景，可以继续推进部署，但上线前建议至少做到：

1. 设置强 `DEFAULT_ADMIN_PASSWORD`。
2. 只开放必要端口。
3. 不上传不可信来源的 PDF / Excel 文件。
4. 不把 `.env` 和真实密钥提交到 GitHub。
5. 定期备份 `data/konglong.sqlite`。
