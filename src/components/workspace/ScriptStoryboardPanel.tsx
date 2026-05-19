import React, { useState, useEffect, useRef } from 'react';
import { scriptStoryboardService } from '../../services/scriptStoryboardService';
import { beatService } from '../../services/beatService';
import { annotationService } from '../../services/annotationService';
import { groupAssetService } from '../../services/groupAssetService';
import { Episode, Beat, Annotation, SharedAsset } from '../../types/workspace';
import { Plus, List, Search, Upload, ChevronLeft, MessageSquare, Paperclip, CheckCircle, Trash2, Download, FolderDown } from 'lucide-react';
import JSZip from 'jszip';

export function ScriptStoryboardPanel({ projectId, groupId }: { projectId: string; groupId: string }) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [selectedEp, setSelectedEp] = useState<string | null>(null);
  
  // Beat Details State
  const [selectedBeat, setSelectedBeat] = useState<Beat | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [newAnnotation, setNewAnnotation] = useState('');
  const [assets, setAssets] = useState<SharedAsset[]>([]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadEpisodes();
  }, [projectId]);

  const loadEpisodes = async () => {
    const eps = await scriptStoryboardService.getEpisodesByProject(projectId);
    setEpisodes(eps);
    if (eps.length > 0 && !selectedEp) setSelectedEp(eps[0].episode_id);
  };

  useEffect(() => {
    if (selectedEp) {
      loadBeats(selectedEp);
    } else {
      setBeats([]);
      setSelectedBeat(null);
    }
  }, [selectedEp]);

  useEffect(() => {
    if (selectedBeat) {
      loadBeatDetails(selectedBeat);
    }
  }, [selectedBeat]);

  const loadBeats = async (epId: string) => {
    const bts = await beatService.getBeatsByEpisode(epId);
    setBeats(bts);
  };
  
  const loadBeatDetails = async (beat: Beat) => {
    const anns = await annotationService.getAnnotationsByTarget('beat', beat.beat_id);
    setAnnotations(anns);
    
    // Load group assets
    const groupAssets = await groupAssetService.getAssetsByGroup(groupId);
    // Filter to ones linked to this beat
    const linkedAssets = groupAssets.filter(a => beat.required_asset_ids?.includes(a.asset_id));
    setAssets(linkedAssets);
  };

  const handleCreateEp = async () => {
    const ep = await scriptStoryboardService.createEpisode({ project_id: projectId, title: `第 ${episodes.length + 1} 集` });
    await loadEpisodes();
    setSelectedEp(ep.episode_id);
  };

  const handleCreateBeat = async (title?: string, scriptText?: string) => {
    if (!selectedEp) return;
    await beatService.createBeat({ episode_id: selectedEp, title: title || `Beat ${beats.length + 1}`, script_text: scriptText });
    await loadBeats(selectedEp);
  };

  const handleDeleteEp = async (e: React.MouseEvent, epId: string) => {
    e.stopPropagation();
    e.preventDefault();
    await scriptStoryboardService.deleteEpisode(epId);
    if (selectedEp === epId) setSelectedEp(null);
    await loadEpisodes();
  };

  const handleDeleteBeat = async (e: React.MouseEvent, beatId: string) => {
    e.stopPropagation();
    e.preventDefault();
    await beatService.deleteBeat(beatId);
    if (selectedEp) await loadBeats(selectedEp);
  };

  // Auto split script
  const handleScriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const fileName = file.name.replace(/\.[^/.]+$/, "");
      let text = '';
      
      if (file.name.toLowerCase().endsWith('.docx')) {
         const arrayBuffer = await file.arrayBuffer();
         // @ts-ignore
         const mammoth = await import('mammoth');
         const result = await mammoth.extractRawText({ arrayBuffer });
         text = result.value;
      } else if (file.name.toLowerCase().endsWith('.doc') || file.name.toLowerCase().endsWith('.wps')) {
         alert('暂不支持老版 .doc 或 .wps 格式，请在办公软件中另存为 .docx 或 .txt 后重试');
         if (fileInputRef.current) fileInputRef.current.value = '';
         return;
      } else {
         const arrayBuffer = await file.arrayBuffer();
         const uint8Array = new Uint8Array(arrayBuffer);
         const utf8Decoder = new TextDecoder('utf-8');
         text = utf8Decoder.decode(uint8Array);
         // If UTF-8 parsing resulted in replacement characters, it is likely GBK
         if (text.includes('\uFFFD')) {
             const gbkDecoder = new TextDecoder('gbk');
             text = gbkDecoder.decode(uint8Array);
         }
      }
      
      if (!text) return;
      
      let isEpisodeFormat = false;
      let isBeatFormat = false;
      let isHierarchicalBeatFormat = false;
      
      const linesArr = text.split('\n');
      for (const l of linesArr) {
         const tl = l.trim();
         if (tl.toLowerCase().startsWith('beat') || tl.toLowerCase().startsWith('[beat')) isBeatFormat = true;
         if (tl.match(/^\[Beat\s+\d+/i)) isHierarchicalBeatFormat = true;
         if (tl.match(/^(?:#\s*)?第.*集/)) isEpisodeFormat = true;
      }

      let eps: { title: string, content: string }[] = [];
      
      if (isEpisodeFormat) {
          // Splitting by "# 第X集" or "第X集"
          const epChunks = text.split(/(?=^\s*(?:#\s*)?第.*集)/m).filter(c => c.trim() !== '');
          for (const chunk of epChunks) {
              const lines = chunk.split('\n');
              let title = lines[0].trim();
              // Remove "# " if present
              title = title.replace(/^#\s*/, '');
              const content = lines.slice(1).join('\n').trim();
              eps.push({ title, content: content || chunk });
          }
      } else {
          eps.push({ title: fileName || '导入剧本', content: text });
      }

      let isFirstEp = true;

      for (const epData of eps) {
          const ep = await scriptStoryboardService.createEpisode({ 
            project_id: projectId, 
            title: epData.title.length > 50 ? epData.title.substring(0, 50) + '...' : epData.title 
          });
          const epId = ep.episode_id;
          if (isFirstEp) {
              setSelectedEp(epId);
              isFirstEp = false;
          }

          let beatChunks: string[] = [];
          
          if (isHierarchicalBeatFormat) {
              // Split by [Beat X] and keep everything until the next [Beat X]
              // Use regex that matches [Beat X ...] at the start of a line
              beatChunks = epData.content.split(/(?=^\[Beat\s+\d+)/mi).filter(c => c.trim() !== '');
          } else if (isBeatFormat) {
              beatChunks = epData.content.split(/(?=^(?:\[)?beat\b)/im).filter(c => c.trim() !== '');
          } else {
              beatChunks = epData.content.split(/\n\s*\n/).filter(c => c.trim() !== '');
              if (beatChunks.length <= 1) {
                  beatChunks = epData.content.split('\n').filter(c => c.trim() !== '');
              }
          }

          let count = 1;
          for (const bChunk of beatChunks) {
              if (!bChunk.trim()) continue;
              let rawTitle = bChunk.split('\n')[0].trim();
              
              if (isHierarchicalBeatFormat && rawTitle.toLowerCase().startsWith('[beat')) {
                  // Keep full [Beat 1 | Title | ...] as title
                  rawTitle = rawTitle.trim();
              } else if (rawTitle.startsWith('[')) {
                // If it's something like [Beat 1 | Title | Time] but not the full hierarchical match
                rawTitle = rawTitle.replace(/^\[/, '').replace(/\]$/, '').split('|').map(s=>s.trim()).filter(Boolean)[1] || rawTitle;
              }

              let title = rawTitle.length > 100 ? rawTitle.substring(0, 97) + '...' : rawTitle;
              if (!isBeatFormat && !isHierarchicalBeatFormat) {
                 title = title || `Beat ${count}`;
              }
              
              await beatService.createBeat({
                 episode_id: epId,
                 title: title,
                 script_text: bChunk.trim(),
                 beat_number: count++
              });
          }
      }
      
      await loadEpisodes();

    } catch (err) {
      console.error('Failed to parse script file', err);
      alert('解析文件失败，可能是文件损坏或加密。');
    }
    
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExportProjectZip = async () => {
    try {
      const zip = new JSZip();
      const projectFolder = zip.folder(`Project_${projectId}_Export`);
      
      for (const ep of episodes) {
        // Sanitize folder name
        const folderName = ep.title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);
        const epFolder = projectFolder?.folder(folderName);
        
        const epBeats = await beatService.getBeatsByEpisode(ep.episode_id);
        
        // Add a master script for the episode
        epFolder?.file('full_script.txt', ep.script_text || 'No script text');
        
        // Add individual beats as sub-folders
        for (const beat of epBeats) {
          const beatFolderName = beat.title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);
          const beatFolder = epFolder?.folder(beatFolderName);
          
          // Inside beat folder, put the content
          beatFolder?.file('script_text.txt', beat.script_text || '');
          
          // Plus some metadata if needed
          const metadata = {
            beat_id: beat.beat_id,
            beat_number: beat.beat_number,
            title: beat.title,
            asset_count: beat.required_asset_ids?.length || 0,
            annotation_count: beat.annotations?.length || 0
          };
          beatFolder?.file('metadata.json', JSON.stringify(metadata, null, 2));
        }
      }
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Project_Export_${new Date().toISOString().split('T')[0]}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
    } catch (err) {
      console.error('Failed to export ZIP', err);
      alert('导出 ZIP 失败');
    }
  };
  
  const handleAddAnnotation = async () => {
    if (!newAnnotation.trim() || !selectedBeat) return;
    
    await annotationService.createAnnotation({
      group_id: groupId,
      project_id: projectId,
      target_type: 'beat',
      target_id: selectedBeat.beat_id,
      content: newAnnotation.trim()
    });
    setNewAnnotation('');
    loadBeatDetails(selectedBeat);
  };
  
  const handleMockAttachAsset = async () => {
     if (!selectedBeat) return;
     const asset = await groupAssetService.createAsset({
       group_id: groupId,
       project_id: projectId,
       name: '附加资产_' + Date.now(),
       type: 'scene_reference',
       url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=500&auto=format&fit=crop',
       thumbnail_url: 'https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=200&auto=format&fit=crop'
     });
     
     const updatedBeat = await beatService.updateBeat(selectedBeat.beat_id, {
        required_asset_ids: [...(selectedBeat.required_asset_ids || []), asset.asset_id]
     });
     if (updatedBeat) {
       setSelectedBeat(updatedBeat);
       // Refresh list
       if (selectedEp) loadBeats(selectedEp);
     }
  };
  
  const handleToggleAnnotation = async (ann: Annotation) => {
    await annotationService.updateAnnotation(ann.annotation_id, {
       status: ann.status === 'open' ? 'resolved' : 'open'
    });
    if (selectedBeat) loadBeatDetails(selectedBeat);
  };

  // Beat Detail View
  if (selectedBeat) {
    return (
      <div className="w-full h-full flex flex-col bg-[#1A1C20]">
        <div className="p-4 border-b border-[#2C2E33] flex items-center justify-between shadow-sm z-10 shrink-0">
          <button onClick={() => setSelectedBeat(null)} className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors">
            <ChevronLeft size={16} /> <span>返回</span>
          </button>
          <div className="font-semibold text-white truncate px-2">{selectedBeat.title}</div>
          <div className="w-6"></div> {/* spacer */}
        </div>
        
        <div className="flex-1 overflow-y-auto no-scrollbar pb-6 space-y-6">
           <div className="p-4">
              <h3 className="text-sm font-medium text-zinc-400 mb-2 uppercase tracking-wider">剧本正文</h3>
              <div className="bg-[#111214] p-3 rounded-xl border border-zinc-700/50 text-sm text-zinc-300 min-h-[80px] whitespace-pre-wrap leading-relaxed">
                 {selectedBeat.script_text || '暂无内容...'}
              </div>
           </div>
           
           <div className="px-4">
              <div className="flex items-center justify-between mb-3">
                 <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">关联资产</h3>
                 <button onClick={handleMockAttachAsset} className="text-[#00bcd4] hover:text-[#00a6bb] text-xs flex items-center gap-1 transition-colors">
                    <Plus size={14} /> 添加资产
                 </button>
              </div>
              
              <div className="grid grid-cols-3 gap-2">
                 {assets.length === 0 ? (
                   <div className="col-span-3 text-center text-zinc-600 text-xs py-4 bg-[#111214] rounded-xl border border-dashed border-zinc-700">暂无关联资产</div>
                 ) : assets.map(a => (
                   <div key={a.asset_id} className="relative group cursor-pointer border border-[#2C2E33] rounded-lg overflow-hidden h-20 bg-[#111214]">
                     {a.thumbnail_url ? (
                       <img src={a.thumbnail_url} className="w-full h-full object-cover" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center text-zinc-700"><Paperclip size={20} /></div>
                     )}
                   </div>
                 ))}
              </div>
           </div>
           
           <div className="px-4 border-t border-zinc-800 pt-6">
              <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider flex items-center gap-2">
                 <MessageSquare size={14} /> 批注与备注
              </h3>
              
              <div className="space-y-3 mb-4">
                 {annotations.length === 0 ? (
                    <div className="text-zinc-600 justify-center flex py-2 text-xs">暂无批注</div>
                 ) : annotations.map(ann => (
                    <div key={ann.annotation_id} className={`p-3 rounded-xl border ${ann.status === 'open' ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-800 bg-zinc-900 opacity-60'} flex gap-3 text-sm transition-all`}>
                       <button onClick={() => handleToggleAnnotation(ann)} className={`shrink-0 mt-0.5 ${ann.status === 'open' ? 'text-zinc-500 hover:text-green-500' : 'text-green-500'} transition-colors`}>
                          <CheckCircle size={16} />
                       </button>
                       <div className="flex-1">
                          <div className={`text-zinc-200 ${ann.status !== 'open' && 'line-through decoration-zinc-600'}`}>{ann.content}</div>
                          <div className="text-[10px] text-zinc-500 mt-1 flex justify-between">
                             <span>{ann.created_by}</span>
                             <span>{new Date(ann.created_at).toLocaleString()}</span>
                          </div>
                       </div>
                    </div>
                 ))}
              </div>
              
              <div className="flex gap-2">
                 <input 
                   type="text" 
                   value={newAnnotation}
                   onChange={e => setNewAnnotation(e.target.value)}
                   onKeyDown={e => e.key === 'Enter' && handleAddAnnotation()}
                   placeholder="添加新的批注..." 
                   className="flex-1 bg-[#111214] border border-zinc-700 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-[#00bcd4]" 
                 />
                 <button onClick={handleAddAnnotation} disabled={!newAnnotation.trim()} className="px-4 bg-[#00bcd4] hover:bg-[#00a6bb] text-black font-medium disabled:opacity-50 rounded-lg text-sm transition-colors">
                   发送
                 </button>
              </div>
           </div>
        </div>
      </div>
    );
  }

  // List View
  return (
    <div className="w-full h-full flex flex-col bg-[#1A1C20] border-r border-[#2C2E33]">
      <div className="p-4 border-b border-[#2C2E33] flex items-center gap-2">
        <h2 className="font-semibold text-white flex-1">剧本与分镜库</h2>
        <input 
           type="file" 
           accept=".txt,.md,.doc,.docx,.wps" 
           className="hidden" 
           ref={fileInputRef} 
           onChange={handleScriptUpload}
        />
        <button 
           className="text-zinc-400 hover:text-[#00bcd4] tooltip relative transition-colors" 
           title="上传剧本并自动拆分"
           onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={16} />
        </button>
        <button 
           className="text-zinc-400 hover:text-[#00bcd4] tooltip relative transition-colors" 
           title="打包导出分级目录 ZIP"
           onClick={handleExportProjectZip}
        >
          <FolderDown size={16} />
        </button>
        <button className="text-zinc-400 hover:text-white transition-colors tooltip relative" title="新建分集" onClick={handleCreateEp}>
          <Plus size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {episodes.map(ep => (
          <div key={ep.episode_id} className="border-b border-[#2C2E33]/50">
            <div 
              className={`p-3 cursor-pointer hover:bg-zinc-800 transition-colors flex items-center gap-2 group/ep ${selectedEp === ep.episode_id ? 'bg-zinc-800 text-[#00bcd4]' : 'text-zinc-300'}`}
              onClick={() => setSelectedEp(ep.episode_id)}
            >
              <List size={14} />
              <span className="font-medium text-sm flex-1 truncate">{ep.title}</span>
              <span className="text-xs text-zinc-500 bg-zinc-950 px-1.5 rounded mr-1">{beats.length > 0 && selectedEp === ep.episode_id ? beats.length : ''}</span>
              <button className="text-zinc-500 hover:text-red-500 opacity-0 group-hover/ep:opacity-100 transition-opacity p-0.5" onClick={(e) => handleDeleteEp(e, ep.episode_id)}>
                 <Trash2 size={14} />
              </button>
            </div>
            
            {selectedEp === ep.episode_id && (
              <div className="pl-6 pr-3 py-2 space-y-2 bg-[#1E2024]">
                {beats.map(beat => (
                  <div 
                    key={beat.beat_id} 
                    onClick={() => setSelectedBeat(beat)}
                    className="p-2 rounded bg-zinc-800/80 border border-zinc-700/50 hover:border-[#00bcd4]/50 cursor-pointer transition-colors group relative"
                  >
                    <div className="text-sm font-medium text-white mb-1 flex items-center justify-between">
                       <span className="truncate pr-2">Beat {beat.beat_number}</span>
                       <button className="text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 z-10" onClick={(e) => handleDeleteBeat(e, beat.beat_id)}>
                         <Trash2 size={12} />
                       </button>
                    </div>
                    <div className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{beat.script_text || beat.title}</div>
                    
                    {(beat.required_asset_ids?.length > 0 || beat.annotations?.length > 0) && (
                      <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-700/50 text-[10px] text-zinc-500">
                         {beat.required_asset_ids?.length > 0 && <span className="flex items-center gap-1"><Paperclip size={10} /> {beat.required_asset_ids.length}</span>}
                         {beat.annotations?.length > 0 && <span className="flex items-center gap-1"><MessageSquare size={10} /> {beat.annotations.length}</span>}
                      </div>
                    )}
                  </div>
                ))}
                <button 
                  onClick={() => handleCreateBeat()}
                  className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-zinc-500 hover:text-[#00bcd4] hover:border-[#00bcd4] text-xs transition-colors flex items-center justify-center gap-1 mt-2"
                >
                  <Plus size={14} /> 新增 Beat
                </button>
              </div>
            )}
          </div>
        ))}
        {episodes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-sm text-zinc-500 px-6 text-center">
             暂无剧本数据，你可以上传TXT/MD文件自动拆分为多个Beat。
          </div>
        )}
      </div>
    </div>
  );
}

