import { createHash, randomUUID } from 'crypto';
import { Router } from 'express';
import { createSession, deleteExpiredSessions, deleteSession, findSessionUser } from '../repositories/sessionRepository.js';
import { findUserByUsername, updateUser } from '../repositories/userRepository.js';

const router = Router();

function hashPassword(password: string) {
  return createHash('sha256').update(password).digest('hex');
}

function getBearerToken(authHeader?: string) {
  const header = authHeader || '';
  return header.startsWith('Bearer ') ? header.slice(7) : '';
}

function safeUser(user: any) {
  const { password_hash, ...rest } = user;
  return rest;
}

router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'username and password are required' });
  }

  deleteExpiredSessions();

  const user = findUserByUsername(username);
  if (!user || user.password_hash !== hashPassword(password) || user.status !== 'active') {
    return res.status(401).json({ success: false, error: 'invalid credentials' });
  }

  const now = new Date().toISOString();
  const updated = updateUser(user.id, { last_login_at: now }) || user;
  const token = randomUUID();
  const session = createSession({ token, userId: updated.id });

  res.json({ success: true, token, expiresAt: session.expires_at, user: safeUser(updated) });
});

router.get('/me', (req, res) => {
  const token = getBearerToken(req.headers.authorization);
  if (!token) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  const user = findSessionUser(token);
  if (!user) {
    return res.status(401).json({ success: false, error: 'unauthorized' });
  }

  res.json({ success: true, user: safeUser(user), userId: user.id });
});

router.post('/logout', (req, res) => {
  const token = getBearerToken(req.headers.authorization);
  if (token) deleteSession(token);
  res.json({ success: true });
});

export default router;
