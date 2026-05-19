import React, { useState, useEffect } from 'react';
import { SharedAsset } from '../../types/workspace';
import { groupAssetService } from '../../services/groupAssetService';
import { Search, Image as ImageIcon, Briefcase } from 'lucide-react';

export function SharedAssetLibrary({ groupId }: { groupId: string }) {
  const [assets, setAssets] = useState<SharedAsset[]>([]);

  useEffect(() => {
    loadAssets();
  }, [groupId]);

  const loadAssets = async () => {
    const list = await groupAssetService.getAssetsByGroup(groupId);
    setAssets(list);
  };

  return (
    <div className="w-full h-full flex flex-col bg-[#1A1C20] border-r border-[#2C2E33]">
      <div className="p-4 border-b border-[#2C2E33] flex items-center justify-between">
        <h2 className="font-semibold text-white flex items-center gap-2">
           <Briefcase size={16} /> 组内共享资产库
        </h2>
      </div>
      <div className="p-3">
         <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
            <input type="text" placeholder="搜索资产..." className="w-full bg-[#111214] border border-zinc-700 rounded-md py-1.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-[#00bcd4]" />
         </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-3 pb-20">
         {assets.length === 0 ? (
           <div className="col-span-2 text-center text-zinc-500 text-sm mt-10">暂无资产，所有组成员在画布中上传或生成的资产将汇总于此。</div>
         ) : assets.map(a => (
           <div key={a.asset_id} className="relative group cursor-pointer border border-[#2C2E33] rounded-lg overflow-hidden h-24 bg-[#111214]">
             {a.thumbnail_url ? (
               <img src={a.thumbnail_url} className="w-full h-full object-cover" />
             ) : (
               <div className="w-full h-full flex items-center justify-center text-zinc-700"><ImageIcon size={24} /></div>
             )}
             <div className="absolute inset-x-0 bottom-0 py-1 px-2 bg-black/70 backdrop-blur text-[10px] text-white truncate">
               {a.name}
             </div>
           </div>
         ))}
      </div>
    </div>
  );
}
