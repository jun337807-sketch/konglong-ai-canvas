import React, { useState, useEffect } from 'react';
import { X, Settings2, Save } from 'lucide-react';
import { ProjectSettings } from '../config/projectSettingsSchema';
import { projectSettingsService } from '../services/projectSettingsService';

interface ProjectSettingsPanelProps {
  projectId: string;
  onClose: () => void;
  onSaved?: (settings: ProjectSettings) => void;
}

export function ProjectSettingsPanel({ projectId, onClose, onSaved }: ProjectSettingsPanelProps) {
  const [settings, setSettings] = useState<ProjectSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    projectSettingsService.getSettings(projectId).then(setSettings);
  }, [projectId]);

  if (!settings) return null;

  const handleSave = async () => {
    setSaving(true);
    await projectSettingsService.saveSettings(projectId, settings);
    setSaving(false);
    onSaved?.(settings);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-black/60 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-[#1C1C1E] border border-zinc-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-6 border-b border-zinc-800/80">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-xl">
              <Settings2 size={24} className="text-[#00bcd4]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">项目设置</h2>
              <p className="text-zinc-500 text-sm mt-1">全局默认配置 (Project ID: {projectId.slice(0, 8)})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-400 tracking-wider uppercase">基本信息</h3>
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">项目名称</label>
              <input 
                type="text" 
                value={settings.project.name}
                onChange={e => setSettings(s => s ? {...s, project: {...s.project, name: e.target.value}} : null)}
                className="w-full bg-[#111214] border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#00bcd4]"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">项目描述</label>
              <textarea 
                value={settings.project.description || ''}
                onChange={e => setSettings(s => s ? {...s, project: {...s.project, description: e.target.value}} : null)}
                className="w-full bg-[#111214] border border-zinc-800 rounded-xl px-4 py-2.5 text-white focus:outline-none focus:border-[#00bcd4] h-24 resize-none"
                placeholder="在此输入项目描述..."
              />
            </div>
          </section>

          <section className="space-y-4">
            <h3 className="text-sm font-semibold text-zinc-400 tracking-wider uppercase">画布偏好</h3>
            <div className="space-y-2">
              <label className="text-sm text-zinc-300">自动保存</label>
              <div className="flex items-center h-11 px-4 bg-[#111214] border border-zinc-800 rounded-xl">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={settings.system.autoSave}
                    onChange={e => setSettings(s => s ? {...s, system: {...s.system, autoSave: e.target.checked}} : null)}
                    className="w-4 h-4 rounded border-zinc-700 text-[#00bcd4] focus:ring-[#00bcd4] bg-zinc-800"
                  />
                  <span className="text-white text-sm">开启自动保存</span>
                </label>
              </div>
            </div>
          </section>
        </div>

        <div className="p-6 border-t border-zinc-800/80 flex justify-end gap-3 bg-[#18181a] rounded-b-2xl">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 text-zinc-300 hover:text-white font-medium transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 bg-[#00bcd4] hover:bg-[#00bcd4]/90 text-white font-medium rounded-xl shadow-lg border border-[#00bcd4]/20 transition-all flex items-center gap-2"
          >
            <Save size={18} />
            {saving ? '保存中...' : '保存设置'}
          </button>
        </div>
      </div>
    </div>
  );
}
