import { Dispatch, SetStateAction, useState } from 'react';
import { User } from '../../types/user';
import { userRepository } from '../../repositories/userRepository';
import { UserPasswordRow } from './UserPasswordRow';

export function UserAdminDialog({
  usersDB,
  currentUser,
  setUsersDB,
  onClose
}: {
  usersDB: User[];
  currentUser: string;
  setUsersDB: Dispatch<SetStateAction<User[]>>;
  onClose: () => void;
}) {
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleAddUser = async () => {
    if (!newUsername.trim() || !newPassword.trim()) return;
    if (usersDB.some(u => u.username === newUsername)) {
      alert('用户名已存在');
      return;
    }
    await userRepository.create({
      username: newUsername,
      password: newPassword,
      displayName: newUsername,
      role: 'user',
    });
    setUsersDB(await userRepository.list());
    setIsAddingUser(false);
    setNewUsername('');
    setNewPassword('');
  };

  const togglePermission = async (username: string, field: 'workspace' | 'canvas' | 'isAdmin') => {
    const user = usersDB.find(u => u.username === username);
    if (!user || !user.permissions) return;
    await userRepository.updateByUsername(username, {
      permissions: { ...user.permissions, [field]: !user.permissions[field] }
    });
    setUsersDB(await userRepository.list());
  };

  const updatePassword = async (username: string, newPass: string) => {
    await userRepository.updateByUsername(username, { password: newPass });
    setUsersDB(await userRepository.list());
  };

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6" onClick={onClose}>
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 shrink-0">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <svg className="w-5 h-5 text-[#00bcd4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            系统权限与用户管理
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-white p-1 rounded-lg hover:bg-zinc-800 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          <div className="flex justify-between items-center mb-2 px-2">
            <h3 className="font-semibold text-zinc-300">用户列表</h3>
            <button onClick={() => setIsAddingUser(!isAddingUser)} className="px-3 py-1.5 bg-[#00bcd4]/10 hover:bg-[#00bcd4]/20 text-[#00bcd4] text-xs font-medium rounded-lg transition-colors flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              {isAddingUser ? '取消新建' : '新建用户'}
            </button>
          </div>

          {isAddingUser && (
            <div className="bg-zinc-800/50 border border-[#00bcd4]/30 rounded-xl p-4 flex gap-4 items-end">
              <div className="flex-1">
                <label className="text-xs text-zinc-400 block mb-1">用户名</label>
                <input type="text" className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#00bcd4]" value={newUsername} onChange={e => setNewUsername(e.target.value)} placeholder="输入新账号" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-zinc-400 block mb-1">初始密码</label>
                <input type="text" className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-[#00bcd4]" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="输入初始密码" />
              </div>
              <button onClick={handleAddUser} className="px-6 py-2 bg-[#00bcd4] hover:bg-[#00a6bb] text-black font-semibold rounded-lg text-sm transition-colors h-[38px] flex items-center">创建</button>
            </div>
          )}

          {usersDB.map((user, idx) => (
            <div key={idx} className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-4 flex flex-col gap-4">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-3 border-b border-zinc-800/50 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center font-bold text-zinc-300">{user.username.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="font-semibold text-zinc-100 flex items-center gap-2">
                      {user.username}
                      {currentUser === user.username ? (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">在线</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] bg-zinc-800 text-zinc-400 border border-zinc-700">离线</span>
                      )}
                    </div>
                    <div className="text-xs text-zinc-500">最后登录: {user.lastLogin}</div>
                  </div>
                </div>
                <div className="flex items-center gap-4 bg-zinc-900 p-2 rounded-lg border border-zinc-800 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer text-xs group">
                    <input type="checkbox" checked={user.permissions?.workspace} onChange={() => togglePermission(user.username, 'workspace')} className="accent-[#00bcd4] w-3.5 h-3.5 rounded bg-zinc-800 border-zinc-600" />
                    <span className={`transition-colors ${user.permissions?.workspace ? 'text-[#00bcd4]' : 'text-zinc-500 group-hover:text-zinc-300'}`}>工作台权限</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-xs group">
                    <input type="checkbox" checked={user.permissions?.canvas} onChange={() => togglePermission(user.username, 'canvas')} className="accent-[#00bcd4] w-3.5 h-3.5 rounded bg-zinc-800 border-zinc-600" />
                    <span className={`transition-colors ${user.permissions?.canvas ? 'text-[#00bcd4]' : 'text-zinc-500 group-hover:text-zinc-300'}`}>画布权限</span>
                  </label>
                  <div className="w-px h-4 bg-zinc-700 mx-1"></div>
                  <label className="flex items-center gap-2 cursor-pointer text-xs group">
                    <input type="checkbox" checked={user.permissions?.isAdmin} onChange={() => togglePermission(user.username, 'isAdmin')} disabled={user.username === 'admin'} className="accent-rose-500 w-3.5 h-3.5 rounded bg-zinc-800 border-zinc-600" />
                    <span className={`transition-colors ${user.permissions?.isAdmin ? 'text-rose-400' : 'text-zinc-500 group-hover:text-zinc-300'} ${user.username === 'admin' ? 'opacity-50' : ''}`}>管理员</span>
                  </label>
                </div>
              </div>

              <UserPasswordRow user={user} updatePassword={updatePassword} />

              {user.actions && user.actions.length > 0 && (
                <div className="pl-1 space-y-2 max-h-[160px] overflow-y-auto custom-scrollbar pr-2 mt-2 bg-zinc-900/50 p-2 rounded-lg border border-zinc-800/50">
                  {user.actions.slice(0, 20).map((act) => (
                    <div key={act.id} className="flex gap-4 items-start text-xs group">
                      <div className="w-32 shrink-0 text-zinc-500 font-mono tracking-tight">{act.time}</div>
                      <div className="flex-1 text-zinc-300 group-hover:text-zinc-100 transition-colors flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00bcd4]/50"></div>
                        {act.action}
                      </div>
                    </div>
                  ))}
                  {user.actions.length > 20 && <div className="text-xs text-zinc-600 italic">... 仅显示最近 20 条记录</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
