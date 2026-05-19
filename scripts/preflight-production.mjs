import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

const rootDir = process.cwd();
const envPath = path.join(rootDir, '.env');
const distServerPath = path.join(rootDir, 'dist', 'server.cjs');
const dataDir = path.join(rootDir, 'data');

if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  console.warn('[preflight] 未找到 .env；将只使用当前 shell / PM2 环境变量。');
}

const errors = [];
const warnings = [];

const nodeEnv = process.env.NODE_ENV || 'production';
const port = process.env.PORT || '3202';
const defaultAdminPassword = process.env.DEFAULT_ADMIN_PASSWORD?.trim();

if (nodeEnv !== 'production') {
  warnings.push(`NODE_ENV 当前为 "${nodeEnv}"，生产部署建议设置为 "production"。`);
}

if (!/^\d+$/.test(port)) {
  errors.push(`PORT 必须是数字，当前值为 "${port}"。`);
}

if (!defaultAdminPassword) {
  errors.push('生产启动必须设置 DEFAULT_ADMIN_PASSWORD。');
} else if (['admin', 'password', '123456', 'change-me', 'changeme'].includes(defaultAdminPassword.toLowerCase())) {
  errors.push('DEFAULT_ADMIN_PASSWORD 过于简单，请改成强密码。');
} else if (defaultAdminPassword.length < 10) {
  warnings.push('DEFAULT_ADMIN_PASSWORD 少于 10 位，建议使用更长的强密码。');
}

if (!fs.existsSync(distServerPath)) {
  errors.push('未找到 dist/server.cjs，请先运行 npm run build。');
}

fs.mkdirSync(dataDir, { recursive: true });

if (!process.env.TOS_ACCESS_KEY_ID || !process.env.TOS_ACCESS_KEY_SECRET) {
  warnings.push('未配置 TOS_ACCESS_KEY_ID / TOS_ACCESS_KEY_SECRET；TOS 上传能力将不可用。');
}

if (!process.env.IMAGE_API_BASE_URL || !process.env.IMAGE_API_KEY) {
  warnings.push('未完整配置图片生成 API；图片生成可能不可用。');
}

if (!process.env.VIDEO_API_KEY) {
  warnings.push('未配置 VIDEO_API_KEY；视频生成可能不可用。');
}

for (const warning of warnings) {
  console.warn(`[preflight][warn] ${warning}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`[preflight][error] ${error}`);
  }
  process.exit(1);
}

console.log(`[preflight] 检查通过，准备以 NODE_ENV=${nodeEnv} PORT=${port} 启动。`);
