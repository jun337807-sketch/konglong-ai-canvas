import React, { useState, useMemo } from 'react';
import { MediaHistoryService, MediaHistoryItem } from '../services/mediaHistoryService';
import { X, Trash2, CheckSquare, Search, Minus, Plus, ArrowDownUp } from 'lucide-react';
import { useReactFlow } from '@xyflow/react';

export function HistoryPanel({ 
  projectId, 
  onClose 
}: { 
  projectId: string, 
  onClose: () => void 
}) {
  const [activeTab, setActiveTab] = useState<'image' | 'video' | 'audio'>('image');
  const [history, setHistory] = useState<MediaHistoryItem[]>(MediaHistoryService.getHistory());
  const [previewMedia, setPreviewMedia] = useState<MediaHistoryItem | null>(null);
  
  const { setNodes, getNodes } = useReactFlow();

  const groupedHistory = useMemo(() => {
    const filtered = history.filter(h => h.type === activeTab);
    const groups: { [key: string]: MediaHistoryItem[] } = {};
    
    filtered.forEach(item => {
      const date = item.createdAt.split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    
    // Sort dates descending
    const sortedDates = Object.keys(groups).sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    return sortedDates.map(date => ({
      date,
      items: groups[date].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }));
  }, [history, activeTab]);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    MediaHistoryService.removeHistory(id);
    setHistory(MediaHistoryService.getHistory());
  };

  const handleUse = (e: React.MouseEvent, item: MediaHistoryItem) => {
    e.stopPropagation();
    
    // Find a somewhat central position or just top-left of current view
    const currentNodes = getNodes();
    let newNodeX = 0;
    let newNodeY = 0;
    if (currentNodes.length > 0) {
      newNodeX = currentNodes[currentNodes.length - 1].position.x + 400;
      newNodeY = currentNodes[currentNodes.length - 1].position.y;
    }
    
    if (item.type === 'image') {
       setNodes(nds => [...nds, {
          id: `img-${crypto.randomUUID()}`,
          type: 'imageNode',
          position: { x: newNodeX, y: newNodeY },
          data: { imageUrl: item.url }
       }]);
    } else if (item.type === 'video') {
       setNodes(nds => [...nds, {
          id: `vid-${crypto.randomUUID()}`,
          type: 'resultNode',
          position: { x: newNodeX, y: newNodeY },
          data: { videoUrl: item.url }
       }]);
    } else if (item.type === 'audio') {
       setNodes(nds => [...nds, {
          id: `aud-${crypto.randomUUID()}`,
          type: 'resultNode', // Or specialized audio node
          position: { x: newNodeX, y: newNodeY },
          data: { audioUrl: item.url } // Assuming you might have audioUrl
       }]);
    }
    onClose();
  };

  const counts = useMemo(() => {
    return {
      image: history.filter(h => h.type === 'image').length,
      video: history.filter(h => h.type === 'video').length,
      audio: history.filter(h => h.type === 'audio').length,
    }
  }, [history]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div className="w-[90vw] max-w-[1200px] h-[85vh] bg-[#1E1E1E] rounded-2xl border border-zinc-800 shadow-2xl flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800 flex items-center justify-between bg-[#1E1E1E]">
          <div className="flex gap-6">
            <button 
              onClick={() => setActiveTab('image')}
              className={`text-sm font-medium transition-colors ${activeTab === 'image' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              图片历史({counts.image})
            </button>
            <button 
              onClick={() => setActiveTab('video')}
              className={`text-sm font-medium transition-colors ${activeTab === 'video' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              视频历史({counts.video})
            </button>
            <button 
              onClick={() => setActiveTab('audio')}
              className={`text-sm font-medium transition-colors ${activeTab === 'audio' ? 'text-zinc-100' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              音频历史({counts.audio})
            </button>
          </div>
          
          <div className="flex items-center gap-3">
             <button className="px-3 py-1.5 bg-zinc-800/80 hover:bg-zinc-700/80 rounded-lg text-xs font-medium text-zinc-300 flex items-center gap-1.5 transition-colors">
               <CheckSquare size={14} /> 批量操作
             </button>
             
             <div className="flex items-center bg-zinc-800/80 rounded-lg px-2 py-1 gap-2">
               <button className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"><Minus size={14} /></button>
               <span className="text-xs font-medium text-zinc-300 px-1">100%</span>
               <button className="p-1 text-zinc-400 hover:text-zinc-200 transition-colors"><Plus size={14} /></button>
             </div>
             
             <button className="p-2 text-zinc-400 hover:text-zinc-200 transition-colors">
               <ArrowDownUp size={16} />
             </button>
             
             <div className="w-px h-4 bg-zinc-700 mx-1"></div>
             
             <button onClick={onClose} className="p-2 text-zinc-400 hover:text-rose-400 transition-colors">
               <X size={18} />
             </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 bg-[#161616] custom-scrollbar">
           {groupedHistory.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                <Search size={32} className="mb-4 opacity-50" />
                <p>暂无{activeTab === 'image' ? '图片' : activeTab === 'video' ? '视频' : '音频'}历史记录</p>
             </div>
           ) : (
             <div className="space-y-8">
               {groupedHistory.map(group => (
                 <div key={group.date}>
                    <h3 className="text-sm font-medium text-zinc-100 mb-4">{group.date}</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                       {group.items.map(item => (
                         <div key={item.id} className="group relative aspect-square bg-zinc-800 rounded-xl overflow-hidden border border-zinc-800/50 hover:border-[#00bcd4]/50 transition-colors shadow-sm cursor-pointer">
                            {item.type === 'image' ? (
                              <img src={item.url} alt="" className="w-full h-full object-cover select-none" />
                            ) : item.type === 'video' ? (
                              <video src={item.url} className="w-full h-full object-cover select-none" preload="metadata" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-zinc-800 text-zinc-500">
                                音频 ({item.url.split('/').pop()})
                              </div>
                            )}
                            
                            {/* Hover Overlay */}
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                               <button 
                                 onClick={(e) => handleDelete(e, item.id)}
                                 className="absolute top-2 right-2 p-1.5 bg-zinc-900/80 hover:bg-rose-500 text-zinc-300 hover:text-white rounded-lg transition-colors"
                               >
                                  <Trash2 size={14} />
                               </button>
                               
                               <div className="flex items-center justify-center gap-4 w-full px-4">
                                  <button onClick={(e) => { e.stopPropagation(); setPreviewMedia(item); }} className="text-sm font-medium text-white hover:text-[#00bcd4] transition-colors drop-shadow-md">
                                    查看
                                  </button>
                                  <button onClick={(e) => handleUse(e, item)} className="text-sm font-medium text-white hover:text-[#00bcd4] transition-colors drop-shadow-md">
                                    使用
                                  </button>
                               </div>
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
               ))}
             </div>
           )}
        </div>
      </div>
      
      {/* Preview Dialog */}
      {previewMedia && (
        <div className="fixed inset-0 z-[250] bg-black/90 flex items-center justify-center" onClick={() => setPreviewMedia(null)}>
           <button className="absolute top-6 right-6 p-2 text-white/50 hover:text-white bg-white/10 hover:bg-white/20 rounded-full transition-all" onClick={() => setPreviewMedia(null)}>
              <X size={24} />
           </button>
           <div className="max-w-[80vw] max-h-[80vh] flex items-center justify-center rounded-xl overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
              {previewMedia.type === 'image' && <img src={previewMedia.url} className="max-w-full max-h-[80vh] object-contain" alt="Preview" />}
              {previewMedia.type === 'video' && <video src={previewMedia.url} className="max-w-full max-h-[80vh]" controls autoPlay />}
              {previewMedia.type === 'audio' && <audio src={previewMedia.url} controls autoPlay />}
           </div>
        </div>
      )}
    </div>
  );
}
