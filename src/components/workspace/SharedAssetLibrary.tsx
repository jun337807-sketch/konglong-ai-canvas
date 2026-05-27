import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Annotation, SharedAsset } from '../../types/workspace';
import { groupAssetService } from '../../services/groupAssetService';
import { annotationService } from '../../services/annotationService';
import { Search, Image as ImageIcon, Briefcase, Film, Upload, Tag, Trash2, X, MessageSquare, CheckCircle, Pencil, Save } from 'lucide-react';

const sharedAssetCategories = ['全部', '人物', '场景', '单帧画面', '视频', '道具', '其他'];

function assetCategory(asset: SharedAsset) {
  return asset.tags?.[0] || (asset.type === 'video' ? '视频' : '单帧画面');
}

function isVideoAsset(asset: SharedAsset) {
  return assetCategory(asset) === '视频' || asset.type === 'video' || /\.(mp4|mov|webm)(\?|$)/i.test(asset.url || '');
}

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

export function SharedAssetLibrary({ groupId }: { groupId: string }) {
  const [assets, setAssets] = useState<SharedAsset[]>([]);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('全部');
  const [isDragging, setIsDragging] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<SharedAsset | null>(null);
  const [assetAnnotations, setAssetAnnotations] = useState<Annotation[]>([]);
  const [newAssetAnnotation, setNewAssetAnnotation] = useState('');
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editingAnnotationText, setEditingAnnotationText] = useState('');
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadAssets();
  }, [groupId]);

  useEffect(() => {
    if (previewAsset) loadAssetAnnotations(previewAsset.asset_id);
  }, [previewAsset?.asset_id]);

  const loadAssets = async () => {
    const list = await groupAssetService.getAssetsByGroup(groupId);
    setAssets(list);
  };

  const uploadFiles = async (files: FileList | File[]) => {
    const list = Array.from(files).filter(file => file.type.startsWith('image/') || file.type.startsWith('video/'));
    for (const file of list) {
      const cat = inferUploadCategory(file);
      const url = await readFileAsDataUrl(file);
      await groupAssetService.createAsset({
        group_id: groupId,
        name: file.name.replace(/\.[^/.]+$/, '') || '未命名资产',
        url,
        thumbnail_url: file.type.startsWith('image/') ? url : undefined,
        type: sharedTypeFromCategory(cat),
        tags: [cat],
        created_by: localStorage.getItem('dino_currentUser') || 'system'
      });
    }
    if (uploadInputRef.current) uploadInputRef.current.value = '';
    await loadAssets();
  };

  const deleteAsset = async (asset: SharedAsset) => {
    if (!confirm(`确定删除「${asset.name}」吗？这会从组内共享资产库移除该资产。`)) return;
    await groupAssetService.deleteAsset(asset.asset_id);
    setAssets(prev => prev.filter(item => item.asset_id !== asset.asset_id));
    if (previewAsset?.asset_id === asset.asset_id) setPreviewAsset(null);
  };

  const loadAssetAnnotations = async (assetId: string) => {
    const list = await annotationService.getAnnotationsByTarget('asset', assetId);
    setAssetAnnotations(list);
  };

  const addAssetAnnotation = async () => {
    if (!previewAsset || !newAssetAnnotation.trim()) return;
    await annotationService.createAnnotation({
      group_id: previewAsset.group_id,
      project_id: previewAsset.project_id || 'shared-library',
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

  const updateCategory = async (asset: SharedAsset, nextCategory: string) => {
    const updated = await groupAssetService.updateAsset(asset.asset_id, {
      type: sharedTypeFromCategory(nextCategory),
      tags: [nextCategory, ...(asset.tags || []).filter(tag => !sharedAssetCategories.includes(tag))]
    });
    if (updated) setAssets(prev => prev.map(item => item.asset_id === updated.asset_id ? updated : item));
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">{assets.length} 项</span>
          <button onClick={() => uploadInputRef.current?.click()} className="inline-flex items-center gap-1 rounded-lg bg-white text-black px-2.5 py-1.5 text-xs font-medium hover:bg-zinc-200 transition-colors">
            <Upload size={13} /> 上传
          </button>
          <input ref={uploadInputRef} type="file" accept="image/*,video/*" multiple className="hidden" onChange={e => e.target.files && uploadFiles(e.target.files)} />
        </div>
      </div>

      <div className="p-3 border-b border-zinc-800/60 flex flex-col gap-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索资产..." className="w-full bg-[#111214] border border-zinc-700 rounded-lg py-2 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-[#00bcd4]" />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
          {sharedAssetCategories.map(cat => (
            <button key={cat} onClick={() => setCategory(cat)} className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${category === cat ? 'bg-[#00bcd4]/20 text-[#00e5ff] border border-[#00bcd4]/30' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800/80 border border-transparent'}`}>{cat}</button>
          ))}
        </div>
      </div>

      <div
        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={e => { e.preventDefault(); setIsDragging(false); uploadFiles(e.dataTransfer.files); }}
        className={`flex-1 overflow-y-auto p-3 grid grid-cols-2 gap-3 pb-20 custom-scrollbar content-start transition-colors ${isDragging ? 'bg-[#00bcd4]/10 ring-1 ring-inset ring-[#00bcd4]/40' : ''}`}
      >
        {visibleAssets.length === 0 ? (
          <div className="col-span-2 text-center text-zinc-500 text-sm mt-10 leading-relaxed">
            暂无资产。可以点击上传，或把图片/视频拖进这里加入组内共享资产库。
          </div>
        ) : visibleAssets.map(asset => {
          const cat = assetCategory(asset);
          const video = isVideoAsset(asset);
          return (
            <div
              key={asset.asset_id}
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('application/x-konglong-shared-asset', JSON.stringify({
                  asset_id: asset.asset_id,
                  name: asset.name,
                  url: asset.url,
                  thumbnail_url: asset.thumbnail_url,
                  type: asset.type,
                  category: cat,
                  tags: asset.tags || [],
                }));
              }}
              onClick={() => setPreviewAsset(asset)}
              className="relative group border border-[#2C2E33] rounded-xl overflow-hidden h-32 bg-[#111214] hover:border-[#00bcd4]/50 transition-colors shadow-[0_8px_24px_rgba(0,0,0,0.25)] cursor-grab active:cursor-grabbing"
              title="拖到画布可创建节点，单击可放大预览"
            >
              <button
                onClick={(e) => { e.stopPropagation(); deleteAsset(asset); }}
                title="删除资产"
                className="absolute top-2 left-2 z-20 opacity-0 group-hover:opacity-100 transition-all rounded-lg bg-rose-500/15 border border-rose-400/30 text-rose-200 hover:bg-rose-500/30 p-1.5 backdrop-blur"
              >
                <Trash2 size={13} />
              </button>
              {asset.thumbnail_url || asset.url ? (
                video ? <div className="w-full h-full bg-black flex items-center justify-center text-zinc-500"><Film size={28} /></div> : <img src={asset.thumbnail_url || asset.url} className="w-full h-full object-cover" />
              ) : <div className="w-full h-full flex items-center justify-center text-zinc-700"><ImageIcon size={24} /></div>}
              <div onClick={(e) => e.stopPropagation()} className="absolute top-2 right-2 z-20 flex items-center gap-1 rounded-md bg-black/75 backdrop-blur px-1.5 py-1 border border-[#00bcd4]/30">
                <Tag size={10} className="text-[#00e5ff]" />
                <select value={cat} onChange={e => updateCategory(asset, e.target.value)} className="bg-transparent text-[10px] text-[#00e5ff] outline-none cursor-pointer">
                  {sharedAssetCategories.filter(item => item !== '全部').map(item => <option key={item} value={item} className="bg-[#111214] text-zinc-200">{item}</option>)}
                </select>
              </div>
              <div className="absolute inset-x-0 bottom-0 py-1.5 px-2 bg-black/75 backdrop-blur text-[11px] text-white truncate">{asset.name}</div>
            </div>
          );
        })}
      </div>

      {previewAsset && (
        <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-8" onClick={() => setPreviewAsset(null)}>
          <button onClick={() => setPreviewAsset(null)} className="absolute right-6 top-6 rounded-full bg-zinc-900/80 border border-zinc-700 p-2 text-zinc-300 hover:text-white hover:border-zinc-500 transition-colors">
            <X size={22} />
          </button>
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
              <div className="min-w-0">
                <div className="text-sm text-white truncate">{previewAsset.name}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{assetCategory(previewAsset)}</div>
              </div>
              <button onClick={() => deleteAsset(previewAsset)} className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-200 hover:bg-rose-500/20 transition-colors">
                <Trash2 size={14} /> 删除
              </button>
            </div>
            <div className="px-4 py-3 flex-1 min-h-0 overflow-y-auto custom-scrollbar">
              <div className="flex items-center gap-2 text-xs text-zinc-300 mb-3">
                <MessageSquare size={14} className="text-[#00e5ff]" />
                <span>资产标注</span>
              </div>
              <div className="space-y-2 mb-3">
                {assetAnnotations.length === 0 ? (
                  <div className="text-xs text-zinc-600 py-2">暂无标注</div>
                ) : assetAnnotations.map(annotation => (
                  <div key={annotation.annotation_id} className="rounded-xl border border-zinc-800 bg-black/25 p-2 text-xs">
                    {editingAnnotationId === annotation.annotation_id ? (
                      <div className="flex gap-2">
                        <input value={editingAnnotationText} onChange={e => setEditingAnnotationText(e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-zinc-100 outline-none focus:border-[#00bcd4]" />
                        <button onClick={() => updateAssetAnnotation(annotation.annotation_id)} className="text-emerald-300 hover:text-emerald-200"><Save size={14} /></button>
                        <button onClick={() => setEditingAnnotationId(null)} className="text-zinc-500 hover:text-white"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <CheckCircle size={13} className="mt-0.5 text-[#00e5ff] shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-zinc-200 break-words">{annotation.content}</div>
                          <div className="text-[10px] text-zinc-600 mt-1">{annotation.created_by} · {new Date(annotation.created_at).toLocaleString()}</div>
                        </div>
                        <button onClick={() => { setEditingAnnotationId(annotation.annotation_id); setEditingAnnotationText(annotation.content); }} className="text-zinc-500 hover:text-[#00e5ff]"><Pencil size={13} /></button>
                        <button onClick={() => deleteAssetAnnotation(annotation.annotation_id)} className="text-zinc-500 hover:text-rose-300"><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={newAssetAnnotation} onChange={e => setNewAssetAnnotation(e.target.value)} onKeyDown={e => e.key === 'Enter' && addAssetAnnotation()} placeholder="给这个资产添加标注..." className="flex-1 bg-zinc-950 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-[#00bcd4]" />
                <button onClick={addAssetAnnotation} disabled={!newAssetAnnotation.trim()} className="rounded-lg bg-[#00bcd4] px-3 py-2 text-xs font-medium text-black disabled:opacity-40">发送</button>
              </div>
            </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
