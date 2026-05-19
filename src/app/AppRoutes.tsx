import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes } from 'react-router-dom';
import InfiniteCanvasWrapper from '../components/InfiniteCanvas';
import { StatisticsOverlay } from '../components/StatisticsOverlay';
import { LoginRoute } from '../features/auth/LoginRoute';
import { UserAdminDialog } from '../features/users/UserAdminDialog';
import { User } from '../types/user';

function CanvasAppRoute({
  usersDB,
  currentUser,
  onLogout,
  setUsersDB,
  addAction
}: {
  usersDB: User[];
  currentUser: string;
  onLogout: () => void | Promise<void>;
  setUsersDB: Dispatch<SetStateAction<User[]>>;
  addAction: (actionStr: string) => void;
}) {
  const [showUsers, setShowUsers] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const user = usersDB.find(u => u.username === currentUser);
  const isAdmin = user?.permissions?.isAdmin || false;

  useEffect(() => {
    addAction('进入 AI 无限画布');
  }, [addAction]);

  const topControls = (
    <>
      {isAdmin && (
        <>
          <button onClick={() => setShowStats(true)} className="px-4 py-2 bg-[#ff5722]/10 backdrop-blur-xl border border-[#ff5722]/30 hover:bg-[#ff5722]/20 rounded-2xl text-sm font-medium transition-colors flex items-center gap-2 text-[#ff5722]">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            使用统计
          </button>
          <button onClick={() => setShowUsers(true)} className="px-4 py-2 bg-[#1C1C1E]/80 backdrop-blur-xl border border-zinc-800/80 hover:bg-zinc-800 rounded-2xl text-sm font-medium transition-colors flex items-center gap-2 text-white">
            <svg className="w-4 h-4 text-[#00bcd4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            用户管理
          </button>
        </>
      )}
      <button onClick={onLogout} className="px-4 py-2 bg-[#1C1C1E]/80 backdrop-blur-xl border border-zinc-800/80 hover:border-rose-500/50 hover:bg-rose-500/10 hover:text-rose-400 rounded-2xl text-sm font-medium transition-colors text-white">
        退出登录（{currentUser}）
      </button>
    </>
  );

  return (
    <>
      <div className="w-screen h-screen">
        <InfiniteCanvasWrapper renderTopRight={topControls} currentUser={currentUser} />
      </div>
      {showUsers && isAdmin && <UserAdminDialog usersDB={usersDB} currentUser={currentUser} setUsersDB={setUsersDB} onClose={() => setShowUsers(false)} />}
      {showStats && isAdmin && <StatisticsOverlay users={usersDB} onClose={() => setShowStats(false)} />}
    </>
  );
}

export function AppRoutes({
  currentUser,
  usersDB,
  setUsersDB,
  handleLogin,
  handleLogout,
  addAction
}: {
  currentUser: string | null;
  usersDB: User[];
  setUsersDB: Dispatch<SetStateAction<User[]>>;
  handleLogin: (username: string) => void;
  handleLogout: () => void | Promise<void>;
  addAction: (actionStr: string) => void;
}) {
  return (
    <Router>
      <Routes>
        <Route path="/" element={currentUser ? <Navigate to="/app" replace /> : <LoginRoute onLogin={handleLogin} usersDB={usersDB} />} />
        <Route path="/app" element={currentUser ? <CanvasAppRoute usersDB={usersDB} currentUser={currentUser} onLogout={handleLogout} setUsersDB={setUsersDB} addAction={addAction} /> : <Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
