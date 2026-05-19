import React, { useState } from 'react';
import { capabilityRegistry } from '../config/capabilityRegistry';
import { CapabilityRegistryEntry, OptionalInputDef } from '../types/capability';
import { MediaCapability, TaskParams } from '../types/task';
import { executeTask } from '../services/capabilityRouter';

interface Props {
  capabilityId: MediaCapability;
  onSuccess: (url: string) => void;
  onError: (msg: string) => void;
}

/**
 * 这是一个动态表单组件，用于展示如何根据 capabilityRegistry 动态渲染 UI。
 * 在后端迁移后，前端只需要这样的通用组件即可支持新能力。
 */
export function CapabilityDynamicForm({ capabilityId, onSuccess, onError }: Props) {
  const capability: CapabilityRegistryEntry = capabilityRegistry[capabilityId];
  
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [params, setParams] = useState<TaskParams>(capability?.defaultParams || {});
  const [loading, setLoading] = useState(false);

  if (!capability) return <div>Capability Not Found</div>;

  const handleParamChange = (name: string, value: any) => {
    setParams(prev => ({ ...prev, [name]: value }));
  };

  const handleGenerate = async () => {
    setLoading(true);
    try {
      // 封装成统一的任务结构去调用
      const url = await executeTask({
        task_id: `task_${Date.now()}`,
        capability: capability.id,
        api_type: capability.apiType,
        media_type: capability.mediaType,
        prompt,
        images: images.map(img => ({ url: img, role: 'reference' })), // 简单映射
        params,
        status: 'pending',
        created_at: Date.now()
      });
      onSuccess(url);
    } catch (err: any) {
      onError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 bg-zinc-900 text-white rounded-xl border border-zinc-700">
      <h3 className="font-bold text-lg">{capability.label}</h3>
      <p className="text-sm text-zinc-400">{capability.description}</p>
      
      {/* 动态渲染必填项提示词 */}
      {capability.requiredInputs.find(i => i.name === 'prompt') && (
        <div className="flex flex-col gap-1">
          <label className="text-sm text-zinc-300">提示词 (Prompt) *</label>
          <textarea 
            className="bg-zinc-800 rounded p-2 text-sm"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
          />
        </div>
      )}

      {/* 动态渲染选填项 */}
      {capability.optionalInputs.map((opt: OptionalInputDef) => (
        <div key={opt.name} className="flex flex-col gap-1">
          <label className="text-sm text-zinc-300">{opt.label}</label>
          {opt.type === 'number' ? (
             <input type="number" 
               className="bg-zinc-800 rounded p-2 text-sm"
               value={params[opt.name] ?? ''} 
               onChange={e => handleParamChange(opt.name, Number(e.target.value))} 
             />
          ) : (
             <input type="text" 
               className="bg-zinc-800 rounded p-2 text-sm"
               value={params[opt.name] ?? ''} 
               onChange={e => handleParamChange(opt.name, e.target.value)} 
             />
          )}
        </div>
      ))}

      <button 
        disabled={loading}
        onClick={handleGenerate}
        className="mt-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white py-2 rounded font-medium transition"
      >
        {loading ? '生成中...' : '提交任务'}
      </button>
    </div>
  );
}
