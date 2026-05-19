import fs from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';
import Database from 'better-sqlite3';

const dataDir = path.join(process.cwd(), 'data');
const dbPath = path.join(dataDir, 'konglong.sqlite');
const schemaPath = path.join(process.cwd(), 'server', 'db', 'schema.sql');

let sqliteDb: Database.Database | null = null;

export function getSqliteDb() {
  if (sqliteDb) return sqliteDb;

  fs.mkdirSync(dataDir, { recursive: true });
  sqliteDb = new Database(dbPath);
  sqliteDb.pragma('foreign_keys = ON');

  const schema = fs.readFileSync(schemaPath, 'utf8');
  sqliteDb.exec(schema);
  seedDefaultAdmin(sqliteDb);

  return sqliteDb;
}

function seedDefaultAdmin(db: Database.Database) {
  const existingAdmin = db.prepare(`SELECT id FROM users WHERE username = ?`).get('admin');
  if (existingAdmin) return;

  const defaultAdminPassword = getDefaultAdminPassword();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (
      id, username, password_hash, display_name, role, status, last_login_at, created_at, updated_at
    ) VALUES (
      @id, @username, @password_hash, @display_name, @role, @status, @last_login_at, @created_at, @updated_at
    )
  `).run({
    id: randomUUID(),
    username: 'admin',
    password_hash: createHash('sha256').update(defaultAdminPassword).digest('hex'),
    display_name: '系统管理员',
    role: 'admin',
    status: 'active',
    last_login_at: null,
    created_at: now,
    updated_at: now
  });
}

function getDefaultAdminPassword() {
  const configuredPassword = process.env.DEFAULT_ADMIN_PASSWORD?.trim();
  if (configuredPassword) return configuredPassword;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('DEFAULT_ADMIN_PASSWORD is required when NODE_ENV=production.');
  }

  return 'admin';
}
