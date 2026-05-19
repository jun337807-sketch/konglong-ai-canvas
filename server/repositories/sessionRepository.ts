import { getSqliteDb } from '../db/sqlite.js';
import { DbUser } from './userRepository.js';

export interface DbSession {
  token: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

const DEFAULT_SESSION_DAYS = 14;

function getSessionTtlMs() {
  const days = Number(process.env.SESSION_TTL_DAYS || DEFAULT_SESSION_DAYS);
  return days * 24 * 60 * 60 * 1000;
}

export function createSession(input: { token: string; userId: string }): DbSession {
  const now = new Date();
  const session: DbSession = {
    token: input.token,
    user_id: input.userId,
    expires_at: new Date(now.getTime() + getSessionTtlMs()).toISOString(),
    created_at: now.toISOString()
  };

  getSqliteDb().prepare(`
    INSERT INTO sessions (token, user_id, expires_at, created_at)
    VALUES (@token, @user_id, @expires_at, @created_at)
  `).run(session);

  return session;
}

export function findSessionUser(token: string): DbUser | undefined {
  const db = getSqliteDb();
  const row = db.prepare(`
    SELECT users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
      AND sessions.expires_at > ?
      AND users.status = 'active'
  `).get(token, new Date().toISOString()) as DbUser | undefined;

  return row;
}

export function deleteSession(token: string) {
  getSqliteDb().prepare(`DELETE FROM sessions WHERE token = ?`).run(token);
}

export function deleteExpiredSessions() {
  getSqliteDb().prepare(`DELETE FROM sessions WHERE expires_at <= ?`).run(new Date().toISOString());
}
