import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { User } from '../types/user';
import { X, Check, X as XIcon, User as UserIcon, Crown, Loader2, RefreshCw, Activity } from 'lucide-react';

interface StatisticsOverlayProps {
  users: User[];
  onClose: () => void;
}

interface UsageTask {
  id: string;
  title: string;
  status: 'success' | 'failed' | 'running';
  durationSeconds: number;
  time: string;
  provider?: string;
  capability?: string;
  errorMessage?: string | null;
}

interface UsageUserStats {
  id: string;
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  totalTasks: number;
  successTasks: number;
  failedTasks: number;
  runningTasks: number;
  totalDuration: number;
  recentTasks: UsageTask[];
}

interface UsageStatistics {
  generatedAt: string;
  totals: {
    totalTasks: number;
    successTasks: number;
    failedTasks: number;
    runningTasks: number;
    totalDuration: number;
    registeredUsers: number;
  };
  users: UsageUserStats[];
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0秒';
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes <= 0) return `${rest}秒`;
  return rest ? `${minutes}分${rest}秒` : `${minutes}分`;
}

function formatTime(value: string) {
  const time = new Date(value);
  if (Number.isNaN(time.getTime())) return value || '-';
  return time.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

function truncateTitle(value: string) {
  if (!value) return '生成任务';
  return value.length > 72 ? `${value.slice(0, 72)}...` : value;
}

export function StatisticsOverlay({ users, onClose }: StatisticsOverlayProps) {
  const [statistics, setStatistics] = useState<UsageStatistics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<Record<string, 'tasks' | 'logs'>>({});

  const loadStatistics = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const response = await fetch('/api/statistics/usage', { cache: 'no-store' });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.success) {
        throw new Error(data?.message || data?.detail || '统计接口读取失败');
      }
      setStatistics({
        generatedAt: data.generatedAt,
        totals: data.totals,
        users: data.users || []
      });
      setError(null);
    } catch (err: any) {
      setError(err?.message || '统计接口暂时不可用');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatistics();
    const timer = window.setInterval(() => {
      void loadStatistics(true);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [loadStatistics]);

  const mergedUsers = useMemo(() => {
    const serverUsers = statistics?.users || [];
    if (serverUsers.length > 0) return serverUsers;
    return users.map(user => ({
      id: user.id,
      username: user.username,
      displayName: user.displayName || user.username,
      role: user.role,
      totalTasks: 0,
      successTasks: 0,
      failedTasks: 0,
      runningTasks: 0,
      totalDuration: 0,
      recentTasks: []
    }));
  }, [statistics, users]);

  const totals = statistics?.totals || {
    totalTasks: 0,
    successTasks: 0,
    failedTasks: 0,
    runningTasks: 0,
    totalDuration: 0,
    registeredUsers: users.length
  };

  const toggleView = (userId: string, mode: 'tasks' | 'logs') => {
    setViewMode(prev => ({ ...prev, [userId]: mode }));
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-[#111111]/95 overflow-y-auto p-4 md:p-8" onClick={onClose}>
      <div className="max-w-[1600px] mx-auto flex flex-col gap-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[#ff5722] text-lg font-bold">
              <span className="w-2 h-5 bg-[#ff5722]"></span>
              使用统计
              {isLoading ? <Loader2 size={16} className="animate-spin text-zinc-500" /> : <Activity size={16} className="text-emerald-400" />}
            </div>
            <div className="text-xs text-zinc-500">
              {statistics?.generatedAt ? `实时刷新中 · 最近更新 ${formatTime(statistics.generatedAt)}` : '实时读取服务器统计'}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => loadStatistics()}
              className="px-3 py-1.5 text-xs font-medium text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 transition-colors rounded-lg border border-cyan-500/20 inline-flex items-center gap-2"
            >
              <RefreshCw size={14} />
              刷新统计
            </button>
            <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
            统计读取暂时不稳定：{error}
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-6">
          <div className="bg-[#1f1d2b] border border-[#2d2a3c] rounded-xl p-6 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-[#ff5722] mb-2">{totals.totalTasks}</span>
            <span className="text-xs text-zinc-500">总任务数</span>
          </div>
          <div className="bg-[#17251f] border border-emerald-500/20 rounded-xl p-6 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-[#4caf50] mb-2">{totals.successTasks}</span>
            <span className="text-xs text-zinc-500">成功任务</span>
          </div>
          <div className="bg-[#221c23] border border-red-500/20 rounded-xl p-6 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-[#f44336] mb-2">{totals.failedTasks}</span>
            <span className="text-xs text-zinc-500">失败任务</span>
          </div>
          <div className="bg-[#14252a] border border-cyan-500/20 rounded-xl p-6 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-cyan-300 mb-2">{totals.runningTasks}</span>
            <span className="text-xs text-zinc-500">进行中</span>
          </div>
          <div className="bg-[#241f23] border border-[#2d2a3c] rounded-xl p-6 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-[#9c27b0] mb-2">{totals.registeredUsers}</span>
            <span className="text-xs text-zinc-500">注册用户</span>
          </div>
        </div>

        <h3 className="text-white font-bold mt-2">用户使用详情</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {mergedUsers.map(user => {
            const mode = viewMode[user.id] || 'tasks';
            const localUser = users.find(item => item.id === user.id);
            const logs = localUser?.actions || [];

            return (
              <div key={user.id} className="bg-[#1A1A1A] border border-zinc-800 rounded-xl p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    {user.role === 'admin' ? <Crown size={16} className="text-[#ffc107]" /> : <UserIcon size={16} className="text-zinc-400" />}
                    <span className="text-white font-bold">{user.username}</span>
                    <span className="text-xs text-zinc-500">{user.displayName && user.displayName !== user.username ? user.displayName : ''}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex bg-zinc-800/50 rounded-lg p-0.5">
                      <button
                        onClick={() => toggleView(user.id, 'tasks')}
                        className={`text-[10px] px-2 py-1 rounded-md transition-colors ${mode === 'tasks' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        任务
                      </button>
                      <button
                        onClick={() => toggleView(user.id, 'logs')}
                        className={`text-[10px] px-2 py-1 rounded-md transition-colors ${mode === 'logs' ? 'bg-zinc-700 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                      >
                        日志
                      </button>
                    </div>
                    {user.role === 'admin' ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 text-purple-400 border border-purple-500/30">管理员</span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-green-500/20 text-green-400 border border-green-500/30">普通用户</span>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-end gap-6 mb-6">
                  <div className="flex flex-col">
                    <span className="text-[#ff5722] text-xl font-bold">{user.totalTasks}</span>
                    <span className="text-[10px] text-zinc-500">任务数</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[#ff9800] text-xl font-bold">{user.successTasks}</span>
                    <span className="text-[10px] text-zinc-500">成功</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[#f44336] text-xl font-bold">{user.failedTasks}</span>
                    <span className="text-[10px] text-zinc-500">失败</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-cyan-300 text-xl font-bold">{user.runningTasks}</span>
                    <span className="text-[10px] text-zinc-500">进行中</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[#ff5722] text-xl font-bold">{formatDuration(user.totalDuration)}</span>
                    <span className="text-[10px] text-zinc-500">总时长</span>
                  </div>
                </div>

                {mode === 'tasks' ? (
                  <div className="flex-1">
                    <div className="text-[11px] text-zinc-500 mb-2 font-medium">最近任务</div>
                    {user.recentTasks.length === 0 ? (
                      <div className="text-xs text-zinc-500 py-4 text-center">暂无任务</div>
                    ) : (
                      <div className="flex flex-col divide-y divide-zinc-800/50">
                        {user.recentTasks.map(task => (
                          <div key={task.id} className="flex items-center justify-between py-2 gap-4">
                            <div className="min-w-0 flex-1">
                              <div className="text-zinc-400 text-xs truncate">{truncateTitle(task.title)}</div>
                              {task.errorMessage && <div className="text-[10px] text-red-300 truncate mt-1">失败原因：{task.errorMessage}</div>}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              {task.status === 'success' ? (
                                <Check size={14} className="text-[#4caf50]" />
                              ) : task.status === 'failed' ? (
                                <XIcon size={14} className="text-[#f44336]" />
                              ) : (
                                <Loader2 size={14} className="text-cyan-300 animate-spin" />
                              )}
                              <span className="text-[10px] text-zinc-500 min-w-[42px]">{formatDuration(task.durationSeconds)}</span>
                              <span className="text-[10px] text-zinc-600 min-w-[100px] text-right">{formatTime(task.time)}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex-1">
                    <div className="text-[11px] text-zinc-500 mb-2 font-medium">操作日志</div>
                    {logs.length === 0 ? (
                      <div className="text-xs text-zinc-500 py-4 text-center">暂无日志</div>
                    ) : (
                      <div className="flex flex-col divide-y divide-zinc-800/50 max-h-[160px] overflow-y-auto custom-scrollbar pr-2">
                        {logs.map((log) => (
                          <div key={log.id} className="flex flex-col justify-center py-2 gap-1.5">
                            <span className="text-zinc-400 text-xs">{log.action}</span>
                            <span className="text-[10px] text-zinc-600">{log.time}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
