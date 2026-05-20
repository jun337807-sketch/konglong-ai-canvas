import React, { useEffect, useMemo, useState } from 'react';
import { X, ListTodo, CheckCircle2, XCircle, Loader2, Clock3, AlertTriangle, Sparkles, Film, Image as ImageIcon } from 'lucide-react';
import { taskQueueManager, Task } from '../services/taskQueueManager';

interface TaskQueuePanelProps {
  projectId: string;
  onClose: () => void;
}

type QueueTask = {
  id: string;
  type: string;
  capability?: string;
  provider?: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'canceled';
  payload?: any;
  input?: any;
  result?: any;
  output?: any;
  error?: string | null;
  error_message?: string | null;
  createdAt?: string;
  updatedAt?: string;
  created_at?: string;
  updated_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
  source: 'server' | 'local';
};

function normalizeServerTask(task: any): QueueTask {
  return {
    ...task,
    type: task.capability || task.type || 'generation',
    status: task.status,
    error: task.error_message || task.errorMessage || null,
    createdAt: task.created_at,
    updatedAt: task.updated_at,
    source: 'server'
  };
}

function normalizeLocalTask(task: Task): QueueTask {
  return {
    ...task,
    error: task.error || null,
    source: 'local'
  };
}

function formatTime(value?: string | null) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function formatDuration(start?: string | null, end?: string | null) {
  if (!start) return '—';
  const startMs = new Date(start).getTime();
  const endMs = end ? new Date(end).getTime() : Date.now();
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs < startMs) return '—';
  const seconds = Math.max(1, Math.round((endMs - startMs) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}m ${rest}s`;
}

function taskTitle(task: QueueTask) {
  const type = `${task.capability || task.type}`;
  if (type.includes('image')) return '图片生成';
  if (type.includes('video')) return '视频生成';
  if (type.includes('script')) return '剧本拆解';
  if (type.includes('audio')) return '音频生成';
  return '生成任务';
}

function taskPrompt(task: QueueTask) {
  const input = task.input || task.payload || {};
  return input.prompt || input.text || input.title || '未记录提示词';
}

function statusMeta(status: QueueTask['status']) {
  switch (status) {
    case 'completed':
      return { label: '成功', className: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/30', dot: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]' };
    case 'failed':
      return { label: '失败', className: 'text-rose-300 bg-rose-500/10 border-rose-400/30', dot: 'bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.8)]' };
    case 'running':
      return { label: '生成中', className: 'text-cyan-300 bg-cyan-500/10 border-cyan-400/30', dot: 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]' };
    case 'pending':
      return { label: '排队中', className: 'text-amber-300 bg-amber-500/10 border-amber-400/30', dot: 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]' };
    default:
      return { label: '已取消', className: 'text-zinc-300 bg-zinc-500/10 border-zinc-400/30', dot: 'bg-zinc-400' };
  }
}

function TaskIcon({ task }: { task: QueueTask }) {
  const type = `${task.capability || task.type}`;
  if (type.includes('video')) return <Film size={16} />;
  if (type.includes('image')) return <ImageIcon size={16} />;
  return <Sparkles size={16} />;
}

function StatusIcon({ status }: { status: QueueTask['status'] }) {
  if (status === 'completed') return <CheckCircle2 size={18} className="text-emerald-400" />;
  if (status === 'failed') return <XCircle size={18} className="text-rose-400" />;
  if (status === 'running') return <Loader2 size={18} className="text-cyan-400 animate-spin" />;
  return <Clock3 size={18} className="text-amber-400" />;
}

export function TaskQueuePanel({ projectId, onClose }: TaskQueuePanelProps) {
  const [tasks, setTasks] = useState<QueueTask[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    const loadTasks = async () => {
      try {
        const [serverRes, localTasks, legacyLocalTasks] = await Promise.all([
          fetch(`/api/workspace-projects/${projectId}/tasks`).then(r => r.json()).catch(() => null),
          taskQueueManager.getTasks(projectId),
          projectId === 'local-project' ? Promise.resolve([]) : taskQueueManager.getTasks('local-project')
        ]);

        const serverTasks = serverRes?.success ? (serverRes.tasks || []).map(normalizeServerTask) : [];
        const localQueueTasks = [...localTasks, ...legacyLocalTasks].map(normalizeLocalTask);
        const seen = new Set<string>();
        const merged = [...serverTasks, ...localQueueTasks]
          .filter(task => {
            if (seen.has(task.id)) return false;
            seen.add(task.id);
            return true;
          })
          .sort((a, b) => new Date(b.createdAt || b.created_at || 0).getTime() - new Date(a.createdAt || a.created_at || 0).getTime());

        setTasks(merged);
        setLoadError(serverRes && !serverRes.success ? '后端任务读取失败，已显示本地任务缓存' : null);
      } catch (err: any) {
        setLoadError(err?.message || '任务队列读取失败');
      }
    };

    loadTasks();
    const interval = setInterval(loadTasks, 3000);
    return () => clearInterval(interval);
  }, [projectId]);

  const stats = useMemo(() => ({
    total: tasks.length,
    running: tasks.filter(t => t.status === 'running' || t.status === 'pending').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length
  }), [tasks]);

  return (
    <div className="absolute right-5 top-20 bottom-5 w-[520px] bg-[#111214]/95 backdrop-blur-2xl border border-zinc-800/90 shadow-[0_24px_80px_rgba(0,0,0,0.65)] z-[250] flex flex-col rounded-3xl overflow-hidden animate-in slide-in-from-right duration-300">
      <div className="relative p-6 border-b border-zinc-800/80 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(0,188,212,0.20),transparent_38%),radial-gradient(circle_at_top_left,rgba(168,85,247,0.12),transparent_32%)] pointer-events-none" />
        <div className="relative flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center text-cyan-300 shadow-[0_0_24px_rgba(0,188,212,0.18)]">
                <ListTodo size={20} />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-white tracking-wide">任务队列</h2>
                <p className="text-xs text-zinc-500 mt-0.5">查看当前项目所有生成任务、耗时与失败原因</p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="relative grid grid-cols-4 gap-2 mt-5">
          <div className="rounded-2xl bg-black/30 border border-zinc-800 p-3"><div className="text-[10px] text-zinc-500">全部</div><div className="text-xl text-white font-semibold mt-1">{stats.total}</div></div>
          <div className="rounded-2xl bg-cyan-500/5 border border-cyan-400/20 p-3"><div className="text-[10px] text-cyan-500">进行中</div><div className="text-xl text-cyan-200 font-semibold mt-1">{stats.running}</div></div>
          <div className="rounded-2xl bg-emerald-500/5 border border-emerald-400/20 p-3"><div className="text-[10px] text-emerald-500">成功</div><div className="text-xl text-emerald-200 font-semibold mt-1">{stats.completed}</div></div>
          <div className="rounded-2xl bg-rose-500/5 border border-rose-400/20 p-3"><div className="text-[10px] text-rose-500">失败</div><div className="text-xl text-rose-200 font-semibold mt-1">{stats.failed}</div></div>
        </div>
      </div>

      {loadError && (
        <div className="mx-4 mt-4 flex items-center gap-2 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-xs text-amber-200">
          <AlertTriangle size={14} />
          {loadError}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 custom-scrollbar">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-4">
            <div className="w-20 h-20 rounded-3xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
              <ListTodo size={36} className="opacity-30" />
            </div>
            <div className="text-center">
              <p className="text-zinc-300 font-medium">暂无生成任务</p>
              <p className="text-xs text-zinc-600 mt-1">图片或视频开始生成后，会自动出现在这里。</p>
            </div>
          </div>
        ) : (
          tasks.map(task => {
            const meta = statusMeta(task.status);
            const created = task.createdAt || task.created_at;
            const completed = task.completed_at || (['completed', 'failed', 'canceled'].includes(task.status) ? (task.updatedAt || task.updated_at) : null);
            const error = task.error || task.error_message;
            return (
              <div key={`${task.source}-${task.id}`} className="group relative overflow-hidden rounded-2xl border border-zinc-800/90 bg-[#18191c]/90 p-4 hover:border-zinc-700 hover:bg-[#1b1c20] transition-all">
                <div className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-cyan-400/60 via-transparent to-purple-400/40 opacity-70" />
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-black/30 border border-zinc-800 flex items-center justify-center text-zinc-300 group-hover:text-cyan-300 transition-colors">
                    <TaskIcon task={task} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`w-2 h-2 rounded-full ${meta.dot}`} />
                        <h4 className="text-sm font-semibold text-white truncate">{taskTitle(task)}</h4>
                      </div>
                      <span className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] ${meta.className}`}>
                        <StatusIcon status={task.status} />
                        {meta.label}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-zinc-400 line-clamp-2">{taskPrompt(task)}</p>

                    <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
                      <div className="rounded-xl bg-black/25 border border-zinc-800/80 px-3 py-2">
                        <div className="text-zinc-600">提交时间</div>
                        <div className="text-zinc-300 mt-1">{formatTime(created)}</div>
                      </div>
                      <div className="rounded-xl bg-black/25 border border-zinc-800/80 px-3 py-2">
                        <div className="text-zinc-600">用时</div>
                        <div className="text-zinc-300 mt-1">{formatDuration(task.started_at || created, completed)}</div>
                      </div>
                      <div className="rounded-xl bg-black/25 border border-zinc-800/80 px-3 py-2">
                        <div className="text-zinc-600">来源</div>
                        <div className="text-zinc-300 mt-1">{task.source === 'server' ? '服务器' : '本地缓存'}</div>
                      </div>
                    </div>

                    {error && (
                      <div className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 leading-relaxed">
                        失败原因：{error}
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-600 font-mono">
                      <span>ID {task.id.slice(0, 18)}</span>
                      <span>{task.provider || task.capability || task.type}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
