import React, { useEffect, useState } from 'react';
import { getVersions, CanvasVersion, saveVersion, deleteVersion } from '../services/versionManager';
import { exportCanvasState } from '../services/canvasStateManager';
import { Node, Edge, useReactFlow } from '@xyflow/react';
import { FileClock, Plus, Trash2, RotateCcw, Clock, Save } from 'lucide-react';

export function VersionPanel({ 
  projectId, 
  onClose,
  onRestore
}: { 
  projectId: string, 
  onClose: () => void,
  onRestore: (state: any) => void
}) {
  const [versions, setVersions] = useState<CanvasVersion[]>([]);
  const [newVersionName, setNewVersionName] = useState('');
  const [newVersionNote, setNewVersionNote] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const { getNodes, getEdges } = useReactFlow();

  useEffect(() => {
    setVersions(getVersions(projectId).sort((a, b) => b.created_at - a.created_at));
  }, [projectId]);

  const handleCreateVersion = () => {
    if (!newVersionName.trim()) return;
    const currentState = exportCanvasState(projectId, getNodes(), getEdges(), null);
    const newVer = saveVersion(projectId, newVersionName, currentState, newVersionNote);
    setVersions([newVer, ...versions]);
    setNewVersionName('');
    setNewVersionNote('');
    setShowCreate(false);
  };

  const handleDelete = (id: string) => {
    deleteVersion(projectId, id);
    setVersions(versions.filter(v => v.version_id !== id));
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-zinc-900 border-l border-zinc-800 z-[200] flex flex-col shadow-2xl animate-in slide-in-from-right-8">
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <h2 className="text-zinc-100 font-medium flex items-center gap-2">
          <FileClock size={16} /> 版本历史
        </h2>
        <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">关闭</button>
      </div>

      <div className="p-4 border-b border-zinc-800">
        {!showCreate ? (
          <button 
            onClick={() => setShowCreate(true)}
            className="w-full flex items-center justify-center gap-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2 rounded-lg transition-colors text-sm"
          >
            <Plus size={16} /> 保存当前版本
          </button>
        ) : (
          <div className="space-y-3">
            <input 
              type="text" 
              placeholder="版本名称 (如: V1 定稿)" 
              value={newVersionName}
              onChange={(e) => setNewVersionName(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#00bcd4]"
              autoFocus
            />
            <textarea 
              placeholder="版本说明 (可选)" 
              value={newVersionNote}
              onChange={(e) => setNewVersionNote(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-[#00bcd4] h-20 resize-none"
            />
            <div className="flex gap-2">
              <button 
                onClick={() => setShowCreate(false)}
                className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-2 rounded-lg transition-colors text-sm"
              >
                取消
              </button>
              <button 
                onClick={handleCreateVersion}
                disabled={!newVersionName.trim()}
                className="flex-1 bg-[#00bcd4]/20 text-[#00bcd4] hover:bg-[#00bcd4]/30 disabled:opacity-50 disabled:cursor-not-allowed py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2"
              >
                <Save size={14} /> 保存
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {versions.length === 0 ? (
          <div className="text-center text-zinc-500 text-sm mt-10">暂无历史版本</div>
        ) : (
          versions.map(v => (
            <div key={v.version_id} className="bg-zinc-800/40 border border-zinc-700/50 rounded-xl p-3 hover:bg-zinc-800/80 transition-colors group">
              <div className="flex justify-between items-start mb-2">
                <div className="font-medium text-zinc-200 text-sm">{v.version_name}</div>
                <button 
                  onClick={() => handleDelete(v.version_id)}
                  className="text-zinc-500 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="删除版本"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 mb-2">
                <Clock size={12} />
                {new Date(v.created_at).toLocaleString()}
              </div>
              {v.note && <div className="text-xs text-zinc-400 mb-3 bg-zinc-900/50 p-2 rounded">{v.note}</div>}
              
              <button 
                onClick={() => onRestore(v.canvas_state)}
                className="w-full flex items-center justify-center gap-1.5 bg-zinc-700/50 hover:bg-zinc-600 text-zinc-300 py-1.5 rounded disabled:opacity-50 transition-colors text-xs"
              >
                <RotateCcw size={12} /> 恢复此版本
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
