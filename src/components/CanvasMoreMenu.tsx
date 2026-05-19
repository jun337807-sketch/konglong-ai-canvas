import React from 'react';
import * as Icons from 'lucide-react';
import { canvasMoreActions } from '../config/canvasMoreActions';

interface CanvasMoreMenuProps {
  onAction: (actionId: string) => void;
  onClose: () => void;
}

export function CanvasMoreMenu({ onAction, onClose }: CanvasMoreMenuProps) {
  return (
    <div className="absolute top-16 right-0 w-64 bg-[#1C1C1E] border border-zinc-800/80 shadow-2xl rounded-2xl py-2 z-[250] animate-in slide-in-from-top-2 fade-in duration-200">
      {canvasMoreActions.map((action, index) => {
        if (action.id.startsWith('divider')) {
          return <div key={action.id} className="h-px bg-zinc-800/50 my-2 mx-4" />;
        }
        
        const Icon = (Icons as any)[action.icon || 'Circle'];
        
        return (
          <button
            key={action.id}
            onClick={() => {
              onAction(action.id);
              onClose();
            }}
            className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/50 text-zinc-300 hover:text-white transition-colors group"
          >
            <div className="text-zinc-500 group-hover:text-[#00bcd4] transition-colors">
              <Icon size={16} />
            </div>
            <span className="text-sm font-medium">{action.label}</span>
          </button>
        );
      })}
    </div>
  );
}
