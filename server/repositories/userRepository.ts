import { randomUUID } from 'crypto';
import { getSqliteDb } from '../db/sqlite.js';

export interface DbUser {
  id: string;
  username: string;
  password_hash: string;
  display_name: string;
  role: 'admin' | 'user';
  status: 'active' | 'disabled' | 'deleted';
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

const USER_SELECT = `
  SELECT id, username, password_hash, display_name, role, status, last_login_at, created_at, updated_at
  FROM users
`;

export function listUsers(): DbUser[] {
  const db = getSqliteDb();
  return db.prepare(`
    ${USER_SELECT}
    WHERE status != 'deleted'
    ORDER BY created_at ASC
  `).all() as DbUser[];
}

export function findUserById(id: string): DbUser | undefined {
  const db = getSqliteDb();
  return db.prepare(`
    ${USER_SELECT}
    WHERE id = ? AND status != 'deleted'
  `).get(id) as DbUser | undefined;
}

export function findUserByUsername(username: string): DbUser | undefined {
  const db = getSqliteDb();
  return db.prepare(`
    ${USER_SELECT}
    WHERE username = ? AND status != 'deleted'
  `).get(username) as DbUser | undefined;
}

export function resolveActorUserId(actor?: string | null): string {
  const db = getSqliteDb();
  const candidate = (actor || '').trim();

  if (candidate) {
    const byId = findUserById(candidate);
    if (byId) return byId.id;

    const byUsername = findUserByUsername(candidate);
    if (byUsername) return byUsername.id;
  }

  const admin = findUserByUsername('admin');
  if (admin) return admin.id;

  const firstUser = db.prepare(`
    ${USER_SELECT}
    WHERE status != 'deleted'
    ORDER BY created_at ASC
    LIMIT 1
  `).get() as DbUser | undefined;

  if (firstUser) return firstUser.id;
  throw new Error('No active user exists for actor resolution');
}

export function createUser(input: {
  username: string;
  passwordHash: string;
  displayName: string;
  role?: 'admin' | 'user';
}): DbUser {
  const db = getSqliteDb();
  const now = new Date().toISOString();
  const user: DbUser = {
    id: randomUUID(),
    username: input.username,
    password_hash: input.passwordHash,
    display_name: input.displayName,
    role: input.role || 'user',
    status: 'active',
    last_login_at: null,
    created_at: now,
    updated_at: now
  };

  db.prepare(`
    INSERT INTO users (
      id, username, password_hash, display_name, role, status, last_login_at, created_at, updated_at
    ) VALUES (
      @id, @username, @password_hash, @display_name, @role, @status, @last_login_at, @created_at, @updated_at
    )
  `).run(user);

  return user;
}

export function updateUser(
  id: string,
  updates: Partial<Pick<DbUser, 'display_name' | 'role' | 'status' | 'last_login_at' | 'password_hash'>>
): DbUser | undefined {
  const db = getSqliteDb();
  const existing = db.prepare(`SELECT * FROM users WHERE id = ?`).get(id) as DbUser | undefined;
  if (!existing) return undefined;

  const updated: DbUser = {
    ...existing,
    ...updates,
    updated_at: new Date().toISOString()
  };

  db.prepare(`
    UPDATE users
    SET display_name = @display_name,
        password_hash = @password_hash,
        role = @role,
        status = @status,
        last_login_at = @last_login_at,
        updated_at = @updated_at
    WHERE id = @id
  `).run(updated);

  return updated;
}
