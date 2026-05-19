import React, { useState, useEffect } from 'react';
import { capabilityRegistry } from '../config/capabilityRegistry';
import { MediaCapability } from '../types/task';
import { DynamicControlRenderer } from './DynamicControlRenderer';
import { buildTask } from '../services/taskBuilder';
import { executeTask } from '../services/capabilityRouter';
import { Sparkles, Loader2, X } from 'lucide-react';

interface Props {
  capabilityId: MediaCapability;
  initialValues?: Record<string, any>;
  onClose?: () => void;
  onSuccess?: (url: string) => void;
}

export function CapabilityPanel({ capabilityId, initialValues, onClose, onSuccess }: Props) {
  const capability = capabilityRegistry[capabilityId];
  
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize defaults
  useEffect(() => {
    if (capability) {
      const initial: Record<string, any> = {};
      capability.uiControls.forEach(ctrl => {
         if (ctrl.defaultValue !== undefined) {
           initial[ctrl.paramKey] = ctrl.defaultValue;
         }
      });
      setFormData({ ...initial, ...(initialValues || {}) });
      setError(null);
    }
  }, [capability, initialValues]);

  if (!capability) return null;

  const handleControlChange = (paramKey: string, val: any) => {
    setFormData(prev => ({ ...prev, [paramKey]: val }));
  };

  const handleGenerate = async () => {
    // Validate required fields
    for (const ctrl of capability.uiControls) {
      if (ctrl.required && !formData[ctrl.paramKey]) {
        setError(`请填写必填项: ${ctrl.label}`);
        return;
      }
    }
    
    setError(null);
    setIsGenerating(true);

    try {
      const task = buildTask(capability, formData);
      const url = await executeTask(task);
      if (onSuccess) onSuccess(url);
    } catch (err: any) {
      setError(err.message || '生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  const generateBtnControl = capability.uiControls.find(c => c.type === 'generate_button');
  const regularControls = capability.uiControls.filter(c => c.type !== 'generate_button');

  return (
    <div className="absolute top-0 right-0 h-full w-[400px] bg-[#1C1C1E] border-l border-zinc-800 flex flex-col z-[100] shadow-2xl animate-in slide-in-from-right-8 duration-300">
      
      {/* Header */}
      <div className="h-[60px] border-b border-zinc-800 flex items-center justify-between px-6 shrink-0 bg-[#1C1C1E] z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00bcd4]/10 flex items-center justify-center text-[#00bcd4]">
            <Sparkles size={18} />
          </div>
          <h3 className="text-zinc-200 font-medium">{capability.label}</h3>
        </div>
        {onClose && (
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition-colors">
            <X size={16} />
          </button>
        )}
      </div>

      {/* Body: Form Controls */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
        {regularControls.map(ctrl => {
          // Dynamic visibility check (if needed later)
          if (ctrl.visibleWhen) {
             const isVisible = ctrl.visibleWhen.every(cond => {
               const actualVal = formData[cond.field];
               if (cond.operator === 'equals') return actualVal === cond.value;
               if (cond.operator === 'not_equals') return actualVal !== cond.value;
               return true; // Simplified
             });
             if (!isVisible) return null;
          }

          return (
            <DynamicControlRenderer
              key={ctrl.id}
              control={ctrl}
              value={formData[ctrl.paramKey]}
              onChange={(val) => handleControlChange(ctrl.paramKey, val)}
              supportedReferenceRoles={capability.supportedReferenceRoles}
              disabled={isGenerating}
            />
          );
        })}
        {error && (
          <div className="text-red-400 text-sm bg-red-400/10 p-3 rounded-xl border border-red-400/20">
            {error}
          </div>
        )}
      </div>

      {/* Footer: Generate Button */}
      {generateBtnControl && (
        <div className="p-6 border-t border-zinc-800 bg-[#1C1C1E]">
          <button 
            disabled={isGenerating}
            onClick={handleGenerate}
            className="w-full bg-gradient-to-r from-[#00bcd4] to-[#0092a8] hover:from-[#00cbe6] hover:to-[#00a2bb] disabled:from-zinc-700 disabled:to-zinc-600 disabled:text-zinc-400 text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-[#00bcd4]/20 transition-all active:scale-[0.98]"
          >
            {isGenerating ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>生成中...</span>
              </>
            ) : (
              <>
                <Sparkles size={18} />
                <span>{generateBtnControl.label}</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
