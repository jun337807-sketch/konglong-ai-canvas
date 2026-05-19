import React, { useState, useEffect, useMemo } from 'react';
import { SharedAsset } from '../../types/workspace';
import { groupAssetService } from '../../services/groupAssetService';
import { Search, Image as ImageIcon, Briefcase, Film } from 'lucide-react';

const sharedAssetCategories = ['全部', '人物', '场景', '单帧画面', '视频'];

function assetCategory(asset: SharedAsset) {
  return asset.tags?.[0] || asset.type || '单帧画面';
}

export function SharedAssetLibrary({ groupId }: { groupId: string }) {
  const [assets, setAssets] = useState<SharedAsset[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');

  useEffect(() => {
    loadAssets();
  }, [groupId]);

  const loadAssets = async () => {
    const list = await groupAssetService.getAssetsByGroup(groupId);
    setAssets(list);
  };

  const visibleAssets = useMemo(() => {
    return assets.filter(asset => {
      const cat = assetCategory(asset);
      const matchesCategory = category === '全部' || cat === category;
      const matchesQuery = !query.trim() || `${asset.name} ${cat}`.toLowerCase().includes(query.trim().toLowerCase());
      return matchesCategory && matchesQuery;
    });
  }, [assets, category, query]);

  return (
    <div className="w-full h-full flex flex-col bg-[#1A1C20] border-r border-[#2C2E33]">
      <div className="p-4 border-b border-[#2C2E33] flex items-center justify-between">
        <h2 className="font-semibold text-white flex items-center gap-2">
          <Briefcase size={16} /> 组内共享资产库
        </h2>
        <span className="text-xs text-zinc-500">{assets.length} 项</span>
      </div>

      <div className="p-3 border-b border-zinc-800/60 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索资产..."
            className="w-full bg-[#111214] border border-zinc-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-[#00bcd4]"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {sharedAssetCategories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${category === cat ? 'bg-[#00bcd4]/20 text-[#00e5ff] border border-[#00bcd4]/30' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 border border-transparent'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-3 pb-20 custom-scrollbar content-start">
        {visibleAssets.length === 0 ? (
          <div className="col-span-2 text-center text-zinc-500 text-sm mt-10 leading-relaxed">
            暂无资产，所有组成员在画布中上传或生成的资产将汇总于此。
          </div>
        ) : visibleAssets.map(asset => {
          const cat = assetCategory(asset);
          const isVideo = cat === '视频' || asset.type === '视频';
          return (
            <div key={asset.asset_id} className="relative group cursor-pointer border border-[#2C2E33] rounded-xl overflow-hidden h-28 bg-[#111214] hover:border-[#00bcd4]/50 transition-colors shadow-[0_8px_24px_rgba(0,0,0,0.25)]">
              {asset.thumbnail_url || asset.url ? (
                isVideo ? (
                  <div className="w-full h-full bg-black flex items-center justify-center text-zinc-500">
                    <Film size={28} />
                  </div>
                ) : (
                  <img src={asset.thumbnail_url || asset.url} className="w-full h-full object-cover" />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center text-zinc-700"><ImageIcon size={24} /></div>
              )}
              <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/70 backdrop-blur rounded-md text-[10px] text-[#00e5ff] border border-[#00bcd4]/30">
                {cat}
              </div>
              <div className="absolute inset-x-0 bottom-0 py-1.5 px-2 bg-black/75 backdrop-blur text-[11px] text-white truncate">
                {asset.name}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}