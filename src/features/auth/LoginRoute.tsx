import { useState } from 'react';
import { User } from '../../types/user';

export function LoginRoute({
  onLogin,
  usersDB
}: {
  onLogin: (username: string, password: string) => void | Promise<void>;
  usersDB: User[];
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('请输入账号和密码');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onLogin(username.trim(), password);
    } catch (err: any) {
      const knownUser = usersDB.find(user => user.username === username.trim());
      if (!knownUser) {
        setError('账号不存在，或服务端尚未同步该用户');
      } else {
        setError(err?.message || '登录失败，请检查账号和密码');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-screen bg-zinc-950 text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-[#00bcd4]/10 to-purple-500/10 z-0" />
      <div className="z-10 bg-zinc-900/80 backdrop-blur-xl border border-zinc-800 p-10 rounded-2xl shadow-2xl w-full max-w-md flex flex-col items-center">
        <div className="w-16 h-16 bg-[#00bcd4]/20 text-[#00bcd4] rounded-2xl flex items-center justify-center mb-6 shadow-[0_0_20px_rgba(0,188,212,0.3)]">
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold mb-2">AI 无限画布登录</h1>
        <p className="text-zinc-400 text-sm mb-8 text-center">请输入你的本地团队账号</p>

        <div className="w-full space-y-4 mb-6">
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5 ml-1">用户名</label>
            <input
              type="text"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-[#00bcd4] transition-colors"
              placeholder="请输入账号"
              value={username}
              onChange={e => setUsername(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              disabled={loading}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-400 block mb-1.5 ml-1">密码</label>
            <input
              type="password"
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-200 focus:outline-none focus:border-[#00bcd4] transition-colors"
              placeholder="请输入密码"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              disabled={loading}
            />
          </div>
        </div>

        {error && (
          <div className="text-rose-400 text-xs mb-4 w-full text-center bg-rose-500/10 py-2 rounded-lg border border-rose-500/20">
            {error}
          </div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-[#00bcd4] to-[#0096a8] hover:from-[#00cbe6] hover:to-[#00a2bb] text-white font-medium rounded-xl shadow-lg shadow-[#00bcd4]/20 transition-all active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? '正在登录...' : '登录系统'}
        </button>
      </div>
    </div>
  );
}
