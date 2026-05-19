import React, { useState } from 'react';
import { Plus, RotateCw, Sparkles, Trash2, X } from 'lucide-react';

interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
}

export function LegacyProjectSelectionOverlay({
  onSelectProject,
  onClose,
  renderTopRight
}: {
  onSelectProject: (id: string, name: string) => void;
  onClose?: () => void;
  renderTopRight?: React.ReactNode;
}) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);

  const fetchProjects = React.useCallback(async () => {
    let apiProjects: ProjectMeta[] = [];
    try {
      const res = await fetch('/api/projects').then(r => r.json());
      if (res.success) apiProjects = res.projects || [];
    } catch (e) {
      console.warn('API error, fallback to local', e);
    }

    try {
      const stored = localStorage.getItem('infinite-canvas-projects');
      if (stored) {
        let parsed = JSON.parse(stored);
        if (parsed && !Array.isArray(parsed) && (parsed.nodes || parsed.edges)) {
          const migrationId = 'legacy-project';
          const migratedProject = { id: migrationId, name: '旧版工作区', updatedAt: Date.now() };
          localStorage.setItem(`infinite-canvas-project-${migrationId}`, stored);
          parsed = [migratedProject];
          localStorage.setItem('infinite-canvas-projects', JSON.stringify(parsed));
          localStorage.removeItem('infinite-canvas-workspace');
        }
        if (Array.isArray(parsed)) {
          const allProjects = [...parsed];
          for (const apiProject of apiProjects) {
            if (!allProjects.find(p => p.id === apiProject.id)) allProjects.push(apiProject);
          }
          setProjects(allProjects.sort((a, b) => b.updatedAt - a.updatedAt));
          return;
        }
      }

      if (apiProjects.length > 0) {
        setProjects(apiProjects);
        return;
      }

      const oldStored = localStorage.getItem('infinite-canvas-workspace');
      if (oldStored) {
        const migrationId = 'legacy-project';
        const migratedProject = { id: migrationId, name: '旧版工作区', updatedAt: Date.now() };
        localStorage.setItem(`infinite-canvas-project-${migrationId}`, oldStored);
        localStorage.setItem('infinite-canvas-projects', JSON.stringify([migratedProject]));
        localStorage.removeItem('infinite-canvas-workspace');
        setProjects([migratedProject]);
      }
    } catch (e) {
      console.error('Failed to load projects', e);
    }
  }, []);

  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateNew = async () => {
    const newId = Date.now().toString();
    const newName = '未命名项目 ' + new Date().toLocaleString();
    const newProject: ProjectMeta = { id: newId, name: newName, updatedAt: Date.now() };
    const updatedProjects = [newProject, ...projects];

    try {
      await fetch(`/api/projects/${newId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, projectData: { nodes: [], edges: [] } })
      });
    } catch (err) {
      console.warn('API sync err', err);
    }

    setProjects(updatedProjects);
    localStorage.setItem('infinite-canvas-projects', JSON.stringify(updatedProjects));
    onSelectProject(newId, newName);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm('确定要删除此项目吗？该操作不可恢复。')) return;

    try {
      await fetch(`/api/projects/${id}`, { method: 'DELETE' });
    } catch (err) {
      console.warn('API delete err', err);
    }
    const updated = projects.filter(project => project.id !== id);
    setProjects(updated);
    localStorage.setItem('infinite-canvas-projects', JSON.stringify(updated));
    localStorage.removeItem(`infinite-canvas-project-${id}`);
    import('idb-keyval').then(({ del }) => {
      del(`infinite-canvas-project-${id}`).catch(err => console.warn(err));
    });
  };

  return (
    <div className="absolute inset-0 z-[1000] bg-[#0E0F11] flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-hidden w-full h-full">
      <div className="absolute top-6 right-6 z-[1010] flex items-center gap-3">
        {renderTopRight}
        {onClose && (
          <button onClick={onClose} className="p-3 bg-[#111214]/80 backdrop-blur-xl border border-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl shadow-lg transition-all">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="relative z-10 bg-[#1C1C1E] border border-zinc-800 rounded-[24px] p-8 shadow-2xl w-[90%] max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-8 shrink-0 flex-wrap gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-2 flex items-center gap-3">画布项目管理</h1>
            <p className="text-sm text-zinc-400">选择一个项目继续创作，或者新建一个项目。</p>
          </div>
          <button onClick={handleCreateNew} className="px-5 py-2.5 bg-[#00bcd4] hover:bg-[#00a6bb] text-black font-semibold rounded-xl text-sm transition-all hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(0,188,212,0.3)] flex items-center gap-2">
            <Plus size={18} /> 新建项目
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
          {projects.length === 0 ? (
            <div className="col-span-full h-full min-h-[200px] flex flex-col items-center justify-center text-zinc-500">
              <Sparkles size={40} className="mb-4 opacity-50" />
              <p>还没有任何项目，点击上方按钮新建一个吧。</p>
            </div>
          ) : (
            projects.map(project => (
              <div key={project.id} onClick={() => onSelectProject(project.id, project.name)} className="group relative bg-[#2A2A2E] border border-zinc-700/50 hover:border-[#00bcd4]/50 hover:bg-[#2A2A2E]/80 rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between min-h-[140px]">
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="font-semibold text-zinc-200 text-lg line-clamp-1 flex-1 group-hover:text-[#00bcd4] transition-colors">{project.name}</h3>
                    <button className="h-8 w-8 rounded-lg hover:bg-rose-500/10 flex items-center justify-center text-zinc-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0 relative z-10" onClick={(e) => handleDelete(e, project.id)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-500">
                  <RotateCw size={12} />
                  更新于 {new Date(project.updatedAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
