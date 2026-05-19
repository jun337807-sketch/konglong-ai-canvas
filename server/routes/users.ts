import { Router } from 'express';
import { createHash } from 'crypto';
import { createUser, listUsers, updateUser } from '../repositories/userRepository.js';

const router = Router();

function hashPassword(password: string) {
  return createHash('sha256').update(password).digest('hex');
}

router.get('/', (_req, res) => {
  const users = listUsers().map(({ password_hash, ...safeUser }) => safeUser);
  res.json({ success: true, users });
});

router.post('/', (req, res) => {
  const { username, password, displayName, role } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'username and password are required' });
  }

  try {
    const user = createUser({
      username,
      passwordHash: hashPassword(password),
      displayName: displayName || username,
      role
    });
    const { password_hash, ...safeUser } = user;
    res.status(201).json({ success: true, user: safeUser });
  } catch (err: any) {
    const message = err?.code === 'SQLITE_CONSTRAINT_UNIQUE'
      ? 'username already exists'
      : err.message;
    res.status(400).json({ success: false, error: message });
  }
});

router.patch('/:id', (req, res) => {
  const { id } = req.params;
  const { displayName, password, role, status, lastLoginAt } = req.body || {};

  const updated = updateUser(id, {
    display_name: displayName,
    password_hash: password ? hashPassword(password) : undefined,
    role,
    status,
    last_login_at: lastLoginAt
  });

  if (!updated) {
    return res.status(404).json({ success: false, error: 'user not found' });
  }

  const { password_hash, ...safeUser } = updated;
  res.json({ success: true, user: safeUser });
});

export default router;
