import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import { scriptStoryboardService } from '../../services/scriptStoryboardService';
import { beatService } from '../../services/beatService';
import { annotationService } from '../../services/annotationService';
import { groupAssetService } from '../../services/groupAssetService';
import { assetManager, Asset } from '../../services/assetManager';
import { Episode, Beat, Annotation, SharedAsset } from '../../types/workspace';
import { Plus, List, Search, Upload, ChevronLeft, MessageSquare, Paperclip, CheckCircle, Trash2, FolderDown, Image as ImageIcon, X, Pencil, Save } from 'lucide-react';

type SourceTab = 'project' | 'entities' | 'shared' | 'upload';
type EntityAsset = { id: string; imageUrl: string; title: string; category?: string };

const assetCategories = ['人物', '场景', '单帧画面', '视频', '道具', '其他'];

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('文件读取失败'));
    reader.readAsDataURL(file);
  });
}

function inferUploadCategory(file: File) {
  if (file.type.startsWith('video/')) return '视频';
  const text = file.name.toLowerCase();
  if (/person|character|face|portrait|人物|角色|主体/.test(text)) return '人物';
  if (/scene|env|bg|场景|环境/.test(text)) return '场景';
  if (/prop|item|道具/.test(text)) return '道具';
  return '单帧画面';
}

function sharedTypeFromCategory(category: string) {
  if (category === '人物') return 'character_reference';
  if (category === '场景') return 'scene_reference';
  if (category === '道具') return 'prop_reference';
  if (category === '视频') return 'video';
  return 'frame_reference';
}

function categoryOf(asset: SharedAsset) {
  return asset.tags?.[0] || (asset.type === 'video' ? '视频' : '单帧画面');
}

function isVideoAsset(asset: SharedAsset) {
  return categoryOf(asset) === '视频' || asset.type === 'video' || /\.(mp4|mov|webm)(\?|$)/i.test(asset.url || '');
}

function sharedAssetDragPayload(asset: SharedAsset) {
  return JSON.stringify({
    asset_id: asset.asset_id,
    name: asset.name,
    url: asset.url,
    thumbnail_url: asset.thumbnail_url,
    type: asset.type,
    category: categoryOf(asset),
    tags: asset.tags || [],
  });
}

export function ScriptStoryboardPanel({ projectId, groupId }: { projectId: string; groupId: string }) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [beats, setBeats] = useState<Beat[]>([]);
  const [selectedEp, setSelectedEp] = useState<string | null>(null);
  const [selectedBeat, setSelectedBeat] = useState<Beat | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [newAnnotation, setNewAnnotation] = useState('');
  const [assets, setAssets] = useState<SharedAsset[]>([]);
  const [allSharedAssets, setAllSharedAssets] = useState<SharedAsset[]>([]);
  const [projectAssets, setProjectAssets] = useState<Asset[]>([]);
  const [entityAssets, setEntityAssets] = useState<EntityAsset[]>([]);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);
  const [sourceTab, setSourceTab] = useState<SourceTab>('shared');
  const [assetQuery, setAssetQuery] = useState('');
  const [uploadCategory, setUploadCategory] = useState('单帧画面');
  const [isDraggingAsset, setIsDraggingAsset] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<SharedAsset | null>(null);
  const [assetAnnotations, setAssetAnnotations] = useState<Annotation[]>([]);
  const [newAssetAnnotation, setNewAssetAnnotation] = useState('');
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editingAnnotationText, setEditingAnnotationText] = useState('');
  const [editingBeatAnnotationId, setEditingBeatAnnotationId] = useState<string | null>(null);
  const [editingBeatAnnotationText, setEditingBeatAnnotationText] = useState('');

  const scriptFileInputRef = useRef<HTMLInputElement>(null);
  const beatAssetUploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadEpisodes(); }, [projectId]);
  useEffect(() => { selectedEp ? loadBeats(selectedEp) : (setBeats([]), setSelectedBeat(null)); }, [selectedEp]);
  useEffect(() => { if (selectedBeat) loadBeatDetails(selectedBeat); }, [selectedBeat, groupId, projectId]);
  useEffect(() => { if (previewAsset) loadAssetAnnotations(previewAsset.asset_id); }, [previewAsset?.asset_id]);

  const loadEpisodes = async () => {
    const eps = await scriptStoryboardService.getEpisodesByProject(projectId);
    setEpisodes(eps);
    if (eps.length > 0 && !selectedEp) setSelectedEp(eps[0].episode_id);
  };

  const loadBeats = async (epId: string) => setBeats(await beatService.getBeatsByEpisode(epId));

  const loadBeatDetails = async (beat: Beat) => {
    const [anns, shared, projectList] = await Promise.all([
      annotationService.getAnnotationsByTarget('beat', beat.beat_id),
      groupAssetService.getAssetsByGroup(groupId),
      assetManager.getAssets(projectId).catch(() => [])
    ]);
    setAnnotations(anns);
    setAllSharedAssets(shared);
    setProjectAssets(projectList);
    setAssets(shared.filter(asset => beat.required_asset_ids?.includes(asset.asset_id)));
    try {
      const stored = localStorage.getItem(`canvas_my_entities_${projectId}`) || localStorage.getItem('canvas_my_entities');
      setEntityAssets(stored ? JSON.parse(stored) : []);
    } catch { setEntityAssets([]); }
  };

  const refreshSelectedBeat = async (beatId: string) => {
    if (!selectedEp) return;
    const list = await beatService.getBeatsByEpisode(selectedEp);
    setBeats(list);
    const nextBeat = list.find(item => item.beat_id === beatId) || null;
    setSelectedBeat(nextBeat);
    if (nextBeat) await loadBeatDetails(nextBeat);
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
    await scriptStoryboardService.deleteEpisode(epId);
    if (selectedEp === epId) setSelectedEp(null);
    await loadEpisodes();
  };

  const handleDeleteBeat = async (e: React.MouseEvent, beatId: string) => {
    e.stopPropagation();
    await beatService.deleteBeat(beatId);
    if (selectedEp) await loadBeats(selectedEp);
  };

  const handleScriptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const arrayBuffer = await file.arrayBuffer();
      let text = new TextDecoder('utf-8').decode(new Uint8Array(arrayBuffer));
      if (text.includes('\uFFFD')) text = new TextDecoder('gbk').decode(new Uint8Array(arrayBuffer));
      if (!text.trim()) return;
      const ep = await scriptStoryboardService.createEpisode({ project_id: projectId, title: file.name.replace(/\.[^/.]+$/, '') || '导入剧本', script_text: text });
      setSelectedEp(ep.episode_id);
      const chunks = text.split(/\n\s*\n/).map(item => item.trim()).filter(Boolean);
      const beatChunks = chunks.length > 1 ? chunks : text.split('\n').map(item => item.trim()).filter(Boolean);
      for (let i = 0; i < beatChunks.length; i += 1) {
        const chunk = beatChunks[i];
        await beatService.createBeat({ episode_id: ep.episode_id, title: chunk.split('\n')[0].slice(0, 80) || `Beat ${i + 1}`, script_text: chunk, beat_number: i + 1 });
      }
      await loadEpisodes();
      await loadBeats(ep.episode_id);
    } catch (err) {
      console.error('Failed to parse script file', err);
      alert('解析剧本文件失败，请尝试 txt/md/docx 文本文件。');
    } finally {
      if (scriptFileInputRef.current) scriptFileInputRef.current.value = '';
    }
  };

  const handleExportProjectZip = async () => {
    try {
      const zip = new JSZip();
      const projectFolder = zip.folder(`Project_${projectId}_Export`);
      for (const ep of episodes) {
        const epFolder = projectFolder?.folder(ep.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100));
        const epBeats = await beatService.getBeatsByEpisode(ep.episode_id);
        epFolder?.file('full_script.txt', ep.script_text || '');
        for (const beat of epBeats) {
          const beatFolder = epFolder?.folder(beat.title.replace(/[\\/:*?"<>|]/g, '_').slice(0, 100));
          beatFolder?.file('script_text.txt', beat.script_text || '');
          beatFolder?.file('metadata.json', JSON.stringify(beat, null, 2));
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
    } catch (err) { console.error('Failed to export ZIP', err); alert('导出 ZIP 失败'); }
  };

  const ensureSharedAsset = async (asset: SharedAsset | Asset | EntityAsset, category = '单帧画面') => {
    if ('asset_id' in asset) return asset;
    const url = 'url' in asset ? asset.url : asset.imageUrl;
    const name = 'name' in asset ? asset.name : asset.title;
    return groupAssetService.createAsset({ group_id: groupId, project_id: projectId, name, url, thumbnail_url: url, type: sharedTypeFromCategory(category), tags: [category], created_by: localStorage.getItem('dino_currentUser') || 'system' });
  };

  const linkAssetToBeat = async (asset: SharedAsset | Asset | EntityAsset, category?: string) => {
    if (!selectedBeat) return;
    const targetCategory = category || ('asset_id' in asset ? categoryOf(asset) : ('type' in asset && asset.type === 'video' ? '视频' : '单帧画面'));
    const sharedAsset = await ensureSharedAsset(asset, targetCategory);
    const nextIds = Array.from(new Set([...(selectedBeat.required_asset_ids || []), sharedAsset.asset_id]));
    await Promise.all([
      beatService.updateBeat(selectedBeat.beat_id, { required_asset_ids: nextIds }),
      groupAssetService.updateAsset(sharedAsset.asset_id, { linked_beat_ids: Array.from(new Set([...(sharedAsset.linked_beat_ids || []), selectedBeat.beat_id])), linked_episode_ids: selectedEp ? Array.from(new Set([...(sharedAsset.linked_episode_ids || []), selectedEp])) : sharedAsset.linked_episode_ids })
    ]);
    setAssetPickerOpen(false);
    await refreshSelectedBeat(selectedBeat.beat_id);
  };

  const uploadFilesToBeat = async (files: FileList | File[]) => {
    if (!selectedBeat) return;
    const list = Array.from(files).filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
    for (const file of list) {
      const url = await readFileAsDataUrl(file);
      const category = uploadCategory || inferUploadCategory(file);
      const sharedAsset = await groupAssetService.createAsset({ group_id: groupId, project_id: projectId, name: file.name.replace(/\.[^/.]+$/, '') || '未命名资产', url, thumbnail_url: file.type.startsWith('image/') ? url : undefined, type: sharedTypeFromCategory(category), tags: [category], linked_beat_ids: [selectedBeat.beat_id], linked_episode_ids: selectedEp ? [selectedEp] : [], created_by: localStorage.getItem('dino_currentUser') || 'system' });
      await linkAssetToBeat(sharedAsset, category);
    }
    if (beatAssetUploadRef.current) beatAssetUploadRef.current.value = '';
  };

  const handleAddAnnotation = async () => {
    if (!newAnnotation.trim() || !selectedBeat) return;
    await annotationService.createAnnotation({ group_id: groupId, project_id: projectId, target_type: 'beat', target_id: selectedBeat.beat_id, content: newAnnotation.trim() });
    setNewAnnotation('');
    loadBeatDetails(selectedBeat);
  };

  const handleToggleAnnotation = async (ann: Annotation) => {
    await annotationService.updateAnnotation(ann.annotation_id, { status: ann.status === 'open' ? 'resolved' : 'open' });
    if (selectedBeat) loadBeatDetails(selectedBeat);
  };

  const handleUpdateBeatAnnotation = async (ann: Annotation) => {
    if (!editingBeatAnnotationText.trim() || !selectedBeat) return;
    await annotationService.updateAnnotation(ann.annotation_id, { content: editingBeatAnnotationText.trim() });
    setEditingBeatAnnotationId(null);
    setEditingBeatAnnotationText('');
    loadBeatDetails(selectedBeat);
  };

  const handleDeleteBeatAnnotation = async (ann: Annotation) => {
    if (!selectedBeat) return;
    await annotationService.deleteAnnotation(ann.annotation_id);
    loadBeatDetails(selectedBeat);
  };

  const unlinkAssetFromBeat = async (asset: SharedAsset) => {
    if (!selectedBeat) return;
    const nextIds = (selectedBeat.required_asset_ids || []).filter(id => id !== asset.asset_id);
    await beatService.updateBeat(selectedBeat.beat_id, { required_asset_ids: nextIds });
    setAssets(prev => prev.filter(item => item.asset_id !== asset.asset_id));
    await refreshSelectedBeat(selectedBeat.beat_id);
  };

  const loadAssetAnnotations = async (assetId: string) => {
    setAssetAnnotations(await annotationService.getAnnotationsByTarget('asset', assetId));
  };

  const addAssetAnnotation = async () => {
    if (!previewAsset || !newAssetAnnotation.trim()) return;
    await annotationService.createAnnotation({
      group_id: previewAsset.group_id,
      project_id: previewAsset.project_id || projectId,
      target_type: 'asset',
      target_id: previewAsset.asset_id,
      content: newAssetAnnotation.trim(),
      created_by: localStorage.getItem('dino_currentUser') || 'system'
    });
    setNewAssetAnnotation('');
    await loadAssetAnnotations(previewAsset.asset_id);
  };

  const updateAssetAnnotation = async (annotationId: string) => {
    if (!previewAsset || !editingAnnotationText.trim()) return;
    await annotationService.updateAnnotation(annotationId, { content: editingAnnotationText.trim() });
    setEditingAnnotationId(null);
    setEditingAnnotationText('');
    await loadAssetAnnotations(previewAsset.asset_id);
  };

  const deleteAssetAnnotation = async (annotationId: string) => {
    if (!previewAsset) return;
    await annotationService.deleteAnnotation(annotationId);
    await loadAssetAnnotations(previewAsset.asset_id);
  };

  const filteredSharedAssets = useMemo(() => allSharedAssets.filter(asset => !assetQuery.trim() || `${asset.name} ${asset.tags?.join(' ')}`.toLowerCase().includes(assetQuery.trim().toLowerCase())), [allSharedAssets, assetQuery]);
  const filteredProjectAssets = useMemo(() => projectAssets.filter(asset => !assetQuery.trim() || `${asset.name} ${asset.type}`.toLowerCase().includes(assetQuery.trim().toLowerCase())), [projectAssets, assetQuery]);
  const filteredEntityAssets = useMemo(() => entityAssets.filter(asset => !assetQuery.trim() || `${asset.title} ${asset.category || ''}`.toLowerCase().includes(assetQuery.trim().toLowerCase())), [entityAssets, assetQuery]);

  const renderAssetCard = (asset: SharedAsset | Asset | EntityAsset, category?: string) => {
    const id = 'asset_id' in asset ? asset.asset_id : asset.id;
    const url = 'asset_id' in asset ? (asset.thumbnail_url || asset.url) : ('url' in asset ? asset.url : asset.imageUrl);
    const name = 'asset_id' in asset ? asset.name : ('name' in asset ? asset.name : asset.title);
    const cat = category || ('asset_id' in asset ? categoryOf(asset) : ('type' in asset && asset.type === 'video' ? '视频' : ('category' in asset ? asset.category || '人物' : '单帧画面')));
    return (
      <button key={id} onClick={() => linkAssetToBeat(asset, cat)} className="group relative h-20 overflow-hidden rounded-xl border border-zinc-800 bg-[#111214] text-left hover:border-[#00bcd4]/60 transition-colors">
        {url ? <img src={url} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" /> : <div className="w-full h-full flex items-center justify-center text-zinc-600"><ImageIcon size={20} /></div>}
        <div className="absolute top-1.5 right-1.5 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] text-[#00e5ff] border border-[#00bcd4]/30">{cat}</div>
        <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-1 text-[11px] text-white truncate">{name}</div>
      </button>
    );
  };

  if (selectedBeat) {
    return (
      <div className="w-full h-full flex flex-col bg-[#1A1C20]">
        <div className="p-4 border-b border-[#2C2E33] flex items-center justify-between shadow-sm z-10 shrink-0">
          <button onClick={() => setSelectedBeat(null)} className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"><ChevronLeft size={16} /> <span>返回</span></button>
          <div className="font-semibold text-white truncate px-2">{selectedBeat.title}</div><div className="w-6" />
        </div>
        <div className="flex-1 overflow-y-auto script-panel-scrollbar pb-6 pr-2 space-y-6">
          <div className="p-4"><h3 className="text-sm font-medium text-zinc-400 mb-2 uppercase tracking-wider">剧本正文</h3><div className="bg-[#111214] p-3 rounded-xl border border-zinc-700/50 text-sm text-zinc-300 min-h-[80px] whitespace-pre-wrap leading-relaxed">{selectedBeat.script_text || '暂无内容...'}</div></div>
          <div className="px-4">
            <div className="flex items-center justify-between mb-3 relative"><h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">关联资产</h3><button onClick={() => setAssetPickerOpen(v => !v)} className="text-[#00bcd4] hover:text-[#00e5ff] text-xs flex items-center gap-1 transition-colors"><Plus size={14} /> 添加资产</button>
              {assetPickerOpen && (<div className="absolute right-0 top-7 z-50 w-[360px] rounded-2xl border border-zinc-800 bg-[#111214]/98 shadow-2xl p-3" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-3"><div className="text-sm text-white font-medium">选择或上传资产</div><button onClick={() => setAssetPickerOpen(false)} className="text-zinc-500 hover:text-white"><X size={16} /></button></div>
                <div className="grid grid-cols-4 gap-1 mb-3 text-xs">{[['shared','共享库'],['project','我的素材'],['entities','主体库'],['upload','上传']].map(([tab,label]) => <button key={tab} onClick={() => setSourceTab(tab as SourceTab)} className={`rounded-lg px-2 py-1.5 ${sourceTab === tab ? 'bg-[#00bcd4]/20 text-[#00e5ff]' : 'bg-zinc-900 text-zinc-400 hover:text-white'}`}>{label}</button>)}</div>
                {sourceTab !== 'upload' && <div className="relative mb-3"><Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500" /><input value={assetQuery} onChange={e => setAssetQuery(e.target.value)} placeholder="搜索资产..." className="w-full bg-black/40 border border-zinc-800 rounded-lg py-2 pl-7 pr-2 text-xs text-white outline-none focus:border-[#00bcd4]" /></div>}
                {sourceTab === 'shared' && <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto script-panel-scrollbar pr-1">{filteredSharedAssets.map(asset => renderAssetCard(asset))}</div>}
                {sourceTab === 'project' && <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto script-panel-scrollbar pr-1">{filteredProjectAssets.map(asset => renderAssetCard(asset))}</div>}
                {sourceTab === 'entities' && <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto script-panel-scrollbar pr-1">{filteredEntityAssets.map(asset => renderAssetCard(asset, asset.category || '人物'))}</div>}
                {sourceTab === 'upload' && <div className="rounded-xl border border-dashed border-zinc-700 bg-black/25 p-4 text-center"><div className="flex items-center justify-center gap-2 mb-3 text-xs"><span className="text-zinc-500">分类</span><select value={uploadCategory} onChange={e => setUploadCategory(e.target.value)} className="bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-200 outline-none">{assetCategories.map(cat => <option key={cat}>{cat}</option>)}</select></div><button onClick={() => beatAssetUploadRef.current?.click()} className="w-full rounded-xl bg-[#00bcd4] hover:bg-[#00a6bb] text-black font-medium py-2 text-sm">手动上传到 Beat</button><p className="mt-2 text-[11px] text-zinc-500">也可以直接拖拽图片/视频到关联资产区域。</p></div>}
                {sourceTab !== 'upload' && ((sourceTab === 'shared' && filteredSharedAssets.length === 0) || (sourceTab === 'project' && filteredProjectAssets.length === 0) || (sourceTab === 'entities' && filteredEntityAssets.length === 0)) && <div className="text-center text-xs text-zinc-500 py-8">暂无可添加资产</div>}
              </div>)}
            </div>
            <input ref={beatAssetUploadRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => e.target.files && uploadFilesToBeat(e.target.files)} />
            <div onDragOver={e => { e.preventDefault(); setIsDraggingAsset(true); }} onDragLeave={() => setIsDraggingAsset(false)} onDrop={e => { e.preventDefault(); setIsDraggingAsset(false); uploadFilesToBeat(e.dataTransfer.files); }} className={`grid grid-cols-3 gap-2 rounded-2xl p-1 transition-colors ${isDraggingAsset ? 'bg-[#00bcd4]/10 ring-1 ring-[#00bcd4]/40' : ''}`}>
              {assets.length === 0 ? <div className="col-span-3 text-center text-zinc-600 text-xs py-6 bg-[#111214] rounded-xl border border-dashed border-zinc-700">暂无关联资产，可点击添加或拖拽上传</div> : assets.map(asset => (
                <div
                  key={asset.asset_id}
                  draggable
                  onDragStart={(e) => {
                    e.stopPropagation();
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('application/x-konglong-shared-asset', sharedAssetDragPayload(asset));
                  }}
                  onClick={() => setPreviewAsset(asset)}
                  className="relative group border border-[#2C2E33] rounded-lg overflow-hidden h-20 bg-[#111214] hover:border-[#00bcd4]/50 transition-colors cursor-grab active:cursor-grabbing"
                  title="单击预览，拖到画布创建节点"
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); unlinkAssetFromBeat(asset); }}
                    title="从当前 Beat 移除"
                    className="absolute top-1 left-1 z-20 rounded-md bg-rose-500/15 border border-rose-400/30 text-rose-200 p-1 opacity-0 group-hover:opacity-100 hover:bg-rose-500/30 transition-all"
                  >
                    <Trash2 size={11} />
                  </button>
                  {asset.thumbnail_url || asset.url ? (
                    isVideoAsset(asset) ? <div className="w-full h-full bg-black flex items-center justify-center text-zinc-600"><Film size={22} /></div> : <img src={asset.thumbnail_url || asset.url} className="w-full h-full object-cover" />
                  ) : <div className="w-full h-full flex items-center justify-center text-zinc-700"><Paperclip size={20} /></div>}
                  <div className="absolute top-1 right-1 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] text-[#00e5ff]">{categoryOf(asset)}</div>
                  <div className="absolute inset-x-0 bottom-0 bg-black/70 px-2 py-0.5 text-[10px] text-white truncate">{asset.name}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="px-4 border-t border-zinc-800 pt-6">
            <h3 className="text-sm font-medium text-zinc-400 mb-4 uppercase tracking-wider flex items-center gap-2"><MessageSquare size={14} /> 批注与备注</h3>
            <div className="space-y-3 mb-4">
              {annotations.length === 0 ? <div className="text-zinc-600 justify-center flex py-2 text-xs">暂无批注</div> : annotations.map(ann => (
                <div key={ann.annotation_id} className={`p-3 rounded-xl border ${ann.status === 'open' ? 'border-zinc-700 bg-zinc-800' : 'border-zinc-800 bg-zinc-900 opacity-60'} flex gap-3 text-sm transition-all`}>
                  <button onClick={() => handleToggleAnnotation(ann)} className={`shrink-0 mt-0.5 ${ann.status === 'open' ? 'text-zinc-500 hover:text-green-500' : 'text-green-500'} transition-colors`}><CheckCircle size={16} /></button>
                  <div className="flex-1 min-w-0">
                    {editingBeatAnnotationId === ann.annotation_id ? (
                      <div className="flex gap-2">
                        <input value={editingBeatAnnotationText} onChange={e => setEditingBeatAnnotationText(e.target.value)} className="flex-1 bg-[#111214] border border-zinc-700 rounded-lg px-2 py-1 text-sm text-white outline-none focus:border-[#00bcd4]" />
                        <button onClick={() => handleUpdateBeatAnnotation(ann)} className="text-emerald-300 hover:text-emerald-200"><Save size={14} /></button>
                        <button onClick={() => setEditingBeatAnnotationId(null)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
                      </div>
                    ) : (
                      <>
                        <div className={`text-zinc-200 break-words ${ann.status !== 'open' && 'line-through decoration-zinc-600'}`}>{ann.content}</div>
                        <div className="text-[10px] text-zinc-500 mt-1 flex justify-between gap-2"><span>{ann.created_by}</span><span>{new Date(ann.created_at).toLocaleString()}</span></div>
                      </>
                    )}
                  </div>
                  {editingBeatAnnotationId !== ann.annotation_id && (
                    <div className="flex gap-1">
                      <button onClick={() => { setEditingBeatAnnotationId(ann.annotation_id); setEditingBeatAnnotationText(ann.content); }} className="text-zinc-500 hover:text-[#00e5ff]"><Pencil size={13} /></button>
                      <button onClick={() => handleDeleteBeatAnnotation(ann)} className="text-zinc-500 hover:text-rose-300"><Trash2 size={13} /></button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="flex gap-2"><input type="text" value={newAnnotation} onChange={e => setNewAnnotation(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddAnnotation()} placeholder="添加新的批注..." className="flex-1 bg-[#111214] border border-zinc-700 rounded-lg py-2 px-3 text-sm text-white focus:outline-none focus:border-[#00bcd4]" /><button onClick={handleAddAnnotation} disabled={!newAnnotation.trim()} className="px-4 bg-[#00bcd4] hover:bg-[#00a6bb] text-black font-medium disabled:opacity-50 rounded-lg text-sm transition-colors">发送</button></div>
          </div>
        </div>
        {previewAsset && (
          <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setPreviewAsset(null)}>
            <button onClick={() => setPreviewAsset(null)} className="absolute right-6 top-6 rounded-full bg-zinc-900/80 border border-zinc-700 p-2 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors"><X size={22} /></button>
            <div className="w-[96vw] h-[92vh] rounded-2xl overflow-hidden border border-zinc-800 bg-[#111214] shadow-[0_30px_120px_rgba(0,0,0,0.8)] grid grid-cols-[minmax(720px,1fr)_380px]" onClick={e => e.stopPropagation()}>
              <div className="min-w-0 min-h-0 bg-black flex items-center justify-center p-4">
              {isVideoAsset(previewAsset) ? (
                <video src={previewAsset.url} controls autoPlay className="w-full h-full object-contain bg-black" />
              ) : (
                <img src={previewAsset.url} alt={previewAsset.name} className="w-full h-full object-contain bg-black" />
              )}
              </div>
              <div className="border-l border-zinc-800 bg-[#18191c] flex flex-col min-h-0">
              <div className="flex items-center justify-between gap-4 px-4 py-3 border-b border-zinc-800">
                <div className="min-w-0"><div className="text-sm text-white truncate">{previewAsset.name}</div><div className="text-xs text-zinc-500 mt-0.5">{categoryOf(previewAsset)}</div></div>
                <button onClick={() => unlinkAssetFromBeat(previewAsset)} className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/20 transition-colors"><Trash2 size={14} /> 从 Beat 移除</button>
              </div>
              <div className="px-4 py-3 flex-1 min-h-0 overflow-y-auto script-panel-scrollbar">
                <div className="flex items-center gap-2 text-xs text-zinc-300 mb-3"><MessageSquare size={14} className="text-[#00e5ff]" /><span>资产标注</span></div>
                <div className="space-y-2 mb-3">
                  {assetAnnotations.length === 0 ? <div className="text-xs text-zinc-600 py-2">暂无标注</div> : assetAnnotations.map(annotation => (
                    <div key={annotation.annotation_id} className="rounded-xl border border-zinc-800 bg-black/25 p-2 text-xs">
                      {editingAnnotationId === annotation.annotation_id ? (
                        <div className="flex gap-2"><input value={editingAnnotationText} onChange={e => setEditingAnnotationText(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-100 outline-none focus:border-[#00bcd4]" /><button onClick={() => updateAssetAnnotation(annotation.annotation_id)} className="text-emerald-300 hover:text-emerald-200"><Save size={14} /></button><button onClick={() => setEditingAnnotationId(null)} className="text-zinc-500 hover:text-white"><X size={14} /></button></div>
                      ) : (
                        <div className="flex gap-2"><CheckCircle size={13} className="mt-0.5 text-[#00e5ff] shrink-0" /><div className="flex-1 min-w-0"><div className="text-zinc-200 break-words">{annotation.content}</div><div className="text-[10px] text-zinc-600 mt-1">{annotation.created_by} · {new Date(annotation.created_at).toLocaleString()}</div></div><button onClick={() => { setEditingAnnotationId(annotation.annotation_id); setEditingAnnotationText(annotation.content); }} className="text-zinc-500 hover:text-[#00e5ff]"><Pencil size={13} /></button><button onClick={() => deleteAssetAnnotation(annotation.annotation_id)} className="text-zinc-500 hover:text-rose-300"><Trash2 size={13} /></button></div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-2"><input value={newAssetAnnotation} onChange={e => setNewAssetAnnotation(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAssetAnnotation()} placeholder="给这个资产添加标注..." className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-[#00bcd4]" /><button onClick={addAssetAnnotation} disabled={!newAssetAnnotation.trim()} className="rounded-lg bg-[#00bcd4] px-3 py-2 text-xs font-medium text-black disabled:opacity-40">发送</button></div>
              </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return <div className="w-full h-full flex flex-col bg-[#1A1C20] border-r border-[#2C2E33]"><div className="p-4 border-b border-[#2C2E33] flex items-center gap-2"><h2 className="font-semibold text-white flex-1">剧本与分镜库</h2><input type="file" accept=".txt,.md,.doc,.docx,.wps" className="hidden" ref={scriptFileInputRef} onChange={handleScriptUpload} /><button className="text-zinc-400 hover:text-[#00bcd4] transition-colors" title="上传剧本并自动拆分" onClick={() => scriptFileInputRef.current?.click()}><Upload size={16} /></button><button className="text-zinc-400 hover:text-[#00bcd4] transition-colors" title="打包导出 ZIP" onClick={handleExportProjectZip}><FolderDown size={16} /></button><button className="text-zinc-400 hover:text-white transition-colors" title="新建分集" onClick={handleCreateEp}><Plus size={16} /></button></div><div className="flex-1 overflow-y-auto script-panel-scrollbar">{episodes.map(ep => <div key={ep.episode_id} className="border-b border-[#2C2E33]/50"><div className={`p-3 cursor-pointer hover:bg-zinc-800 transition-colors flex items-center gap-2 group/ep ${selectedEp === ep.episode_id ? 'bg-zinc-800 text-[#00bcd4]' : 'text-zinc-300'}`} onClick={() => setSelectedEp(ep.episode_id)}><List size={14} /><span className="font-medium text-sm flex-1 truncate">{ep.title}</span><button className="text-zinc-500 hover:text-red-500 opacity-0 group-hover/ep:opacity-100 transition-opacity p-0.5" onClick={(e) => handleDeleteEp(e, ep.episode_id)}><Trash2 size={14} /></button></div>{selectedEp === ep.episode_id && <div className="pl-6 pr-3 py-2 space-y-2 bg-[#1E2024]">{beats.map(beat => <div key={beat.beat_id} onClick={() => setSelectedBeat(beat)} className="p-2 rounded bg-zinc-800/80 border border-zinc-700/50 hover:border-[#00bcd4]/50 cursor-pointer transition-colors group relative"><div className="text-sm font-medium text-white mb-1 flex items-center justify-between"><span className="truncate pr-2">Beat {beat.beat_number}</span><button className="text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 z-10" onClick={(e) => handleDeleteBeat(e, beat.beat_id)}><Trash2 size={12} /></button></div><div className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{beat.script_text || beat.title}</div>{(beat.required_asset_ids?.length > 0 || beat.annotations?.length > 0) && <div className="flex items-center gap-2 mt-2 pt-2 border-t border-zinc-700/50 text-[10px] text-zinc-500">{beat.required_asset_ids?.length > 0 && <span className="flex items-center gap-1"><Paperclip size={10} /> {beat.required_asset_ids.length}</span>}{beat.annotations?.length > 0 && <span className="flex items-center gap-1"><MessageSquare size={10} /> {beat.annotations.length}</span>}</div>}</div>)}<button onClick={() => handleCreateBeat()} className="w-full py-2 border border-dashed border-zinc-700 rounded-lg text-zinc-500 hover:text-[#00bcd4] hover:border-[#00bcd4] text-xs transition-colors flex items-center justify-center gap-1 mt-2"><Plus size={14} /> 新增 Beat</button></div>}</div>)}{episodes.length === 0 && <div className="flex flex-col items-center justify-center h-40 text-sm text-zinc-500 px-6 text-center">暂无剧本数据，你可以上传 TXT/MD 文件自动拆分为多个 Beat。</div>}</div></div>;
}
