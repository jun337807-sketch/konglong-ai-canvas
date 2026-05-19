import React from 'react';
import { X, Sparkles } from 'lucide-react';
import { promptTemplates } from '../config/promptTemplates';

interface PromptTemplatePanelProps {
  onSelect: (template: string) => void;
  onClose: () => void;
}

export function PromptTemplatePanel({ onSelect, onClose }: PromptTemplatePanelProps) {
  return (
    <div className="absolute right-0 top-0 bottom-0 w-[400px] bg-[#1C1C1E] border-l border-zinc-800/80 shadow-2xl z-[250] flex flex-col transform transition-transform animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between p-6 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <Sparkles size={20} className="text-[#00bcd4]" />
          <h2 className="text-lg font-bold text-white">提示词模板</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
        {promptTemplates.map(template => (
          <div 
            key={template.id} 
            onClick={() => {
              onSelect(template.template);
              onClose();
            }}
            className="bg-[#111214] border border-zinc-800 rounded-xl p-4 hover:border-[#00bcd4]/50 cursor-pointer transition-colors group"
          >
            <h4 className="text-sm font-medium text-white group-hover:text-[#00bcd4] transition-colors">{template.name}</h4>
            <p className="text-xs text-zinc-400 mt-1">{template.description}</p>
            <div className="mt-3 p-2 bg-zinc-900 rounded-lg text-xs text-zinc-500 font-mono leading-relaxed line-clamp-3">
              {template.template}
            </div>
            <div className="mt-3 flex gap-2 flex-wrap">
              {template.variables.map(v => (
                <span key={v} className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded">
                  {'{'}{v}{'}'}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
