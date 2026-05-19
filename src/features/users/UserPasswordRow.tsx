import { useEffect, useState } from 'react';
import { User } from '../../types/user';

export function UserPasswordRow({ user, updatePassword }: { user: User; updatePassword: (username: string, newPass: string) => void }) {
  const [draftPassword, setDraftPassword] = useState(user.password || '');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    setDraftPassword(user.password || '');
  }, [user.password]);

  const handleUpdate = () => {
    updatePassword(user.username, draftPassword);
    alert('密码已更新');
  };

  const handleReset = () => {
    updatePassword(user.username, '123');
    setDraftPassword('123');
    alert('密码已重置为 123');
  };

  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500 shrink-0">登录密码</span>
        <div className="relative">
          <input
            type={showPassword ? 'text' : 'password'}
            value={draftPassword}
            onChange={(e) => setDraftPassword(e.target.value)}
            className="bg-zinc-900 border border-zinc-700 rounded-md py-1.5 pl-2 pr-8 text-xs text-zinc-300 outline-none focus:border-[#00bcd4] w-36 transition-colors"
            placeholder="输入新密码"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            {showPassword ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
            )}
          </button>
        </div>
        <button onClick={handleUpdate} className="px-3 py-1.5 bg-[#00bcd4]/10 hover:bg-[#00bcd4]/20 border border-[#00bcd4]/30 rounded-md text-xs text-[#00bcd4] transition-colors">
          保存
        </button>
        <button onClick={handleReset} className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700/50 rounded-md text-xs text-zinc-300 transition-colors">
          重置密码
        </button>
      </div>
      <span className="text-xs text-zinc-600 italic mt-2 md:mt-0">累计操作：{user.actions?.length || 0} 次</span>
    </div>
  );
}
