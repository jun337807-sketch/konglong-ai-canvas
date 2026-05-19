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
const recommendations = [];

function value(name, fallback = '') {
  return (process.env[name] || fallback).trim();
}

function requireVar(name, message) {
  if (!value(name)) errors.push(message || `缺少环境变量 ${name}。`);
}

function warnIfMissing(name, message) {
  if (!value(name)) warnings.push(message || `未配置 ${name}。`);
}

function isEnabled(name) {
  return value(name).toLowerCase() === 'true';
}

function isPlaceholder(rawValue) {
  const v = String(rawValue || '').trim().toLowerCase();
  return !v || ['change-me', 'changeme', 'admin', 'password', '123456', 'your-key', '你的key', '你的图片生成api key', '你的视频月付key'].includes(v);
}

const nodeEnv = value('NODE_ENV', 'production');
const port = value('PORT', '3202');
const defaultAdminPassword = value('DEFAULT_ADMIN_PASSWORD');

if (nodeEnv !== 'production') {
  warnings.push(`NODE_ENV 当前为 "${nodeEnv}"，生产部署建议设置为 "production"。`);
}

if (!/^\d+$/.test(port)) {
  errors.push(`PORT 必须是数字，当前值为 "${port}"。`);
}

if (port === '3201') {
  warnings.push('PORT=3201 可能和你现有的 aivideo/backend 冲突，建议本项目使用 3202。');
}

if (!defaultAdminPassword) {
  errors.push('生产启动必须设置 DEFAULT_ADMIN_PASSWORD。');
} else if (isPlaceholder(defaultAdminPassword)) {
  errors.push('DEFAULT_ADMIN_PASSWORD 过于简单或仍是占位值，请改成强密码。');
} else if (defaultAdminPassword.length < 10) {
  warnings.push('DEFAULT_ADMIN_PASSWORD 少于 10 位，建议使用更长的强密码。');
}

if (!fs.existsSync(distServerPath)) {
  errors.push('未找到 dist/server.cjs，请先运行 npm run build。');
}

fs.mkdirSync(dataDir, { recursive: true });

const tosVars = ['TOS_ACCESS_KEY_ID', 'TOS_ACCESS_KEY_SECRET', 'TOS_BUCKET', 'TOS_REGION', 'TOS_ENDPOINT'];
const missingTos = tosVars.filter(name => !value(name));
if (missingTos.length > 0) {
  warnings.push(`TOS 配置不完整，缺少：${missingTos.join(', ')}；上传、参考素材转存、生成结果转存可能不可用。`);
}

if (isEnabled('ASSET_INGEST_TO_TOS') && missingTos.length > 0) {
  errors.push('ASSET_INGEST_TO_TOS=true 时必须完整配置 TOS。');
}

if (isEnabled('VIDEO_REFERENCE_INGEST_TO_TOS') && missingTos.length > 0) {
  errors.push('VIDEO_REFERENCE_INGEST_TO_TOS=true 时必须完整配置 TOS。');
}

if (!isEnabled('ASSET_INGEST_TO_TOS')) {
  recommendations.push('建议正式给小组使用时设置 ASSET_INGEST_TO_TOS=true，让生成结果落到 TOS，后续复用更稳定。');
}

if (!isEnabled('VIDEO_REFERENCE_INGEST_TO_TOS')) {
  recommendations.push('建议设置 VIDEO_REFERENCE_INGEST_TO_TOS=true，避免视频 API 因中文文件名、临时 URL 或不可访问素材失败。');
}

warnIfMissing('IMAGE_API_BASE_URL', '未配置 IMAGE_API_BASE_URL，图片生成不可用。');
warnIfMissing('IMAGE_API_KEY', '未配置 IMAGE_API_KEY，图片生成不可用。');

const imageProvider = value('IMAGE_PROVIDER', 'openai-compatible');
if (imageProvider !== 'openai-compatible') {
  warnings.push(`IMAGE_PROVIDER 当前为 "${imageProvider}"；你当前第三方图片服务建议使用 openai-compatible。`);
}

warnIfMissing('IMAGE_API_SUBMIT_PATH', '未配置 IMAGE_API_SUBMIT_PATH，文生图路径可能不正确。');
warnIfMissing('IMAGE_API_EDIT_PATH', '未配置 IMAGE_API_EDIT_PATH，图生图/参考图生成可能不可用。');

requireVar('IMAGE_MODEL_KONGLONG_IMAGE', '缺少 IMAGE_MODEL_KONGLONG_IMAGE，前端 KONGLONG Image 无法映射到后端模型。');
requireVar('IMAGE_MODEL_KONGLONG_BANANA_2', '缺少 IMAGE_MODEL_KONGLONG_BANANA_2，前端 KONGLONG Banana 2 无法映射到后端模型。');
requireVar('IMAGE_MODEL_KONGLONG_BANANA_PRO', '缺少 IMAGE_MODEL_KONGLONG_BANANA_PRO，前端 KONGLONG Banana pro 无法映射到后端模型。');

warnIfMissing('VIDEO_API_BASE_URL', '未配置 VIDEO_API_BASE_URL，视频生成不可用。');
warnIfMissing('VIDEO_API_KEY', '未配置 VIDEO_API_KEY，视频生成不可用。');
warnIfMissing('VIDEO_API_SUBMIT_PATH', '未配置 VIDEO_API_SUBMIT_PATH，视频提交路径可能不正确。');
warnIfMissing('VIDEO_API_QUERY_PATH', '未配置 VIDEO_API_QUERY_PATH，视频查询路径可能不正确。');

const videoModel = value('VIDEO_MODEL', 'r_sd2');
if (videoModel !== 'r_sd2' && videoModel !== 'cool:r_sd2') {
  errors.push(`当前月付视频通道只支持 r_sd2 / cool:r_sd2，VIDEO_MODEL 当前为 "${videoModel}"。`);
}

const videoResolution = value('VIDEO_RESOLUTION', '720p').toLowerCase();
if (!['480p', '720p'].includes(videoResolution)) {
  warnings.push(`VIDEO_RESOLUTION 当前为 "${videoResolution}"；月付接口只支持 480p / 720p，运行时会降级到 720p。`);
}

const authMode = value('VIDEO_API_AUTH_MODE', 'monthly-key');
if (!['monthly-key', 'bearer'].includes(authMode)) {
  warnings.push(`VIDEO_API_AUTH_MODE 当前为 "${authMode}"；建议使用 monthly-key 或 bearer。`);
}

for (const warning of warnings) {
  console.warn(`[preflight][warn] ${warning}`);
}

for (const recommendation of recommendations) {
  console.warn(`[preflight][建议] ${recommendation}`);
}

if (errors.length > 0) {
  for (const error of errors) {
    console.error(`[preflight][error] ${error}`);
  }
  process.exit(1);
}

console.log(`[preflight] 检查通过，准备以 NODE_ENV=${nodeEnv} PORT=${port} 启动。`);