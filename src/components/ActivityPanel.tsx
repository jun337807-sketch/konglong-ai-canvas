import React, { useEffect, useState } from 'react';
import { Activity, X } from 'lucide-react';
import { OperationLog, operationLogRepository } from '../repositories/operationLogRepository';

export function ActivityPanel({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const [logs, setLogs] = useState<OperationLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    operationLogRepository
      .listByProject(projectId)
      .then(setLogs)
      .finally(() => setLoading(false));
  }, [projectId]);

  return (
    <div
      className="fixed inset-0 z-[2000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}
    >
      <div
        className="bg-[#1C1C1E] border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold">
            <Activity size={18} className="text-[#00bcd4]" />
            操作日志
          </div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="关闭操作日志"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          {loading ? (
            <div className="text-zinc-500 text-sm py-10 text-center">加载中...</div>
          ) : logs.length === 0 ? (
            <div className="text-zinc-500 text-sm py-10 text-center">暂无操作日志</div>
          ) : (
            <div className="space-y-3">
              {logs.map(log => (
                <div key={log.id} className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm font-semibold text-zinc-100">{log.action}</span>
                    <span className="text-xs text-zinc-500">{new Date(log.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="text-xs text-zinc-500 flex flex-wrap gap-3">
                    {log.actorUserId && <span>用户：{log.actorUserId}</span>}
                    {log.targetType && <span>对象：{log.targetType}</span>}
                    {log.targetId && <span>ID：{log.targetId.slice(0, 8)}</span>}
                  </div>
                  {Object.keys(log.metadata || {}).length > 0 && (
                    <pre className="text-[11px] text-zinc-400 bg-zinc-900/80 border border-zinc-800 rounded-lg p-3 overflow-x-auto">
                      {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
