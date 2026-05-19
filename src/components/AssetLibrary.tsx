import React, { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Video, FileAudio, Folder } from 'lucide-react';
import { assetManager, Asset } from '../services/assetManager';
import { assetCategories } from '../config/assetRoles';

interface AssetLibraryProps {
  projectId: string;
  onClose: () => void;
}

export function AssetLibrary({ projectId, onClose }: AssetLibraryProps) {
  const [assets, setAssets] = useState<Asset[]>([]);

  useEffect(() => {
    assetManager.getAssets(projectId).then(setAssets);
  }, [projectId]);

  return (
    <div className="absolute right-0 top-0 bottom-0 w-[400px] bg-[#1C1C1E] border-l border-zinc-800/80 shadow-2xl z-[250] flex flex-col transform transition-transform animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between p-6 border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <Folder size={20} className="text-[#00bcd4]" />
          <h2 className="text-lg font-bold text-white">资产库 (Asset Library)</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-xl text-zinc-400 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
        {assets.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500 gap-3">
            <ImageIcon size={48} className="opacity-20" />
            <p>项目暂无资产</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {assets.map(asset => (
              <div key={asset.id} className="bg-[#111214] border border-zinc-800 rounded-xl p-3 hover:border-zinc-600 transition-colors cursor-pointer group">
                <div className="aspect-square bg-zinc-900 rounded-lg overflow-hidden flex items-center justify-center mb-2 relative">
                  {asset.type === 'image' && <img src={asset.url} alt="asset" className="w-full h-full object-cover" />}
                  {asset.type === 'video' && <Video size={24} className="text-zinc-500" />}
                  {asset.type === 'audio' && <FileAudio size={24} className="text-zinc-500" />}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <span className="text-xs text-white font-medium bg-black/60 px-2 py-1 rounded">使用</span>
                  </div>
                </div>
                <p className="text-xs text-zinc-400 truncate">{asset.name}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
