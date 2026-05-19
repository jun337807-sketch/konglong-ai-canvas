import { AppRoutes } from './app/AppRoutes';
import { useSession } from './features/auth/useSession';

export default function App() {
  const {
    currentUser,
    usersDB,
    setUsersDB,
    sessionReady,
    addAction,
    handleLogin,
    handleLogout
  } = useSession();

  if (!sessionReady) {
    return (
      <div className="w-screen h-screen bg-zinc-950 text-zinc-400 flex items-center justify-center">
        正在恢复会话...
      </div>
    );
  }

  return (
    <AppRoutes
      currentUser={currentUser}
      usersDB={usersDB}
      setUsersDB={setUsersDB}
      handleLogin={handleLogin}
      handleLogout={handleLogout}
      addAction={addAction}
    />
  );
}
