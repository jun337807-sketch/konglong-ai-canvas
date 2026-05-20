import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const username = process.argv[2] || 'admin';
const password = process.argv[3];

if (!password) {
  console.error('用法：node scripts/reset-admin-password.mjs <用户名> <新密码>');
  console.error('示例：node scripts/reset-admin-password.mjs admin admin123');
  process.exit(1);
}

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'konglong.sqlite');
const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');

fs.mkdirSync(dataDir, { recursive: true });
const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

if (fs.existsSync(schemaPath)) {
  db.exec(fs.readFileSync(schemaPath, 'utf8'));
}

const now = new Date().toISOString();
const passwordHash = createHash('sha256').update(password).digest('hex');
const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);

if (existing) {
  db.prepare(`
    UPDATE users
    SET password_hash = ?,
        status = 'active',
        updated_at = ?
    WHERE username = ?
  `).run(passwordHash, now, username);
  console.log(`✅ 已重置用户 ${username} 的密码，并启用账号。`);
} else {
  db.prepare(`
    INSERT INTO users (
      id, username, password_hash, display_name, role, status, last_login_at, created_at, updated_at
    ) VALUES (
      @id, @username, @password_hash, @display_name, @role, @status, @last_login_at, @created_at, @updated_at
    )
  `).run({
    id: randomUUID(),
    username,
    password_hash: passwordHash,
    display_name: username === 'admin' ? '系统管理员' : username,
    role: username === 'admin' ? 'admin' : 'user',
    status: 'active',
    last_login_at: null,
    created_at: now,
    updated_at: now
  });
  console.log(`✅ 用户 ${username} 不存在，已创建并设置密码。`);
}

db.close();
