import React, { useEffect, useState } from 'react';
import { Edit2, FolderKanban, Plus, Sparkles, Trash2, User as UserIcon, Users, X } from 'lucide-react';
import { workspaceRepository } from '../../repositories/workspaceRepository';
import { Group } from '../../types/workspace';

export function GroupSelectionOverlay({
  onSelectGroup,
  onClose,
  renderTopRight,
  currentUser
}: {
  onSelectGroup: (id: string, name: string) => void;
  onClose?: () => void;
  renderTopRight?: React.ReactNode;
  currentUser?: string;
}) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [groupToDelete, setGroupToDelete] = useState<string | null>(null);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    setLoading(true);
    const gs = await workspaceRepository.listGroups();
    setGroups(gs);
    setLoading(false);
  };

  const handleCreateNew = async () => {
    const defaultName = `未命名小组 ${new Date().toLocaleString()}`;
    const newGroup = await workspaceRepository.createGroup({ group_name: defaultName, created_by: currentUser || 'system' });
    await loadGroups();
    onSelectGroup(newGroup.group_id, newGroup.group_name);
  };

  const handleDeleteClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setGroupToDelete(id);
  };

  const confirmDelete = async () => {
    if (!groupToDelete) return;
    await workspaceRepository.removeGroup(groupToDelete);
    setGroupToDelete(null);
    await loadGroups();
  };

  const cancelDelete = () => setGroupToDelete(null);

  const startEdit = (e: React.MouseEvent, group: Group) => {
    e.stopPropagation();
    setEditingGroupId(group.group_id);
    setEditName(group.group_name);
  };

  const saveEdit = async (e: React.MouseEvent | React.FocusEvent | React.KeyboardEvent, id: string) => {
    e.stopPropagation();
    if (editName.trim() === '') {
      setEditingGroupId(null);
      return;
    }
    await workspaceRepository.updateGroup(id, { group_name: editName.trim() });
    setEditingGroupId(null);
    await loadGroups();
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') saveEdit(e, id);
    if (e.key === 'Escape') setEditingGroupId(null);
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0E0F11] flex flex-col pt-16">
      <div className="absolute top-4 right-4 z-[100] flex items-center gap-4">
        {renderTopRight}
        {onClose && (
          <button onClick={onClose} className="p-2 bg-zinc-800/80 hover:bg-zinc-700/80 backdrop-blur-md rounded-xl text-zinc-400 hover:text-white transition-all shadow-lg border border-zinc-700/50">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="max-w-7xl w-full mx-auto px-8 py-8 flex flex-col h-full">
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 pb-4">
          {currentUser && (
            <div className="mb-10">
              <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                <UserIcon className="text-blue-400" /> 个人工作区
              </h2>
              <div
                onClick={() => onSelectGroup(`personal_${currentUser}`, '个人工作区')}
                className="group relative bg-[#1A1A1A] border border-zinc-700/50 hover:border-blue-400/50 hover:bg-[#222] rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between min-h-[160px] max-w-sm"
              >
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-zinc-200 text-lg line-clamp-1 flex-1 group-hover:text-blue-400 transition-colors flex items-center gap-2">
                      个人项目
                    </h3>
                  </div>
                  <p className="text-sm text-zinc-500 line-clamp-2">只有你可以访问这个工作区的项目。</p>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500 mt-4">
                  <FolderKanban size={14} />
                  <span className="flex-1">进入个人工作区</span>
                </div>
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Users className="text-[#00bcd4]" /> 小组工作区
              </h2>
              <button
                onClick={handleCreateNew}
                className="px-4 py-2 bg-[#00bcd4] hover:bg-[#00a6bb] text-black font-semibold rounded-xl text-sm transition-all shadow-[0_4px_20px_rgba(0,188,212,0.3)] flex items-center gap-2"
              >
                <Plus size={16} /> 新建小组
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-max">
              {loading ? (
                <div className="col-span-full h-full min-h-[160px] flex items-center justify-center text-zinc-500">加载中...</div>
              ) : groups.length === 0 ? (
                <div className="col-span-full h-full min-h-[160px] flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-700/50 rounded-2xl">
                  <Sparkles size={32} className="mb-4 opacity-50" />
                  <p>还没有任何小组，点击上方按钮新建一个吧。</p>
                </div>
              ) : (
                groups.map(group => (
                  <div
                    key={group.group_id}
                    onClick={() => { if (editingGroupId !== group.group_id) onSelectGroup(group.group_id, group.group_name); }}
                    className="group relative bg-[#1A1A1A] border border-zinc-700/50 hover:border-[#00bcd4]/50 hover:bg-[#222] rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between min-h-[160px]"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        {editingGroupId === group.group_id ? (
                          <input
                            type="text"
                            value={editName}
                            autoFocus
                            onChange={(e) => setEditName(e.target.value)}
                            onBlur={(e) => saveEdit(e, group.group_id)}
                            onKeyDown={(e) => handleEditKeyDown(e, group.group_id)}
                            onClick={(e) => e.stopPropagation()}
                            className="font-semibold text-white bg-[#111214] border border-[#00bcd4] rounded-md px-2 py-0.5 flex-1 focus:outline-none"
                          />
                        ) : (
                          <h3 className="font-semibold text-zinc-200 text-lg line-clamp-1 flex-1 group-hover:text-[#00bcd4] transition-colors flex items-center gap-2">
                            {group.group_name}
                            <button onClick={(e) => startEdit(e, group)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-[#00bcd4]/20 rounded text-[#00bcd4] transition-all">
                              <Edit2 size={12} />
                            </button>
                          </h3>
                        )}
                        <button
                          onClick={(e) => handleDeleteClick(e, group.group_id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-500/20 rounded-md text-zinc-500 hover:text-red-500 transition-all ml-2 flex-shrink-0"
                          title="删除小组"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <p className="text-sm text-zinc-500 line-clamp-2">{group.description || '暂无描述'}</p>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-4">
                      <FolderKanban size={14} />
                      <span className="flex-1">进入工作区</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {groupToDelete && (
        <div className="fixed inset-0 z-[200] bg-black/60 flex items-center justify-center backdrop-blur-sm" onClick={cancelDelete}>
          <div className="bg-[#1A1A1A] border border-zinc-700 rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-xl font-bold text-white mb-2">确认删除小组？</h3>
            <p className="text-zinc-400 mb-6 text-sm">此操作将永久删除该小组。你确定要继续吗？</p>
            <div className="flex justify-end gap-3">
              <button onClick={cancelDelete} className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-300 hover:text-white hover:bg-zinc-800 transition-all">
                取消
              </button>
              <button onClick={confirmDelete} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-lg">
                确定删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
