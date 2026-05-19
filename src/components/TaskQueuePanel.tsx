import React, { useState, useEffect } from 'react';
import { X, ListTodo, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { taskQueueManager, Task } from '../services/taskQueueManager';

interface TaskQueuePanelProps {
  projectId: string;
  onClose: () => void;
}

export function TaskQueuePanel({ projectId, onClose }: TaskQueuePanelProps) {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    // 轮询查询任务状态
    const checkTasks = () => {
      taskQueueManager.getTasks(projectId).then(setTasks);
    };
    checkTasks();
    const interval = setInterval(checkTasks, 5000);
    return () => clearInterval(interval);
  }, [projectId]);

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[400px] bg-[#1C1C1E] border-l border-zinc-800/80 shadow-2xl z-[250] flex flex-col transform transition-transform animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between p-6 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <ListTodo size={20} className="text-[#00bcd4]" />
          <h2 className="text-lg font-bold text-white">任务队列</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {tasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3">
            <ListTodo size={48} className="opacity-20" />
            <p>暂无生成任务</p>
          </div>
        ) : (
          tasks.map(task => (
            <div key={task.id} className="bg-[#111214] border border-zinc-800 rounded-xl p-4 flex items-start gap-3">
              <div className="mt-0.5">
                {task.status === 'pending' && <div className="w-5 h-5 rounded-full border-2 border-zinc-600 border-t-zinc-400 animate-spin" />}
                {task.status === 'running' && <Loader2 size={20} className="text-[#00bcd4] animate-spin" />}
                {task.status === 'completed' && <CheckCircle2 size={20} className="text-emerald-500" />}
                {task.status === 'failed' && <XCircle size={20} className="text-rose-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white truncate">
                  {task.type === 'image_generation' ? '生成图片' : 
                   task.type === 'video_generation' ? '生成视频' : 
                   task.type === 'script_breakdown' ? '智能拆解' : '未知任务'}
                </h4>
                <p className="text-xs text-zinc-500 mt-1 truncate">ID: {task.id.slice(0, 15)}...</p>
                {task.status === 'failed' && <p className="text-xs text-rose-500 mt-1">{task.error}</p>}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
