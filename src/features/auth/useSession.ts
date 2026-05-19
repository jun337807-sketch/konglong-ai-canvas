import { useEffect, useState } from 'react';
import { userRepository } from '../../repositories/userRepository';
import { User } from '../../types/user';

function formatNow() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
}

function getStoredToken() {
  return localStorage.getItem('dino_auth_token') || '';
}

function clearStoredSession() {
  localStorage.removeItem('dino_auth_token');
  localStorage.removeItem('dino_currentUser');
}

export function useSession() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [usersDB, setUsersDB] = useState<User[]>([]);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('dino_currentUser', currentUser);
    } else {
      localStorage.removeItem('dino_currentUser');
    }
  }, [currentUser]);

  useEffect(() => {
    const bootstrap = async () => {
      const users = await userRepository.list();
      setUsersDB(users);

      const token = getStoredToken();
      if (!token) {
        setSessionReady(true);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        }).then(r => r.json());

        if (res.success && res.user?.username) {
          setCurrentUser(res.user.username);
        } else {
          clearStoredSession();
        }
      } catch (e) {
        console.warn('Failed to restore API session', e);
        clearStoredSession();
      } finally {
        setSessionReady(true);
      }
    };

    void bootstrap();
  }, []);

  const refreshUsers = async () => setUsersDB(await userRepository.list());

  const addAction = async (actionStr: string) => {
    if (!currentUser) return;

    const user = await userRepository.getByUsername(currentUser);
    if (!user) return;

    await userRepository.updateByUsername(currentUser, {
      actions: [
        { id: Date.now().toString() + Math.random(), time: formatNow(), action: actionStr },
        ...(user.actions || [])
      ]
    });
    await refreshUsers();
  };

  const handleLogin = async (username: string, password?: string) => {
    if (password) {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      }).then(r => r.json());

      if (!res.success) {
        throw new Error(res.error || '登录失败');
      }

      localStorage.setItem('dino_auth_token', res.token);
    }

    const user = await userRepository.getByUsername(username);
    if (user) {
      const timeStr = formatNow();
      await userRepository.updateByUsername(username, {
        status: 'active',
        lastLogin: timeStr,
        actions: [
          { id: Date.now().toString() + Math.random(), time: timeStr, action: '用户登录' },
          ...(user.actions || [])
        ]
      });
      await refreshUsers();
    }

    setCurrentUser(username);
  };

  const handleLogout = async () => {
    const token = getStoredToken();
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        });
      } catch (e) {
        console.warn('Failed to logout API session', e);
      }
    }
    clearStoredSession();
    setCurrentUser(null);
  };

  return {
    currentUser,
    usersDB,
    setUsersDB,
    sessionReady,
    refreshUsers,
    addAction,
    handleLogin,
    handleLogout
  };
}
