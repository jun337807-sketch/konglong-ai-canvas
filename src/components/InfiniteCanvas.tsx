import React, { useState, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  Panel,
  Handle,
  Position,
  ReactFlowProvider,
  BackgroundVariant,
  useReactFlow,
  SelectionMode,
  NodeToolbar,
  NodeResizer,
  useEdges,
  useNodes,
  MarkerType,
  BaseEdge,
  getBezierPath,
  EdgeLabelRenderer
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import Markdown from 'react-markdown';
import { 
  ImagePlus, Type, Film, BrainCircuit, LayoutGrid, X, 
  Play, Maximize, Download, Sun, SplitSquareHorizontal, 
  Move3D, Eye, Sparkles, Focus, RotateCw, BookMarked, 
  Copy, CopyPlus, ClipboardPaste, Trash2, BoxSelect, Settings, HelpCircle,
  Plus, Share2, Shapes, Clock, Headphones, AlignLeft, Image as ImageIcon, Video, Scissors, AudioLines, FileText, Upload, Box, MapPin, Monitor, Camera, Maximize2, Minimize2, Languages, Settings2, Zap, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, ArrowUp, User, RefreshCw, CheckCircle, Loader2, Briefcase, List, ListTodo, Save, Check
} from 'lucide-react';
import { useCanvasHistory } from '../hooks/useCanvasHistory';
import { HistoryPanel } from './HistoryPanel';
import { VersionPanel } from './VersionPanel';
import { CapabilityPanel } from './CapabilityPanel';
import { MediaCapability } from '../types/task';
import { CleanPanoramaViewer, CleanPanoramaRef } from './CleanPanoramaViewer';
import { getAIClient, imageUrlToDataUrl, runImageGeneration, runMegaBreakdown, runScriptReview } from '../services/aiService';
import { taskQueueManager } from '../services/taskQueueManager';
import { assetManager } from '../services/assetManager';
import { MediaHistoryService } from '../services/mediaHistoryService';
import { ensurePublicMediaUrl } from '../services/mediaUploadService';

import { ProjectSettingsPanel } from './ProjectSettingsPanel';
import { ScriptStoryboardPanel } from './workspace/ScriptStoryboardPanel';
import { SharedAssetLibrary } from './workspace/SharedAssetLibrary';
import { CanvasMoreMenu } from './CanvasMoreMenu';
import { AssetLibrary } from './AssetLibrary';
import { TaskQueuePanel } from './TaskQueuePanel';
import { PromptTemplatePanel } from './PromptTemplatePanel';
import { groupAssetService } from '../services/groupAssetService';
import { projectSettingsService } from '../services/projectSettingsService';
import { canvasActionService } from '../services/canvasActionService';
import { canvasHealthCheck } from '../services/canvasHealthCheck';
import { ActivityPanel } from './ActivityPanel';
import { canvasProjectPersistence } from '../services/canvasProjectPersistence';
import { createNodeTypes } from './canvas/createNodeTypes';
import { workspaceRepository } from '../repositories/workspaceRepository';

// Custom Node Styling Constants
const selectedBorder = "border-[rgba(255,255,255,0.15)] shadow-[0_0_20px_rgba(255,255,255,0.15)]"; // White soft glow
const defaultBorder = "border-zinc-800/80";
const nodeBg = "bg-[#111214]/90 backdrop-blur-md";
const handleStyle = "!w-5 !h-5 !min-w-[20px] !min-h-[20px] !absolute !top-1/2 !-translate-y-1/2 !bg-transparent !border-transparent !opacity-0 transition-all duration-200 cursor-crosshair z-50 rounded-full";
const plusHandleStyle = "!relative !right-auto !top-auto !translate-y-0 !w-7 !h-7 !min-w-[28px] !min-h-[28px] !bg-[#2A2A2A] !border !border-zinc-600 !rounded-full !opacity-100 flex items-center justify-center text-zinc-300 hover:!bg-zinc-700 hover:!border-[#00bcd4] hover:text-white hover:!scale-110 hover:shadow-[0_0_16px_rgba(0,188,212,0.55)] transition-all duration-200 cursor-crosshair z-50";
const resizerHandleStyle = "w-2 h-2 bg-white/50 rounded-sm border-none shadow-[0_0_4px_rgba(255,255,255,0.3)]";
const entityCategories = ['人物', '场景', '道具', '特效', '其他'];

const FloatingPlusHandle = ({ type, position, title }: { type: 'source' | 'target'; position: Position; title?: string }) => (
  <div className={`absolute top-0 bottom-0 ${position === Position.Left ? '-left-8' : '-right-8'} w-8 z-40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center`}>
    <Handle type={type} position={position} className={plusHandleStyle} title={title || '按住拖拽连接'}>
      <Plus size={14} />
    </Handle>
  </div>
);

function extractGeneratedMediaUrl(value: any): string | undefined {
  const looksLikeMediaUrl = (text: string) => {
    if (!/^https?:\/\//i.test(text)) return false;
    const clean = text.split('?')[0].toLowerCase();
    return /\.(png|jpe?g|webp|gif|avif|bmp|mp4|mov|webm)$/i.test(clean)
      || /\/file\//i.test(text)
      || /aitohumanize|grsai|tos-|volces|volc|cdn|image|img|media|oss|cos/i.test(text);
  };

  const find = (item: any, depth = 0): string | undefined => {
    if (!item || depth > 8) return undefined;
    if (typeof item === 'string') {
      const text = item.trim();
      if (looksLikeMediaUrl(text)) return text;
      if ((text.startsWith('{') && text.endsWith('}')) || (text.startsWith('[') && text.endsWith(']'))) {
        try {
          return find(JSON.parse(text), depth + 1);
        } catch {
          return undefined;
        }
      }
      return undefined;
    }
    if (Array.isArray(item)) {
      for (const child of item) {
        const url = find(child, depth + 1);
        if (url) return url;
      }
      return undefined;
    }
    if (typeof item !== 'object') return undefined;

    for (const key of [
      'url', 'imageUrl', 'image_url', 'videoUrl', 'video_url',
      'outputUrl', 'output_url', 'fileUrl', 'file_url',
      'mediaUrl', 'media_url', 'resultUrl', 'result_url'
    ]) {
      const url = find(item[key], depth + 1);
      if (url) return url;
    }

    for (const key of ['result', 'results', 'raw', 'data', 'output', 'outputs', 'images', 'image', 'media', 'files', 'file']) {
      const url = find(item[key], depth + 1);
      if (url) return url;
    }

    for (const [key, child] of Object.entries(item)) {
      if (['request', 'prompt', 'input', 'inputs', 'payload'].includes(key)) continue;
      const url = find(child, depth + 1);
      if (url) return url;
    }
    return undefined;
  };

  return find(value);
}

function normalizeServerGenerationTask(task: any) {
  const input = task?.input || {};
  const output = task?.output || null;
  const capability = String(task?.capability || '');
  const type = capability.includes('video') ? 'video_generation' : 'image_generation';
  return {
    id: task.id,
    projectId: task.workspace_project_id,
    type,
    status: task.status,
    nodeId: task.nodeId || input?.metadata?.nodeId || input?.nodeId,
    payload: input,
    result: output,
    error: task.error_message || output?.errorMessage,
    createdAt: task.created_at,
    updatedAt: task.updated_at || task.completed_at || task.created_at
  };
}

function normalizeGenerationStatus(status?: string) {
  const normalized = String(status || '').toLowerCase();
  if (['success', 'succeeded', 'completed', 'complete', 'done'].includes(normalized)) return 'completed';
  if (['fail', 'failed', 'failure', 'error', 'errored', 'cancel', 'canceled', 'cancelled'].includes(normalized)) return 'failed';
  if (['running', 'processing', 'submitted', 'in_progress', 'progress', 'pending', 'queued', 'queueing'].includes(normalized)) return 'running';
  return normalized || 'unknown';
}

async function fetchProjectGenerationTasks(projectId: string) {
  try {
    const response = await fetch(`/api/workspace-projects/${encodeURIComponent(projectId)}/tasks`, {
      headers: { Accept: 'application/json' }
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.success) return [];
    return (data.tasks || []).map(normalizeServerGenerationTask);
  } catch (error) {
    console.warn('Failed to fetch server generation tasks:', error);
    return [];
  }
}

async function toInlineImageParts(imageUrl: string) {
  const dataUrl = imageUrl.startsWith('data:image/') ? imageUrl : await imageUrlToDataUrl(imageUrl);
  return {
    data: dataUrl.split(',')[1],
    mimeType: dataUrl.split(';')[0].split(':')[1]
  };
}

function inferEntityCategory(input?: string) {
  const text = (input || '').toLowerCase();
  if (/(人物|角色|主角|配角|反派|演员|女孩|女生|女人|男性|男人|男孩|少年|少女|头像|肖像|人像|character|person|portrait|girl|boy|woman|man)/i.test(text)) return '人物';
  if (/(场景|环境|房间|室内|室外|街道|城市|村庄|森林|山|海|湖|天空|建筑|办公室|客厅|卧室|scene|environment|room|street|city|forest|mountain|sea|building)/i.test(text)) return '场景';
  if (/(道具|物品|武器|剑|刀|枪|手机|书|杯子|车|船|门|prop|object|weapon|sword|phone|book|cup|car)/i.test(text)) return '道具';
  if (/(特效|火焰|烟雾|爆炸|光效|魔法|粒子|闪电|effect|vfx|magic|fire|smoke|explosion|lightning)/i.test(text)) return '特效';
  return '其他';
}

function inferSharedAssetCategory(input?: string, mediaType?: 'image' | 'video') {
  if (mediaType === 'video') return '视频';
  const entityCategory = inferEntityCategory(input);
  if (entityCategory === '人物' || entityCategory === '场景') return entityCategory;
  return '单帧画面';
}

function inferVideoReferenceRoleFromNode(node: any, index: number, total: number, activeTab: string) {
  const data = node?.data || {};
  const text = [
    data.referenceRole,
    data.role,
    data.category,
    data.assetCategory,
    data.entityCategory,
    data.type,
    data.title,
    data.name,
    data.prompt,
    Array.isArray(data.tags) ? data.tags.join(' ') : ''
  ].filter(Boolean).join(' ').toLowerCase();

  if (activeTab === '首尾帧' && index === total - 1) return 'last_frame';
  if (/last[_\s-]?frame|尾帧|最后一帧/.test(text)) return 'last_frame';
  if (/character|person|portrait|face|主体|人物|角色|人像|脸|肖像|三视图/.test(text)) return 'character';
  if (/scene|location|environment|background|landscape|interior|exterior|场景|空间|环境|背景|建筑|街道|室内|室外|城市|山水/.test(text)) return 'scene';
  if (/prop|product|object|item|道具|产品|物品|器物|服装|武器|车辆/.test(text)) return 'prop';
  if (/style|mood|lighting|color|reference|风格|氛围|光影|色调|质感|参考/.test(text)) return 'style';

  return activeTab === '首尾帧' && total === 1 ? 'last_frame' : 'style';
}

function inferDownloadExtension(url: string, fallback: string) {
  if (url.startsWith('data:image/')) return url.slice('data:image/'.length).split(';')[0].replace('jpeg', 'jpg') || fallback;
  if (url.startsWith('data:video/')) return url.slice('data:video/'.length).split(';')[0] || fallback;
  try {
    const ext = new URL(url).pathname.split('.').pop()?.toLowerCase();
    return ext && /^[a-z0-9]+$/.test(ext) ? ext : fallback;
  } catch {
    return fallback;
  }
}

function getMediaProxyUrl(url: string) {
  return `/api/media-proxy?url=${encodeURIComponent(url)}`;
}

function fallbackImageToProxy(e: React.SyntheticEvent<HTMLImageElement>) {
  const image = e.currentTarget;
  const originalUrl = image.dataset.originalSrc || image.src;
  if (!/^https?:\/\//i.test(originalUrl) || image.dataset.proxyFallback === 'true') return;
  image.dataset.proxyFallback = 'true';
  image.src = getMediaProxyUrl(originalUrl);
}
function fallbackVideoToProxy(e: React.SyntheticEvent<HTMLVideoElement>) {
  const video = e.currentTarget;
  const originalUrl = video.dataset.originalSrc || video.currentSrc || video.src;
  if (!/^https?:\/\//i.test(originalUrl) || video.dataset.proxyFallback === 'true') return;
  video.dataset.proxyFallback = 'true';
  video.src = getMediaProxyUrl(originalUrl);
  video.load();
}

async function triggerMediaDownload(url: string, filename: string) {
  let downloadUrl = url;
  let shouldRevoke = false;

  if (!url.startsWith('data:')) {
    const response = await fetch(getMediaProxyUrl(url));
    if (!response.ok) {
      throw new Error(`下载失败：HTTP ${response.status}`);
    }
    const blob = await response.blob();
    downloadUrl = URL.createObjectURL(blob);
    shouldRevoke = true;
  }

  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (shouldRevoke) {
    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
  }
}

// Custom Node Components
const TextNode = ({ data, id, selected }: any) => {
  const [showReviewMenu, setShowReviewMenu] = useState(false);
  const [reviewMode, setReviewMode] = useState<'full' | 'scene' | 'beat'>('full');
  const [reviewOptions, setReviewOptions] = useState({ compliance: true, dialogue: true });

  const reviewModeConfig = {
    'full': { label: '全文审查', icon: Zap, type: 'script-review-full' },
    'scene': { label: '单场审查', icon: MapPin, type: 'script-review-scene' },
    'beat': { label: 'Beat 审查', icon: Clock, type: 'script-review-beat' },
  };

  const currentReview = reviewModeConfig[reviewMode];
  const CurrentIcon = currentReview.icon;

  return (
    <>
      <NodeResizer color="transparent" handleClassName={resizerHandleStyle} minWidth={240} minHeight={150} isVisible={selected} />
      <div className={`${nodeBg} border-[1.5px] ${selected ? selectedBorder : defaultBorder} rounded-2xl p-4 shadow-sm hover:shadow-[0_0_15px_rgba(0,188,212,0.15)] transition-shadow min-w-[240px] w-full h-full flex flex-col group relative`} onClick={() => setShowReviewMenu(false)}>
        {data.isGenerating && (
          <div className="absolute inset-0 bg-[#1A1A1A]/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-3 z-50">
             <Zap className={`animate-pulse ${data.generatingText?.includes('审查') ? 'text-rose-500' : 'text-[#00bcd4]'}`} size={24} />
             <div className={`text-sm font-medium animate-pulse ${data.generatingText?.includes('审查') ? 'text-rose-500' : 'text-[#00bcd4]'}`}>{data.generatingText || '处理中...'}</div>
          </div>
        )}
        <FloatingPlusHandle type="target" position={Position.Left} title="拖入连接到文本节点" />
        <div className="flex items-center gap-2 mb-3 text-zinc-400 pb-2 border-b border-zinc-800/50">
          <Type size={14} className={selected ? "text-[#00bcd4]" : ""} />
          <span className="text-xs font-semibold tracking-wide flex-1">文本 / 剧本</span>
          <label className="cursor-pointer text-zinc-500 hover:text-[#00bcd4] transition-colors" title="上传TXT/MD剧本">
            <Upload size={14} />
            <input 
              type="file" 
              accept=".txt,.md,.csv" 
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const text = ev.target?.result as string;
                    if (data.onChange) data.onChange(id, text);
                  };
                  reader.readAsText(file);
                }
              }} 
            />
          </label>
        </div>
        <textarea 
          className="w-full flex-1 bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 text-sm text-zinc-300 resize-none focus:outline-none focus:border-[#00bcd4] mb-3 focus:bg-zinc-900/80 transition-colors"
          value={data.text || ''}
          onChange={(e) => data.onChange(id, e.target.value)}
          placeholder="输入剧本内容..."
        />
        <div className="flex items-start justify-end gap-2 mt-auto pt-2 border-t border-zinc-800/50 flex-wrap relative">
          {!data.isReviewResult && (
            <>
              <div className="relative flex">
                <div className="flex items-stretch bg-zinc-800/80 hover:bg-rose-500/20 text-zinc-300 hover:text-rose-400 rounded-lg text-xs transition-colors border border-zinc-700/50 hover:border-rose-500/50">
                  <button 
                    onClick={(e) => { e.stopPropagation(); if (data.onAddNode) data.onAddNode('textNode', currentReview.type, undefined, id, { reviewOptions }); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 border-r border-zinc-700/50 hover:bg-rose-500/10 rounded-l-lg transition-colors"
                  >
                    <CurrentIcon size={12} />
                    <span>{currentReview.label}</span>
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); setShowReviewMenu(!showReviewMenu); }}
                    className="flex items-center px-2 py-1.5 hover:bg-rose-500/10 rounded-r-lg transition-colors"
                  >
                    <ChevronDown size={12} className={`transition-transform duration-200 ${showReviewMenu ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                
                {showReviewMenu && (
                  <div className="absolute bottom-full mb-1 left-0 w-44 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl overflow-hidden z-20 flex flex-col">
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setReviewMode('full'); 
                        setShowReviewMenu(false); 
                      }}
                      className={`flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-700 transition-colors ${reviewMode === 'full' ? 'text-rose-400 bg-zinc-700/50' : 'text-zinc-300'}`}
                    >
                      <Zap size={12} />
                      <div className="flex flex-col">
                        <span>全文审查</span>
                      </div>
                    </button>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setReviewMode('scene'); 
                        setShowReviewMenu(false); 
                      }}
                      className={`flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-700 transition-colors border-t border-zinc-700/50 ${reviewMode === 'scene' ? 'text-rose-400 bg-zinc-700/50' : 'text-zinc-300'}`}
                    >
                      <MapPin size={12} />
                      <div className="flex flex-col">
                        <span>单场审查</span>
                      </div>
                    </button>
                    <button 
                      onClick={(e) => { 
                        e.stopPropagation(); 
                        setReviewMode('beat'); 
                        setShowReviewMenu(false); 
                      }}
                      className={`flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-700 transition-colors border-t border-zinc-700/50 ${reviewMode === 'beat' ? 'text-rose-400 bg-zinc-700/50' : 'text-zinc-300'}`}
                    >
                      <Clock size={12} />
                      <div className="flex flex-col">
                        <span>Beat 审查</span>
                      </div>
                    </button>
                    
                    <div className="border-t border-zinc-700/50 mt-1 pt-1 pb-1">
                      <div className="px-3 py-1 text-[10px] text-zinc-500 font-medium">审查选项</div>
                      <label 
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input 
                          type="checkbox" 
                          checked={reviewOptions.compliance} 
                          onChange={(e) => setReviewOptions(prev => ({...prev, compliance: e.target.checked}))} 
                          className="w-3 h-3 rounded bg-zinc-900 border-zinc-600 text-rose-500 focus:ring-rose-500/50" 
                        />
                        <span>内容合规风险</span>
                      </label>
                      <label 
                        className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-300 hover:bg-zinc-700 transition-colors cursor-pointer"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input 
                          type="checkbox" 
                          checked={reviewOptions.dialogue} 
                          onChange={(e) => setReviewOptions(prev => ({...prev, dialogue: e.target.checked}))} 
                          className="w-3 h-3 rounded bg-zinc-900 border-zinc-600 text-rose-500 focus:ring-rose-500/50" 
                        />
                        <span>台词 / OS 问题</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <button 
                onClick={(e) => { e.stopPropagation(); if (data.onAddNode) data.onAddNode('scriptNode', 'director-breakdown', undefined, id); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/80 hover:bg-[#00bcd4]/20 text-zinc-300 hover:text-[#00bcd4] rounded-lg text-xs transition-colors border border-zinc-700/50 hover:border-[#00bcd4]/50"
              >
                <Film size={12} />
                <span>剧本拆解</span>
              </button>
            </>
          )}

          {data.isReviewResult && (
            <>
              {data.repairedText && (
                <button 
                  onClick={(e) => { 
                    e.stopPropagation(); 
                    if (data.onApplyRepair) data.onApplyRepair(data.sourceId, data.repairedText); 
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 rounded-lg text-xs transition-colors border border-emerald-500/30 hover:border-emerald-500/50"
                >
                  <CheckCircle size={12} />
                  <span>应用修复</span>
                </button>
              )}
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  if (data.onAddNode) {
                    data.onAddNode('textNode', `script-review-${data.reviewType}`, undefined, data.sourceId, { problem: data.problem }); 
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 rounded-lg text-xs transition-colors border border-blue-500/30 hover:border-blue-500/50"
              >
                <RefreshCw size={12} />
                <span>重新审查</span>
              </button>
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  const problem = prompt("请输入您发现的具体问题：");
                  if (problem && data.onAddNode) data.onAddNode('textNode', 'script-review-repair', undefined, data.sourceId, { problem }); 
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/80 hover:bg-orange-500/20 text-zinc-300 hover:text-orange-400 rounded-lg text-xs transition-colors border border-zinc-700/50 hover:border-orange-500/50"
              >
                <Focus size={12} />
                <span>定点返修</span>
              </button>
            </>
          )}
        </div>
        <FloatingPlusHandle type="source" position={Position.Right} title="从文本节点拖出连接" />
      </div>
    </>
  );
};

const buildCharacterSheetPrompt = (basePrompt: string, uid: string) => {
  const prompt = basePrompt.trim();
  if (prompt.includes('多视图角色设定图') || prompt.includes('角色三视图')) return prompt;

  return `${prompt}

【角色三视图生成指令】
多视图角色设定图，结构化排版，严格一致性控制。根据参考图与提示词自动判断画风：如果原图/提示词偏写实，则生成写实摄影、真实物理世界人物；如果原图/提示词偏动漫或插画，则保持原图动漫/插画画风。
核心布局：左侧 3 个大型全身视图，正面 + 背面 + 侧面，A 姿势，双臂自然下垂，身体直立，人物比例严谨，解剖结构准确。右侧 4 格肖像矩阵，2x2 排列，包含正面肖像、左侧肖像、右侧肖像、角色右眼与皮肤/材质微距细节。
构图要求：整体横向排版，左侧全身三视图，右侧肖像矩阵，布局清晰，间距均匀；所有视图人物尺度统一，对齐严格，比例完全一致。
机位控制：全身视图为正交视角，无透视畸变；肖像视图为标准人像机位。
环境与光影：统一中性纯色背景，影棚级柔光，光照方向统一，强度一致，无明显阴影，无高光溢出。
一致性约束：所有视图必须为同一角色，面部特征、骨骼结构、体型、服装完全一致，不允许漂移；不允许姿势变化、服装变化、光影变化、背景变化、风格偏移。
画质要求：超高分辨率，极致清晰，细节锐利，皮肤与材质真实。画面边缘带有清晰排版文字「人物 UID：${uid}_01」。`;
};

type SingleFrameReferenceRole = 'character' | 'quality_scene' | 'frame' | 'prop';

const singleFrameRoleLabels: Record<SingleFrameReferenceRole, string> = {
  frame: '单帧画面',
  character: '人物',
  quality_scene: '场景',
  prop: '道具'
};

const getNodeImageUrl = (node: any): string => {
  return String(
    node?.data?.imageUrl ||
    node?.data?.url ||
    node?.data?.mediaUrl ||
    node?.data?.thumbnailUrl ||
    ''
  );
};

const inferSingleFrameReferenceRole = (node: any): SingleFrameReferenceRole => {
  const manualRole = node?.data?.singleFrameReferenceRole || node?.data?.referenceRole;
  if (manualRole && ['character', 'quality_scene', 'frame', 'prop'].includes(manualRole)) {
    return manualRole as SingleFrameReferenceRole;
  }

  const text = [
    node?.data?.title,
    node?.data?.name,
    node?.data?.prompt,
    node?.data?.category,
    node?.data?.assetType,
    node?.data?.role,
    node?.data?.referenceRole,
    node?.data?.tags,
  ].flat().filter(Boolean).join(' ').toLowerCase();

  if (/单帧|尾帧|首帧|截图|截帧|frame|shot|still/.test(text)) return 'frame';
  if (/人物|角色|主体|人像|模特|character|person|portrait|subject/.test(text)) return 'character';
  if (/道具|物品|产品|服装|衣服|手机|prop|object|product|costume/.test(text)) return 'prop';
  if (/场景|环境|建筑|空间|门店|室内|室外|街道|scene|environment|location|building/.test(text)) return 'quality_scene';

  return 'quality_scene';
};

const buildSingleFrameRedrawPrompt = (input: {
  userPrompt?: string;
  hasCharacter: boolean;
  hasQualityScene: boolean;
  hasProps: boolean;
}) => {
  const characterRef = input.hasCharacter
    ? '图A为人物资产图，最高优先级，用于锁定人物五官、脸型、发型、服装、体型、肤色和人物整体真实质感。'
    : '如未提供图A人物资产图，则以图C中的人物身份、姿态、服装和画面关系为准，只做真实摄影质感提升。';
  const sceneRef = input.hasQualityScene
    ? '图B为高质量真实摄影场景/质感参考图，仅用于提供真实摄影质感、光线质量、色温、清晰度、细节表现和环境画质标准，不用于改变图C背景空间结构。'
    : '如未提供图B高质量场景参考图，则自行提升真实摄影质感、光线质量、清晰度、色彩统一度和环境细节，但不得改变图C背景空间结构。';
  const propRef = input.hasProps
    ? '道具参考图用于锁定关键道具的外观、材质、比例和相对关系，但不得改变图C中的构图、遮挡和空间关系。'
    : '';

  return `任务目标：将人物资产质感、高质量真实摄影场景质感，与单帧画面的构图和背景空间关系进行融合重绘，输出一张高清、干净、真实摄影感的高质量单帧画面。

参考图说明：
${characterRef}
${sceneRef}
图C为当前单帧/尾帧截图，最高优先级，用于锁定当前镜头构图、人物当前姿态、人物与道具相对位置、手机位置、遮挡关系、景别、镜头透视，以及背景空间结构和关键环境锚点。
${propRef}

严格要求：
最终画面必须严格延续图C中的背景空间结构，不改变图C中的环境类型和关键空间锚点。
必须保留图C中的背景关系，包括背景所在空间类型、门店/建筑/玻璃门/台阶等关键结构、前中后景透视关系、人物与背景的相对位置、画面构图和遮挡关系。
图B只用于提升整体画面质量，不得将图B中的背景结构替换到图C中。图B不能改变图C的背景场景类型，不能把图C中的门店空间改成树路街景，也不能替换为新的街道布局。

融合要求：
人物动作、构图和背景结构以图C为主；人物五官、发型、服装和人物真实摄影质感以图A为主；整体光线质量、清晰度、色彩统一度和真实摄影画质以图B为主。

负面限制：
禁止继承图C的低清感、模糊、压缩噪点、偏色、视频帧质感。
禁止把图B中的不同背景结构替换到图C中。
禁止新增与图C不一致的树木、道路、车流、林荫道、街景布局或其他空间元素。
禁止改变图C现有的门店、玻璃门、建筑入口、台阶等关键背景结构。

画面要求：
高清、干净、色彩统一、真实摄影感、自然光线、人物稳定、环境稳定。
非动漫、非插画、非游戏CG、禁止字幕、不要水印、不要Logo。

输出要求：
输出单张高质量首帧图。最终画面应当看起来像：图C的同一空间、同一动作、同一构图，但被图A和图B重新提升为高质量真实摄影画面。
${input.userPrompt ? `\n补充要求：${input.userPrompt}` : ''}`;
};

const ImageNode = ({ data, id, selected }: any) => {
  const edges = useEdges();
  const nodes = useNodes();
  const { setNodes, getNode, updateNodeData } = useReactFlow();
  const [prompt, setPrompt] = useState(data.prompt || '');
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isPanoramaOpen, setIsPanoramaOpen] = useState(false);
  const [isAnnotationOpen, setIsAnnotationOpen] = useState(false);
  const [annotationMode, setAnnotationMode] = useState<'brush' | 'text' | 'mosaic'>('brush');
  const [annotationColor, setAnnotationColor] = useState('#00e5ff');
  const [annotationSize, setAnnotationSize] = useState(14);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(data.title || '图片节点');
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [imageUsingProxy, setImageUsingProxy] = useState(false);
  const panoramaRef = useRef<CleanPanoramaRef>(null);
  const annotationCanvasRef = useRef<HTMLCanvasElement>(null);
  const lastAnnotationPointRef = useRef<{ x: number; y: number } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const handlePanoramaScreenshot = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (panoramaRef.current) {
      const screenshot = panoramaRef.current.takeScreenshot();
      if (screenshot && data.onAddNode) {
        data.onAddNode('imageNode', 'panorama-screenshot', undefined, undefined, { 
          imageUrl: screenshot.dataUrl,
          initialWidth: 320,
          initialHeight: Math.round(320 * (screenshot.height / screenshot.width))
        });
        setIsPanoramaOpen(false);
      }
    }
  };

  React.useEffect(() => {
    setImageLoadFailed(false);
    setImageUsingProxy(false);
  }, [data.imageUrl]);

  const loadImageIntoAnnotationCanvas = useCallback(() => {
    const canvas = annotationCanvasRef.current;
    if (!canvas || !data.imageUrl) return;
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const maxWidth = Math.min(window.innerWidth * 0.72, 1100);
      const maxHeight = Math.min(window.innerHeight * 0.72, 760);
      const scale = Math.min(maxWidth / image.naturalWidth, maxHeight / image.naturalHeight, 1);
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    };
    image.onerror = () => {
      alert('标注编辑器无法读取当前图片。请先把图片下载后重新上传到画布，再进行标注。');
      setIsAnnotationOpen(false);
    };
    image.src = data.imageUrl;
  }, [data.imageUrl]);

  React.useEffect(() => {
    if (isAnnotationOpen) {
      setTimeout(loadImageIntoAnnotationCanvas, 0);
    }
  }, [isAnnotationOpen, loadImageIntoAnnotationCanvas]);

  const getAnnotationPoint = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = annotationCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * canvas.width,
      y: ((e.clientY - rect.top) / rect.height) * canvas.height
    };
  };

  const drawAnnotationAt = (point: { x: number; y: number }) => {
    const canvas = annotationCanvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    if (annotationMode === 'brush') {
      const last = lastAnnotationPointRef.current || point;
      ctx.strokeStyle = annotationColor;
      ctx.lineWidth = annotationSize;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(point.x, point.y);
      ctx.stroke();
      lastAnnotationPointRef.current = point;
      return;
    }

    if (annotationMode === 'mosaic') {
      const size = annotationSize * 2.4;
      const x = Math.max(0, point.x - size / 2);
      const y = Math.max(0, point.y - size / 2);
      const w = Math.min(size, canvas.width - x);
      const h = Math.min(size, canvas.height - y);
      const patch = document.createElement('canvas');
      patch.width = Math.max(1, Math.round(w / 8));
      patch.height = Math.max(1, Math.round(h / 8));
      const patchCtx = patch.getContext('2d');
      if (!patchCtx) return;
      patchCtx.imageSmoothingEnabled = false;
      patchCtx.drawImage(canvas, x, y, w, h, 0, 0, patch.width, patch.height);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(patch, 0, 0, patch.width, patch.height, x, y, w, h);
      ctx.imageSmoothingEnabled = true;
    }
  };

  const handleAnnotationPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    const point = getAnnotationPoint(e);
    if (annotationMode === 'text') {
      const text = window.prompt('请输入标注文字');
      if (!text) return;
      const canvas = annotationCanvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      ctx.font = `700 ${Math.max(18, annotationSize * 1.6)}px sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.72)';
      ctx.fillStyle = annotationColor;
      ctx.strokeText(text, point.x, point.y);
      ctx.fillText(text, point.x, point.y);
      return;
    }
    setIsAnnotating(true);
    lastAnnotationPointRef.current = point;
    drawAnnotationAt(point);
  };

  const handleAnnotationPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isAnnotating || annotationMode === 'text') return;
    drawAnnotationAt(getAnnotationPoint(e));
  };

  const handleAnnotationPointerUp = () => {
    setIsAnnotating(false);
    lastAnnotationPointRef.current = null;
  };

  const saveAnnotationAsNode = async () => {
    const canvas = annotationCanvasRef.current;
    if (!canvas || !data.onAddNode) return;
    const currentNode = getNode(id);
    const position = currentNode
      ? { x: currentNode.position.x + Number(currentNode.width || currentNode.style?.width || 320) + 90, y: currentNode.position.y }
      : undefined;
    const dataUrl = canvas.toDataURL('image/png');
    let imageUrl = dataUrl;
    try {
      imageUrl = await ensurePublicMediaUrl(dataUrl, 'image', 0);
    } catch (error) {
      console.warn('Annotation image upload to public storage failed, use local preview only:', error);
    }
    data.onAddNode('imageNode', undefined, position, id, {
      imageUrl,
      title: `${data.title || '图片'}-标注版`,
      initialWidth: Math.min(420, canvas.width),
      initialHeight: Math.round(Math.min(420, canvas.width) * (canvas.height / canvas.width))
    });
    setIsAnnotationOpen(false);
  };
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showFormatMenu, setShowFormatMenu] = useState(false);
  const [resolution, setResolution] = useState(data.resolution || '4K');
  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio || data.requestedAspectRatio || '16:9');
  const [model, setModel] = useState(data.uiModel || data.model || 'KONGLONG Image');
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [imageCount, setImageCount] = useState(data.imageCount || 1);
  const [showCountMenu, setShowCountMenu] = useState(false);
  const [characterSheetMode, setCharacterSheetMode] = useState(!!data.characterSheetMode);

  const persistGenerationOptions = useCallback((patch: Record<string, any>) => {
    setNodes((nds) => nds.map((node) => (
      node.id === id ? { ...node, data: { ...node.data, ...patch } } : node
    )));
  }, [id, setNodes]);
  
  const [stylePreset, setStylePreset] = useState('写实');
  const [showStyleMenu, setShowStyleMenu] = useState(false);

  const styleOptions = ['写实', '二次元', '赛博朋克', '水墨', '油画', '3D 渲染', '漫画', '铅笔画'];
  
  const [showMultiAngle, setShowMultiAngle] = useState(false);
  const [maHorizontal, setMaHorizontal] = useState(0);
  const [maVertical, setMaVertical] = useState(0);
  const [maZoom, setMaZoom] = useState(2);
  const [maUsePrompt, setMaUsePrompt] = useState(false);
  const [maPreset, setMaPreset] = useState('自定义');

  React.useEffect(() => {
    const handleClickOutside = () => {
      setShowFormatMenu(false);
      setShowCountMenu(false);
      setShowStyleMenu(false);
      setShowAddMenu(false);
      setShowModelMenu(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const applyMaPreset = (p: string) => {
    if (p === '自定义') return;
    if (p === '倾斜视角') { setMaHorizontal(45); setMaVertical(45); }
    else if (p === '正面俯拍') { setMaHorizontal(0); setMaVertical(45); }
    else if (p === '正面仰拍') { setMaHorizontal(0); setMaVertical(-45); }
    else if (p === '全景俯拍') { setMaHorizontal(180); setMaVertical(90); }
    else if (p === '背面视角') { setMaHorizontal(180); setMaVertical(0); }
    else if (p === '鱼眼视角') { setMaZoom(4); setMaHorizontal(0); setMaVertical(0); }
  };

  const incomingEdges = edges.filter((e: any) => e.target === id);
  const referenceNodes = incomingEdges.map((e: any) => nodes.find((n: any) => n.id === e.source)).filter(Boolean);
  const referenceImages = referenceNodes.filter((n: any) => n?.type === 'imageNode' && n?.data?.imageUrl);
  const isConnectedToSingleFrameRepaint = edges.some((e: any) => {
    if (e.source !== id) return false;
    const targetNode = nodes.find((n: any) => n.id === e.target);
    return targetNode?.type === 'aiGenNode' && targetNode?.data?.type === 'singleFrameRepaint';
  });
  const singleFrameRole = inferSingleFrameReferenceRole({ data });

  const handleAction = (action: string, payload?: any) => {
    setActiveDropdown(null);
    if (action === 'preview') {
      setIsPreviewOpen(true);
      return;
    }
    if (action === 'panorama') {
      if (data.imageUrl) {
        setIsPanoramaOpen(true);
      } else {
        alert("请先生成图片");
      }
      return;
    }
    if (action === 'annotate') {
      if (data.imageUrl) {
        setIsAnnotationOpen(true);
      } else {
        alert("请先上传或生成图片");
      }
      return;
    }
    if (action === 'hd-redraw') {
      if (data.onAddNode) {
        data.onAddNode('aiGenNode', 'singleFrameRepaint', undefined, id);
      }
      return;
    }
    if (data.onAction) {
      data.onAction(id, action, payload);
    }
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    setImageLoadFailed(false);
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth && naturalHeight && data.aspectRatioLockedFor !== data.imageUrl) {
      const node = getNode(id);
      if (node) {
        const requestedRatio = typeof data.requestedAspectRatio === 'string' ? data.requestedAspectRatio : '';
        const [requestedX, requestedY] = requestedRatio.split(':').map(Number);
        const aspect = Number.isFinite(requestedX) && Number.isFinite(requestedY) && requestedX > 0 && requestedY > 0
          ? requestedX / requestedY
          : naturalWidth / naturalHeight;
        const currentWidth = node.style?.width ? parseInt(node.style.width as string) : 320;
        const targetHeight = Math.round(currentWidth / aspect);
        
        if (Math.abs((node.style?.height as number || 0) - targetHeight) > 2) {
          setNodes(nds => nds.map(n => {
            if (n.id === id) {
              return {
                ...n,
                style: { ...n.style, width: currentWidth, height: targetHeight },
                data: { ...n.data, aspectRatioLockedFor: data.imageUrl }
              };
            }
            return n;
          }));
        } else {
          setNodes(nds => nds.map(n => {
            if (n.id === id) {
              return { ...n, data: { ...n.data, aspectRatioLockedFor: data.imageUrl } };
            }
            return n;
          }));
        }
      }
    }
  };

  const handleNodeImageError = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const image = e.currentTarget;
    const originalUrl = image.dataset.originalSrc || String(data.imageUrl || image.src || '');
    if (/^https?:\/\//i.test(originalUrl) && image.dataset.proxyFallback !== 'true') {
      image.dataset.proxyFallback = 'true';
      setImageUsingProxy(true);
      image.src = getMediaProxyUrl(originalUrl);
      return;
    }
    setImageLoadFailed(true);
  };

  return (
    <>
      <NodeResizer color="transparent" handleClassName={resizerHandleStyle} minWidth={240} minHeight={100} isVisible={selected} keepAspectRatio={!!data.imageUrl} />
      
      {/* Node Label (Above Node) */}
      <div className={`absolute -top-7 left-0 text-zinc-400 text-xs flex items-center gap-1.5 font-medium px-1 transition-opacity opacity-100 z-50`}>
        <ImageIcon size={14} />
        {isEditingTitle ? (
          <input 
            autoFocus
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={() => {
              setIsEditingTitle(false);
              updateNodeData(id, { title: tempTitle });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setIsEditingTitle(false);
                updateNodeData(id, { title: tempTitle });
              }
            }}
            className="bg-transparent border-b border-zinc-500 outline-none text-white w-24 px-1"
          />
        ) : (
          <span 
            onDoubleClick={(e) => {
              e.stopPropagation();
              setTempTitle(data.title || '图片节点');
              setIsEditingTitle(true);
            }} 
            className="cursor-text hover:text-zinc-200"
          >
            {data.title || '图片节点'}
          </span>
        )}
      </div>
      
      <NodeToolbar
        isVisible={selected}
        position={Position.Top}
        className="flex items-center gap-1 p-1 bg-[#1a1b1e]/95 backdrop-blur-xl border border-zinc-700/80 rounded-xl shadow-2xl z-50 mb-2 relative"
      >
        <button onClick={() => handleAction('preview')} className="p-1.5 text-zinc-400 hover:text-[#00bcd4] hover:bg-[#00bcd4]/10 rounded-lg tooltip relative" title="预览"><Maximize size={15} /></button>
        <button onClick={() => setShowMultiAngle(!showMultiAngle)} className={`p-1.5 rounded-lg tooltip ${showMultiAngle ? 'text-white bg-zinc-800' : 'text-zinc-400 hover:text-[#00bcd4] hover:bg-[#00bcd4]/10'}`} title="多角度"><Move3D size={15} /></button>
        <button onClick={() => handleAction('relight')} className="p-1.5 text-zinc-400 hover:text-[#00bcd4] hover:bg-[#00bcd4]/10 rounded-lg tooltip" title="打光"><Sun size={15} /></button>
        <div className="w-px h-4 bg-zinc-700 mx-0.5"></div>
        <div className="relative">
          <button onClick={() => setActiveDropdown(activeDropdown === '9grid' ? null : '9grid')} className={`p-1.5 rounded-lg tooltip ${activeDropdown === '9grid' ? 'text-white bg-zinc-800' : 'text-zinc-400 hover:text-[#00bcd4] hover:bg-[#00bcd4]/10'}`} title="九宫格"><LayoutGrid size={15} /></button>
          {activeDropdown === '9grid' && (
             <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 bg-[#242424] border border-zinc-800 rounded-lg shadow-xl w-32 py-1 z-[100] text-sm text-zinc-300">
               <button onClick={() => handleAction('9grid-multi')} className="w-full text-left px-3 py-1.5 hover:bg-[#343434] hover:text-white">多视图网格</button>
               <button onClick={() => handleAction('9grid-story')} className="w-full text-left px-3 py-1.5 hover:bg-[#343434] hover:text-white">分镜推演</button>
               <button onClick={() => handleAction('9grid-character')} className="w-full text-left px-3 py-1.5 hover:bg-[#343434] hover:text-white">角色三视图</button>
             </div>
          )}
        </div>
        <div className="relative">
          <button onClick={() => setActiveDropdown(activeDropdown === 'hd' ? null : 'hd')} className={`p-1.5 rounded-lg tooltip ${activeDropdown === 'hd' ? 'text-white bg-zinc-800' : 'text-zinc-400 hover:text-[#00bcd4] hover:bg-[#00bcd4]/10'}`} title="高清"><Sparkles size={15} /></button>
          {activeDropdown === 'hd' && (
             <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 bg-[#242424] border border-zinc-800 rounded-lg shadow-xl w-32 py-1 z-[100] text-sm text-zinc-300">
               <button onClick={() => handleAction('hd-enhance')} className="w-full text-left px-3 py-1.5 hover:bg-[#343434] hover:text-white">高清增强</button>
               <button onClick={() => handleAction('hd-expand')} className="w-full text-left px-3 py-1.5 hover:bg-[#343434] hover:text-white">扩图</button>
               <button onClick={() => handleAction('hd-redraw')} className="w-full text-left px-3 py-1.5 hover:bg-[#343434] hover:text-white">单帧重绘</button>
               <button onClick={() => handleAction('hd-erase')} className="w-full text-left px-3 py-1.5 hover:bg-[#343434] hover:text-white">擦除</button>
             </div>
          )}
        </div>
        <div className="relative">
          <button onClick={() => setActiveDropdown(activeDropdown === 'split' ? null : 'split')} className={`p-1.5 rounded-lg tooltip ${activeDropdown === 'split' ? 'text-white bg-zinc-800' : 'text-zinc-400 hover:text-[#00bcd4] hover:bg-[#00bcd4]/10'}`} title="宫格切分"><SplitSquareHorizontal size={15} /></button>
          {activeDropdown === 'split' && (
             <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 bg-[#242424] border border-zinc-800 rounded-lg shadow-xl w-24 py-1 z-[100] text-sm text-zinc-300">
               <button onClick={() => handleAction('split-4')} className="w-full text-left px-3 py-1.5 hover:bg-[#343434] hover:text-white">4宫格</button>
               <button onClick={() => handleAction('split-9')} className="w-full text-left px-3 py-1.5 hover:bg-[#343434] hover:text-white">9宫格</button>
               <button onClick={() => handleAction('split-16')} className="w-full text-left px-3 py-1.5 hover:bg-[#343434] hover:text-white">16宫格</button>
             </div>
          )}
        </div>
        <div className="w-px h-4 bg-zinc-700 mx-0.5"></div>
        <button onClick={() => handleAction('annotate')} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg tooltip" title="标注"><Focus size={15} /></button>
        <button onClick={() => handleAction('rotate')} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg tooltip" title="旋转"><RotateCw size={15} /></button>
        <button onClick={() => handleAction('download')} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg tooltip" title="下载"><Download size={15} /></button>
        <button onClick={() => handleAction('panorama')} className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg tooltip" title="全景"><Eye size={15} /></button>
      </NodeToolbar>
      
      <div className={`${nodeBg} border-[1.5px] ${selected ? selectedBorder : defaultBorder} rounded-2xl p-0 shadow-sm hover:shadow-[0_0_15px_rgba(0,188,212,0.15)] transition-shadow w-full h-full flex flex-col relative group`}>
        {isConnectedToSingleFrameRepaint && (
          <div
            className="absolute -top-11 left-28 z-[120] nodrag nowheel flex items-center rounded-xl border border-[#00bcd4]/35 bg-[#101417]/95 px-1.5 py-1.5 shadow-[0_0_24px_rgba(0,188,212,0.18)] backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            title="仅在连接到单帧重绘功能节点时显示"
          >
            <select
              value={singleFrameRole}
              onChange={(e) => updateNodeData(id, {
                ...data,
                singleFrameReferenceRole: e.target.value as SingleFrameReferenceRole
              })}
              className="bg-[#191b1f] border border-zinc-700 rounded-lg px-2 py-1 text-[11px] text-zinc-100 outline-none hover:border-[#00bcd4]/60"
            >
              {Object.entries(singleFrameRoleLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}
        
        <FloatingPlusHandle type="target" position={Position.Left} title="拖入连接到图片节点" />
        
        {/* Thumbnails outside top-left */}
        {data.thumbnails && data.thumbnails.length > 0 && (
          <div 
            className="absolute -left-14 top-0 flex flex-col gap-2 overflow-y-auto px-1 py-1 shrink-0 custom-scrollbar h-full z-50 pointer-events-auto"
            style={{ maxHeight: '100%' }}
            onWheel={(e) => e.stopPropagation()}
          >
            {data.thumbnails.map((thumb: string, idx: number) => (
              <div 
                key={idx} 
                onClick={(e) => { e.stopPropagation(); if(data.onAction) data.onAction(id, 'select-thumbnail', thumb) }} 
                className={`w-10 h-10 shrink-0 rounded-lg overflow-hidden border ${data.imageUrl === thumb ? 'border-[#00bcd4] shadow-[0_0_8px_rgba(0,188,212,0.4)]' : 'border-zinc-800/50 md:hover:border-zinc-500'} cursor-pointer transition-all relative nodrag`}
              >
                 <img src={thumb || undefined} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        )}
        
        {/* Right '+' Connection Handle: click opens quick add, drag creates edge */}
        <div className={`absolute top-0 bottom-0 -right-10 w-12 z-40 transition-opacity flex items-center justify-center ${showAddMenu ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}>
           <Handle
             type="source"
             position={Position.Right}
             className={plusHandleStyle}
             onClick={(e) => { e.stopPropagation(); setShowAddMenu(!showAddMenu); }}
             title="单击添加节点，按住拖拽连接"
           >
             <Plus size={14} />
           </Handle>

           {showAddMenu && (
             <div className="absolute top-1/2 -translate-y-1/2 left-full ml-2 bg-[#2A2A2A] border border-zinc-700/80 rounded-xl shadow-2xl p-2 w-48 flex flex-col gap-1 z-[100]" onClick={e => e.stopPropagation()}>
               <div className="text-xs text-zinc-500 font-medium px-2 py-1.5 mb-1">引用该节点生成</div>
               <button onClick={(e) => { e.stopPropagation(); if(data.onAddNode) data.onAddNode('textNode', undefined, undefined, id); setShowAddMenu(false); }} className="flex items-center gap-3 w-full px-2 py-2 hover:bg-zinc-700/50 rounded-lg transition-colors text-zinc-300">
                 <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center"><Type size={12} /></div>
                 <span className="text-sm">文本</span>
               </button>
               <button onClick={(e) => { e.stopPropagation(); if(data.onAddNode) data.onAddNode('imageNode', undefined, undefined, id); setShowAddMenu(false); }} className="flex items-center gap-3 w-full px-2 py-2 hover:bg-zinc-700/50 rounded-lg transition-colors text-zinc-300">
                 <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center"><ImageIcon size={12} /></div>
                 <span className="text-sm">图片</span>
               </button>
               <button onClick={(e) => { e.stopPropagation(); if(data.onAddNode) data.onAddNode('videoNode', undefined, undefined, id); setShowAddMenu(false); }} className="flex items-center gap-3 w-full px-2 py-2 hover:bg-zinc-700/50 rounded-lg transition-colors text-zinc-300">
                 <div className="w-6 h-6 rounded bg-zinc-800 flex items-center justify-center"><Video size={12} /></div>
                 <span className="text-sm">视频</span>
               </button>
             </div>
           )}
        </div>

        {data.imageUrl ? (
          <div className="flex-1 rounded-2xl overflow-hidden relative group/img bg-transparent m-1 flex flex-col justify-center">
            <img 
              src={data.imageUrl || undefined} 
              data-original-src={data.imageUrl || undefined}
              onLoad={handleImageLoad}
              onError={handleNodeImageError}
              onClick={(e) => {
                e.stopPropagation();
                if (imageLoadFailed || data.isGenerating) return;
                if (!selected) {
                  setNodes((nds) => nds.map((node) => ({ ...node, selected: node.id === id })));
                  return;
                }
                setIsPreviewOpen(true);
              }}
              referrerPolicy="no-referrer"
              alt="Node content" 
              className={`w-full h-full object-contain block cursor-zoom-in ${data.rotation ? 'rotate-90 transition-transform' : ''}`} 
            />
            {imageUsingProxy && !imageLoadFailed && (
              <div className="absolute left-3 bottom-3 z-10 rounded-full border border-[#00bcd4]/30 bg-black/55 px-2 py-1 text-[10px] text-[#8befff] backdrop-blur">
                代理加载
              </div>
            )}
            {imageLoadFailed && (
              <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#18191c]/95 px-6 text-center">
                <ImageIcon size={34} className="mb-3 text-zinc-500" />
                <div className="text-sm font-medium text-zinc-200">图片链接暂时无法显示</div>
                <div className="mt-2 max-w-[260px] text-xs leading-relaxed text-zinc-500">
                  可能是第三方临时链接过期、防盗链，或 TOS 转存未成功。请重新生成，或确认服务器已开启 ASSET_INGEST_TO_TOS。
                </div>
              </div>
            )}
            <button onClick={(e) => { e.stopPropagation(); if(data.onAction) data.onAction(id, 'download'); }} className="absolute top-3 right-3 p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg opacity-0 group-hover/img:opacity-100 transition-opacity z-10">
               <Upload size={16} />
            </button>
            
            {data.isGenerating && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                <Sparkles className="text-[#00bcd4] animate-pulse mb-3" size={32} />
                <span className="text-sm text-[#00e5ff] font-medium">
                  {data.progressMsg || '正在生成图片中，请稍等...'}
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 rounded-2xl bg-[#2A2A2A]/50 border-2 border-transparent hover:border-zinc-700 transition-colors flex flex-col items-center justify-center relative m-1">
             {data.isGenerating ? (
               <div className="flex flex-col items-center justify-center px-6 text-center">
                 <Sparkles className="text-[#00bcd4] animate-pulse mb-3" size={32} />
                 <span className="text-sm text-[#00e5ff] font-medium">
                   {data.progressMsg || '正在生成图片中，请稍等...'}
                 </span>
               </div>
             ) : (
               <div className="text-zinc-600 mb-6 mt-4">
                 <ImageIcon size={64} className="opacity-40 mx-auto" />
               </div>
             )}
             
             {!data.isGenerating && <div className={`absolute left-1/2 -translate-x-1/2 transition-all duration-200 z-[100] opacity-0 group-hover:opacity-100 ${selected ? '-top-[90px]' : '-top-12'}`}>
                <label className="flex items-center gap-2 px-3 py-1.5 bg-[#2A2A2A] border border-zinc-700 hover:bg-zinc-700 text-zinc-300 rounded-lg cursor-pointer text-sm shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                  <Upload size={14} /> 上传
                  <input type="file" accept="image/*" className="hidden" onClick={e => e.stopPropagation()} onChange={(e) => {
                     e.stopPropagation();
                     const file = e.target.files?.[0];
                     if(file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                           if(data.onUpload) data.onUpload(id, ev.target?.result as string, 'image');
                        }
                        reader.readAsDataURL(file);
                     }
                  }}/>
                </label>
             </div>}
             
             
          </div>
        )}
      </div>

      {showMultiAngle && (
        <div 
          className="absolute top-[calc(100%+16px)] left-0 bg-[#2A2A2A] border border-zinc-700/80 rounded-2xl shadow-2xl p-5 flex flex-col w-[540px] z-[70] cursor-default nodrag"
          onWheel={(e) => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-zinc-700/50 pb-3 mb-4">
            <div className="text-sm font-medium text-zinc-200">多角度编辑器</div>
            <button onClick={() => setShowMultiAngle(false)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
          </div>
          
          <div className="flex gap-2 text-[11px] mb-6 overflow-x-auto no-scrollbar pb-1">
            {['自定义', '鱼眼视角', '倾斜视角', '正面俯拍', '正面仰拍', '全景俯拍', '背面视角'].map(p => (
              <button 
                key={p}
                onClick={(e) => { e.stopPropagation(); setMaPreset(p); applyMaPreset(p); }}
                className={`px-3 py-1.5 rounded-lg bg-[#202020] border transition-colors ${maPreset === p ? 'border-zinc-400 text-white' : 'border-zinc-700/50 text-zinc-400 hover:text-white hover:border-zinc-500'} whitespace-nowrap`}
              >
                {p}
              </button>
            ))}
          </div>

          <div className="flex gap-6 items-center">
            {/* Sphere */}
            <div className="w-[200px] h-[200px] bg-[#1E1E1E] rounded-2xl flex items-center justify-center relative shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]">
                <svg width="160" height="160" viewBox="0 0 100 100" className="absolute opacity-20 text-zinc-400">
                  <circle cx="50" cy="50" r="48" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  <ellipse cx="50" cy="50" rx="16" ry="48" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  <ellipse cx="50" cy="50" rx="32" ry="48" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  <ellipse cx="50" cy="50" rx="48" ry="16" fill="none" stroke="currentColor" strokeWidth="0.5" />
                  <ellipse cx="50" cy="50" rx="48" ry="32" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </svg>
                <div className="absolute top-2 left-1/2 -translate-x-1/2 text-zinc-500"><ChevronUp size={14} /></div>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 text-zinc-500"><ChevronDown size={14} /></div>
                <div className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-500"><ChevronLeft size={14} /></div>
                <div className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500"><ChevronRight size={14} /></div>
                <div className="w-[72px] h-[72px] bg-black rounded-lg overflow-hidden relative shadow-2xl ring-1 ring-white/10 z-10 flex items-center justify-center pointer-events-none">
                   {data.imageUrl ? <img src={data.imageUrl || undefined} className="w-full h-full object-cover opacity-90" /> : <ImageIcon size={24} className="text-zinc-700" />}
                   <div className="absolute inset-0 border border-white/20 rounded-lg pointer-events-none"></div>
                   <div className="absolute top-1/2 left-0 w-full h-[1px] bg-white/20 border-t border-dashed border-white/30 pointer-events-none"></div>
                   <div className="absolute top-0 left-1/2 w-[1px] h-full bg-white/20 border-l border-dashed border-white/30 pointer-events-none"></div>
                </div>
            </div>
            
            {/* Sliders */}
            <div className="flex-1 flex flex-col gap-5">
               <div className="flex items-center gap-4">
                 <span className="text-xs text-zinc-400 w-14 shrink-0">水平环绕</span>
                 <input type="range" min={-180} max={180} value={maHorizontal} onChange={(e) => { setMaHorizontal(Number(e.target.value)); setMaPreset('自定义'); }} className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none accent-white cursor-pointer" />
                 <span className="text-xs text-zinc-200 w-8 text-right shrink-0">{maHorizontal}°</span>
               </div>
               <div className="flex items-center gap-4">
                 <span className="text-xs text-zinc-400 w-14 shrink-0">垂直俯仰</span>
                 <input type="range" min={-90} max={90} value={maVertical} onChange={(e) => { setMaVertical(Number(e.target.value)); setMaPreset('自定义'); }} className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none accent-white cursor-pointer" />
                 <span className="text-xs text-zinc-200 w-8 text-right shrink-0">{maVertical}°</span>
               </div>
               <div className="flex items-center gap-4">
                 <span className="text-xs text-zinc-400 w-14 shrink-0">景别缩放</span>
                 <input type="range" min={0} max={4} value={maZoom} onChange={(e) => { setMaZoom(Number(e.target.value)); setMaPreset('自定义'); }} className="flex-1 h-1 bg-zinc-700 rounded-lg appearance-none accent-white cursor-pointer" />
                 <span className="text-xs text-zinc-200 w-8 text-right shrink-0">{['特写', '近景', '中景', '全景', '远景'][maZoom]}</span>
               </div>
               
               <div className="flex items-center gap-3 mt-1">
                 <span className="text-xs text-zinc-400 w-14 shrink-0">提示词</span>
                 <button 
                   onClick={() => setMaUsePrompt(!maUsePrompt)}
                   className={`w-9 h-5 rounded-full transition-colors relative ${maUsePrompt ? 'bg-[#00bcd4]' : 'bg-zinc-700'}`}
                 >
                   <div className={`w-3.5 h-3.5 rounded-full bg-white absolute top-0.5 transition-all ${maUsePrompt ? 'left-5' : 'left-0.5'}`} />
                 </button>
               </div>
            </div>
          </div>
          
          <div className="mt-6 flex items-center justify-between border-t border-zinc-700/50 pt-4">
            <button 
              className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1.5 transition-colors"
              onClick={(e) => { e.stopPropagation(); setMaHorizontal(0); setMaVertical(0); setMaZoom(2); setMaPreset('自定义'); }}
            >
              <RefreshCw size={12} /> 重置参数
            </button>
            
            <div className="flex items-center gap-3">
               <span className="text-[11px] text-zinc-500 flex items-center gap-1"><Zap size={10} className="text-zinc-600" /> 1</span>
               <button 
                 className={`w-8 h-8 rounded-full ${data.isGenerating ? 'bg-[#00bcd4]/20' : 'bg-white hover:bg-zinc-200'} text-black flex items-center justify-center transition-colors shadow-lg`}
                 onClick={(e) => { 
                   e.stopPropagation(); 
                   if (data.onAction) data.onAction(id, 'multi-angle-gen', { horizontal: maHorizontal, vertical: maVertical, zoom: maZoom, usePrompt: maUsePrompt }); 
                   setShowMultiAngle(false); 
                 }}
               >
                 <ArrowUp size={16} />
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Generation Panel (only show on selected) */}
      {(selected && !isPreviewOpen) && (
        <div 
          className="absolute top-[calc(100%+16px)] left-0 bg-[#2A2A2A] border border-zinc-700 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 min-w-[560px] min-h-[250px] w-[560px] z-[60] cursor-default overflow-visible"
          onWheel={(e) => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            setShowFormatMenu(false);
            setShowStyleMenu(false);
            setShowCountMenu(false);
          }}
        >
           {/* Reference Images */}
           <div className="flex items-center gap-2 mb-2">
             {referenceImages.length > 0 && (
               <div className="border-zinc-700 flex items-center gap-2">
                 {referenceImages.map((refNode: any, i: number) => (
                   <div key={refNode.id} className="relative w-8 h-8 rounded-md overflow-hidden border border-zinc-600 shadow-sm">
                     <img src={refNode.data.imageUrl || undefined} className="w-full h-full object-cover" />
                     <div className="absolute -top-1 -right-1 bg-[#242424] text-white border border-zinc-600 text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                       {i + 1}
                     </div>
                   </div>
                 ))}
               </div>
             )}
           </div>

           {/* Input Area */}
           <div className={`relative flex-1 flex flex-col group/textarea min-h-0 bg-zinc-800/50 border border-zinc-700/50 rounded-xl mb-4 ${isExpanded ? 'z-50 shadow-2xl border-[#00bcd4]/50 h-auto' : 'focus-within:border-zinc-500 focus-within:bg-zinc-800 transition-colors'}`}>
             {isExpanded && (
                <div className="fixed inset-0 z-40 bg-black/20" onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}></div>
             )}
             <div className={`relative flex flex-col p-3 z-50 ${isExpanded ? 'bg-[#2A2A2A] rounded-xl' : ''}`}>
               <button 
                 onClick={(e) => { 
                   e.stopPropagation(); 
                   setIsExpanded(!isExpanded); 
                   if (!isExpanded && textareaRef.current) {
                     setTimeout(() => {
                        textareaRef.current!.style.height = 'auto';
                        textareaRef.current!.style.height = textareaRef.current!.scrollHeight + 'px';
                        textareaRef.current!.focus();
                     }, 10);
                   } else if (textareaRef.current) {
                     textareaRef.current.style.height = 'auto';
                   }
                 }}
                 className="absolute top-2 right-2 p-1.5 text-zinc-400 hover:text-white bg-zinc-800 rounded opacity-0 group-hover/textarea:opacity-100 transition-opacity z-10 hover:bg-zinc-700"
                 title={isExpanded ? "收起" : "展开全文"}
                 onMouseDown={e => e.stopPropagation()}
               >
                 {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
               </button>
               <textarea 
                 ref={textareaRef}
                 className={`w-full text-sm py-2 px-3 bg-transparent border-none focus:outline-none resize-y text-zinc-300 placeholder-zinc-500 nodrag nopan nowheel font-medium selection:bg-purple-500/30 custom-scrollbar pb-6 ${isExpanded ? 'min-h-[200px]' : 'min-h-[60px]'}`}
                 placeholder="描述视频内容，可用 @图片1 / @视频1 引用连入素材"
                 value={prompt}
                 onMouseDown={e => e.stopPropagation()}
                 onKeyDown={e => e.stopPropagation()}
                 onChange={e => {
                    setPrompt(e.target.value);
                    updateNodeData(id, { ...data, prompt: e.target.value });
                    if (isExpanded && textareaRef.current) {
                      textareaRef.current.style.height = 'auto';
                      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
                    }
                 }}
               />
             </div>
           </div>

           {/* Bottom Bar (Settings & Generate) */}
           <div className="flex items-center justify-between border-t border-zinc-700/50 pt-3 flex-nowrap">
             {/* Left Settings */}
             <div className="flex items-center gap-2 shrink-0">
               <div className="relative">
                 <button 
                   onClick={(e) => { e.stopPropagation(); setShowModelMenu(!showModelMenu); }}
                   className={`flex items-center gap-1 text-xs transition-colors px-2 py-1 rounded-md whitespace-nowrap shrink-0 ${showModelMenu ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:text-white hover:bg-zinc-800/50'}`}
                 >
                   <Box size={14} className={showModelMenu ? 'text-[#00bcd4]' : 'text-zinc-400'} /> {model} <ChevronDown size={12} className={`transition-transform ${showModelMenu ? 'rotate-180' : ''}`} />
                 </button>
                 
                 {showModelMenu && (
                   <div 
                     className="absolute bottom-[calc(100%+8px)] left-0 w-[200px] bg-[#1E1E1E] border border-zinc-700/80 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] py-2 z-50 flex flex-col"
                     onClick={(e) => e.stopPropagation()}
                   >
                     {['KONGLONG Image', 'KONGLONG Banana 2', 'KONGLONG Banana pro'].map(m => (
                       <button
                         key={m}
                         onClick={(e) => { e.stopPropagation(); setModel(m); persistGenerationOptions({ uiModel: m, model: m }); setShowModelMenu(false); }}
                         className={`flex items-center gap-2 px-4 py-2 text-xs transition-colors text-left ${model === m ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'}`}
                       >
                         {m}
                       </button>
                     ))}
                   </div>
                 )}
               </div>
               <div className="relative">
                 <button 
                   onClick={(e) => { e.stopPropagation(); setShowFormatMenu(!showFormatMenu); }}
                   className={`flex items-center gap-1 text-xs transition-colors px-2 py-1 rounded-md whitespace-nowrap shrink-0 ${showFormatMenu ? 'bg-zinc-800 text-white' : 'text-zinc-300 hover:text-white hover:bg-zinc-800/50'}`}
                 >
                   <Monitor size={14} className={showFormatMenu ? 'text-[#00bcd4]' : 'text-zinc-400'} /> {aspectRatio} • {resolution} <ChevronDown size={12} className={`transition-transform ${showFormatMenu ? 'rotate-180' : ''}`} />
                 </button>
                 
                 {showFormatMenu && (
                   <div 
                     className="absolute bottom-[calc(100%+8px)] left-0 w-[340px] bg-[#1E1E1E] border border-zinc-700/80 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] p-4 z-50 flex flex-col gap-4"
                     onClick={(e) => e.stopPropagation()}
                   >
                     {/* 分辨率 */}
                     <div>
                       <div className="text-xs text-zinc-500 mb-2 font-medium">分辨率</div>
                       <div className="grid grid-cols-3 gap-2">
                         {['1K', '2K', '4K'].map(res => {
                           const isUnsupported = false;
                           return (
                             <button 
                               key={res}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!isUnsupported) {
                                  setResolution(res);
                                  persistGenerationOptions({ resolution: res });
                                }
                              }}
                               disabled={isUnsupported}
                               className={`py-1.5 text-xs rounded-lg border transition-colors ${
                                 isUnsupported ? 'border-zinc-800 text-zinc-600 bg-zinc-900/50 cursor-not-allowed' :
                                 resolution === res ? 'border-zinc-500 bg-white/5 shadow-[0_0_12px_rgba(255,255,255,0.15)] text-white font-medium' : 'border-zinc-700/50 text-zinc-400 hover:border-zinc-500 hover:text-zinc-300'
                               }`}
                             >
                               {res}
                             </button>
                           );
                         })}
                       </div>
                     </div>
                     
                     {/* 比例 */}
                     <div>
                       <div className="text-xs text-zinc-500 mb-2 font-medium">比例</div>
                       <div className="grid grid-cols-5 gap-2">
                         {[
                           { label: '自适应', aspect: 'auto' },
                           { label: '1:1', aspect: '1/1' },
                           { label: '9:16', aspect: '9/16' },
                           { label: '16:9', aspect: '16/9' },
                           { label: '3:4', aspect: '3/4' },
                           { label: '4:3', aspect: '4/3' },
                           { label: '3:2', aspect: '3/2' },
                           { label: '2:3', aspect: '2/3' },
                           { label: '4:5', aspect: '4/5' },
                           { label: '5:4', aspect: '5/4' },
                           { label: '21:9', aspect: '21/9' },
                         ].map(ratio => {
                           const isSelected = aspectRatio === ratio.label;
                           // Parse aspect ratio numbers for icon sizing
                           let w = 12, h = 12;
                           if (ratio.aspect !== 'auto') {
                             const [x, y] = ratio.aspect.split('/').map(Number);
                             const maxDim = 16;
                             if (x > y) {
                               w = maxDim;
                               h = (y / x) * maxDim;
                             } else {
                               h = maxDim;
                               w = (x / y) * maxDim;
                             }
                           }
                           
                           return (
                             <button
                               key={ratio.label}
                              onClick={(e) => {
                                e.stopPropagation();
                                setAspectRatio(ratio.label);
                                persistGenerationOptions({ aspectRatio: ratio.label, requestedAspectRatio: ratio.label });
                              }}
                               className={`flex flex-col items-center justify-center p-2 rounded-lg border transition-all ${isSelected ? 'border-zinc-500 bg-white/5 shadow-[0_0_12px_rgba(255,255,255,0.15)] text-white' : 'border-zinc-800/50 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300'}`}
                             >
                               <div className="h-6 flex items-center justify-center mb-1">
                                 {ratio.aspect === 'auto' ? (
                                    <div className={`border-2 rounded-[2px] transition-colors w-4 h-4 ${isSelected ? 'border-white' : 'border-zinc-500'}`} />
                                 ) : (
                                    <div className={`border-2 rounded-[2px] transition-colors ${isSelected ? 'border-white' : 'border-zinc-500'}`} style={{ width: Math.max(8, w), height: Math.max(8, h) }} />
                                 )}
                               </div>
                               <div className={`text-[10px] ${isSelected ? 'text-white font-medium' : 'text-zinc-500'}`}>
                                 {ratio.label}
                               </div>
                             </button>
                           );
                         })}
                       </div>
                     </div>
                   </div>
                 )}
               </div>
               
             </div>

             {/* Right Settings */}
             <div className="flex items-center gap-2 shrink-0">
               <button 
                 className="text-zinc-400 hover:text-white" 
                 title="中英翻译"
                 onClick={(e) => {
                   e.stopPropagation();
                   if (data.onAction) {
                      data.onAction(id, 'translate-prompt', data.prompt);
                   }
                 }}
               >
                 <Languages size={14} />
               </button>
               <label
                 className={`w-4 h-4 rounded-[5px] border flex items-center justify-center cursor-pointer transition-colors ${characterSheetMode ? 'border-[#00bcd4] bg-[#00bcd4]/20 text-[#00e5ff]' : 'border-zinc-600 bg-zinc-900/60 text-transparent hover:border-zinc-400'}`}
                 title="角色三视图"
                 onClick={(e) => e.stopPropagation()}
                 onMouseDown={(e) => e.stopPropagation()}
               >
                 <input
                   type="checkbox"
                   checked={characterSheetMode}
                   className="sr-only"
                   onChange={(e) => {
                     const checked = e.target.checked;
                     setCharacterSheetMode(checked);
                     persistGenerationOptions({ characterSheetMode: checked });
                   }}
                 />
                 <Check size={11} strokeWidth={3} />
               </label>
               <button className="text-zinc-400 hover:text-white"><Settings2 size={14} /></button>
               
               <div className="relative">
                 <button onClick={(e) => { e.stopPropagation(); setShowCountMenu(!showCountMenu); }} className="text-zinc-300 text-xs flex items-center gap-1 hover:text-white transition-colors">
                   {imageCount}张 <ChevronDown size={12} className={`transition-transform ${showCountMenu ? 'rotate-180' : ''}`} />
                 </button>
                 {showCountMenu && (
                   <div className="absolute bottom-[calc(100%+8px)] right-0 w-20 bg-[#1E1E1E] border border-zinc-700/80 rounded-xl shadow-2xl py-2 flex flex-col z-50">
                     {[1, 2, 4].map(num => (
                       <button
                         key={num}
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageCount(num);
                          persistGenerationOptions({ imageCount: num });
                          setShowCountMenu(false);
                        }}
                         className={`px-4 py-1.5 text-xs text-left transition-colors ${imageCount === num ? 'bg-zinc-800 text-[#00bcd4]' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'}`}
                       >
                         {num}张
                       </button>
                     ))}
                   </div>
                 )}
               </div>
               
               <button 
                 className={`w-8 h-8 rounded-full ${data.isGenerating ? 'bg-[#00bcd4]/20' : 'bg-zinc-600 hover:bg-[#00bcd4]'} text-white flex items-center justify-center transition-all shadow-lg ml-1 relative`}
                 onClick={(e) => {
                   e.stopPropagation();
                   if(!data.isGenerating && data.onGenerate) {
                     persistGenerationOptions({ aspectRatio, requestedAspectRatio: aspectRatio, resolution, imageCount, stylePreset, uiModel: model, model, characterSheetMode });
                     data.onGenerate(id, { aspectRatio, resolution, imageCount, stylePreset, uiModel: model, characterSheetMode });
                   }
                 }}
                 disabled={data.isGenerating}
               >
                 {data.isGenerating ? (
                   <>
                     <div className="absolute inset-0 rounded-full border-[1.5px] border-[#00bcd4] border-t-transparent animate-spin" />
                     <div className="text-[10px] text-[#00bcd4] font-medium">{data.progress ? `${Math.round(data.progress)}%` : ''}</div>
                   </>
                 ) : (
                   <ArrowUp size={16} />
                 )}
               </button>
             </div>
           </div>
        </div>
      )}

      {isPreviewOpen && data.imageUrl && createPortal(
        <div className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center backdrop-blur-sm" onClick={() => setIsPreviewOpen(false)}>
          <button className="absolute top-6 right-6 p-2 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700">
            <X size={20} />
          </button>
          <img
            src={data.imageUrl || undefined}
            data-original-src={data.imageUrl || undefined}
            onError={fallbackImageToProxy}
            referrerPolicy="no-referrer"
            alt="Preview"
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-xl shadow-2xl cursor-zoom-out"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}

      {isPanoramaOpen && data.imageUrl && createPortal(
        <div className="fixed inset-0 z-[1000] bg-black/90 flex items-center justify-center backdrop-blur-sm" onClick={() => setIsPanoramaOpen(false)}>
          <div className="absolute top-6 right-6 flex flex-col gap-3 z-50">
            <button className="p-2.5 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 shadow-xl transition-all" onClick={() => setIsPanoramaOpen(false)}>
              <X size={20} />
            </button>
            <button className="p-2.5 bg-[#00bcd4] text-white rounded-xl hover:bg-[#00bcd4]/80 shadow-xl transition-all" onClick={handlePanoramaScreenshot} title="全景截图提取为新节点">
              <Camera size={20} />
            </button>
          </div>
          <div className="w-[90vw] h-[90vh] rounded-xl overflow-hidden shadow-2xl relative" onClick={(e) => e.stopPropagation()}>
            <CleanPanoramaViewer
               ref={panoramaRef}
               imageUrl={data.imageUrl}
               spatialObjects={[]}
               onSpaceClick={(yaw, pitch) => {
                 // In the future this could add objects to the panorama
               }}
            />
          </div>
        </div>,
        document.body
      )}

      {isAnnotationOpen && data.imageUrl && createPortal(
        <div className="fixed inset-0 z-[1000] bg-black/88 backdrop-blur-md flex items-center justify-center p-6" onClick={() => setIsAnnotationOpen(false)}>
          <div className="w-[min(1180px,94vw)] max-h-[92vh] rounded-3xl border border-zinc-800 bg-[#111214]/95 shadow-[0_30px_120px_rgba(0,0,0,0.75)] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800/90 bg-gradient-to-r from-zinc-950 via-zinc-900 to-zinc-950">
              <div>
                <div className="text-white font-semibold">图片标注编辑器</div>
                <div className="text-xs text-zinc-500 mt-0.5">画笔涂抹、文字标注、马赛克处理，保存后会生成新的图片节点。</div>
              </div>
              <button onClick={() => setIsAnnotationOpen(false)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl transition-colors">
                <X size={18} />
              </button>
            </div>

            <div className="flex items-center gap-3 px-5 py-3 border-b border-zinc-800/80 bg-[#17181b]">
              {[
                { id: 'brush', label: '画笔' },
                { id: 'text', label: '文字' },
                { id: 'mosaic', label: '马赛克' }
              ].map(item => (
                <button
                  key={item.id}
                  onClick={() => setAnnotationMode(item.id as 'brush' | 'text' | 'mosaic')}
                  className={`px-3 py-1.5 rounded-xl text-xs border transition-all ${annotationMode === item.id ? 'text-white border-[#00bcd4]/50 bg-[#00bcd4]/15 shadow-[0_0_18px_rgba(0,188,212,0.16)]' : 'text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-800'}`}
                >
                  {item.label}
                </button>
              ))}
              <div className="w-px h-6 bg-zinc-800 mx-1" />
              <label className="flex items-center gap-2 text-xs text-zinc-400">
                颜色
                <input type="color" value={annotationColor} onChange={(e) => setAnnotationColor(e.target.value)} className="w-8 h-8 bg-transparent rounded cursor-pointer" />
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-400 min-w-[180px]">
                尺寸
                <input type="range" min={4} max={42} value={annotationSize} onChange={(e) => setAnnotationSize(Number(e.target.value))} className="flex-1 accent-[#00bcd4]" />
                <span className="w-7 text-right text-zinc-300">{annotationSize}</span>
              </label>
              <button onClick={loadImageIntoAnnotationCanvas} className="ml-auto px-3 py-1.5 rounded-xl text-xs text-zinc-300 border border-zinc-800 hover:bg-zinc-800 hover:text-white transition-colors">
                重置
              </button>
              <button onClick={saveAnnotationAsNode} className="px-4 py-1.5 rounded-xl text-xs font-semibold text-black bg-[#00e5ff] hover:bg-white transition-colors shadow-[0_0_24px_rgba(0,229,255,0.22)]">
                保存为新节点
              </button>
            </div>

            <div className="flex-1 min-h-0 p-5 overflow-auto bg-[radial-gradient(circle_at_center,rgba(0,188,212,0.08),transparent_34%),#0b0c0f] flex items-center justify-center">
              <canvas
                ref={annotationCanvasRef}
                className="max-w-full max-h-[72vh] rounded-2xl shadow-2xl border border-zinc-800 bg-zinc-950 cursor-crosshair touch-none"
                onPointerDown={handleAnnotationPointerDown}
                onPointerMove={handleAnnotationPointerMove}
                onPointerUp={handleAnnotationPointerUp}
                onPointerCancel={handleAnnotationPointerUp}
                onPointerLeave={handleAnnotationPointerUp}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};

const CAMERA_MOVEMENTS = [
  { name: '固定镜头', text: 'Static shot', baseClass: '', hoverClass: '' },
  { name: '跟随拍摄', text: 'Tracking shot', baseClass: 'scale-110', hoverClass: 'group-hover:scale-125 group-hover:-translate-y-2' },
  { name: '盘旋抬升', text: 'Spiraling up', baseClass: 'scale-110', hoverClass: 'group-hover:scale-125 group-hover:-translate-y-2 group-hover:rotate-3' },
  { name: '盘旋下降', text: 'Spiraling down', baseClass: 'scale-110', hoverClass: 'group-hover:scale-125 group-hover:translate-y-2 group-hover:-rotate-3' },
  { name: '镜头上摇', text: 'Pan up', baseClass: 'scale-110 -translate-y-2', hoverClass: 'group-hover:translate-y-2' },
  { name: '镜头下摇', text: 'Pan down', baseClass: 'scale-110 translate-y-2', hoverClass: 'group-hover:-translate-y-2' },
  { name: '镜头左摇', text: 'Pan left', baseClass: 'scale-110 -translate-x-2', hoverClass: 'group-hover:translate-x-2' },
  { name: '镜头右摇', text: 'Pan right', baseClass: 'scale-110 translate-x-2', hoverClass: 'group-hover:-translate-x-2' },
  { name: '镜头上升', text: 'Lift up', baseClass: 'scale-125 translate-y-4', hoverClass: 'group-hover:-translate-y-4' },
  { name: '镜头下降', text: 'Lift down', baseClass: 'scale-125 -translate-y-4', hoverClass: 'group-hover:translate-y-4' },
  { name: '镜头左移', text: 'Move left', baseClass: 'scale-125 translate-x-4', hoverClass: 'group-hover:-translate-x-4' },
  { name: '镜头右移', text: 'Move right', baseClass: 'scale-125 -translate-x-4', hoverClass: 'group-hover:translate-x-4' },
  { name: '镜头前推', text: 'Zoom in', baseClass: 'scale-100', hoverClass: 'group-hover:scale-125' },
  { name: '镜头后移', text: 'Zoom out', baseClass: 'scale-125', hoverClass: 'group-hover:scale-100' },
  { name: '变焦推进', text: 'Dolly in', baseClass: 'scale-100', hoverClass: 'group-hover:scale-125 group-hover:-translate-y-1' },
  { name: '变焦拉远', text: 'Dolly out', baseClass: 'scale-125 -translate-y-1', hoverClass: 'group-hover:scale-100 group-hover:translate-y-0' },
  { name: '柯克变焦', text: 'Vertigo effect', baseClass: 'scale-110', hoverClass: 'group-hover:scale-150 group-hover:-rotate-[1deg]' },
  { name: '环绕拍摄', text: 'Orbit', baseClass: 'scale-125 translate-x-2', hoverClass: 'group-hover:-translate-x-2 group-hover:rotate-[3deg]' },
  { name: '滚筒旋转', text: 'Barrel roll', baseClass: 'scale-110', hoverClass: 'group-hover:scale-[1.15] group-hover:rotate-[10deg]' },
  { name: '第一视角', text: 'POV', baseClass: 'scale-110', hoverClass: 'group-hover:scale-125 group-hover:translate-y-[2px] group-hover:translate-x-[2px]' },
  { name: '无人机', text: 'Drone', baseClass: 'scale-125 translate-y-2', hoverClass: 'group-hover:scale-100 group-hover:translate-y-0' },
  { name: '高空航拍', text: 'Aerial view', baseClass: 'scale-125', hoverClass: 'group-hover:scale-100' },
  { name: '手持拍摄', text: 'Handheld', baseClass: 'scale-110', hoverClass: 'group-hover:rotate-[1deg] group-hover:-translate-x-[2px] group-hover:translate-y-[2px]' }
];

const CameraMovementItem = ({ cam, prompt, setPrompt, updateNodeData, id, data, setShowCameraMenu }: any) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  return (
    <button 
        onClick={(e) => {
            e.stopPropagation();
            const newPrompt = prompt ? `${prompt}, ${cam.text}` : cam.text;
            setPrompt(newPrompt);
            updateNodeData(id, { ...data, prompt: newPrompt });
            setShowCameraMenu(false);
        }}
        onMouseEnter={() => {
            if (videoRef.current) {
                videoRef.current.currentTime = 0;
                videoRef.current.play().catch(() => {});
            }
        }}
        onMouseLeave={() => {
            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.currentTime = 0;
            }
        }}
        className="group flex flex-col gap-2 rounded-lg transition-colors hover:bg-zinc-800 p-1.5 -mx-1.5"
    >
        <div className="w-full aspect-video rounded-lg overflow-hidden border border-zinc-700/50 group-hover:border-[#00bcd4]/50 relative bg-zinc-900 pointer-events-none">
            <img 
              src={`https://images.unsplash.com/photo-1542831371-29b0f74f9713?w=400&q=80`}
              alt={cam.name}
              referrerPolicy="no-referrer"
              className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-300 ${cam.baseClass} group-hover:opacity-0`}
            />
            <video 
                ref={videoRef}
                src="https://media.w3.org/2010/05/sintel/trailer.mp4"
                muted
                loop
                playsInline
                crossOrigin="anonymous"
                className={`absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 transition-all duration-[3000ms] ease-out ${cam.baseClass} ${cam.hoverClass}`}
            />
        </div>
        <div className="text-[11px] text-zinc-300 group-hover:text-white pb-1 text-center font-medium">
            {cam.name}
        </div>
    </button>
  );
};

const VideoNode = ({ data, id, selected }: any) => {
  const { updateNodeData, getNode, getNodes, getEdges, setNodes } = useReactFlow();
  const flowNodes = useNodes();
  const flowEdges = useEdges();
  const [prompt, setPrompt] = useState(data.prompt || "");
  const [loading, setLoading] = useState(data.isGenerating || false);
  const [progressMsg, setProgressMsg] = useState(data.progressMsg || "");
  const [activeTab, setActiveTab] = useState(data.activeTab || '全能参考');
  const tabs = ['文生视频', '全能参考', '图生视频', '首尾帧', '图片参考'];

  const [aspectRatio, setAspectRatio] = useState(data.aspectRatio || '16:9');
  const [resolution, setResolution] = useState(data.resolution || '720P');
  const [duration, setDuration] = useState(data.duration || 15);
  const [audioEnabled, setAudioEnabled] = useState(data.audioEnabled !== undefined ? data.audioEnabled : true);
  const [cleanOutputConstraints, setCleanOutputConstraints] = useState(!!data.cleanOutputConstraints);
  const [videoModel, setVideoModel] = useState(data.videoModel || 'Seedance 2.0 VIP');
  const [showVideoModelMenu, setShowVideoModelMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCameraMenu, setShowCameraMenu] = useState(false);
  const [showFrameMenu, setShowFrameMenu] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [tempTitle, setTempTitle] = useState(data.title || '视频节点');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showReferenceMenu, setShowReferenceMenu] = useState(false);

  useEffect(() => {
    setLoading(!!data.isGenerating);
    setProgressMsg(data.progressMsg || "");
  }, [data.isGenerating, data.progressMsg]);

  const connectedReferences = React.useMemo(() => {
    let imageIndex = 0;
    let videoIndex = 0;
    let audioIndex = 0;
    return flowEdges
      .filter(edge => edge.target === id)
      .flatMap(edge => {
        const node = flowNodes.find(n => n.id === edge.source) as any;
        if (!node) return [];
        const title = node.data?.title || node.data?.label || '上游素材';
        const items: Array<{ label: string; title: string; type: 'image' | 'video' | 'audio'; url: string }> = [];
        if (node.data?.imageUrl) {
          imageIndex += 1;
          items.push({ label: `@图片${imageIndex}`, title, type: 'image', url: node.data.imageUrl });
        }
        if (node.data?.videoUrl) {
          videoIndex += 1;
          items.push({ label: `@视频${videoIndex}`, title, type: 'video', url: node.data.videoUrl });
        }
        if (node.data?.audioUrl) {
          audioIndex += 1;
          items.push({ label: `@音频${audioIndex}`, title, type: 'audio', url: node.data.audioUrl });
        }
        return items;
      })
      .slice(0, 8);
  }, [flowEdges, flowNodes, id]);

  const insertReferenceMention = (label: string) => {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? prompt.length;
    const before = prompt.slice(0, cursor);
    const after = prompt.slice(cursor);
    const atIndex = before.lastIndexOf('@');
    const nextPrompt = atIndex >= 0
      ? `${before.slice(0, atIndex)}${label} ${after}`
      : `${before}${label} ${after}`;
    const nextCursor = (atIndex >= 0 ? atIndex : before.length) + label.length + 1;
    setPrompt(nextPrompt);
    updateNodeData(id, { prompt: nextPrompt });
    setShowReferenceMenu(false);
    requestAnimationFrame(() => {
      textarea?.focus();
      textarea?.setSelectionRange(nextCursor, nextCursor);
    });
  };

  React.useEffect(() => {
    const node = getNodes().find(n => n.id === id);
    if (node) {
      const h = node.style?.height;
      if (!h || (typeof h === 'number' && h < 240) || (typeof h === 'string' && parseInt(h, 10) < 240)) {
        setNodes(nds => nds.map(n => n.id === id ? { ...n, style: { ...n.style, height: 240 } } : n));
      }
    }
  }, [id, setNodes, getNodes]);

  React.useEffect(() => {
    const handleClickOutside = () => {
      setShowSettings(false);
      setShowCameraMenu(false);
      setShowVideoModelMenu(false);
      setShowFrameMenu(false);
      setShowReferenceMenu(false);
    };
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);

  const handleGenerate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (loading || data.isGenerating) return;
    if (!prompt.trim()) return alert("请输入提示词");
    
    const queueProjectId = data.projectId || 'local-project';
    setLoading(true);
    setProgressMsg("正在连接视频生成服务...");
    updateNodeData(id, { isGenerating: true, progressMsg: "正在连接视频生成服务...", activeTab });
    
    try {
      // 收集所有连入当前视频节点的图片/视频，作为“全能参考”素材。
      const edges = getEdges();
      const nodes = getNodes();
      const incomingEdges = edges.filter(edge => edge.target === id);
      const referenceNodes = incomingEdges.map(edge => nodes.find(n => n.id === edge.source)).filter(Boolean);
      const referenceMedia = referenceNodes
        .flatMap((node: any) => [
          node?.data?.imageUrl ? { url: node.data.imageUrl, type: 'image' as const } : null,
          node?.data?.videoUrl ? { url: node.data.videoUrl, type: 'video' as const } : null,
          node?.data?.audioUrl ? { url: node.data.audioUrl, type: 'audio' as const } : null
        ])
        .filter((item): item is { url: string; type: 'image' | 'video' | 'audio' } => !!item && typeof item.url === 'string')
        .slice(0, 8);
      const referenceRoles = referenceNodes
        .flatMap((node: any) => [
          node?.data?.imageUrl ? { node, type: 'image' as const } : null,
          node?.data?.videoUrl ? { node, type: 'video' as const } : null,
          node?.data?.audioUrl ? { node, type: 'audio' as const } : null
        ])
        .filter((item): item is { node: any; type: 'image' | 'video' | 'audio' } => !!item)
        .slice(0, 8)
        .map((item, index, all) => item.type === 'video'
          ? 'style'
          : item.type === 'audio'
            ? 'voice'
          : inferVideoReferenceRoleFromNode(item.node, index, all.length, activeTab)
        );

      const { ensurePublicMediaUrl } = await import('../services/mediaUploadService');
      const referenceMediaUrls: string[] = [];
      for (let index = 0; index < referenceMedia.length; index += 1) {
        const item = referenceMedia[index];
        if (!/^https?:\/\//i.test(item.url)) {
          const msg = `正在上传参考素材 ${index + 1}/${referenceMedia.length} 到 TOS...`;
          setProgressMsg(msg);
          updateNodeData(id, { progressMsg: msg });
        }
        referenceMediaUrls.push(await ensurePublicMediaUrl(item.url, item.type, index));
      }
      
      const { generateDreaminaVideoAndWait } = await import('../api/dreaminaApi');
      const finalVideoUrl = await generateDreaminaVideoAndWait(
        prompt, 
        referenceMediaUrls[0] || null,
        (status: string) => {
          let msg = "";
          if (status === "submitted") msg = "任务已提交，排队中...";
          if (status === "processing") msg = "正在生成视频中，通常需要 1-3 分钟...";
          setProgressMsg(msg);
          updateNodeData(id, { progressMsg: msg });
        },
        {
          workspaceProjectId: queueProjectId,
          createdBy: localStorage.getItem('dino_currentUser') || 'system',
          imageUrls: referenceMediaUrls,
          referenceRoles,
          cleanOutputConstraints,
          ratio: aspectRatio,
          duration,
          resolution,
          generateAudio: audioEnabled,
          model: videoModel,
          metadata: {
            activeTab,
            supportsAtReference: true,
            capability: 'multi_reference_video',
            cleanOutputConstraints,
            referenceRoles,
            nodeId: id
          }
        }
      );
      
      setLoading(false);
      setProgressMsg("");
      updateNodeData(id, { videoUrl: finalVideoUrl, isGenerating: false, progressMsg: "", prompt, activeTab, aspectRatio, resolution, duration, audioEnabled, videoModel, cleanOutputConstraints });
    } catch (err: any) {
      const message = String(err?.message || '未知错误');
      const isTransient = /502|503|504|Bad Gateway|fetch failed|网络|超时|暂时|仍在|仍可能|后台处理中|读取不稳定|排队|处理中/i.test(message);
      if (isTransient) {
        const msg = "视频仍在服务商后台处理中，请稍后查看任务队列。";
        setLoading(true);
        setProgressMsg(msg);
        updateNodeData(id, { isGenerating: true, progressMsg: msg, activeTab, prompt, aspectRatio, resolution, duration, audioEnabled, videoModel, cleanOutputConstraints });
        return;
      }
      alert("视频生成失败：" + message);
      setLoading(false);
      setProgressMsg("");
      updateNodeData(id, { isGenerating: false, progressMsg: "", generationError: message });
    }
  };

  const captureVideoFrame = async (mode: 'current' | 'first' | 'last') => {
    const video = videoRef.current;
    if (!video || !data.videoUrl) {
      alert('当前视频还没有可截取的画面');
      return;
    }

    const seekTo = (time: number) => new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
      };
      const onSeeked = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(new Error('视频定位失败，无法截帧'));
      };
      video.addEventListener('seeked', onSeeked, { once: true });
      video.addEventListener('error', onError, { once: true });
      video.currentTime = time;
    });

    try {
      const originalTime = video.currentTime || 0;
      if (mode === 'first') await seekTo(0);
      if (mode === 'last') await seekTo(Math.max(0, (video.duration || 0) - 0.08));

      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1280;
      canvas.height = video.videoHeight || 720;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('浏览器无法创建截帧画布');
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/png');
      let imageUrl = dataUrl;
      try {
        imageUrl = await ensurePublicMediaUrl(dataUrl, 'image', 0);
      } catch (error) {
        console.warn('Captured frame upload to public storage failed, use local preview only:', error);
      }

      if (mode !== 'current') {
        try { await seekTo(originalTime); } catch {}
      }

      const node = getNode(id);
      const position = node
        ? { x: node.position.x + Number(node.width || node.style?.width || 360) + 80, y: node.position.y + (mode === 'first' ? 0 : mode === 'current' ? 60 : 120) }
        : undefined;
      const label = mode === 'first' ? '首帧' : mode === 'last' ? '尾帧' : '当前帧';
      if (data.onAddNode) {
        data.onAddNode('imageNode', undefined, position, id, {
          imageUrl,
          title: `${data.title || '视频'}-${label}`,
          initialWidth: 320,
          initialHeight: Math.round(320 * (canvas.height / canvas.width))
        });
      }
      setShowFrameMenu(false);
    } catch (err: any) {
      alert(`截帧失败：${err?.message || '当前视频地址可能不允许浏览器截帧'}`);
    }
  };
  return (
    <>
      <NodeResizer color="transparent" handleClassName={resizerHandleStyle} minWidth={240} minHeight={100} isVisible={selected} keepAspectRatio={!!data.videoUrl} />
      
      {/* Node Label (Above Node) */}
      <div className={`absolute -top-7 left-0 text-zinc-400 text-xs flex items-center gap-1.5 font-medium px-1 transition-opacity opacity-100 z-50`}>
        <Film size={14} />
        {isEditingTitle ? (
          <input 
            autoFocus
            value={tempTitle}
            onChange={(e) => setTempTitle(e.target.value)}
            onBlur={() => {
              setIsEditingTitle(false);
              updateNodeData(id, { title: tempTitle });
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                setIsEditingTitle(false);
                updateNodeData(id, { title: tempTitle });
              }
            }}
            className="bg-transparent border-b border-zinc-500 outline-none text-white w-24 px-1"
          />
        ) : (
          <span 
            onDoubleClick={(e) => {
              e.stopPropagation();
              setTempTitle(data.title || '视频节点');
              setIsEditingTitle(true);
            }} 
            className="cursor-text hover:text-zinc-200"
          >
            {data.title || '视频节点'}
          </span>
        )}
      </div>

      <div className={`${nodeBg} border-[1.5px] ${selected ? selectedBorder : defaultBorder} rounded-2xl p-0 shadow-sm hover:shadow-[0_0_15px_rgba(0,188,212,0.15)] transition-shadow w-full h-full flex flex-col relative pointer-events-auto group`}>
        <FloatingPlusHandle type="target" position={Position.Left} title="拖入连接到视频节点" />
        
        

        {/* Media Area */}
        <FloatingPlusHandle type="source" position={Position.Right} title="从视频节点拖出连接" />
        <div className="flex-1 m-1 rounded-2xl overflow-hidden bg-[#1E1E1E] flex flex-col justify-center relative min-h-0">
            {loading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4 text-center bg-zinc-900/80 backdrop-blur-sm z-10">
              <Sparkles className="text-[#00bcd4] animate-pulse" size={28} />
              <span className="text-xs text-[#00bcd4] font-medium animate-pulse">{progressMsg || "生成中..."}</span>
            </div>
          ) : data.videoUrl ? (
            <>
              <video
                ref={videoRef}
                src={data.videoUrl || undefined}
                data-original-src={data.videoUrl || undefined}
                controls
                crossOrigin="anonymous"
                onError={fallbackVideoToProxy}
                className="w-full h-full object-contain block bg-black nodrag"
                autoPlay
              />
              <div className="absolute top-3 right-3 z-20">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowFrameMenu(!showFrameMenu); }}
                  className="p-2 bg-black/60 hover:bg-[#00bcd4]/20 text-white rounded-lg border border-white/10 hover:border-[#00bcd4]/40 backdrop-blur-md transition-colors"
                  title="截取视频帧"
                >
                  <Scissors size={15} />
                </button>
                {showFrameMenu && (
                  <div className="absolute top-full right-0 mt-2 w-40 rounded-xl border border-zinc-700/80 bg-[#1E1E1E]/95 shadow-2xl p-1.5 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => captureVideoFrame('current')} className="text-left px-3 py-2 rounded-lg text-xs text-zinc-200 hover:bg-zinc-800 hover:text-white transition-colors">截取当前帧</button>
                    <button onClick={() => captureVideoFrame('first')} className="text-left px-3 py-2 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors">截取首帧</button>
                    <button onClick={() => captureVideoFrame('last')} className="text-left px-3 py-2 rounded-lg text-xs text-zinc-400 hover:bg-zinc-800 hover:text-white transition-colors">截取尾帧</button>
                  </div>
                )}
              </div>
            </>
          ) : (
             <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                 <Film size={48} className="opacity-40 text-zinc-600" />
             </div>
          )}

        </div>
      </div>

      {/* Bottom Generation Panel (only show on selected) */}
      {selected && (
        <div 
          className="absolute top-[calc(100%+16px)] left-0 bg-[#2A2A2A] border border-zinc-700/80 rounded-2xl shadow-xl p-4 flex flex-col min-w-[560px] min-h-[300px] w-[560px] z-[60] cursor-default overflow-visible nodrag"
          onWheel={(e) => e.stopPropagation()}
          onClick={e => {
            e.stopPropagation();
            setShowSettings(false);
          }}
        >
             {/* Tabs Row */}
             <div className="flex items-center justify-between mb-4">
                 <div className="flex gap-2">
                     {tabs.map(tab => (
                         <button 
                             key={tab} 
                             onClick={(e) => { e.stopPropagation(); setActiveTab(tab); }}
                             className={`px-3 py-1 text-xs rounded-lg transition-colors border border-transparent ${activeTab === tab ? 'bg-zinc-700 text-zinc-200 border-zinc-600' : 'bg-zinc-800/50 text-zinc-500 border-zinc-700/50 hover:text-zinc-300'}`}
                         >
                             {tab}
                         </button>
                     ))}
                 </div>
             </div>
             
             {/* Tools Row */}
             <div className="flex gap-3 mb-4">
                 <div className="relative">
                     <button 
                         onClick={(e) => { e.stopPropagation(); setShowCameraMenu(!showCameraMenu); setShowSettings(false); }}
                         className={`flex flex-col items-center justify-center gap-1.5 w-14 h-14 border rounded-[14px] transition-colors ${showCameraMenu ? 'bg-zinc-700 border-zinc-500 text-white' : 'bg-zinc-800/80 border-zinc-700/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600'}`}
                     >
                         <Camera size={16} strokeWidth={1.5} />
                         <span className="text-[10px] font-medium">运镜</span>
                     </button>
                     
                     {showCameraMenu && (
                         <div 
                             className="absolute bottom-[calc(100%+8px)] left-0 w-[560px] max-h-[380px] overflow-y-auto custom-scrollbar bg-[#2A2A2A] border border-zinc-700/80 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] p-4 z-[100]" 
                             onClick={(e) => e.stopPropagation()}
                         >
                             <div className="grid grid-cols-4 gap-3">
                                 {CAMERA_MOVEMENTS.map(cam => (
                                    <CameraMovementItem 
                                        key={cam.name} 
                                        cam={cam} 
                                        prompt={prompt} 
                                        setPrompt={setPrompt} 
                                        updateNodeData={updateNodeData} 
                                        id={id} 
                                        data={data} 
                                        setShowCameraMenu={setShowCameraMenu} 
                                    />
                                ))}
                             </div>
                         </div>
                     )}
                 </div>
                 <button 
                   onClick={() => data.onOpenAssets?.('entities')}
                   className="flex flex-col items-center justify-center gap-1.5 w-14 h-14 bg-zinc-800/80 border border-zinc-700/80 rounded-[14px] hover:bg-zinc-700 hover:border-zinc-600 transition-colors text-zinc-400 hover:text-zinc-200"
                 >
                     <User size={16} strokeWidth={1.5} />
                     <span className="text-[10px] font-medium">角色库</span>
                 </button>
             </div>

             {connectedReferences.length > 0 && (
               <div className="mb-4 rounded-xl border border-zinc-700/60 bg-zinc-900/30 p-2">
                 <div className="mb-2 flex items-center justify-between text-[10px] text-zinc-500">
                   <span>连入参考素材</span>
                   <span>提示词输入 @ 可快速引用</span>
                 </div>
                 <div className="flex flex-wrap gap-2">
                   {connectedReferences.map((ref) => (
                     <button
                       key={`${ref.label}-${ref.url}`}
                       onClick={(e) => { e.stopPropagation(); insertReferenceMention(ref.label); }}
                       className="group flex items-center gap-2 rounded-lg border border-zinc-700/70 bg-[#151515] px-2 py-1.5 text-left hover:border-[#00bcd4]/60 hover:bg-[#00bcd4]/10 transition-colors"
                       title={`插入 ${ref.label}`}
                     >
                       <div className="h-9 w-12 overflow-hidden rounded-md border border-zinc-700/80 bg-black/40 flex items-center justify-center shrink-0">
                         {ref.type === 'image' ? (
                           <img src={ref.url} data-original-src={ref.url} onError={fallbackImageToProxy} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                         ) : ref.type === 'video' ? (
                           <Video size={16} className="text-zinc-400 group-hover:text-[#00e5ff]" />
                         ) : (
                           <AudioLines size={16} className="text-zinc-400 group-hover:text-[#00e5ff]" />
                         )}
                       </div>
                       <div className="min-w-0">
                         <div className="text-xs font-semibold text-zinc-200 group-hover:text-white">{ref.label}</div>
                         <div className="max-w-[120px] truncate text-[10px] text-zinc-500">{ref.title}</div>
                       </div>
                     </button>
                   ))}
                 </div>
               </div>
             )}

             {/* Text Area */}
             <div className={`relative bg-zinc-800/50 border border-zinc-700/50 rounded-xl mb-6 group/textarea ${isExpanded ? 'z-50 shadow-2xl border-[#00bcd4]/50' : 'focus-within:border-zinc-500 focus-within:bg-zinc-800 transition-colors'}`}>
               {isExpanded && (
                  <div className="fixed inset-0 z-40 bg-black/20" onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}></div>
               )}
               <div className={`relative flex flex-col p-3 z-50 ${isExpanded ? 'bg-[#2A2A2A] rounded-xl' : ''}`}>
                 <button 
                   onClick={(e) => { 
                     e.stopPropagation(); 
                     setIsExpanded(!isExpanded); 
                     if (!isExpanded && textareaRef.current) {
                       setTimeout(() => {
                          textareaRef.current!.style.height = 'auto';
                          textareaRef.current!.style.height = textareaRef.current!.scrollHeight + 'px';
                          textareaRef.current!.focus();
                       }, 10);
                     } else if (textareaRef.current) {
                       textareaRef.current.style.height = 'auto';
                     }
                   }}
                   className="absolute top-2 right-2 p-1.5 text-zinc-400 hover:text-white bg-zinc-800 rounded opacity-0 group-hover/textarea:opacity-100 transition-opacity z-10 hover:bg-zinc-700"
                   title={isExpanded ? "收起" : "展开全文"}
                   onMouseDown={(e) => e.stopPropagation()}
                 >
                   {isExpanded ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                 </button>
                 <textarea
                    ref={textareaRef}
                    className={`w-full text-sm py-2 px-3 bg-transparent border-none focus:outline-none resize-y text-zinc-300 placeholder-zinc-500 nodrag nopan nowheel font-medium selection:bg-purple-500/30 custom-scrollbar pb-6 ${isExpanded ? 'min-h-[200px]' : 'min-h-[60px]'}`}
                    placeholder="描述视频内容，可用 @图片1 / @视频1 / @音频1 引用连入素材"
                    value={prompt}
                    onChange={(e) => { 
                      const nextPrompt = e.target.value;
                      const cursor = e.target.selectionStart ?? nextPrompt.length;
                      const beforeCursor = nextPrompt.slice(0, cursor);
                      setPrompt(nextPrompt); 
                      updateNodeData(id, { prompt: nextPrompt });
                      setShowReferenceMenu(/@$/.test(beforeCursor) && connectedReferences.length > 0);
                      if (isExpanded && textareaRef.current) {
                        textareaRef.current.style.height = 'auto';
                        textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
                      }
                    }}
                    disabled={loading}
                    onMouseDown={(e) => e.stopPropagation()}
                    onKeyDown={(e) => {
                      e.stopPropagation();
                      if (e.key === 'Escape') setShowReferenceMenu(false);
                    }}
                 />
                 {showReferenceMenu && connectedReferences.length > 0 && (
                   <div
                     className="absolute left-3 top-[calc(100%-6px)] z-[120] w-72 rounded-xl border border-zinc-700/80 bg-[#171717]/98 shadow-[0_14px_40px_rgba(0,0,0,0.75)] p-2"
                     onMouseDown={(e) => e.stopPropagation()}
                     onClick={(e) => e.stopPropagation()}
                   >
                     <div className="px-2 pb-1 text-[10px] text-zinc-500">选择要引用的上游素材</div>
                     <div className="max-h-56 overflow-y-auto custom-scrollbar space-y-1">
                       {connectedReferences.map((ref) => (
                         <button
                           key={`mention-${ref.label}-${ref.url}`}
                           onClick={() => insertReferenceMention(ref.label)}
                           className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-zinc-800/90 transition-colors"
                         >
                           <div className="h-8 w-10 overflow-hidden rounded-md border border-zinc-700/80 bg-black/40 flex items-center justify-center shrink-0">
                             {ref.type === 'image' ? (
                               <img src={ref.url} data-original-src={ref.url} onError={fallbackImageToProxy} referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                             ) : ref.type === 'video' ? (
                               <Video size={15} className="text-zinc-400" />
                             ) : (
                               <AudioLines size={15} className="text-zinc-400" />
                             )}
                           </div>
                           <div className="min-w-0 flex-1">
                             <div className="text-xs font-semibold text-zinc-200">{ref.label}</div>
                             <div className="truncate text-[10px] text-zinc-500">{ref.title}</div>
                           </div>
                         </button>
                       ))}
                     </div>
                   </div>
                 )}
               </div>
             </div>

            {/* Bottom Controls Row */}
            <div className="flex items-center justify-between pt-3">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowVideoModelMenu(!showVideoModelMenu); setShowSettings(false); }}
                            className="flex items-center gap-2 text-xs text-zinc-300 hover:text-white transition-colors"
                        >
                            <span className="w-1 h-3 bg-[#FFC107] rounded-sm shadow-[0_0_8px_rgba(255,193,7,0.8)]"></span>
                            <span className="font-bold flex items-center gap-1 tracking-wide">
                                {videoModel} <ChevronDown size={14} className="text-zinc-500 ml-0.5" />
                            </span>
                        </button>
                        
                        {showVideoModelMenu && (
                            <div 
                                className="absolute bottom-[calc(100%+8px)] left-0 w-[200px] bg-[#1E1E1E] border border-zinc-700/80 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] py-2 z-50 flex flex-col"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {['Seedance 2.0 VIP', 'Seedance 2.0 Fast VIP'].map(m => (
                                    <button
                                        key={m}
                                        onClick={(e) => { 
                                            e.stopPropagation(); 
                                            setVideoModel(m); 
                                            updateNodeData(id, { videoModel: m });
                                            setShowVideoModelMenu(false); 
                                        }}
                                        className={`flex items-center gap-2 px-4 py-2 text-xs transition-colors text-left ${videoModel === m ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-300'}`}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="relative">
                        <button 
                            onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setShowVideoModelMenu(false); }}
                            className={`flex items-center gap-1.5 text-xs border px-2 py-1 rounded transition-colors ${showSettings ? 'border-zinc-500 text-white bg-zinc-800' : 'border-transparent text-zinc-300 hover:text-white hover:border-zinc-700'}`}
                        >
                            <Monitor size={14} />
                            <span className="font-medium tracking-wide">
                                {aspectRatio} · {resolution} · {duration}s · {audioEnabled ? '🔊' : '🔇'}
                            </span> 
                            <ChevronDown size={14} className={`text-zinc-500 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Settings Popover */}
                        {showSettings && (
                            <div className="absolute bottom-[calc(100%+8px)] left-0 w-[300px] bg-[#2A2A2A] border border-zinc-700/80 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] p-4 z-[100] flex flex-col gap-5 text-sm" onClick={(e) => e.stopPropagation()}>
                                {/* 比例 */}
                                <div>
                                    <div className="text-zinc-400 mb-2.5 text-xs font-medium">比例</div>
                                    <div className="flex flex-wrap gap-2">
                                        {['Auto', '16:9', '4:3', '1:1', '3:4', '9:16', '21:9'].map(ratio => (
                                            <button 
                                                key={ratio}
                                                onClick={() => { setAspectRatio(ratio); updateNodeData(id, { aspectRatio: ratio }); }}
                                                className={`flex flex-col items-center justify-center w-12 h-14 rounded-lg transition-all border ${aspectRatio === ratio ? 'border-zinc-500 bg-white/5 shadow-[0_0_12px_rgba(255,255,255,0.15)] text-white' : 'border-zinc-800/50 bg-[#1A1A1A]/30 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800'}`}
                                            >
                                                <div className={`border-2 rounded-[2px] mb-1 transition-colors ${aspectRatio === ratio ? 'border-white' : 'border-zinc-500'} 
                                                  ${ratio === 'Auto' ? 'w-4 h-4' : 
                                                    ratio === '16:9' ? 'w-5 h-3' : 
                                                    ratio === '4:3' ? 'w-4 h-3' : 
                                                    ratio === '1:1' ? 'w-4 h-4' : 
                                                    ratio === '3:4' ? 'w-3 h-4' : 
                                                    ratio === '9:16' ? 'w-3 h-5' : 
                                                    'w-6 h-2.5'}`} 
                                                />
                                                <span className="text-[10px]">{ratio}</span>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 清晰度 */}
                                <div>
                                    <div className="text-zinc-400 mb-2.5 text-xs font-medium">清晰度</div>
                                    <div className="flex gap-2">
                                        {['480P', '720P', '1080P'].map(res => (
                                            <button 
                                                key={res}
                                                onClick={() => { setResolution(res); updateNodeData(id, { resolution: res }); }}
                                                className={`flex-1 py-1.5 rounded-lg text-xs transition-all border ${resolution === res ? 'border-zinc-500 bg-white/5 shadow-[0_0_12px_rgba(255,255,255,0.15)] text-white' : 'border-zinc-800/50 bg-[#1A1A1A]/30 text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800'}`}
                                            >
                                                {res}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* 视频时长 */}
                                <div>
                                    <div className="flex items-center justify-between text-zinc-400 mb-2 text-xs">
                                        <span>视频时长</span>
                                        <span className="text-zinc-300">{duration}s</span>
                                    </div>
                                    <input 
                                        type="range" 
                                        min="4" 
                                        max="15" 
                                        value={duration} 
                                        onChange={(e) => {
                                            const val = parseInt(e.target.value);
                                            setDuration(val);
                                            updateNodeData(id, { duration: val });
                                        }}
                                        className="w-full h-1 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white"
                                    />
                                </div>

                                {/* 生成音频 */}
                                <div>
                                    <div className="text-zinc-400 mb-2.5 text-xs flex items-center gap-1">
                                        生成音频 <HelpCircle size={12} className="text-zinc-500 cursor-pointer" />
                                    </div>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={() => { setAudioEnabled(true); updateNodeData(id, { audioEnabled: true }); }}
                                            className={`flex-1 py-1.5 rounded-lg border text-xs transition-colors ${audioEnabled ? 'border-white text-white' : 'border-zinc-700 text-zinc-400 hover:text-zinc-300 hover:border-zinc-500'}`}
                                        >
                                            开启
                                        </button>
                                        <button 
                                            onClick={() => { setAudioEnabled(false); updateNodeData(id, { audioEnabled: false }); }}
                                            className={`flex-1 py-1.5 rounded-lg border text-xs transition-colors ${!audioEnabled ? 'border-white text-white' : 'border-zinc-700 text-zinc-400 hover:text-zinc-300 hover:border-zinc-500'}`}
                                        >
                                            关闭
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-2.5">
                    <button className="text-zinc-400 hover:text-white p-1 transition-colors" title="翻译">
                        <Languages size={15} />
                    </button>
                    <label
                      className={`w-4 h-4 rounded-[5px] border flex items-center justify-center cursor-pointer transition-colors ${cleanOutputConstraints ? 'border-[#00bcd4] bg-[#00bcd4]/20 text-[#00e5ff]' : 'border-zinc-600 bg-zinc-900/60 text-transparent hover:border-zinc-400'}`}
                      title="无字幕 / 无水印 / 无Logo"
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={cleanOutputConstraints}
                        className="sr-only"
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setCleanOutputConstraints(checked);
                          updateNodeData(id, { cleanOutputConstraints: checked });
                        }}
                      />
                      <Check size={11} strokeWidth={3} />
                    </label>
                    <button className="text-zinc-400 hover:text-white p-1 transition-colors" title="设置">
                        <Settings2 size={15} />
                    </button>
                    
                    <button className="flex items-center gap-1 text-xs font-medium text-zinc-300 hover:text-white px-1.5 transition-colors">
                        1个 <ChevronDown size={12} className="text-zinc-500" />
                    </button>

                    <button
                        onClick={handleGenerate}
                        disabled={loading}
                        className={`w-8 h-8 rounded-[10px] flex items-center justify-center transition-all ml-1 ${loading ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-400 hover:bg-white text-black shadow-lg hover:shadow-white/20 hover:-translate-y-0.5'}`}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        {loading ? <RefreshCw size={14} className="animate-spin" /> : <ArrowUp size={16} strokeWidth={2.5} />}
                    </button>
                </div>
            </div>
        </div>
      )}
    </>
  );
};

const AIGenNode = ({ data, id, selected }: any) => {
  return (
    <div className={`${nodeBg} border-[1.5px] ${selected ? selectedBorder : "border-[#00bcd4]/30"} rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow min-w-[240px] max-w-[320px]`}>
      <Handle type="target" position={Position.Left} className={handleStyle} />
      <div className="flex items-center gap-2 mb-3 text-[#00bcd4] pb-2">
        <BrainCircuit size={14} />
        <span className="text-xs font-semibold tracking-wide">{data.title || 'AI 处理流'}</span>
      </div>
      <div className="space-y-3">
        <div className="text-xs text-zinc-400 leading-relaxed">{data.description}</div>
        <button 
          onClick={() => data.onRun(id)}
          disabled={data.isGenerating}
          className="w-full py-2 bg-[#00bcd4]/10 hover:bg-[#00bcd4]/20 text-[#00bcd4] border border-[#00bcd4]/30 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 text-sm"
        >
          {data.isGenerating ? (
            <span className="animate-pulse">处理中...</span>
          ) : (
            <>
              <Play size={14} />
              执行运算
            </>
          )}
        </button>
      </div>
      <Handle type="source" position={Position.Right} className={handleStyle} />
    </div>
  );
};

const ResultNode = ({ data, id, selected }: any) => {
  return (
    <div className={`${nodeBg} border-[1.5px] ${selected ? "border-green-500" : "border-green-500/30"} rounded-2xl p-4 shadow-sm hover:shadow-[0_0_15px_rgba(34,197,94,0.15)] transition-shadow min-w-[240px] max-w-[320px]`}>
      <Handle type="target" position={Position.Left} className={handleStyle} />
      <div className="flex items-center gap-2 mb-3 text-green-500 pb-2">
        <BrainCircuit size={14} />
        <span className="text-xs font-semibold tracking-wide">结果节点</span>
      </div>
      <div className="text-sm text-zinc-300 leading-relaxed bg-zinc-900/50 p-3 rounded-xl border border-zinc-800/50">
        {data.content || '等待生成结果...'}
      </div>
      <Handle type="source" position={Position.Right} className={handleStyle} />
    </div>
  );
};

const AudioNode = ({ data, id, selected }: any) => {
  return (
    <>
      <NodeResizer color="transparent" handleClassName={resizerHandleStyle} minWidth={280} minHeight={120} isVisible={selected} />
      <div className={`${nodeBg} border-[1.5px] ${selected ? selectedBorder : defaultBorder} rounded-2xl p-2 shadow-sm hover:shadow-md transition-shadow min-w-[280px] w-full h-full flex flex-col`}>
        <Handle type="target" position={Position.Left} className={handleStyle} />
        <div className="flex items-center gap-2 px-2 py-2 text-zinc-400">
          <AudioLines size={14} className={selected ? "text-[#00bcd4]" : ""} />
          <span className="text-xs font-semibold tracking-wide">音频</span>
        </div>
        {data.audioUrl ? (
          <div className="rounded-xl overflow-hidden border border-zinc-800/50 p-2 flex-1 flex items-center justify-center">
            <audio src={data.audioUrl || undefined} controls className="w-full" />
          </div>
        ) : (
          <label className="w-full flex-1 min-h-[60px] bg-zinc-900/50 hover:bg-zinc-800/50 border border-dashed border-zinc-800/50 hover:border-[#00bcd4]/50 hover:text-[#00bcd4] rounded-xl flex items-center justify-center text-zinc-500 flex-col gap-2 cursor-pointer transition-colors group">
            <Upload size={16} className="group-hover:-translate-y-1 transition-transform" />
            <span className="text-[10px]">点击上传文件</span>
            <input 
              type="file" 
              accept="audio/*" 
              className="hidden" 
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = (ev) => {
                    const url = ev.target?.result as string;
                    if (data.onUpload) data.onUpload(id, url, 'audio');
                  };
                  reader.readAsDataURL(file);
                }
              }} 
            />
          </label>
        )}
        <Handle type="source" position={Position.Right} className={handleStyle} />
      </div>
    </>
  );
};

const ScriptNode = ({ data, id, selected }: any) => {
  const [activeTab, setActiveTab] = React.useState('overview');

  const tabs = [
    { id: 'overview', label: '总览' },
    { id: 'scenes', label: '场次' },
    { id: 'characters', label: '人物' },
    { id: 'locations', label: '场景' },
    { id: 'props', label: '道具' },
    { id: 'beats', label: '节拍 & 动作' },
    { id: 'risks', label: '连贯性与风险' },
  ];

  return (
    <>
      <NodeResizer color="transparent" handleClassName={resizerHandleStyle} minWidth={440} minHeight={350} isVisible={selected} />
      <div className={`${nodeBg} border-[1.5px] ${selected ? selectedBorder : defaultBorder} rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow min-w-[440px] w-full h-full flex flex-col relative`}>
        <Handle type="target" position={Position.Left} className={handleStyle} />
        <div className="flex items-center justify-between mb-3 text-zinc-400 pb-2 border-b border-zinc-800/50 shrink-0">
          <div className="flex items-center gap-2">
            <FileText size={14} className={selected ? "text-[#00bcd4]" : ""} />
            <span className="text-xs font-semibold tracking-wide flex-1 text-[#00bcd4]">剧本拆解工作台</span>
          </div>
          <button onClick={(e) => { e.stopPropagation(); if(data.onReBreakdown) data.onReBreakdown(id); }} className="flex items-center gap-1.5 px-2 py-1 bg-zinc-800/50 hover:bg-zinc-700/80 rounded transition-colors text-zinc-400 hover:text-white border border-zinc-700">
            {data.isGenerating ? <RefreshCw size={12} className="animate-spin text-[#00bcd4]" /> : <RefreshCw size={12} />}
            <span className="text-[10px]">重新拆解</span>
          </button>
        </div>
        {data.isGenerating && (
          <div className="absolute inset-0 z-50 bg-[#111214]/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center gap-3">
             <RefreshCw className="animate-spin text-[#00bcd4]" size={24} />
             <div className="text-sm font-medium text-[#00bcd4] animate-pulse">AI 正在深度拆解剧本...</div>
          </div>
        )}
        
        {data.breakdown ? (
          <div className="flex flex-col flex-1 h-full overflow-hidden border border-zinc-800/50 rounded-lg">
            {/* Tabs Header */}
            <div className="flex items-center gap-1 overflow-x-auto p-1 border-b border-zinc-800/50 bg-zinc-900/80 shrink-0 scrollbar-hide">
              {tabs.map(tab => (
                <button 
                  key={tab.id}
                  onClick={(e) => { e.stopPropagation(); setActiveTab(tab.id); }}
                  className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors ${activeTab === tab.id ? 'bg-zinc-800 text-[#00bcd4] font-medium' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            
            {/* Tab Content */}
            <div className="flex-1 overflow-auto bg-zinc-900/50 p-3 pr-2 custom-scrollbar text-xs text-zinc-300">
              {activeTab === 'overview' && (
                <div className="flex flex-col gap-3">
                  <div className="text-[#00bcd4] font-medium text-sm mb-1">{data.breakdown.overview.title}</div>
                  <div className="grid grid-cols-[80px_1fr] gap-2">
                    <span className="text-zinc-500">主题/主旨:</span><span>{data.breakdown.overview.theme}</span>
                    <span className="text-zinc-500">时空背景:</span><span>{data.breakdown.overview.timePeriod}</span>
                    <span className="text-zinc-500">情绪基调:</span><span>{data.breakdown.overview.overallMood}</span>
                  </div>
                  <div className="mt-2 text-zinc-400 leading-relaxed border-t border-zinc-800/50 pt-3">
                    <span className="text-zinc-500 block mb-1">剧情梗概:</span>
                    {data.breakdown.overview.synopsis}
                  </div>
                </div>
              )}

              {activeTab === 'scenes' && (
                <div className="flex flex-col gap-4">
                  {data.breakdown.scenes.map((scene: any, idx: number) => (
                    <div key={idx} className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-800/50">
                      <div className="flex items-center justify-between mb-2 pb-2 border-b border-zinc-800/50">
                        <span className="text-[#00bcd4] font-medium">场次 {scene.sceneNo}: {scene.name}</span>
                        <span className="text-[10px] bg-zinc-800 px-2 py-0.5 rounded text-zinc-400">{scene.setting} · {scene.time}</span>
                      </div>
                      <div className="grid grid-cols-[60px_1fr] gap-y-1.5 gap-x-2 text-[11px]">
                        <span className="text-zinc-500">地点:</span><span>{scene.location}</span>
                        <span className="text-zinc-500">人物:</span><span>{scene.characters.join('、')}</span>
                        <span className="text-zinc-500">事件:</span><span>{scene.events}</span>
                        <span className="text-zinc-500">情绪:</span><span>{scene.mood}</span>
                        <span className="text-zinc-500">前后场:</span><span>{scene.relation}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'characters' && (
                <div className="flex flex-col gap-4">
                  {data.breakdown.characters.map((char: any, idx: number) => (
                    <div key={idx} className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-800/50">
                      <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-800/50">
                        <span className="font-medium text-zinc-100">{char.name}</span>
                        <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">{char.role}</span>
                        <span className="text-[10px] text-zinc-500">{char.ageGroup}</span>
                      </div>
                      <div className="grid grid-cols-[60px_1fr] gap-y-1.5 gap-x-2 text-[11px]">
                        <span className="text-zinc-500">外观:</span><span className="text-zinc-300">{char.appearance}</span>
                        <span className="text-zinc-500">状态:</span><span><span className="text-orange-400/80">当前: </span>{char.currentState} <span className="text-rose-400/80 ml-2">情绪: </span>{char.emotionalState}</span>
                        <span className="text-zinc-500">目标:</span><span className="text-emerald-400/80">{char.goal}</span>
                        <span className="text-zinc-500">关系:</span><span>{char.relationships}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'locations' && (
                <div className="flex flex-col gap-4">
                  {data.breakdown.locations.map((loc: any, idx: number) => (
                    <div key={idx} className="bg-zinc-800/30 rounded-lg p-3 border border-zinc-800/50">
                      <div className="font-medium text-zinc-200 mb-2 pb-2 border-b border-zinc-800/50">{loc.name}</div>
                      <div className="grid grid-cols-[60px_1fr] gap-y-1.5 gap-x-2 text-[11px]">
                        <span className="text-zinc-500">空间类型:</span><span>{loc.spaceType}</span>
                        <span className="text-zinc-500">空间锚点:</span><span>{loc.spatialAnchors}</span>
                        <span className="text-zinc-500">门窗出入:</span><span>{loc.ports}</span>
                        <span className="text-zinc-500">家具构件:</span><span>{loc.furniture}</span>
                        <span className="text-zinc-500">光线氛围:</span><span>{loc.lighting} · {loc.atmosphere}</span>
                        <span className="text-zinc-500">状态变化:</span><span className="text-yellow-500/80">{loc.statusChange}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'props' && (
                <div className="grid grid-cols-1 gap-2">
                  {data.breakdown.props.map((prop: any, idx: number) => (
                    <div key={idx} className="bg-zinc-800/30 rounded-lg p-2.5 border border-zinc-800/50">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium text-amber-500">{prop.name}</span>
                        <span className="text-[10px] text-zinc-500">归属: {prop.owner}</span>
                      </div>
                      <div className="text-[10px] flex flex-col gap-1 mt-2 text-zinc-400">
                        <div className="flex gap-2"><span className="text-zinc-500 shrink-0">流转:</span> <span>初始{prop.initPosition} → {prop.appearTime}出现 → 离手于{prop.dropTime}</span></div>
                        <div className="flex gap-2"><span className="text-zinc-500 shrink-0">动作:</span> <span>{prop.usage}</span></div>
                        <div className="flex gap-2"><span className="text-zinc-500 shrink-0">续场:</span> <span>{prop.nextScene ? '进入下一场' : '本场结束'}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'beats' && (
                <div className="flex flex-col gap-4">
                  <div className="bg-zinc-800/30 p-2 rounded-lg border border-zinc-800/50">
                    <div className="text-xs text-zinc-400 font-medium mb-1.5 flex items-center gap-1.5"><ArrowUp size={12} className="rotate-90"/> 核心动作链</div>
                    <div className="text-[11px] text-[#00bcd4]">{data.breakdown.actionChain.join(' → ')}</div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <div className="text-xs text-zinc-500 font-medium">Beats 拆解</div>
                    {data.breakdown.beats.map((beat: any, idx: number) => (
                      <div key={idx} className="bg-zinc-800/20 rounded-lg p-2.5 border-l-2 border-l-purple-500/50 border border-zinc-800/50 relative pl-4">
                        <div className="absolute left-0 top-0 bottom-0 w-8 flex items-center justify-center -translate-x-1/2 opacity-30">
                          <div className="w-4 h-4 rounded-full bg-zinc-900 border-2 border-purple-500 flex items-center justify-center text-[8px] font-bold">{beat.beatNo}</div>
                        </div>
                        <div className="text-[10px] text-zinc-500 mb-1">属于: 场次 {beat.sceneNo}</div>
                        <div className="flex items-center gap-1 text-[11px] font-medium text-zinc-200 mb-1">
                          <span>{beat.start}</span>
                          <span className="text-zinc-600">→</span>
                          <span>{beat.end}</span>
                        </div>
                        <div className="grid grid-cols-[50px_1fr] gap-y-1 gap-x-1 text-[10px] mt-1.5">
                          <span className="text-zinc-500">主要动作:</span><span className="text-zinc-300">{beat.action}</span>
                          <span className="text-zinc-500">情绪变化:</span><span className="text-rose-400/80">{beat.emotionChange}</span>
                          <span className="text-zinc-500">视觉重点:</span><span className="text-[#00bcd4]">{beat.visualFocus}</span>
                          <span className="text-zinc-500">台词承载:</span><span className="text-zinc-400">{beat.dialogueLoad}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'risks' && (
                <div className="flex flex-col gap-2">
                  {data.breakdown.continuityRisks.map((risk: string, idx: number) => (
                    <div key={idx} className="flex gap-2 bg-rose-500/5 border border-rose-500/20 rounded-lg p-2.5 text-[11px]">
                      <div className="text-rose-500 shrink-0 mt-0.5"><Zap size={12} /></div>
                      <span className="text-zinc-300">{risk}</span>
                    </div>
                  ))}
                  {(!data.breakdown.continuityRisks || data.breakdown.continuityRisks.length === 0) && (
                    <div className="text-zinc-500 text-center py-4">暂无发现明显连贯性风险</div>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-3 overflow-auto flex-1 h-full mb-3 text-zinc-300 text-xs">
            {data.script ? (
              <table className="w-full text-left">
                <thead className="text-zinc-500 border-b border-zinc-800/50 sticky top-0 bg-zinc-900/90 backdrop-blur">
                  <tr>
                    <th className="pb-2 font-medium w-12">镜号</th>
                    <th className="pb-2 font-medium">画面描述</th>
                    <th className="pb-2 font-medium w-16">景别</th>
                  </tr>
                </thead>
                <tbody>
                  {data.script.map((row: any, i: number) => (
                    <tr key={i} className="border-b border-zinc-800/20 last:border-0 hover:bg-zinc-800/30 transition-colors">
                      <td className="py-2 text-zinc-500 align-top">{i + 1}</td>
                      <td className="py-2 pr-2 align-top">{row.description}</td>
                      <td className="py-2 text-zinc-500 align-top">{row.shotType || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-zinc-600 flex-col gap-2">
                <span className="text-xs">拆解内容为空</span>
              </div>
            )}
          </div>
        )}
        <div className="flex items-center justify-end gap-2 mt-3 pt-2 border-t border-zinc-800/50 shrink-0">
          <button 
            onClick={(e) => { e.stopPropagation(); if (data.onConfirmBreakdown) data.onConfirmBreakdown(id); }}
            className="flex items-center gap-1.5 px-4 py-1.5 bg-[#00bcd4]/15 hover:bg-[#00bcd4]/30 text-[#00bcd4] rounded-lg text-xs font-medium transition-all border border-[#00bcd4]/40 hover:scale-[1.02] shadow-[0_0_10px_rgba(0,188,212,0.2)]"
          >
            <CheckCircle size={14} />
            <span>确认拆解结果</span>
          </button>
        </div>
        <Handle type="source" position={Position.Right} className={handleStyle} />
      </div>
    </>
  );
};

const AssetGroupNode = ({ data, id, selected }: any) => {
  const isTextOnly = data.type === 'textOnly';
  
  return (
    <>
      <NodeResizer color="transparent" handleClassName={resizerHandleStyle} minWidth={380} minHeight={200} isVisible={selected} />
      <div className={`${nodeBg} border-[1.5px] ${selected ? selectedBorder : defaultBorder} rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow min-w-[380px] w-full h-full flex flex-col relative`}>
        <Handle type="target" position={Position.Left} className={handleStyle} />
        <div className="flex items-center justify-between mb-3 pb-2 border-b border-zinc-800/50">
          <div className="flex items-center gap-2 text-zinc-400">
            <Box size={14} className={selected ? "text-[#00bcd4]" : ""} />
            <span className="text-xs font-semibold tracking-wide">{data.title} ({data.assets?.length || 0})</span>
          </div>
          {!isTextOnly && data.assets && data.assets.length > 0 && (
            <button 
              onClick={(e) => { e.stopPropagation(); if (data.onGenerateAll) data.onGenerateAll(id); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#00bcd4]/10 hover:bg-[#00bcd4]/20 text-[#00bcd4] rounded-lg text-xs transition-colors border border-[#00bcd4]/30"
            >
              <Sparkles size={12} />
              <span>全部生成</span>
            </button>
          )}
        </div>
        
        {!isTextOnly && (
          <div className="mb-3">
             <textarea 
               className="w-full bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-2 text-[11px] text-zinc-300 resize-none outline-none focus:border-[#00bcd4]/50 custom-scrollbar"
               placeholder={`统一定义${data.title}的专属Prompt指令 (可选)...`}
               rows={2}
               value={data.prompt || ''}
               onChange={(e) => {
                 if (data.onUpdateGroupPrompt) data.onUpdateGroupPrompt(id, e.target.value);
               }}
               onPointerDown={(e) => e.stopPropagation()}
             />
          </div>
        )}

        <div className={`${isTextOnly ? 'flex flex-col gap-2' : 'grid grid-cols-2 lg:grid-cols-3 gap-3'} overflow-y-auto flex-1 h-full pr-1 custom-scrollbar`}>
          {data.assets?.map((asset: any, idx: number) => (
            <div key={idx} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 flex flex-col group relative">
              <div className="text-sm font-medium text-zinc-200 mb-1">{asset.name}</div>
              
              {!isTextOnly ? (
                <textarea
                  className="w-full bg-transparent text-[10px] text-zinc-400 resize-none outline-none flex-1 custom-scrollbar min-h-[40px] pointer-events-auto"
                  value={asset.description}
                  onChange={(e) => {
                     if (data.onUpdateAssetDescription) data.onUpdateAssetDescription(id, idx, e.target.value);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                />
              ) : (
                <div className="text-[11px] text-zinc-400 flex-1">{asset.description}</div>
              )}
              
              {!isTextOnly && (
                <>
                  {asset.imageUrl ? (
                    <div className="w-full aspect-square rounded-lg overflow-hidden bg-black/50 relative mt-2">
                      <img src={asset.imageUrl || undefined} className="w-full h-full object-cover" />
                    </div>
                  ) : asset.isGenerating ? (
                    <div className="w-full aspect-square rounded-lg border border-[#00bcd4]/30 bg-[#00bcd4]/5 flex flex-col items-center justify-center mt-2">
                      <Sparkles className="text-[#00bcd4] animate-pulse mb-2" size={20} />
                      <span className="text-[10px] text-[#00bcd4]">生成中...</span>
                    </div>
                  ) : (
                    <div className="w-full aspect-square rounded-lg border border-dashed border-zinc-700 bg-zinc-800/20 flex flex-col items-center justify-center group/btn relative mt-2">
                      <button 
                        onClick={(e) => { e.stopPropagation(); if (data.onGenerateSingle) data.onGenerateSingle(id, idx); }}
                        className="absolute inset-0 w-full h-full flex flex-col items-center justify-center gap-2 opacity-60 hover:opacity-100 transition-opacity text-zinc-500 hover:text-[#00bcd4]"
                      >
                        <ImagePlus size={20} />
                        <span className="text-[10px]">点击生成</span>
                      </button>
                    </div>
                  )}
                  <Handle 
                    type="source" 
                    position={Position.Right} 
                    id={`asset-${idx}`}
                    className="!w-3 !h-3 !bg-[#00bcd4] !border-2 !border-[#111214] opacity-0 group-hover:opacity-100 transition-opacity" 
                    style={{ top: '50%', right: -6 }}
                  />
                </>
              )}
            </div>
          ))}
        </div>
        {!isTextOnly && <Handle type="source" position={Position.Right} className={handleStyle} />}
      </div>
    </>
  );
};

const ReviewResultNode = ({ data, id, selected }: any) => {
  const [activeTab, setActiveTab] = useState<'overall' | 'priority' | 'compliance' | 'format' | 'confirmation' | 'conclusion'>('overall');
  const [isEditing, setIsEditing] = useState(false);

  const tabs = [
    { id: 'overall', label: '总体判断' },
    { id: 'priority', label: '优先修复' },
    { id: 'compliance', label: '合规与风险' },
    { id: 'format', label: '格式与细节' },
    { id: 'confirmation', label: '需确认方向' },
    { id: 'conclusion', label: '审查结论' },
  ];

  const reportData = typeof data.reviewReport === 'object' && data.reviewReport !== null ? data.reviewReport : null;
  const currentText = reportData ? reportData[activeTab] || '' : (data.reviewReport || '');

  const handleEditChange = (e: any) => {
    if (!data.onChangeField) return;
    if (reportData) {
      data.onChangeField(id, 'reviewReport', { ...reportData, [activeTab]: e.target.value });
    } else {
      data.onChangeField(id, 'reviewReport', e.target.value);
    }
  };

  return (
    <>
      <NodeResizer color="transparent" handleClassName={resizerHandleStyle} minWidth={450} minHeight={450} isVisible={selected} />
      <div className={`${nodeBg} border-[1.5px] ${selected ? selectedBorder : defaultBorder} rounded-2xl p-0 shadow-sm hover:shadow-[0_0_15px_rgba(0,188,212,0.15)] transition-shadow min-w-[450px] w-full h-full flex flex-col relative overflow-hidden`}>
        <Handle type="target" position={Position.Left} className={handleStyle} />
        
        {/* Header */}
        <div className="flex items-center gap-2 p-3 bg-zinc-900/80 border-b border-zinc-800 shrink-0">
          <Zap size={15} className="text-rose-400" />
          <span className="text-sm font-bold tracking-wide text-zinc-200 flex-1">剧本审查报告</span>
          <button 
            onClick={(e) => { 
                e.stopPropagation(); 
                setIsEditing(!isEditing); 
            }}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[11px] font-medium transition-colors border ${isEditing ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30' : 'bg-zinc-800/50 text-zinc-400 border-zinc-700/50 hover:bg-zinc-700'}`}
          >
            {isEditing ? <CheckCircle size={12} /> : <FileText size={12} />}
            {isEditing ? '完成' : '编辑'}
          </button>
          <button 
            onClick={(e) => { 
                e.stopPropagation(); 
                if (data.onAddNode) data.onAddNode('textNode', `script-review-${data.reviewType}`, undefined, data.sourceScriptId, { problem: data.problem });
            }}
            className="flex items-center gap-1 text-rose-400 hover:text-white bg-rose-500/10 hover:bg-rose-500/30 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors"
          >
            <RefreshCw size={11} />
            从头重审
          </button>
        </div>

        {/* Content Area */}
        <div className="flex flex-col flex-1 min-h-0 bg-[#111214]">
          {/* Tabs */}
          {reportData && (
            <div className="flex px-2 pt-2 border-b border-zinc-800/80 shrink-0 gap-1 overflow-x-auto custom-scrollbar">
              {tabs.map(tab => (
                <button 
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors border-b-2 whitespace-nowrap ${activeTab === tab.id ? 'border-rose-500 text-rose-400 bg-zinc-800/50' : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/30'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 min-h-0 relative p-3">
            {isEditing ? (
              <textarea
                className="w-full h-full bg-zinc-900/50 border border-zinc-800/50 rounded-lg p-4 text-sm text-zinc-300 resize-none focus:outline-none focus:border-rose-500 transition-colors custom-scrollbar leading-relaxed"
                value={currentText}
                onChange={handleEditChange}
                placeholder="审查报告内容..."
              />
            ) : (
              <div className="bg-zinc-800/20 rounded-xl p-5 border border-zinc-800/50 h-full overflow-y-auto custom-scrollbar shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
                 <div className="markdown-body text-sm text-zinc-300 leading-relaxed font-light">
                    <Markdown>{currentText}</Markdown>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3 bg-zinc-900/80 border-t border-zinc-800 flex justify-end shrink-0 relative">
          <button 
            onClick={() => { if(data.onExportPolished) data.onExportPolished(id, data.sourceScriptId, data.aiScript) }}
            className="w-full py-2.5 bg-gradient-to-r from-[#00bcd4] to-[#0092a8] hover:from-[#00cbe6] hover:to-[#00a2bb] text-white rounded-lg text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(0,188,212,0.2)]"
          >
            <Type size={16} />
            一键输出润色版剧本
          </button>
        </div>

        <Handle type="source" position={Position.Right} className={handleStyle} />
      </div>
    </>
  );
};

const nodeTypes = createNodeTypes({
  TextNode,
  ImageNode,
  VideoNode,
  AudioNode,
  ScriptNode,
  AIGenNode,
  ResultNode,
  AssetGroupNode,
  ReviewResultNode,
});

const AnimatedEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
}: any) => {
  const { setEdges } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetPosition,
    targetX,
    targetY,
  });

  // Remove any inherited filter that might cause cyan outlines
  const baseStyle = { ...style };
  delete baseStyle.filter;
  delete baseStyle.stroke;

  return (
    <g 
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <defs>
        <linearGradient id={`${id}-gradient`} x1="0%" y1="0%" x2="200%" y2="0%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.1)" />
          <stop offset="25%" stopColor="#ffffff" />
          <stop offset="50%" stopColor="rgba(255, 255, 255, 0.1)" />
          <stop offset="75%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="rgba(255, 255, 255, 0.1)" />
          <animateTransform attributeName="gradientTransform" type="translate" from="-1 0" to="0 0" dur="2s" repeatCount="indefinite" />
        </linearGradient>
      </defs>
      <path
        d={edgePath}
        fill="none"
        strokeOpacity={0}
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />
      {/* Solid track baseline */}
      <BaseEdge path={edgePath} style={{ ...baseStyle, stroke: '#ffffff', strokeDasharray: 'none', strokeWidth: 1.5, opacity: 0.15 }} markerEnd={markerEnd} />
      {/* Flowing light comet */}
      <BaseEdge path={edgePath} style={{ ...baseStyle, stroke: `url(#${id}-gradient)`, strokeDasharray: 'none', strokeWidth: 1.5 }} className="glow-edge-path" />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
            opacity: isHovered ? 1 : 0,
            transition: 'opacity 0.2s',
          }}
          className="nodrag nopan"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setEdges((edges) => edges.filter((e) => e.id !== id));
            }}
            className="w-6 h-6 bg-[#2A2A2A] border border-zinc-700 rounded-full flex items-center justify-center text-zinc-300 hover:text-red-500 hover:border-red-500 hover:bg-red-500/10 transition-colors shadow-lg cursor-pointer"
          >
            <Scissors size={12} />
          </button>
        </div>
      </EdgeLabelRenderer>
    </g>
  );
};

const edgeTypes = {
  animated: AnimatedEdge,
};

function Canvas({ projectId, projectName, groupId, groupName, onBackToProjects, currentUser, onProjectRenamed }: { projectId: string; projectName: string; groupId: string; groupName: string; onBackToProjects: () => void; currentUser?: string; onProjectRenamed?: (name: string) => void }) {
  const navigate = useNavigate();
  const { getNode, getNodes, getEdges, fitView, screenToFlowPosition, getViewport } = useReactFlow();
  const [nodes, setNodes, onNodesChangeOriginal] = useNodesState([]);
  const [edges, setEdges, onEdgesChangeOriginal] = useEdgesState([]);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);
  const [showVersionPanel, setShowVersionPanel] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showCanvasMenu, setShowCanvasMenu] = useState(false);
  const [showAssetLibrary, setShowAssetLibrary] = useState(false);
  const [showTaskQueue, setShowTaskQueue] = useState(false);
  const [showActivityPanel, setShowActivityPanel] = useState(false);
  const [showPromptTemplates, setShowPromptTemplates] = useState(false);

  const { saveHistory, undo, redo, canUndo, canRedo } = useCanvasHistory(projectId, nodes, edges, setNodes as any, setEdges as any);

  const onNodesChange = useCallback((changes: any[]) => {
    const removeChanges = changes.filter(c => c.type === 'remove');
    if (removeChanges.length > 0) {
      saveHistory('delete_node');
    }
    onNodesChangeOriginal(changes);
  }, [onNodesChangeOriginal, saveHistory]);

  const onEdgesChange = useCallback((changes: any[]) => {
    const removeChanges = changes.filter(c => c.type === 'remove');
    if (removeChanges.length > 0) {
      saveHistory('delete_edge');
    }
    onEdgesChangeOriginal(changes);
  }, [onEdgesChangeOriginal, saveHistory]);

  const [menu, setMenu] = useState<{ id: string; top: number; left: number, type?: 'node' | 'pane' | 'selection' | 'add-node' | 'add-connected-node', sourceNodeId?: string, nodeType?: string } | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const [clipboard, setClipboard] = useState<{ type: 'node' | 'image', data: any } | null>(null);
  const [toast, setToast] = useState<{ message: string, visible: boolean }>({ message: '', visible: false });
  const [globalProgress, setGlobalProgress] = useState<{ visible: boolean, text: string, progress: number }>({ visible: false, text: '', progress: 0 });
  const [activeSidebarPopover, setActiveSidebarPopover] = useState<'add' | 'assets' | 'team-assets' | 'script' | null>(null);
  const [scriptPanelSize, setScriptPanelSize] = useState(() => {
    try {
      const stored = localStorage.getItem(`script_panel_size_${projectId}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        return { width: Math.min(Math.max(Number(parsed.width) || 420, 360), 860), height: Math.min(Math.max(Number(parsed.height) || 600, 460), 900) };
      }
    } catch {}
    return { width: 420, height: 600 };
  });
  const [assetsTab, setAssetsTab] = useState<'materials' | 'entities'>('materials');
  const [materialsCategory, setMaterialsCategory] = useState('全部');
  const [entitiesCategory, setEntitiesCategory] = useState('全部');
  const [myEntities, setMyEntities] = useState<any[]>([]);
  const [entityCategoryMenuId, setEntityCategoryMenuId] = useState<string | null>(null);

  const handleScriptPanelResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startY = event.clientY;
    const startWidth = scriptPanelSize.width;
    const startHeight = scriptPanelSize.height;

    const onMove = (moveEvent: MouseEvent) => {
      const maxWidth = Math.min(860, Math.max(420, window.innerWidth - 120));
      const maxHeight = Math.min(900, Math.max(520, window.innerHeight - 80));
      const nextSize = {
        width: Math.min(Math.max(startWidth + moveEvent.clientX - startX, 360), maxWidth),
        height: Math.min(Math.max(startHeight + moveEvent.clientY - startY, 460), maxHeight),
      };
      setScriptPanelSize(nextSize);
      try { localStorage.setItem(`script_panel_size_${projectId}`, JSON.stringify(nextSize)); } catch {}
    };

    const onUp = () => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    document.body.style.cursor = 'nwse-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [projectId, scriptPanelSize.height, scriptPanelSize.width]);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(`canvas_my_entities_${projectId}`) || localStorage.getItem('canvas_my_entities');
      if (stored) setMyEntities(JSON.parse(stored));
    } catch (error) {
      console.warn('Failed to load my entities:', error);
    }
  }, [projectId]);

  React.useEffect(() => {
    try {
      localStorage.setItem(`canvas_my_entities_${projectId}`, JSON.stringify(myEntities));
      localStorage.setItem('canvas_my_entities', JSON.stringify(myEntities));
    } catch (error) {
      console.warn('Failed to save my entities:', error);
    }
  }, [projectId, myEntities]);

  React.useEffect(() => {
    let disposed = false;

    const syncTerminalGenerationTasksToNodes = async () => {
      try {
        const projectIds = Array.from(new Set([projectId, 'local-project'].filter(Boolean)));
        const taskGroups = await Promise.all(projectIds.map((id) => taskQueueManager.getTasks(id)));
        const serverTaskGroups = await Promise.all(projectIds.map((id) => fetchProjectGenerationTasks(id)));
        const latestTaskByNodeId = new Map<string, any>();
        const serverNodeKeys = new Set<string>();

        for (const task of serverTaskGroups.flat()) {
          if (!task?.nodeId || !['image_generation', 'video_generation'].includes(task.type)) continue;
          serverNodeKeys.add(task.nodeId + ':' + task.type);
          const previous = latestTaskByNodeId.get(task.nodeId);
          const taskTime = new Date(task.updatedAt || task.createdAt || 0).getTime();
          const previousTime = previous ? new Date(previous.updatedAt || previous.createdAt || 0).getTime() : -1;
          if (!previous || taskTime >= previousTime) {
            latestTaskByNodeId.set(task.nodeId, task);
          }
        }

        for (const task of taskGroups.flat()) {
          if (!task?.nodeId || !['image_generation', 'video_generation'].includes(task.type)) continue;
          if (serverNodeKeys.has(task.nodeId + ':' + task.type)) continue;
          const previous = latestTaskByNodeId.get(task.nodeId);
          const taskTime = new Date(task.updatedAt || task.createdAt || 0).getTime();
          const previousTime = previous ? new Date(previous.updatedAt || previous.createdAt || 0).getTime() : -1;
          if (!previous || taskTime >= previousTime) {
            latestTaskByNodeId.set(task.nodeId, task);
          }
        }

        if (disposed || latestTaskByNodeId.size === 0) return;

        setNodes((currentNodes: any[]) => currentNodes.map((node: any) => {
          const task = latestTaskByNodeId.get(node.id);
          if (!task) return node;
          const status = normalizeGenerationStatus(task.status);
          const isGenerationNode = ['imageNode', 'videoNode'].includes(node.type);
          if (!isGenerationNode) return node;

          if (status === 'running') {
            const progressMsg = node.type === 'videoNode'
              ? '视频仍在服务商后台生成，请稍后查看任务队列。'
              : '图片仍在服务商后台生成，请稍后查看任务队列。';
            return {
              ...node,
              data: {
                ...node.data,
                isGenerating: true,
                progress: node.data?.progress || 92,
                progressMsg: node.data?.progressMsg || progressMsg,
                generatingText: node.data?.generatingText || '',
                generationError: undefined
              }
            };
          }

          if (!node?.data?.isGenerating && !['completed', 'failed'].includes(status)) return node;
          if (!['completed', 'failed'].includes(status)) return node;

          const nextData: any = {
            ...node.data,
            isGenerating: false,
            progress: undefined,
            progressMsg: '',
            generatingText: '',
          };

          if (status === 'failed') {
            nextData.generationError = task.error || '生成失败，请查看任务队列失败原因。';
            return { ...node, data: nextData };
          }

          const resultUrl = extractGeneratedMediaUrl(task.result);
          nextData.generationError = undefined;
          if (resultUrl && node.type === 'imageNode') nextData.imageUrl = resultUrl;
          if (resultUrl && node.type === 'videoNode') nextData.videoUrl = resultUrl;
          return { ...node, data: nextData };
        }));
      } catch (error) {
        console.warn('Failed to sync terminal generation tasks to nodes:', error);
      }
    };

    syncTerminalGenerationTasksToNodes();
    const timer = window.setInterval(syncTerminalGenerationTasksToNodes, 3000);
    return () => {
      disposed = true;
      window.clearInterval(timer);
    };
  }, [projectId, setNodes]);

  const [activeRightPanel, setActiveRightPanel] = useState<{ type: MediaCapability, nodeId: string, initialValues?: Record<string, any> } | null>(null);
  const [initialDataLoaded, setInitialDataLoaded] = useState(false);
  const [currentProjectName, setCurrentProjectName] = useState(projectName);

  React.useEffect(() => {
    setCurrentProjectName(projectName);
  }, [projectName]);

  React.useEffect(() => {
    const closeFloatingMenus = () => {
      setShowCanvasMenu(false);
      setEntityCategoryMenuId(null);
    };
    window.addEventListener('click', closeFloatingMenus);
    return () => window.removeEventListener('click', closeFloatingMenus);
  }, []);

  const showToast = useCallback((message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => setToast({ message: '', visible: false }), 2500);
  }, []);

  const handleSaveProject = useCallback(async (arg1?: any, arg2?: any) => {
    if (!initialDataLoaded) return;

    const currentNodes = Array.isArray(arg1) ? arg1 : nodes;
    const currentEdges = Array.isArray(arg2) ? arg2 : edges;
    const slimNodes = currentNodes.map((node: any) => {
      const data = node?.data || {};
      const imageUrl = typeof data.imageUrl === 'string' && data.imageUrl.startsWith('data:image/') && data.imageUrl.length > 750_000
        ? ''
        : data.imageUrl;
      const videoUrl = typeof data.videoUrl === 'string' && data.videoUrl.startsWith('data:video/') && data.videoUrl.length > 750_000
        ? ''
        : data.videoUrl;

      return {
        ...node,
        data: {
          ...data,
          imageUrl,
          videoUrl
        }
      };
    });
    await canvasProjectPersistence.save(projectId, currentProjectName, {
      nodes: slimNodes,
      edges: currentEdges
    });
  }, [nodes, edges, projectId, currentProjectName, initialDataLoaded]);

  const persistCanvasSoon = useCallback((delayMs = 120) => {
    window.setTimeout(() => {
      handleSaveProject(getNodes(), getEdges()).catch((error) => {
        console.warn('Canvas quick persist failed:', error);
      });
    }, delayMs);
  }, [handleSaveProject, getNodes, getEdges]);

  const [settings, setSettings] = useState<any>(null);

  // Load project settings initially
  React.useEffect(() => {
    projectSettingsService.getSettings(projectId).then(setSettings);
  }, [projectId]);

  // Load project initially
  React.useEffect(() => {
    const loadData = async () => {
      const projectData = await canvasProjectPersistence.load(projectId);
      if (projectData) {
        setNodes(hydrateRuntimeNodeData(projectData.nodes || []));
        setEdges(projectData.edges || []);
        setTimeout(() => setInitialDataLoaded(true), 100);
        return;
      }
      setTimeout(() => setInitialDataLoaded(true), 100);
    };
    loadData();
  }, [projectId, setNodes, setEdges]);

  // Auto-save when nodes or edges change
  React.useEffect(() => {
    if (initialDataLoaded && settings?.system?.autoSave !== false) {
      const intervalMs = settings?.system?.autoSaveIntervalMs || 30000;
      const timer = setTimeout(() => {
        handleSaveProject(nodes, edges);
      }, Math.max(3000, Math.min(intervalMs, 10000)));
      return () => clearTimeout(timer);
    }
  }, [nodes, edges, handleSaveProject, initialDataLoaded, settings]);

  const handleLoadProject = useCallback(() => {
    // Deprecated for direct manual load, handled by initial effect
    showToast('项目已自动加载');
  }, [showToast]);

  const handleProjectSettingsSaved = useCallback(async (nextSettings: any) => {
    setSettings(nextSettings);
    const nextName = String(nextSettings?.project?.name || '').trim();
    if (!nextName) return;
    setCurrentProjectName(nextName);
    onProjectRenamed?.(nextName);
    try {
      await workspaceRepository.renameProject(projectId, nextName);
    } catch (err) {
      console.warn('Failed to sync project name to repository', err);
    }
  }, [projectId, onProjectRenamed]);

  const handleNewProject = useCallback(() => {
    // Let's redirect back to projects instead
    onBackToProjects();
  }, [onBackToProjects]);

  const handleOpenGenerate = useCallback(async (nodeId: string, options?: { aspectRatio?: string, resolution?: string, imageCount?: number, stylePreset?: string, uiModel?: string, characterSheetMode?: boolean }) => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    const targetNode = currentNodes.find(n => n.id === nodeId);
    const basePrompt = String(targetNode?.data?.prompt || '').trim();
    const shouldUseCharacterSheet = !!(options?.characterSheetMode || targetNode?.data?.characterSheetMode);
    const prompt = shouldUseCharacterSheet ? buildCharacterSheetPrompt(basePrompt, nodeId) : basePrompt;
    const upstreamImageUrls = currentEdges
      .filter(edge => edge.target === nodeId)
      .map(edge => currentNodes.find(n => n.id === edge.source))
      .filter(sourceNode => sourceNode?.type === 'imageNode' && sourceNode.data?.imageUrl)
      .map(sourceNode => sourceNode?.data?.imageUrl as string);
    const selfImageUrl = targetNode?.type === 'imageNode' && targetNode.data?.imageUrl && !targetNode.data?.isGenerating
      ? String(targetNode.data.imageUrl)
      : '';
    const rawReferenceImageUrls = Array.from(new Set([
      selfImageUrl,
      ...upstreamImageUrls
    ].filter(Boolean)));

    if (!targetNode) return;
    if (!prompt) {
      showToast('请输入图片提示词');
      return;
    }

    const patchNodeData = (patch: Record<string, unknown>) => {
      setNodes(nds => nds.map(node => (
        node.id === nodeId
          ? { ...node, data: { ...node.data, ...patch } }
          : node
      )));
    };

    try {
      const generationAspectRatio = options?.aspectRatio || targetNode.data?.aspectRatio || targetNode.data?.requestedAspectRatio || '16:9';
      const generationResolution = options?.resolution || targetNode.data?.resolution || '4K';
      const generationModel = options?.uiModel || targetNode.data?.uiModel || targetNode.data?.model || 'KONGLONG Image';
      const generationImageCount = options?.imageCount || targetNode.data?.imageCount || 1;
      const referenceImageUrls = (await Promise.all(rawReferenceImageUrls.map(async (url, index) => {
        try {
          return await ensurePublicMediaUrl(url, 'image', index);
        } catch {
          return url;
        }
      }))).filter(Boolean);
      const referenceInstruction = referenceImageUrls.length > 0
        ? shouldUseCharacterSheet
          ? '\n\n【参考图锁定】以参考图中的人物作为唯一角色来源，严格继承人物五官、脸型、发型、服装、体型、肤色和整体画风；不要凭空替换成其他人物。'
          : '\n\n【图生图参考要求】严格以参考图作为原始图像/上游素材，保留主体身份、脸型、发型、服装、姿态、构图与整体风格；只根据提示词修改指定内容，不要生成无关新人物，不要替换成其他角色。'
        : '';
      const generationPrompt = `${prompt}${referenceInstruction}`;
      patchNodeData({
        isGenerating: true,
        progress: 8,
        progressMsg: referenceImageUrls.length > 0 ? '正在参考图片生成...' : '正在生成图片...',
        prompt,
        aspectRatio: generationAspectRatio,
        requestedAspectRatio: generationAspectRatio,
        resolution: generationResolution,
        imageCount: generationImageCount,
        uiModel: generationModel,
        model: generationModel,
        characterSheetMode: shouldUseCharacterSheet
      });
      const startedAt = Date.now();
      const progressTimer = window.setInterval(() => {
        const elapsedSeconds = Math.floor((Date.now() - startedAt) / 1000);
        const nextProgress = Math.min(92, 8 + Math.floor(elapsedSeconds * 1.2));
        patchNodeData({
          isGenerating: true,
          progress: nextProgress,
          progressMsg: elapsedSeconds > 90
            ? '图片仍在生成中，服务商返回较慢，请继续等待...'
            : referenceImageUrls.length > 0
              ? '正在参考图片生成...'
              : '正在生成图片...'
        });
      }, 3000);

      try {
        const imageUrl = await runImageGeneration(
          generationPrompt,
          undefined,
          undefined,
          generationAspectRatio,
          generationResolution,
          {
            workspaceProjectId: projectId,
            createdBy: currentUser || 'system',
            uiModel: generationModel,
            referenceImages: referenceImageUrls,
            imageCount: generationImageCount,
            nodeId
          }
        );

        window.clearInterval(progressTimer);
        const requestedRatio = generationAspectRatio;
        const [ratioX, ratioY] = requestedRatio.split(':').map(Number);
        setNodes(nds => nds.map(node => {
          if (node.id !== nodeId) return node;
          const currentWidth = Number(node.style?.width || node.width || 320);
          const nextHeight = Number.isFinite(ratioX) && Number.isFinite(ratioY) && ratioX > 0 && ratioY > 0
            ? Math.round(currentWidth * (ratioY / ratioX))
            : Number(node.style?.height || node.height || 320);
          return {
            ...node,
            style: { ...node.style, width: currentWidth, height: nextHeight },
            data: {
              ...node.data,
              imageUrl,
              isGenerating: false,
              progress: 100,
              progressMsg: '',
              aspectRatio: generationAspectRatio,
              resolution: generationResolution,
              imageCount: generationImageCount,
              stylePreset: options?.stylePreset,
              uiModel: generationModel,
              model: generationModel,
              requestedAspectRatio: requestedRatio
            }
          };
        }));
        MediaHistoryService.addHistory({ type: 'image', url: imageUrl });
        showToast(referenceImageUrls.length > 0 ? '参考图生成完成' : '图片生成完成');
      } catch (err) {
        window.clearInterval(progressTimer);
        throw err;
      }
    } catch (err: any) {
      const message = String(err?.message || '未知错误');
      const isStillProcessing = message.includes('仍在生成') || message.includes('后台处理中') || message.includes('读取不稳定');
      patchNodeData(isStillProcessing
        ? { isGenerating: true, progress: 92, progressMsg: '图片仍在服务商后台生成，请稍后查看任务队列。' }
        : { isGenerating: false, progress: 0, progressMsg: '' }
      );
      showToast(`图片生成失败：${err?.message || '未知错误'}`);
    }
  }, [getNodes, getEdges, setNodes, projectId, currentUser, showToast]);

  const onConnect = useCallback(
    (params: Connection) => {
      saveHistory('connect_edge');
      setEdges((eds) => addEdge({ 
        ...params, 
        type: 'animated',
        animated: true, 
        style: { stroke: '#00bcd4', strokeWidth: 2.5, filter: 'drop-shadow(0 0 8px rgba(0,188,212,0.8))' }
      }, eds));
    },
    [setEdges, saveHistory]
  );

  const handleImageAction = useCallback((id: string, action: string, payload?: any) => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    const node = currentNodes.find(n => n.id === id);
    if (!node) return;

    if (action === 'translate-prompt') {
      const promptToTranslate = payload || node.data.prompt;
      if (!promptToTranslate) {
        showToast('没有提示词需要翻译');
        return;
      }
      showToast('正在翻译...');
      const genAI = getAIClient();
      genAI.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Translate the following text. If it is mostly in Chinese, translate it to English. If it is mostly in English, translate it to Chinese. Return ONLY the translation without quotes or explanations:\n${promptToTranslate}`
      }).then(res => {
         updateNodeData(id, 'prompt', res.text);
         showToast('翻译完成');
      }).catch(err => {
         console.error(err);
         showToast('翻译失败');
      });
      return;
    }

    if (action === 'download') {
      if (node.data.imageUrl) {
        const ext = inferDownloadExtension(String(node.data.imageUrl), 'png');
        triggerMediaDownload(String(node.data.imageUrl), `image-${id}.${ext}`)
          .then(() => showToast('图片开始下载'))
          .catch((err) => {
            console.error(err);
            showToast('下载失败：图片源不允许直接下载，请右键图片另存为');
          });
      } else {
        showToast('无可用图片下载');
      }
      return;
    }

    if (action === 'rotate') {
      updateNodeData(id, 'rotation', !node.data.rotation);
      return;
    }

    if (action === 'select-thumbnail') {
      updateNodeData(id, 'imageUrl', payload);
      return;
    }

    if (action === 'annotate') {
      showToast('标注工具下一步会接入画笔、文字和马赛克；当前先保留入口，不影响图片生成链路。');
      return;
    }

    const sourceImage = String(node.data.imageUrl || '');
    if (!sourceImage) {
      showToast('请先上传或生成一张图片');
      return;
    }

    const addDerivedImageNode = (imageUrl: string, title: string, index = 0) => {
      const newNodeId = `image-${Date.now()}-${index}`;
      const xOffset = 360 + (index % 4) * 220;
      const yOffset = Math.floor(index / 4) * 260;
      const newNode = {
        id: newNodeId,
        type: 'imageNode',
        position: { x: node.position.x + xOffset, y: node.position.y + yOffset },
        style: { width: 320, height: 320 },
        data: {
          imageUrl,
          title,
          projectId,
          prompt: node.data.prompt || '',
          onAction: handleImageAction,
          onUpload: handleNodeFileUpload,
          onGenerate: handleOpenGenerate,
          onChange: handleImageChange,
          onAddNode: addNode,
          onOpenAssets: openAssets
        },
      };
      setNodes(nds => [...nds, newNode]);
      setEdges(eds => [...eds, { id: `e-${id}-${newNodeId}`, source: id, target: newNodeId, animated: true, style: { stroke: '#00bcd4' } }]);
    };

    const splitGrid = async (gridSize: 2 | 3 | 4) => {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = sourceImage;
      });
      const cellWidth = Math.floor(image.naturalWidth / gridSize);
      const cellHeight = Math.floor(image.naturalHeight / gridSize);
      const splitJobs = Array.from({ length: gridSize * gridSize }).map(async (_, index) => {
        const col = index % gridSize;
        const row = Math.floor(index / gridSize);
        const canvas = document.createElement('canvas');
        canvas.width = cellWidth;
        canvas.height = cellHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        ctx.drawImage(image, col * cellWidth, row * cellHeight, cellWidth, cellHeight, 0, 0, cellWidth, cellHeight);
        try {
          const dataUrl = canvas.toDataURL('image/png');
          const publicUrl = await ensurePublicMediaUrl(dataUrl, 'image', index);
          addDerivedImageNode(publicUrl, `${gridSize * gridSize}宫格拆分 ${index + 1}`, index);
          MediaHistoryService.addHistory({ type: 'image', url: publicUrl });
          return true;
        } catch (err) {
          console.warn('Persist split grid cell failed:', err);
          return false;
        }
      });
      const results = await Promise.all(splitJobs);
      const successCount = results.filter(Boolean).length;
      showToast(successCount === gridSize * gridSize
        ? `${gridSize * gridSize}宫格拆分完成`
        : `宫格拆分完成 ${successCount}/${gridSize * gridSize}，失败项未写入本地大图，避免刷新后丢失或页面崩溃`
      );
    };

    if (action === 'split-4' || action === 'split-9' || action === 'split-16') {
      const gridSize = action === 'split-4' ? 2 : action === 'split-9' ? 3 : 4;
      splitGrid(gridSize).catch(() => showToast('宫格拆分失败：图片地址不允许浏览器读取，请先下载后重新上传到画布再拆分'));
      return;
    }

    const userPrompt = String(node.data.prompt || '').trim();
    const cameraText = payload
      ? `目标机位：水平环绕 ${payload.horizontal ?? 0}°，垂直俯仰 ${payload.vertical ?? 0}°，景别 ${['特写', '近景', '中景', '全景', '远景'][payload.zoom ?? 2] || '中景'}。`
      : '';

    const buildSingleFrameReferences = () => {
      const incomingReferenceNodes = currentEdges
        .filter(edge => edge.target === id)
        .map(edge => currentNodes.find(n => n.id === edge.source))
        .filter(Boolean)
        .map(sourceNode => ({
          node: sourceNode,
          url: getNodeImageUrl(sourceNode),
          role: inferSingleFrameReferenceRole(sourceNode)
        }))
        .filter(item => item.url);

      const characterRefs = incomingReferenceNodes.filter(item => item.role === 'character');
      const qualitySceneRefs = incomingReferenceNodes.filter(item => item.role === 'quality_scene');
      const explicitFrameRefs = incomingReferenceNodes.filter(item => item.role === 'frame');
      const propRefs = incomingReferenceNodes.filter(item => item.role === 'prop');

      const frameUrl = explicitFrameRefs[0]?.url || sourceImage;
      const orderedUrls = [
        ...characterRefs.map(item => item.url),
        ...qualitySceneRefs.map(item => item.url),
        frameUrl,
        ...propRefs.map(item => item.url),
      ].filter((url, index, arr) => !!url && arr.indexOf(url) === index);

      const prompt = buildSingleFrameRedrawPrompt({
        userPrompt,
        hasCharacter: characterRefs.length > 0,
        hasQualityScene: qualitySceneRefs.length > 0,
        hasProps: propRefs.length > 0
      });

      return {
        prompt,
        referenceImages: orderedUrls,
        summary: {
          character: characterRefs.length,
          qualityScene: qualitySceneRefs.length,
          frame: frameUrl ? 1 : 0,
          prop: propRefs.length
        }
      };
    };

    const promptMap: Record<string, { title: string; prompt: string; ratio?: string; resolution?: string }> = {
      'multi-angle-gen': {
        title: '多角度生成',
        prompt: `以参考图为唯一视觉基准，生成同一主体/同一场景的新角度画面。${cameraText}保持身份、服装、场景结构、材质、光影和画风一致，不添加无关元素。${payload?.usePrompt && userPrompt ? `补充要求：${userPrompt}` : ''}`,
        ratio: '16:9',
        resolution: '4K'
      },
      relight: {
        title: '打光衍生',
        prompt: `以参考图为基础，仅重新设计电影级光影与氛围，主体、构图、角色身份、服装和场景结构保持一致。${userPrompt ? `补充要求：${userPrompt}` : ''}`,
        resolution: '4K'
      },
      '9grid-multi': {
        title: '多视图网格',
        prompt: `基于参考图生成一张结构清晰的多视图网格资产图。内容包含：东向、西向、南向、北向、鸟瞰、低机位、入口视角、关键空间锚点、全景总览。所有格子必须是同一场景的连续空间推演，建筑/家具/地形/光影/画风严格一致，不能漂移，适合用于场景资产完善。${userPrompt ? `补充要求：${userPrompt}` : ''}`,
        ratio: '16:9',
        resolution: '4K'
      },
      '9grid-story': {
        title: '九宫格分镜推演',
        prompt: `以参考图为开场视觉，生成一张九宫格故事分镜图。九个画面按照从左到右、从上到下推进，包含建立镜头、人物/主体动作、冲突、转折、细节特写、结果镜头。保持角色身份、场景、色彩、光影和画风一致，每格构图有明确镜头语言。${userPrompt ? `故事方向：${userPrompt}` : ''}`,
        ratio: '1:1',
        resolution: '4K'
      },
      '9grid-character': {
        title: '角色三视图',
        prompt: `多视图角色设定图，结构化排版，严格一致性控制。根据参考图自动判断画风：如果原图写实，则生成写实摄影/真实物理世界人物；如果原图动漫或插画，则保持原图动漫/插画画风。核心布局：左侧3个大型全身视图，正面 + 背面 + 侧面，A姿势，双臂自然下垂，身体直立，人物比例严谨，解剖结构准确。右侧4格肖像矩阵，2x2排列，包含正面肖像、左侧肖像、右侧肖像、角色右眼和真实皮肤/材质微距细节。整体横向排版，左侧全身三视图，右侧肖像矩阵，布局清晰，间距均匀。所有视图人物尺度统一，对齐严格，比例完全一致。全身视图为正交视角，无透视畸变；肖像视图为标准人像机位。统一中性纯色背景，影棚级柔光，光照方向统一。所有视图必须为同一角色，面部特征、骨骼结构、体型、服装完全一致，不允许漂移。画面边缘带有清晰排版文字「人物 UID：${id}_01」。不允许姿势变化、服装变化、光影变化、背景变化、风格偏移。${userPrompt ? `补充要求：${userPrompt}` : ''}`,
        ratio: '16:9',
        resolution: '4K'
      },
      'hd-enhance': {
        title: '高清增强',
        prompt: '对参考图进行高清增强和细节修复，保持原始构图、主体、画风、色彩关系完全不变；提升分辨率、边缘清晰度、材质纹理、面部/场景细节，去除压缩噪点和模糊。',
        resolution: '4K'
      },
      'hd-expand': {
        title: '扩图结果',
        prompt: `基于参考图进行自然扩图/outpainting，向画面外延展环境和空间信息。主体比例、画风、光影和透视保持一致，新增区域必须像原图自然延伸，不改变原主体。${userPrompt ? `扩展方向：${userPrompt}` : ''}`,
        ratio: '16:9',
        resolution: '4K'
      },
      'hd-redraw': {
        title: '单帧重绘',
        prompt: buildSingleFrameReferences().prompt,
        resolution: '4K'
      },
      'hd-erase': {
        title: '擦除修复',
        prompt: `以参考图为基础进行智能擦除修复：移除画面中明显杂物、瑕疵、污点、水印感干扰或不自然元素，并用周围背景自然补全。不要改变主体身份、构图和画风。${userPrompt ? `优先处理：${userPrompt}` : ''}`,
        resolution: '4K'
      }
    };

    const config = promptMap[action];
    if (!config) return;

    const runDerivative = async () => {
      const shouldGenerateInNewNode = action === '9grid-multi';
      const pendingNodeId = shouldGenerateInNewNode ? `image-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` : '';
      try {
        const singleFrameReferences = action === 'hd-redraw' ? buildSingleFrameReferences() : undefined;
        if (shouldGenerateInNewNode) {
          const [ratioX, ratioY] = (config.ratio || '16:9').split(':').map(Number);
          const pendingWidth = 360;
          const pendingHeight = Number.isFinite(ratioX) && Number.isFinite(ratioY) && ratioX > 0 && ratioY > 0
            ? Math.round(pendingWidth * (ratioY / ratioX))
            : 240;
          const pendingNode = {
            id: pendingNodeId,
            type: 'imageNode',
            position: { x: node.position.x + 360, y: node.position.y },
            style: { width: pendingWidth, height: pendingHeight },
            data: {
              imageUrl: '',
              title: config.title,
              projectId,
              prompt: config.prompt,
              isGenerating: true,
              progressMsg: `正在生成${config.title}...`,
              aspectRatio: config.ratio || '16:9',
              requestedAspectRatio: config.ratio || '16:9',
              resolution: config.resolution || '4K',
              uiModel: String(node.data.uiModel || node.data.model || 'KONGLONG Image'),
              model: String(node.data.uiModel || node.data.model || 'KONGLONG Image'),
              onAction: handleImageAction,
              onUpload: handleNodeFileUpload,
              onGenerate: handleOpenGenerate,
              onChange: handleImageChange,
              onAddNode: addNode,
              onOpenAssets: openAssets
            },
          };
          setNodes(nds => [...nds, pendingNode]);
          setEdges(eds => [...eds, { id: `e-${id}-${pendingNodeId}`, source: id, target: pendingNodeId, animated: true, style: { stroke: '#00bcd4' } }]);
        } else {
          updateNodeData(id, 'isGenerating', true);
          updateNodeData(id, 'progressMsg', action === 'hd-redraw' ? '正在融合上游资产进行单帧重绘...' : `正在生成${config.title}...`);
        }
        const imageUrl = await runImageGeneration(
          singleFrameReferences?.prompt || config.prompt,
          undefined,
          undefined,
          config.ratio || '16:9',
          config.resolution || '4K',
          {
            workspaceProjectId: projectId,
            createdBy: currentUser || 'system',
            uiModel: String(node.data.uiModel || 'KONGLONG Image'),
            referenceImages: singleFrameReferences?.referenceImages || [sourceImage],
            nodeId: shouldGenerateInNewNode ? pendingNodeId : id
          }
        );
        if (shouldGenerateInNewNode) {
          setNodes(nds => nds.map(item => item.id === pendingNodeId ? {
            ...item,
            data: {
              ...item.data,
              imageUrl: String(imageUrl),
              isGenerating: false,
              progressMsg: ''
            }
          } : item));
        } else {
          addDerivedImageNode(String(imageUrl), config.title);
        }
        MediaHistoryService.addHistory({ type: 'image', url: String(imageUrl) });
        showToast(action === 'hd-redraw'
          ? `单帧重绘完成：人物${singleFrameReferences?.summary.character || 0}，质感/场景${singleFrameReferences?.summary.qualityScene || 0}，单帧${singleFrameReferences?.summary.frame || 0}，道具${singleFrameReferences?.summary.prop || 0}`
          : `${config.title}生成完成`
        );
      } catch (err: any) {
        console.error(err);
        if (shouldGenerateInNewNode) {
          setNodes(nds => nds.map(item => item.id === pendingNodeId ? {
            ...item,
            data: {
              ...item.data,
              isGenerating: false,
              progressMsg: `${config.title}生成失败：${err?.message || '未知错误'}`
            }
          } : item));
        }
        showToast(`${config.title}生成失败：${err?.message || '未知错误'}`);
      } finally {
        if (!shouldGenerateInNewNode) {
          updateNodeData(id, 'isGenerating', false);
          updateNodeData(id, 'progressMsg', '');
        }
      }
    };

    runDerivative();
  }, [getNodes, getEdges, setNodes, setEdges, showToast, projectId, currentUser]);

  const updateNodeData = useCallback((id: string, key: string, value: any) => {
    saveHistory('update_node', id);
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === id) {
          return { ...node, data: { ...node.data, [key]: value } };
        }
        return node;
      })
    );
  }, [setNodes]);

  const handleTextChange = useCallback((id: string, text: string) => {
    updateNodeData(id, 'text', text);
  }, [updateNodeData]);

  const handleReviewFieldChange = useCallback((id: string, field: string, value: string) => {
    updateNodeData(id, field, value);
  }, [updateNodeData]);

  const handleExportPolished = (id: string, sourceId: string, polishedText: string) => {
    let progress = 10;
    setGlobalProgress({ visible: true, text: '生成润色版文件...', progress });
    const interval = setInterval(() => {
      progress += 20;
      if (progress >= 80) clearInterval(interval);
      setGlobalProgress(prev => prev.visible ? { ...prev, progress } : prev);
    }, 200);

    setTimeout(() => {
      clearInterval(interval);
      setGlobalProgress({ visible: true, text: '输出完成！', progress: 100 });
      setTimeout(() => setGlobalProgress(prev => ({ ...prev, visible: false })), 1500);

      const newNodeId = `text-${Date.now()}`;
      setNodes(nds => {
        const node = nds.find(n => n.id === id);
        if (!node) return nds;

        const newNode = {
          id: newNodeId,
          type: 'textNode',
          position: { x: node.position.x + 400, y: node.position.y },
          style: { width: 320, height: 420 },
          data: { text: polishedText, onChange: handleTextChange, onAddNode: addNode }
        };
        return nds.map(n => ({...n, selected: false})).concat({ ...newNode, selected: true } as any);
      });
      
      setEdges(eds => eds.concat({
        id: `e-${id}-${newNodeId}`,
        source: id,
        target: newNodeId,
        type: 'animatedEdge',
        animated: true,
        style: { stroke: '#10b981', strokeWidth: 2 } // emerald-500
      }));
      showToast('输出润色版剧本成功');
    }, 1000);
  };

  const handleImageChange = useCallback((id: string, key: string, value: any) => {
    updateNodeData(id, key, value);
  }, [updateNodeData]);

  const handleContextMenuAction = useCallback((action: string) => {
    if (!menu) {
      return;
    }
    
    if (menu.type === 'selection') {
      if (action === 'delete') {
        const selectedNodes = nodes.filter(n => n.selected);
        const nodesToDelete = selectedNodes.map(n => n.id);
        if (nodesToDelete.length > 0) {
          saveHistory('delete_node');
          setNodes(nds => nds.filter(n => !nodesToDelete.includes(n.id)));
          setEdges(eds => eds.filter(e => !nodesToDelete.includes(e.source) && !nodesToDelete.includes(e.target)));
          showToast(`已删除 ${nodesToDelete.length} 个节点`);
        }
      }
      setMenu(null);
      return;
    }

    if (menu.type !== 'node') {
      setMenu(null);
      return;
    }
    const nodeId = menu.id;
    const node = nodes.find(n => n.id === nodeId);
    if (!node) {
      setMenu(null);
      return;
    }

    switch (action) {
      case 'save-asset':
        showToast('已保存到我的素材库');
        break;
      case 'enter-panorama':
        showToast('正在进入全景预览...');
        break;
      case 'create-subject':
        showToast('已提取并创建主体资源');
        break;
      case 'optimize-layout':
        showToast('工作流布局已优化');
        // Simple mock: just space out connected nodes
        break;
      case 'copy-node':
        setClipboard({ type: 'node', data: node });
        showToast('节点已复制');
        break;
      case 'copy-image':
        if (node.data?.imageUrl) {
          setClipboard({ type: 'image', data: node.data.imageUrl });
          showToast('图片资源已复制');
        } else {
          showToast('该节点没有图片');
        }
        break;
      case 'download-media': {
        const mediaUrl = node.data?.imageUrl || node.data?.videoUrl;
        if (!mediaUrl) {
          showToast('该节点没有可下载的媒体');
          break;
        }
        const isVideo = !!node.data?.videoUrl;
        const ext = inferDownloadExtension(mediaUrl, isVideo ? 'mp4' : 'png');
        const safeTitle = String(node.data?.title || (isVideo ? 'video-node' : 'image-node')).replace(/[\\/:*?"<>|]/g, '-');
        triggerMediaDownload(mediaUrl, `${safeTitle}.${ext}`)
          .then(() => showToast(isVideo ? '开始下载视频' : '开始下载图片'))
          .catch((err) => {
            console.error(err);
            showToast('下载失败：媒体源不允许直接下载，请打开后另存为');
          });
        break;
      }
      case 'add-shared-asset': {
        const mediaUrl = node.data?.imageUrl || node.data?.videoUrl;
        if (!mediaUrl) {
          showToast('该节点没有可共享的媒体');
          break;
        }
        const isVideo = !!node.data?.videoUrl;
        const title = String(node.data?.title || (isVideo ? '视频素材' : '图片素材'));
        const category = inferSharedAssetCategory(title, isVideo ? 'video' : 'image');
        groupAssetService.createAsset({
          group_id: groupId,
          project_id: projectId,
          url: mediaUrl,
          thumbnail_url: node.data?.imageUrl || undefined,
          name: title,
          type: category,
          tags: [category],
          created_by: currentUser || 'system'
        }).then(() => {
          showToast(`已添加到组内共享资产库：${category}`);
        }).catch((err) => {
          console.error(err);
          showToast('添加共享资产失败');
        });
        break;
      }
      case 'duplicate': {
        const newNodeId = node.type + '-' + Date.now();
        const cleanData = {
          ...node.data,
          isGenerating: false,
          loading: false,
          progress: 0,
          progressMsg: '',
          generationTaskId: undefined,
          providerTaskId: undefined,
          error: undefined,
          errorMessage: undefined,
          ...(node.type === 'imageNode' ? {
            aspectRatio: node.data?.aspectRatio || node.data?.requestedAspectRatio || '16:9',
            requestedAspectRatio: node.data?.requestedAspectRatio || node.data?.aspectRatio || '16:9',
            resolution: node.data?.resolution || '4K',
            uiModel: node.data?.uiModel || node.data?.model || 'KONGLONG Image',
            model: node.data?.uiModel || node.data?.model || 'KONGLONG Image'
          } : {}),
          ...(node.type === 'videoNode' ? {
            aspectRatio: node.data?.aspectRatio || '16:9',
            resolution: node.data?.resolution || '720p',
            duration: node.data?.duration || 15,
            videoModel: node.data?.videoModel || 'Seedance 2.0 VIP',
            activeTab: node.data?.activeTab || 'multi_reference',
            cleanOutputConstraints: Boolean(node.data?.cleanOutputConstraints)
          } : {})
        };
        const newNode = {
          ...node,
          id: newNodeId,
          selected: false,
          dragging: false,
          position: { x: node.position.x + 50, y: node.position.y + 50 },
          data: cleanData
        };
        const inheritedEdges = edges
          .filter(edge => edge.target === nodeId)
          .map((edge, index) => ({
            ...edge,
            id: edge.source + '-' + newNodeId + '-ref-' + Date.now() + '-' + index,
            target: newNodeId,
            selected: false
          }));
        setNodes(nds => [...nds, newNode]);
        if (inheritedEdges.length > 0) {
          setEdges(eds => [...eds, ...inheritedEdges]);
        }
        showToast(inheritedEdges.length > 0 ? '\u5df2\u521b\u5efa\u526f\u672c\uff0c\u5e76\u7ee7\u627f ' + inheritedEdges.length + ' \u6761\u4e0a\u6e38\u53c2\u8003' : '\u5df2\u521b\u5efa\u526f\u672c');
        break;
      }
      case 'paste': {
        if (clipboard) {
          if (clipboard.type === 'node') {
            const newNodeId = `${clipboard.data.type}-${Date.now()}`;
            const cleanData = {
              ...clipboard.data.data,
              isGenerating: false,
              loading: false,
              progress: 0,
              progressMsg: '',
              generationTaskId: undefined,
              providerTaskId: undefined,
              error: undefined,
              errorMessage: undefined
            };
            const newNode = {
              ...clipboard.data,
              id: newNodeId,
              selected: false,
              dragging: false,
              position: { x: node.position.x + 50, y: node.position.y + 50 },
              data: cleanData
            };
            setNodes(nds => [...nds, newNode]);
            showToast('已粘贴节点');
          } else if (clipboard.type === 'image') {
            const newNodeId = `image-${Date.now()}`;
            const newNode = {
              id: newNodeId,
              type: 'imageNode',
              position: { x: node.position.x + 50, y: node.position.y + 50 },
              style: { width: 320, height: 320 },
              data: { imageUrl: clipboard.data, onAction: handleImageAction, onUpload: handleNodeFileUpload, onGenerate: handleOpenGenerate }
            };
            setNodes(nds => [...nds, newNode]);
            showToast('已粘贴图片');
          }
        } else {
          showToast('剪贴板为空');
        }
        break;
      }
      case 'delete':
        const selectedNodes = nodes.filter(n => n.selected);
        let nodesToDelete = [nodeId];
        // If right-clicked node is part of a multiple selection, delete all selected nodes
        if (selectedNodes.length > 1 && selectedNodes.some(n => n.id === nodeId)) {
            nodesToDelete = selectedNodes.map(n => n.id);
        }
        
        saveHistory('delete_node');
        setNodes(nds => nds.filter(n => !nodesToDelete.includes(n.id)));
        setEdges(eds => eds.filter(e => !nodesToDelete.includes(e.source) && !nodesToDelete.includes(e.target)));
        showToast(nodesToDelete.length > 1 ? `已删除 ${nodesToDelete.length} 个节点` : '节点已删除');
        break;
      case 'copy-clipboard':
        const contentToCopy = node.data.imageUrl || node.data.text || node.data.content || JSON.stringify(node.data);
        navigator.clipboard.writeText(contentToCopy || '').then(() => {
          showToast('已复制到系统剪贴板');
        }).catch(() => {
          showToast('复制到剪贴板失败');
        });
        break;
      default:
        break;
    }
    setMenu(null);
  }, [menu, nodes, edges, setNodes, setEdges, showToast, setClipboard]);

  const handlePaneContextMenuAction = useCallback((action: string) => {
    if (!menu || menu.type !== 'pane') {
      setMenu(null);
      return;
    }
    if (action === 'create-text' || action === 'create-image' || action === 'create-video') {
      const position = screenToFlowPosition({ x: menu.left, y: menu.top });
      const timestamp = Date.now();
      const nodeConfig = {
        'create-text': {
          id: `textNode-${timestamp}`,
          type: 'textNode',
          style: { width: 320, height: 180 },
          data: { text: '', projectId, onChange: handleTextChange }
        },
        'create-image': {
          id: `imageNode-${timestamp}`,
          type: 'imageNode',
          style: { width: 320, height: 320 },
          data: { imageUrl: '', projectId, onAction: handleImageAction, onUpload: handleNodeFileUpload, onGenerate: handleOpenGenerate, onChange: handleImageChange, onOpenAssets: openAssets }
        },
        'create-video': {
          id: `videoNode-${timestamp}`,
          type: 'videoNode',
          style: { width: 320, height: 320 },
          data: { videoUrl: '', projectId, onUpload: handleNodeFileUpload, onOpenAssets: openAssets }
        }
      } as const;
      const config = nodeConfig[action];
      setNodes(nds => [...nds, { ...config, position } as unknown as Node]);
      showToast(action === 'create-text' ? '已新建文本节点' : action === 'create-image' ? '已新建图片节点' : '已新建视频节点');
      setMenu(null);
      return;
    }
    if (action === 'paste' && clipboard) {
      const position = screenToFlowPosition({ x: menu.left, y: menu.top });
      if (clipboard.type === 'node') {
        const newNodeId = `${clipboard.data.type}-${Date.now()}`;
        const newNode = {
          ...clipboard.data,
          id: newNodeId,
          position
        };
        setNodes(nds => [...nds, newNode]);
        showToast('已粘贴节点');
      } else if (clipboard.type === 'image') {
        const newNodeId = `image-${Date.now()}`;
        const newNode = {
          id: newNodeId,
          type: 'imageNode',
          position,
          style: { width: 320, height: 320 },
          data: { imageUrl: clipboard.data, onAction: handleImageAction, onUpload: handleNodeFileUpload, onGenerate: handleOpenGenerate }
        };
        setNodes(nds => [...nds, newNode]);
        showToast('已粘贴图片');
      }
    }
    setMenu(null);
  }, [menu, clipboard, setNodes, showToast, screenToFlowPosition, projectId, handleTextChange, handleImageAction, handleOpenGenerate, handleImageChange]);

  const runAIGeneration = useCallback(async (nodeId: string) => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();
    
    const node = currentNodes.find(n => n.id === nodeId);
    if (!node) return;

    // Find incoming edges to get input data
    const incomingEdges = currentEdges.filter(e => e.target === nodeId);
    const inputNodes = incomingEdges.map(e => currentNodes.find(n => n.id === e.source)).filter(Boolean);

    updateNodeData(nodeId, 'isGenerating', true);
    let task = null;

    try {
      if (node.data.type === 'text2image') {
        const textInput = inputNodes.find(n => n?.type === 'textNode')?.data.text as string;
        if (!textInput) throw new Error("Requires text input");
        
        task = await taskQueueManager.enqueueTask(projectId, 'image_generation', { prompt: textInput }, nodeId);
        await taskQueueManager.updateTaskStatus(projectId, task.id, 'running');
        
        const imageUrl = await runImageGeneration(textInput, undefined, undefined, '1:1', '1K', {
          workspaceProjectId: projectId,
          createdBy: currentUser || 'system'
        });
        
        if (imageUrl) {
          await taskQueueManager.updateTaskStatus(projectId, task.id, 'completed', { url: imageUrl });
          await assetManager.registerAsset(projectId, { type: 'image', url: imageUrl, name: `Generated Image ${task.id.slice(0, 4)}` });
          
          // Create a new image node connected to this AI node
          const newNodeId = `image-${Date.now()}`;
          const newNode = {
            id: newNodeId,
            type: 'imageNode',
            position: { x: node.position.x, y: node.position.y + 200 },
            style: { width: 320, height: 320 },
            data: { imageUrl, onAction: handleImageAction, onUpload: handleNodeFileUpload, onGenerate: handleOpenGenerate },
          };
          setNodes(nds => [...nds, newNode]);
          setEdges(eds => [...eds, { id: `e-${nodeId}-${newNodeId}`, source: nodeId, target: newNodeId, animated: true }]);
        } else {
          throw new Error('Image generation failed');
        }
      } else if (node.data.type === 'image2prompt') {
        const imageInput = inputNodes.find(n => n?.type === 'imageNode')?.data.imageUrl as string;
        if (!imageInput) throw new Error("Requires image input");
        
        const { data: base64Data, mimeType } = await toInlineImageParts(imageInput);
        
        const ai = getAIClient();
        const response = await ai.models.generateContent({
          model: 'gemini-3.1-pro-preview',
          contents: [
            { inlineData: { data: base64Data, mimeType } },
            "Analyze the style, composition, lighting, and subject of this image. Generate a highly detailed, comma-separated prompt that could be used to recreate this image or generate something in the exact same style. Focus on visual keywords."
          ]
        });
        
        const promptText = response.text;
        
        // Create a new text node
        const newNodeId = `text-${Date.now()}`;
        const newNode = {
          id: newNodeId,
          type: 'textNode',
          position: { x: node.position.x, y: node.position.y + 200 },
          style: { width: 320, height: 180 },
          data: { text: promptText, onChange: handleTextChange },
        };
        setNodes(nds => [...nds, newNode]);
        setEdges(eds => [...eds, { id: `e-${nodeId}-${newNodeId}`, source: nodeId, target: newNodeId, animated: true }]);
      } else if (node.data.type === 'autoStoryboard') {
        const imageInput = inputNodes.find(n => n?.type === 'imageNode')?.data.imageUrl as string;
        if (!imageInput) throw new Error("Requires image input");
        
        // Simulate storyboard generation (in reality, would call AI to generate 9 images or a grid)
        // For demonstration, we'll just create a text node describing the storyboard
        const { data: base64Data, mimeType } = await toInlineImageParts(imageInput);
        
        const ai = getAIClient();
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: [
            { inlineData: { data: base64Data, mimeType } },
            "Based on this image, generate a 9-grid storyboard description. For each of the 9 shots, describe the shot type (e.g., Close-up, Wide shot), angle, and action. Format as a numbered list 1-9."
          ]
        });
        
        const newNodeId = `text-${Date.now()}`;
        const newNode = {
          id: newNodeId,
          type: 'textNode',
          position: { x: node.position.x, y: node.position.y + 200 },
          style: { width: 320, height: 180 },
          data: { text: response.text, onChange: handleTextChange },
        };
        setNodes(nds => [...nds, newNode]);
        setEdges(eds => [...eds, { id: `e-${nodeId}-${newNodeId}`, source: nodeId, target: newNodeId, animated: true }]);
      } else if (node.data.type === 'singleFrameRepaint') {
        const imageNodes = inputNodes.filter(n => n?.type === 'imageNode');
        if (imageNodes.length === 0) throw new Error("需要连接至少一张图片节点");

        const imageItems = imageNodes
          .map(n => ({
            node: n,
            url: getNodeImageUrl(n),
            role: inferSingleFrameReferenceRole(n)
          }))
          .filter(item => item.url);

        const characterRefs = imageItems.filter(item => item.role === 'character');
        const qualitySceneRefs = imageItems.filter(item => item.role === 'quality_scene');
        const frameRefs = imageItems.filter(item => item.role === 'frame');
        const propRefs = imageItems.filter(item => item.role === 'prop');
        const fallbackFrame = [...imageItems].sort((a, b) => (b.node?.position.x || 0) - (a.node?.position.x || 0))[0];
        const frameUrl = frameRefs[0]?.url || fallbackFrame?.url;
        if (!frameUrl) throw new Error("需要至少一张可用图片作为单帧构图参考");

        const referenceImages = [
          ...characterRefs.map(item => item.url),
          ...qualitySceneRefs.map(item => item.url),
          frameUrl,
          ...propRefs.map(item => item.url)
        ].filter((url, index, arr) => !!url && arr.indexOf(url) === index);

        const repaintPrompt = buildSingleFrameRedrawPrompt({
          userPrompt: String(node.data.prompt || '').trim(),
          hasCharacter: characterRefs.length > 0,
          hasQualityScene: qualitySceneRefs.length > 0,
          hasProps: propRefs.length > 0
        });

        task = await taskQueueManager.enqueueTask(projectId, 'image_generation', {
          prompt: repaintPrompt,
          referenceRoles: imageItems.map(item => ({ nodeId: item.node?.id, role: item.role }))
        }, nodeId);
        await taskQueueManager.updateTaskStatus(projectId, task.id, 'running');
        updateNodeData(nodeId, 'progressMsg', '正在根据参考类型进行单帧重绘...');

        const imageUrl = await runImageGeneration(repaintPrompt, undefined, undefined, '16:9', '4K', {
          workspaceProjectId: projectId,
          createdBy: currentUser || 'system',
          uiModel: 'KONGLONG Image',
          referenceImages,
          imageCount: 1
        });

        await taskQueueManager.updateTaskStatus(projectId, task.id, 'completed', { url: imageUrl });
        await assetManager.registerAsset(projectId, { type: 'image', url: imageUrl, name: `单帧重绘 ${task.id.slice(0, 4)}` });
        MediaHistoryService.addHistory({ type: 'image', url: imageUrl });

        const newNodeId = `image-${Date.now()}`;
        const newNode = {
          id: newNodeId,
          type: 'imageNode',
          position: { x: node.position.x + 360, y: node.position.y },
          style: { width: 420, height: 236 },
          data: {
            imageUrl,
            title: '单帧重绘结果',
            projectId,
            prompt: repaintPrompt,
            onAction: handleImageAction,
            onGenerate: handleOpenGenerate,
            onChange: handleImageChange,
            requestedAspectRatio: '16:9',
            resolution: '4K'
          },
        };
        setNodes(nds => [...nds, newNode]);
        setEdges(eds => [...eds, { id: `e-${nodeId}-${newNodeId}`, source: nodeId, target: newNodeId, animated: true, style: { stroke: '#00bcd4' } }]);
        showToast(`单帧重绘完成：人物${characterRefs.length}，场景质感${qualitySceneRefs.length}，单帧${frameUrl ? 1 : 0}，道具${propRefs.length}`);
      }
    } catch (error: any) {
      if (task) {
        await taskQueueManager.updateTaskStatus(projectId, task.id, 'failed', undefined, error.message);
      }
      console.error("AI Generation failed:", error);
      alert(`Generation failed: ${error.message}`);
    } finally {
      updateNodeData(nodeId, 'isGenerating', false);
    }
  }, [nodes, edges, setNodes, setEdges, updateNodeData, handleTextChange, handleImageAction, handleOpenGenerate, handleImageChange, projectId, currentUser]);

  const handleNodeFileUpload = useCallback(async (nodeId: string, url: string, fileType: 'image' | 'video' | 'audio') => {
    let finalUrl = url;
    try {
      finalUrl = await ensurePublicMediaUrl(url, fileType, 0);
    } catch (error) {
      console.warn('Node media upload to public storage failed, use local preview only:', error);
      showToast('素材上传到对象存储失败：仅本次浏览器可预览，建议检查 TOS 配置');
    }
    setNodes(nds => nds.map(n => {
      if (n.id === nodeId) {
        if (fileType === 'image') return { ...n, data: { ...n.data, imageUrl: finalUrl } };
        if (fileType === 'video') return { ...n, data: { ...n.data, videoUrl: finalUrl } };
        if (fileType === 'audio') return { ...n, data: { ...n.data, audioUrl: finalUrl } };
      }
      return n;
    }));
  }, [setNodes, showToast]);


  const handleConfirmBreakdown = useCallback((nodeId: string) => {
    setNodes(nds => {
      const node = nds.find(n => n.id === nodeId);
      if (!node || !node.data.breakdown) {
        showToast('无法确认：未找到拆解数据');
        return nds;
      }
      
      const bd = node.data.breakdown;

      const generateSingleAsset = (groupId: string, itemIdx: number) => {
        setNodes(currNds => currNds.map(n => {
          if (n.id === groupId) {
            const newAssets = [...(n.data.assets || [])];
            newAssets[itemIdx] = { ...newAssets[itemIdx], isGenerating: true };
            return { ...n, data: { ...n.data, assets: newAssets } };
          }
          return n;
        }));
        setTimeout(() => {
          setNodes(currNds => currNds.map(n => {
            if (n.id === groupId) {
              const newAssets = [...(n.data.assets || [])];
              newAssets[itemIdx] = { 
                ...newAssets[itemIdx], 
                isGenerating: false,
                imageUrl: `https://images.unsplash.com/photo-${Math.floor(1500000000000 + Math.random() * 100000000000)}?auto=format&fit=crop&q=80&w=400&h=400`
              };
              return { ...n, data: { ...n.data, assets: newAssets } };
            }
            return n;
          }));
        }, 2000);
      };

      const generateAllAssets = (groupId: string) => {
        setNodes(currNds => currNds.map(n => {
          if (n.id === groupId) {
            const newAssets = (n.data.assets || []).map((a: any) => ({ ...a, isGenerating: !a.imageUrl }));
            return { ...n, data: { ...n.data, assets: newAssets } };
          }
          return n;
        }));
        setTimeout(() => {
          setNodes(currNds => currNds.map(n => {
            if (n.id === groupId) {
              const newAssets = (n.data.assets || []).map((a: any) => {
                 if (!a.imageUrl) {
                   return {
                     ...a, 
                     isGenerating: false,
                     imageUrl: `https://images.unsplash.com/photo-${Math.floor(1500000000000 + Math.random() * 100000000000)}?auto=format&fit=crop&q=80&w=400&h=400`
                   };
                 }
                 return a;
              });
              return { ...n, data: { ...n.data, assets: newAssets } };
            }
            return n;
          }));
        }, 2500);
      };

      const handleUpdateAssetDescription = (groupId: string, itemIdx: number, newDesc: string) => {
        setNodes(currNds => currNds.map(n => {
          if (n.id === groupId) {
            const newAssets = [...(n.data.assets || [])];
            newAssets[itemIdx] = { ...newAssets[itemIdx], description: newDesc };
            return { ...n, data: { ...n.data, assets: newAssets } };
          }
          return n;
        }));
      };

      const handleUpdateGroupPrompt = (groupId: string, newPrompt: string) => {
        setNodes(currNds => currNds.map(n => {
          if (n.id === groupId) {
            return { ...n, data: { ...n.data, prompt: newPrompt } };
          }
          return n;
        }));
      };

      const characters = {
        title: '人物列表',
        assets: bd.characters.map((c: any) => ({ name: c.name, description: c.appearance + ' | ' + c.role }))
      };
      const scenes = {
        title: '场次列表',
        assets: bd.scenes.map((s: any) => ({ name: `场次 ${s.sceneNo}: ${s.name}`, description: s.setting + ' · ' + s.time + ' | ' + s.events }))
      };
      const locations = {
        title: '场景列表',
        assets: bd.locations.map((l: any) => ({ name: l.name, description: l.spaceType + ' | ' + l.atmosphere }))
      };
      const props = {
        title: '道具列表',
        assets: bd.props.map((p: any) => ({ name: p.name, description: p.usage + (p.owner ? ` (归属: ${p.owner})` : '') }))
      };
      const beats = {
        title: 'Beats列表',
        assets: bd.beats.map((b: any) => ({ name: `Beat ${b.beatNo} (场次 ${b.sceneNo})`, description: b.action + ' | 情绪: ' + b.emotionChange }))
      };

      const groups = [
        { ...scenes, type: 'textOnly' }, 
        { ...characters, type: 'generative' }, 
        { ...locations, type: 'generative' }, 
        { ...props, type: 'generative' }, 
        { ...beats, type: 'textOnly' },
        { 
          title: '连贯性与风险', 
          type: 'textOnly', 
          assets: bd.continuityRisks && bd.continuityRisks.length > 0 
            ? bd.continuityRisks.map((r: string) => ({name: '风险提示', description: r})) 
            : [{name: '无重大风险', description: 'AI分析未发现明显逻辑漏洞'}] 
        }
      ];
      
      const newNodes = groups.map((g, index) => {
        const groupId = `assetGroup-${Date.now()}-${index}`;
        return {
          id: groupId,
          type: 'assetGroupNode',
          position: { x: node.position.x + 550, y: node.position.y + (index * 260) - 200 },
          data: { 
            title: g.title,
            type: g.type,
            assets: g.assets,
            onGenerateSingle: generateSingleAsset,
            onGenerateAll: generateAllAssets,
            onUpdateAssetDescription: handleUpdateAssetDescription,
            onUpdateGroupPrompt: handleUpdateGroupPrompt
          }
        };
      });

      setEdges(eds => [
        ...eds, 
        ...newNodes.map(n => ({
          id: `e-${nodeId}-${n.id}`,
          source: nodeId,
          target: n.id,
          animated: true,
          style: { stroke: '#00bcd4', strokeWidth: 2, opacity: 0.5 }
        }))
      ]);

      showToast('已确认拆解结果并生成分类面板');
      return [...nds, ...newNodes];
    });
  }, [setNodes, setEdges, showToast]);

  const handleReBreakdown = useCallback((nodeId: string) => {
    showToast('已申请重新拆解，AI 正在分析...');
    updateNodeData(nodeId, 'isGenerating', true);
    setTimeout(() => {
      showToast('重新拆解完成');
      updateNodeData(nodeId, 'isGenerating', false);
    }, 2000);
  }, [updateNodeData, showToast]);

  const openAssets = useCallback((tab: 'materials' | 'entities' = 'materials') => {
    setActiveSidebarPopover('assets');
    setAssetsTab(tab);
  }, []);

  const addNode = (type: string, aiType?: string, pos?: { x: number, y: number }, sourceNodeId?: string, extraParams?: any) => {
    const id = `${type}-${Date.now()}`;
    const sourceNode = sourceNodeId ? getNode(sourceNodeId) : null;
    let actualPosition = pos;
    if (!actualPosition) {
      if (sourceNode) {
        actualPosition = {
          x: sourceNode.position.x + (type === 'scriptNode' ? 500 : 400),
          y: sourceNode.position.y
        };
      } else {
        // Find center of current viewport using screenToFlowPosition
        if (reactFlowWrapper.current) {
          const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
          actualPosition = screenToFlowPosition({
            x: reactFlowBounds.x + reactFlowBounds.width / 2,
            y: reactFlowBounds.y + reactFlowBounds.height / 2
          });
          // Add a small random offset if multiple nodes are added to center
          actualPosition.x += Math.random() * 50 - 25;
          actualPosition.y += Math.random() * 50 - 25;
        } else {
          actualPosition = { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 };
        }
      }
    }
    const position = actualPosition;
    
    // Auto-generate script audit
    if (aiType && aiType.startsWith('script-review') && sourceNodeId) {
      const reviewTypeMap: Record<string, string> = {
        'script-review-full': 'full',
        'script-review-scene': 'scene',
        'script-review-beat': 'beat',
        'script-review-repair': 'repair'
      };
      
      const rType = reviewTypeMap[aiType] as any;
      if (!rType) return;
      
      showToast('AI 正在审核剧本...');
      updateNodeData(sourceNodeId, 'isGenerating', true);
      updateNodeData(sourceNodeId, 'generatingText', 'AI 正在审查剧本...');
      
      const sourceNode = getNode(sourceNodeId);
      const scriptText = sourceNode?.data?.text || "Unknown Script";

      let prevContext = "";
      let nextContext = "";
      let problem = extraParams?.problem || "";
      let reviewOptions = extraParams?.reviewOptions;
      
      if (rType === 'scene') {
        prevContext = prompt("请输入上一场摘要（选填/取消则为空）：") || "";
        nextContext = prompt("请输入下一场摘要（选填/取消则为空）：") || "";
      } else if (rType === 'repair' && !problem) {
        problem = prompt("请输入您发现的具体问题：") || "";
        if (!problem) {
          showToast("已取消维修");
          updateNodeData(sourceNodeId, 'isGenerating', false);
          return;
        }
      }

      setGlobalProgress({ visible: true, text: '初始化...', progress: 10 });
      setTimeout(() => {
        setGlobalProgress(prev => prev.visible ? { ...prev, text: '🎬 剧本审核中...', progress: 60 } : prev);
      }, 500);

      runScriptReview(rType as any, { 
        text: scriptText as string, 
        prevContext: prevContext as string, 
        nextContext: nextContext as string, 
        problem: problem as string, 
        reviewOptions: reviewOptions as any
      })
        .then((analysis) => {
          setGlobalProgress(prev => ({ ...prev, text: '审核完成！', progress: 100 }));
          setTimeout(() => setGlobalProgress(prev => ({ ...prev, visible: false })), 2000);
          updateNodeData(sourceNodeId, 'isGenerating', false);
          
          let resultText = "";
          let aiScript = analysis.ai_friendly_polished_script || analysis.aiReadyScript || '';
          let reviewReport = analysis.review_report || analysis.diagnostic_report || analysis.diagnosticReport || '';
          let strategy = analysis.fixing_strategy || analysis.fixingStrategy || '';
          let confirmReq = analysis.client_confirmation_required || analysis.requiresConfirmation || '无';

          if (!analysis.review_report && (reviewReport || strategy || confirmReq)) {
             reviewReport = `### 第一部分：问题诊断报告\n${reviewReport}\n\n### 第二部分：修复方案\n${strategy}\n\n### 第三部分：需甲方确认事项\n${confirmReq}`;
          }

          if (!aiScript && rType !== 'repair') {
             throw new Error("生成失败：未返回 AI 友好润色版剧本");
          }

          if (rType === 'repair') {
            resultText = `【返修对象】\n${analysis.target || ''}\n\n【问题原因】\n${analysis.problemCause || ''}\n\n【修复后文本】\n${analysis.repairedText || ''}\n\n【需确认事项】\n${confirmReq}`;
            const newNode = { 
              id, 
              type: 'textNode', 
              position: { x: position.x + 350, y: position.y }, 
              style: { width: 440, height: 600 }, 
              data: { 
                text: resultText,
                isReviewResult: true,
                sourceId: sourceNodeId,
                reviewType: rType,
                problem: problem,
                repairedText: analysis.repairedText || analysis.aiReadyScript,
                onChange: handleTextChange, 
                onAddNode: addNode,
                onApplyRepair: (origId: string, repaired: string) => {
                  setNodes(currNds => currNds.map(n => {
                    if (n.id === origId) {
                      return { ...n, data: { ...n.data, text: repaired } };
                    }
                    return n;
                  }));
                  showToast("已将修复文本应用到原节点");
                }
              } 
            };
            setNodes(nds => [...nds, newNode]);
            setEdges(eds => [...eds, {
              id: `e-${sourceNodeId}-${id}`,
              source: sourceNodeId,
              target: id,
              animated: true,
              style: { stroke: '#e11d48', strokeWidth: 2 } // rose-600
            }]);
          } else {
            const newNode = {
              id,
              type: 'reviewResultNode',
              position: { x: position.x + 350, y: position.y },
              style: { width: 440, height: 600 },
              data: {
                reviewReport,
                aiScript,
                sourceScriptId: sourceNodeId,
                reviewType: rType,
                problem: problem,
                onChangeField: handleReviewFieldChange,
                onExportPolished: handleExportPolished,
                onAddNode: addNode
              }
            };
            setNodes(nds => [...nds, newNode]);
            setEdges(eds => [...eds, {
              id: `e-${sourceNodeId}-${id}`,
              source: sourceNodeId,
              target: id,
              animated: true,
              style: { stroke: '#e11d48', strokeWidth: 2 } // rose-600
            }]);
          }

          showToast('剧本审核完成');
        })
        .catch(err => {
          setGlobalProgress(prev => ({ ...prev, visible: false }));
          updateNodeData(sourceNodeId, 'isGenerating', false);
          showToast('审核失败：' + err.message);
        });

      return;
    }

    // Auto-generate script breakdown
    if (aiType === 'director-breakdown' && sourceNodeId) {
      setGlobalProgress({ visible: true, text: 'AI 正在拆解剧本...', progress: 10 });
      
      // Simulate progress
      const interval = setInterval(() => {
        setGlobalProgress(prev => {
          if (!prev.visible) {
            clearInterval(interval);
            return prev;
          }
          const nextProgress = prev.progress + 15;
          return { ...prev, progress: nextProgress > 85 ? 85 : nextProgress };
        });
      }, 800);
      
      const sourceNode = getNode(sourceNodeId!);
      const scriptText = sourceNode?.data?.text || "Unknown Script";

      runMegaBreakdown(scriptText as string)
        .then((bd) => {
          clearInterval(interval);
          setGlobalProgress({ visible: true, text: '拆解完成！', progress: 100 });
          setTimeout(() => setGlobalProgress(prev => ({ ...prev, visible: false })), 2000);
          
          const mappedBreakdown = {
            overview: {
              title: "剧本总览",
              theme: bd.script_overview?.theme || "-",
              synopsis: bd.script_overview?.synopsis || "-",
              timePeriod: JSON.stringify(bd.script_overview?.time_space || []) || "-",
              overallMood: bd.script_overview?.tone || "-"
            },
            scenes: (bd.scenes || []).map((s: any) => ({
              sceneNo: s.scene_number || s.scene_id || "-",
              name: s.scene_name || "-",
              setting: s.interior_exterior || "-",
              time: s.time || "-",
              location: s.location_id || "-",
              characters: s.characters || [],
              events: s.key_event || "-",
              mood: s.emotion || "-",
              relation: s.previous_next_relation || "-"
            })),
            characters: (bd.characters || []).map((c: any) => ({
              name: c.name || "-",
              role: c.identity || "-",
              ageGroup: c.age_range || "-",
              appearance: c.appearance || "-",
              currentState: c.current_state || "-",
              emotionalState: c.psychology || "-",
              goal: c.goal || "-",
              relationships: JSON.stringify(c.relationships || [])
            })),
            locations: (bd.locations || []).map((l: any) => ({
              name: l.name || "-",
              spaceType: l.space_type || "-",
              spatialAnchors: JSON.stringify(l.anchors || []),
              ports: JSON.stringify(l.entrances_exits || {}),
              furniture: JSON.stringify(l.specific_components || []),
              lighting: l.lighting_atmosphere || "-",
              atmosphere: l.lighting_atmosphere || "-",
              statusChange: JSON.stringify(l.state_changes || [])
            })),
            props: (bd.props || []).map((p: any) => ({
              name: p.name || "-",
              owner: p.owner || "-",
              initPosition: p.initial_position || "-",
              appearTime: p.appearance_timing || "-",
              dropTime: p.release_timing || "-",
              usage: JSON.stringify(p.interactions || []),
              nextScene: JSON.stringify(p.scene_flow || [])
            })),
            actionChain: (bd.beats || []).map((b: any) => b.beat_summary || ""),
            beats: (bd.beats || []).map((b: any, index: number) => ({
              beatNo: index + 1,
              sceneNo: b.scene_id || "-",
              start: "Beat Start",
              end: "Beat End",
              action: JSON.stringify(b.action_chain || []),
              emotionChange: b.emotion || "-",
              visualFocus: b.visual_focus || "-",
              dialogueLoad: b.dialogue_load || "-"
            })),
            continuityRisks: (bd.continuity_risks || []).map((r: any) => 
               `[${r.risk_type}] ${r.description} (建议: ${r.suggested_fix})`
            )
          };

          const newNode = { 
            id, 
            type: 'scriptNode', 
            position, 
            style: { width: 480, height: 480 }, 
            data: { 
              breakdown: mappedBreakdown, 
              onConfirmBreakdown: handleConfirmBreakdown,
              onReBreakdown: handleReBreakdown,
              isGenerating: false,
              script: null,
              onAddNode: addNode 
            } 
          };
          
          setNodes(nds => [...nds, newNode]);
          setEdges(eds => [...eds, {
            id: `e-${sourceNodeId}-${id}`,
            source: sourceNodeId,
            target: id,
            animated: true,
            style: { stroke: '#00bcd4', strokeWidth: 2 }
          }]);
          showToast('剧本拆解完成');
        })
        .catch(err => {
          clearInterval(interval);
          setGlobalProgress({ visible: false, text: '', progress: 0 });
          showToast('拆解失败：' + err.message);
        });

      return;
    }

    // Auto-generate video from image
    if (aiType === 'generate-video' && typeof sourceNodeId === 'string') {
      showToast('AI 正在生成视频...');
      
      // We first create an empty generating video node to show some loading state
      const newNode: Node = { 
        id, 
        type: 'videoNode', 
        position: { x: position.x, y: position.y + 350 },
        style: { width: 320, height: 320 }, 
        data: { videoUrl: '', isGenerating: true, onUpload: handleNodeFileUpload, onAddNode: addNode } 
      };
      
      setNodes(nds => [...nds, newNode]);
      setEdges(eds => [...eds, {
        id: `e-${sourceNodeId}-${id}`,
        source: sourceNodeId,
        target: id,
        animated: true,
        style: { stroke: '#00bcd4', strokeWidth: 2 }
      }]);

      // Mock completion
      setTimeout(() => {
        setNodes(nds => nds.map(n => {
          if (n.id === id) {
             return {
               ...n,
               data: { 
                 ...n.data, 
                 isGenerating: false,
                 // Placeholder video URL (using a sample open source video)
                 videoUrl: 'https://vjs.zencdn.net/v/oceans.mp4' 
               }
             };
          }
          return n;
        }));
        showToast('视频生成完成');
      }, 3000);
      return;
    }

    // Auto-generate frames from script
    if (aiType === 'generate-frames' && sourceNodeId) {
      showToast('AI 正在生成画面...');
      setTimeout(() => {
        const frames = [
          { image: 'https://images.unsplash.com/photo-1542157585-ef20bfcce579?auto=format&fit=crop&q=80&w=400&h=400', title: '镜号 1' },
          { image: 'https://images.unsplash.com/photo-1590483866874-5bebc2de714f?auto=format&fit=crop&q=80&w=400&h=400', title: '镜号 2' },
          { image: 'https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?auto=format&fit=crop&q=80&w=400&h=400', title: '镜号 3' },
          { image: 'https://images.unsplash.com/photo-1517441589136-1c210518bead?auto=format&fit=crop&q=80&w=400&h=400', title: '镜号 4' }
        ];
        
        const newNodes = frames.map((frame, index) => {
          const frameId = `imageNode-${Date.now()}-${index}`;
          // Layout in a grid below the script
          const row = Math.floor(index / 2);
          const col = index % 2;
          return {
            id: frameId,
            type: 'imageNode',
            position: { x: position.x + (col * 340), y: position.y + 350 + (row * 340) },
            style: { width: 320, height: 320 },
            data: { 
              imageUrl: frame.image, 
              text: frame.title,
              onAction: handleImageAction, 
              onUpload: handleNodeFileUpload, 
              onGenerate: handleOpenGenerate, 
              onChange: handleImageChange, 
              onAddNode: addNode 
            }
          };
        });

        const newEdges = newNodes.map(node => ({
          id: `e-${sourceNodeId}-${node.id}`,
          source: sourceNodeId,
          target: node.id,
          animated: true,
          style: { stroke: '#00bcd4', strokeWidth: 2 }
        }));

        setNodes(nds => [...nds, ...newNodes]);
        setEdges(eds => [...eds, ...newEdges]);
        showToast('生成画面完成');
      }, 2000);
      return;
    }

    let newNode: Node;
    
    if (type === 'textNode') {
      newNode = { id, type, position, style: { width: 320, height: 180 }, data: { text: '', projectId, onChange: handleTextChange, onAddNode: addNode, ...extraParams } };
    } else if (type === 'imageNode') {
      newNode = { id, type, position, style: { width: extraParams?.initialWidth || 320, height: extraParams?.initialHeight || 320 }, data: { imageUrl: '', projectId, onAction: handleImageAction, onUpload: handleNodeFileUpload, onGenerate: handleOpenGenerate, onChange: handleImageChange, onAddNode: addNode, onOpenAssets: openAssets, ...extraParams } };
    } else if (type === 'videoNode') {
      newNode = { id, type, position, style: { width: extraParams?.initialWidth || 320, height: extraParams?.initialHeight || 320 }, data: { videoUrl: '', projectId, onUpload: handleNodeFileUpload, onAddNode: addNode, onOpenAssets: openAssets, ...extraParams } };
    } else if (type === 'audioNode') {
      newNode = { id, type, position, style: { width: 320, height: 140 }, data: { audioUrl: '', onUpload: handleNodeFileUpload, onAddNode: addNode, ...extraParams } };
    } else if (type === 'scriptNode') {
      newNode = { id, type, position, style: { width: 480, height: 380 }, data: { script: null, onAddNode: addNode, onConfirmBreakdown: handleConfirmBreakdown, onReBreakdown: handleReBreakdown, isGenerating: false, ...extraParams } };
    } else if (type === 'aiGenNode') {
      let title = 'AI Generation';
      let description = '';
      if (aiType === 'text2image') {
        title = 'Text to Image';
        description = 'Connect a Text Node to generate an image.';
      } else if (aiType === 'image2prompt') {
        title = 'Image to Prompt';
        description = 'Connect an Image Node to reverse-engineer its prompt.';
      } else if (aiType === 'autoStoryboard') {
        title = 'Auto Storyboard (9-Grid)';
        description = 'Connect an Image Node to generate a 9-shot storyboard.';
      } else if (aiType === 'singleFrameRepaint') {
        title = '单帧重绘';
        description = '连接多张图片节点(图A人物,图B场景,图C参考帧,图D道具)，再执行重绘';
      } else if (aiType === 'videoSynth') {
        title = '视频合成';
        description = 'Merge multiple video or audio nodes into one final composition.';
      }
      
      newNode = { 
        id, 
        type, 
        position, 
        data: { type: aiType, title, description, onRun: runAIGeneration, isGenerating: false } 
      };
    } else {
      return;
    }
    
    setNodes((nds) => nds.concat(newNode));
    if (sourceNodeId) {
      setEdges((eds) => [...eds, {
        id: `e-${sourceNodeId}-${id}`,
        source: sourceNodeId,
        target: id,
        animated: true,
        style: { stroke: '#00bcd4', strokeWidth: 1.5, opacity: 0.6 }
      }]);
    }
  };

  function hydrateRuntimeNodeData(savedNodes: any[]): Node[] {
    return savedNodes.map((node: any) => {
      const data = node.data || {};

      if (node.type === 'imageNode') {
        return {
          ...node,
          data: {
            ...data,
            projectId,
            onAction: handleImageAction,
            onUpload: handleNodeFileUpload,
            onGenerate: handleOpenGenerate,
            onChange: handleImageChange,
            onAddNode: addNode,
            onOpenAssets: openAssets
          }
        };
      }

      if (node.type === 'videoNode') {
        return {
          ...node,
          data: {
            ...data,
            projectId,
            onUpload: handleNodeFileUpload,
            onAddNode: addNode,
            onOpenAssets: openAssets
          }
        };
      }

      if (node.type === 'textNode') {
        return {
          ...node,
          data: {
            ...data,
            projectId,
            onChange: handleTextChange,
            onAddNode: addNode
          }
        };
      }

      if (node.type === 'aiGenNode') {
        return {
          ...node,
          data: {
            ...data,
            onRun: runAIGeneration
          }
        };
      }

      return node;
    });
  }

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      if (!reactFlowWrapper.current) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      const sharedAssetPayload = event.dataTransfer.getData('application/x-konglong-shared-asset');
      if (sharedAssetPayload) {
        try {
          const asset = JSON.parse(sharedAssetPayload);
          const assetUrl = asset.url || asset.thumbnail_url;
          if (!assetUrl) {
            showToast('资产缺少可用链接，无法拖入画布');
            return;
          }

          const isVideo = asset.category === '视频'
            || asset.type === 'video'
            || /\.(mp4|mov|webm)(\?|$)/i.test(assetUrl);

          if (isVideo) {
            addNode('videoNode', undefined, position, undefined, {
              videoUrl: assetUrl,
              text: asset.name || '组内共享视频',
              sharedAssetId: asset.asset_id,
              assetCategory: asset.category,
              source: 'group-shared-asset',
            });
          } else {
            addNode('imageNode', undefined, position, undefined, {
              imageUrl: assetUrl,
              text: asset.name || '组内共享图片',
              sharedAssetId: asset.asset_id,
              assetCategory: asset.category,
              source: 'group-shared-asset',
              initialWidth: 360,
              initialHeight: 240,
            });
          }
          showToast('已从组内共享资产库添加到画布');
          persistCanvasSoon();
          return;
        } catch (error) {
          console.warn('Failed to drop shared asset:', error);
          showToast('资产拖入失败');
          return;
        }
      }

      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        Array.from(event.dataTransfer.files).forEach((file, index) => {
          const offset = index * 40;
          const nodePosition = { x: position.x + offset, y: position.y + offset };
          
          if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = async (e) => {
              const localUrl = e.target?.result as string;
              let imageUrl = localUrl;
              try {
                imageUrl = await ensurePublicMediaUrl(localUrl, 'image', index);
              } catch (error) {
                console.warn('Image upload to public storage failed, use local preview only:', error);
                showToast('图片上传到对象存储失败：仅本次浏览器可预览，建议检查 TOS 配置');
              }
              const newNodeId = `image-${Date.now()}-${index}`;
              const newNode = {
                id: newNodeId,
                type: 'imageNode',
                position: nodePosition,
                style: { width: 320, height: 320 },
                data: { 
                  imageUrl,
                  onAction: handleImageAction,
                  onUpload: handleNodeFileUpload,
                  onGenerate: handleOpenGenerate
                },
              };
              setNodes((nds) => nds.concat(newNode));
              persistCanvasSoon();
              if (index === 0) showToast('图片上传成功');
            };
            reader.readAsDataURL(file);
          } else if (file.type.startsWith('video/')) {
            const reader = new FileReader();
            reader.onload = async (e) => {
              const localUrl = e.target?.result as string;
              let videoUrl = localUrl;
              try {
                videoUrl = await ensurePublicMediaUrl(localUrl, 'video', index);
              } catch (error) {
                console.warn('Video upload to public storage failed, use local preview only:', error);
                showToast('视频上传到对象存储失败：仅本次浏览器可预览，建议检查 TOS 配置');
              }
              const newNodeId = `video-${Date.now()}-${index}`;
              const newNode = {
                id: newNodeId,
                type: 'videoNode',
                position: nodePosition,
                style: { width: 320, height: 320 },
                data: { videoUrl, onUpload: handleNodeFileUpload },
              };
              setNodes((nds) => nds.concat(newNode));
              persistCanvasSoon();
              if (index === 0) showToast('视频上传成功');
            };
            reader.readAsDataURL(file);
          } else if (file.type.startsWith('audio/')) {
            const reader = new FileReader();
            reader.onload = async (e) => {
              const localUrl = e.target?.result as string;
              let audioUrl = localUrl;
              try {
                audioUrl = await ensurePublicMediaUrl(localUrl, 'audio', index);
              } catch (error) {
                console.warn('Audio upload to public storage failed, use local preview only:', error);
                showToast('音频上传到对象存储失败：仅本次浏览器可预览，建议检查 TOS 配置');
              }
              const newNodeId = `audio-${Date.now()}-${index}`;
              const newNode = {
                id: newNodeId,
                type: 'audioNode',
                position: nodePosition,
                style: { width: 320, height: 140 },
                data: { audioUrl, onUpload: handleNodeFileUpload },
              };
              setNodes((nds) => nds.concat(newNode));
              persistCanvasSoon();
              if (index === 0) showToast('音频上传成功');
            };
            reader.readAsDataURL(file);
          } else if (file.type.startsWith('text/') || file.name.endsWith('.txt') || file.name.endsWith('.md') || file.name.endsWith('.csv')) {
            const reader = new FileReader();
            reader.onload = (e) => {
              const textContent = e.target?.result as string;
              
              if (file.name.endsWith('.csv')) {
                // Determine if it's a script
                const lines = textContent.split('\n');
                if (lines.length > 1) {
                  const scriptData = lines.slice(1).map(l => {
                    const params = l.split(',');
                    return { description: params[0] || '', shotType: params[1] || '' };
                  });
                  const newNode = {
                    id: `script-${Date.now()}-${index}`,
                    type: 'scriptNode',
                    position: nodePosition,
                    style: { width: 480, height: 300 },
                    data: { script: scriptData },
                  };
                  setNodes((nds) => nds.concat(newNode));
                  persistCanvasSoon();
                  if (index === 0) showToast('脚本上传成功');
                  return;
                }
              }
              
              const newNode = {
                id: `text-${Date.now()}-${index}`,
                type: 'textNode',
                position: nodePosition,
                style: { width: 320, height: 180 },
                data: { text: textContent, onChange: handleTextChange },
              };
              setNodes((nds) => nds.concat(newNode));
              persistCanvasSoon();
              if (index === 0) showToast('文本上传成功');
            };
            reader.readAsText(file);
          }
        });
      }
    },
    [screenToFlowPosition, setNodes, handleImageAction, showToast, addNode, persistCanvasSoon]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setMenu({
        id: node.id,
        top: event.clientY,
        left: event.clientX,
        type: 'node',
        nodeType: node.type
      });
    },
    [setMenu]
  );

  const onPaneContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setMenu({
        id: 'pane',
        top: event.clientY,
        left: event.clientX,
        type: 'pane'
      });
    },
    [setMenu]
  );

  const onSelectionContextMenu = useCallback(
    (event: React.MouseEvent, selectedNodes: Node[]) => {
      event.preventDefault();
      setMenu({
        id: 'selection',
        top: event.clientY,
        left: event.clientX,
        type: 'selection'
      });
    },
    [setMenu]
  );

  const [fullscreenNodeId, setFullscreenNodeId] = useState<string | null>(null);

  const onNodeDoubleClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (node.type === 'imageNode' || node.type === 'videoNode' || node.type === 'resultNode') {
      return;
    }
    setFullscreenNodeId(node.id);
  }, []);

  const onEdgeDoubleClick = useCallback((event: React.MouseEvent, edge: Edge) => {
    event.stopPropagation();
    setEdges((eds) => eds.filter(e => e.id !== edge.id));
  }, [setEdges]);

  const onPaneClick = useCallback((event: React.MouseEvent) => {
    setMenu(null);
    if (event.detail === 2) {
      setMenu({ id: 'add-node', top: event.clientY, left: event.clientX, type: 'add-node' });
    }
  }, [setMenu]);

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: any) => {
      if (!connectionState.isValid) {
        const { clientX, clientY } = 'changedTouches' in event ? event.changedTouches[0] : event;
        setMenu({ 
          id: 'add-connected-node', 
          top: clientY, 
          left: clientX, 
          type: 'add-connected-node',
          sourceNodeId: connectionState.fromNode?.id
        } as any);
      }
    },
    [setMenu]
  );

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const activeElement = document.activeElement as HTMLElement;
      const isInputFocused = (
        target?.tagName?.toLowerCase() === 'input' || 
        target?.tagName?.toLowerCase() === 'textarea' || 
        target?.isContentEditable ||
        activeElement?.tagName?.toLowerCase() === 'input' ||
        activeElement?.tagName?.toLowerCase() === 'textarea' ||
        activeElement?.isContentEditable
      );
      
      if (isInputFocused) {
        return; // Ignore if typing to allow default browser paste / keyboard behavior
      }
      
      if ((e.metaKey || e.ctrlKey) && e.key === '0') {
        e.preventDefault();
        fitView({ duration: 800 });
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'c') {
        // Find selected node
        const selectedNode = nodes.find(n => n.selected);
        if (selectedNode) setClipboard({ type: 'node', data: selectedNode });
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'v' && clipboard) {
        if (clipboard.type === 'node') {
          const newNodeId = `${clipboard.data.type}-${Date.now()}`;
          const newNode = {
            ...clipboard.data,
            id: newNodeId,
            position: { x: clipboard.data.position.x + 50, y: clipboard.data.position.y + 50 },
            selected: true
          };
          setNodes(nds => nds.map(n => ({...n, selected: false})).concat(newNode));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [fitView, nodes, clipboard, setNodes, setClipboard]);

  return (
    <div className="w-full h-full relative bg-[#0E0F11]">
      {globalProgress.visible && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-[200] flex items-center justify-center pointer-events-none transition-all duration-300 animate-in slide-in-from-top-4 fade-in">
          <div className={`bg-[#1C1C1E]/95 border border-zinc-800/80 backdrop-blur-md rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 border-b-2 ${globalProgress.progress === 100 ? 'border-b-emerald-400' : 'border-b-[#00bcd4]'}`}>
            <div className="relative flex items-center justify-center w-6 h-6">
               {globalProgress.progress === 100 ? (
                 <CheckCircle className="text-emerald-400" size={18} />
               ) : (
                 <RefreshCw className="text-[#00bcd4] animate-spin" size={18} />
               )}
            </div>
            <div className="flex flex-col min-w-[140px]">
              <span className="text-zinc-200 text-sm font-medium">{globalProgress.text}</span>
              <div className="h-1.5 w-full bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                <div className={`h-full transition-all duration-500 rounded-full ${globalProgress.progress === 100 ? 'bg-emerald-400' : 'bg-[#00bcd4]'}`} style={{ width: `${globalProgress.progress}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Floating Top Toolbar */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[100] bg-[#111214]/80 backdrop-blur-xl border border-zinc-800/80 rounded-2xl shadow-lg flex items-center p-1.5 gap-1">
        <button onClick={() => setShowProjectSettings(true)} className="px-3 py-1.5 text-xs font-semibold text-zinc-300 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-colors">
          {settings?.project?.name || currentProjectName || '未命名项目'}
        </button>
        <div className="w-px h-5 bg-zinc-800 mx-1"></div>
        <button onClick={() => fitView({ duration: 800 })} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-colors tooltip" title="居中对齐">
          <Eye size={16} />
        </button>
        <button
          onClick={async () => {
            await handleSaveProject(nodes, edges);
            showToast('项目已手动保存');
          }}
          className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-colors tooltip"
          title="手动保存"
        >
          <Save size={16} />
        </button>
        <button onClick={() => setShowTaskQueue(true)} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-colors tooltip" title="查看任务队列">
          <ListTodo size={16} />
        </button>
        <div className="relative">
          <button onClick={(e) => { e.stopPropagation(); setShowCanvasMenu(!showCanvasMenu); }} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-colors tooltip" title="更多">
            <Settings size={16} />
          </button>
          {showCanvasMenu && (
            <div className="absolute top-full mt-2 right-0" onClick={(e) => e.stopPropagation()}>
               <CanvasMoreMenu 
                  onAction={async (actionId) => {
                    if (actionId === 'health-check') {
                      const res = await canvasHealthCheck.inspect(nodes, edges);
                      if (res.issues.length === 0) {
                        showToast(`健康检查通过 (得分 ${res.score})`);
                      } else {
                        showToast(`健康检查发现 ${res.issues.length} 个问题`);
                      }
                    } else if (actionId === 'export-json') {
                      canvasActionService.exportCurrentCanvas(projectId, nodes, edges);
                    } else if (actionId === 'view-history') {
                      setShowHistoryPanel(true);
                    } else if (actionId === 'view-queue') {
                      setShowTaskQueue(true);
                    } else if (actionId === 'view-logs') {
                       setShowActivityPanel(true);
                    }
                  }} 
                  onClose={() => setShowCanvasMenu(false)} 
                />
            </div>
          )}
        </div>
      </div>

      {/* Sidebar UI */}
      <div className="absolute top-1/2 -translate-y-1/2 left-6 z-[100] flex gap-4 pointer-events-none">
        {/* Main Icon Column */}
        <div className="bg-[#1C1C1E] border border-zinc-800/80 rounded-[20px] shadow-2xl p-2 flex flex-col gap-3 items-center w-[52px] h-fit pointer-events-auto">
          <button 
            onClick={() => setActiveSidebarPopover(p => p === 'add' ? null : 'add')} 
            className={`flex items-center justify-center w-9 h-9 rounded-xl transition-colors group relative ${activeSidebarPopover === 'add' ? 'bg-[#E5E5E5] text-black' : 'bg-[#E5E5E5] text-black hover:bg-white'}`}
          >
            <Plus size={20} strokeWidth={2.5} />
            <span className="absolute left-full ml-3 px-2 py-1 bg-[#2D2D2D] border border-zinc-700/50 text-xs text-zinc-200 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">新建节点</span>
          </button>
          
          <button className="flex items-center justify-center w-10 h-10 text-zinc-400 hover:text-white rounded-xl transition-colors group relative">
            <ClipboardPaste size={18} />
            <span className="absolute left-full ml-3 px-2 py-1 bg-[#2D2D2D] border border-zinc-700/50 text-xs text-zinc-200 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">我的工具箱</span>
          </button>

          <button 
            onClick={() => setShowHistoryPanel(true)}
            className="flex items-center justify-center w-10 h-10 text-zinc-400 hover:text-white rounded-xl transition-colors group relative"
          >
            <Clock size={18} />
            <span className="absolute left-full ml-3 px-2 py-1 bg-[#2D2D2D] border border-zinc-700/50 text-xs text-zinc-200 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">历史记录</span>
          </button>
          
          <button 
            onClick={() => setActiveSidebarPopover(p => p === 'assets' ? null : 'assets')} 
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors group relative ${activeSidebarPopover === 'assets' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/50'}`}
          >
            <Shapes size={18} />
            {activeSidebarPopover !== 'assets' && (
              <span className="absolute left-full ml-3 px-2 py-1 bg-[#2D2D2D] border border-zinc-700/50 text-xs text-zinc-200 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">我的素材</span>
            )}
          </button>

          <button 
            onClick={() => setActiveSidebarPopover(p => p === 'team-assets' ? null : 'team-assets')} 
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors group relative ${activeSidebarPopover === 'team-assets' ? 'bg-[#00bcd4]/20 text-[#00bcd4]' : 'text-[#00bcd4]/70 hover:text-[#00bcd4] hover:bg-[#00bcd4]/10'}`}
          >
            <Briefcase size={18} />
            {activeSidebarPopover !== 'team-assets' && (
              <span className="absolute left-full ml-3 px-2 py-1 bg-[#2D2D2D] border border-zinc-700/50 text-xs text-zinc-200 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">小组资产</span>
            )}
          </button>
          
          <button 
            onClick={() => setActiveSidebarPopover(p => p === 'script' ? null : 'script')} 
            className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors group relative ${activeSidebarPopover === 'script' ? 'bg-indigo-500/20 text-indigo-400' : 'text-indigo-400/70 hover:text-indigo-400 hover:bg-indigo-500/10'}`}
          >
            <List size={18} />
            {activeSidebarPopover !== 'script' && (
              <span className="absolute left-full ml-3 px-2 py-1 bg-[#2D2D2D] border border-zinc-700/50 text-xs text-zinc-200 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">剧本分镜</span>
            )}
          </button>
          
          <div className="w-6 h-px bg-zinc-800 my-1"></div>
          
          <button className="flex items-center justify-center w-10 h-10 text-zinc-400 hover:text-white hover:bg-zinc-800/50 rounded-xl transition-colors group relative">
            <HelpCircle size={18} />
            <span className="absolute left-full ml-3 px-2 py-1 bg-[#2D2D2D] border border-zinc-700/50 text-xs text-zinc-200 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity">帮助</span>
          </button>
        </div>

        {/* Add Node Popover */}
        {activeSidebarPopover === 'add' && (
          <div className="bg-[#1C1C1E] border border-zinc-800/80 rounded-[20px] shadow-2xl p-4 w-56 flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200 h-fit pointer-events-auto">
            <div>
              <h3 className="text-zinc-500 text-xs mb-2 px-2 font-medium">添加节点</h3>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => { addNode('textNode'); setActiveSidebarPopover(null); }} className="flex items-center gap-3 w-full px-2 py-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-200">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                    <AlignLeft size={14} />
                  </div>
                  <span className="text-sm">文本</span>
                </button>
                <button onClick={() => { addNode('imageNode'); setActiveSidebarPopover(null); }} className="flex items-center gap-3 w-full px-2 py-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-200">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                    <ImageIcon size={14} />
                  </div>
                  <span className="text-sm">图片</span>
                </button>
                <button onClick={() => { addNode('videoNode'); setActiveSidebarPopover(null); }} className="flex items-center gap-3 w-full px-2 py-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-200">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                    <Video size={14} />
                  </div>
                  <span className="text-sm">视频</span>
                </button>
                <button onClick={() => { addNode('audioNode'); setActiveSidebarPopover(null); }} className="flex items-center gap-3 w-full px-2 py-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-200">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                    <AudioLines size={14} />
                  </div>
                  <span className="text-sm flex-1 text-left">音频</span>
                </button>
                <button className="flex items-center gap-3 w-full px-2 py-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-200">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                    <Scissors size={14} />
                  </div>
                  <span className="text-sm flex-1 text-left">视频合成</span>
                  <span className="bg-zinc-800 text-zinc-500 text-[10px] px-1.5 py-0.5 rounded leading-none">Beta</span>
                </button>
              </div>
            </div>
            
            <div>
              <h3 className="text-zinc-500 text-xs mb-2 px-2 font-medium">添加资源</h3>
              <div className="flex flex-col gap-0.5">
                <button onClick={() => {
                   const input = document.createElement('input');
                   input.type = 'file';
                   input.accept = 'image/*';
                   input.onchange = (e: any) => {
                     const file = e.target.files?.[0];
                     if (file) {
                       const reader = new FileReader();
                       reader.onload = (ev) => {
                         const rect = reactFlowWrapper.current?.getBoundingClientRect();
                         const position = rect 
                           ? screenToFlowPosition({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }) 
                           : { x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 150 };
                         
                         const newNode = {
                           id: `image-${Date.now()}`,
                           type: 'imageNode',
                           position,
                           style: { width: 320, height: 320 },
                           data: { imageUrl: ev.target?.result, onAction: handleImageAction, onUpload: handleNodeFileUpload, onGenerate: handleOpenGenerate }
                         };
                         setNodes(nds => nds.concat(newNode));
                         showToast('上传成功');
                         setActiveSidebarPopover(null);
                       };
                       reader.readAsDataURL(file);
                     }
                   };
                   input.click();
                }} className="flex items-center gap-3 w-full px-2 py-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-200">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                    <Upload size={14} />
                  </div>
                  <span className="text-sm">上传</span>
                </button>
                <button onClick={() => {
                  setActiveSidebarPopover('assets');
                }} className="flex items-center gap-3 w-full px-2 py-2 hover:bg-zinc-800 rounded-xl transition-colors text-zinc-200">
                  <div className="w-7 h-7 rounded-lg bg-zinc-800/80 flex items-center justify-center text-zinc-400">
                    <Shapes size={14} />
                  </div>
                  <span className="text-sm">从图库选择</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* My Assets Popover */}
        {activeSidebarPopover === 'assets' && (
          <div className="bg-[#1C1C1E] border border-zinc-800/80 rounded-[20px] shadow-2xl w-[480px] h-[520px] flex flex-col animate-in fade-in zoom-in-95 duration-200 pointer-events-auto">
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-baseline gap-5 relative">
                <button 
                  onClick={() => setAssetsTab('materials')} 
                  className={`font-medium text-[15px] transition-colors relative pb-1 ${assetsTab === 'materials' ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-400'}`}
                >
                  我的素材
                  {assetsTab === 'materials' && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-zinc-200 rounded-full" />}
                </button>
                <button 
                  onClick={() => setAssetsTab('entities')} 
                  className={`font-medium text-[15px] transition-colors relative pb-1 ${assetsTab === 'entities' ? 'text-zinc-200' : 'text-zinc-500 hover:text-zinc-400'}`}
                >
                  我的主体库
                  {assetsTab === 'entities' && <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-zinc-200 rounded-full" />}
                </button>
              </div>
              <button onClick={() => setActiveSidebarPopover(null)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            
            {assetsTab === 'materials' && (
              <>
                <div className="flex items-center gap-6 px-5 pb-4 text-sm text-zinc-400 overflow-x-auto no-scrollbar border-b border-zinc-800/50">
                  {['全部', '人物', '场景', '物品', '风格', '音效', '其他'].map(cat => (
                    <button 
                      key={cat} 
                      onClick={() => setMaterialsCategory(cat)}
                      className={`shrink-0 transition-colors text-xs font-medium ${materialsCategory === cat ? 'bg-zinc-700/50 text-white px-3 py-1 rounded-md' : 'hover:text-zinc-200'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                
                <div className="flex-1 p-5 overflow-y-auto grid grid-cols-3 gap-4 custom-scrollbar">
                  {nodes.filter(n => n.type === 'imageNode' && n.data?.imageUrl).map((node, i) => (
                    <div 
                      key={node.id}
                      className="flex flex-col gap-2 group cursor-pointer relative"
                      onClick={() => {
                        const rect = reactFlowWrapper.current?.getBoundingClientRect();
                        const position = rect 
                          ? screenToFlowPosition({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }) 
                          : { x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 150 };
                        
                        addNode('imageNode', undefined, position, undefined, { imageUrl: node.data.imageUrl });
                        showToast('已添加到画布');
                        setActiveSidebarPopover(null);
                      }}
                    >
                      <div className="aspect-square bg-zinc-800 rounded-xl overflow-hidden relative border border-transparent group-hover:border-zinc-500 transition-colors">
                        <img src={node.data.imageUrl} className="w-full h-full object-cover" alt={node.data.title || "图片素材"} />
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!myEntities.some(e => e.id === node.id)) {
                              const title = node.data.title || `主体 ${myEntities.length + 1}`;
                              setMyEntities([...myEntities, { id: node.id, imageUrl: node.data.imageUrl, title, category: inferEntityCategory(title) }]);
                              showToast('已添加到我的主体库');
                            } else {
                              showToast('主体库已存在该素材');
                            }
                          }}
                          className="absolute bottom-2 right-2 p-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white opacity-0 group-hover:opacity-100 hover:bg-[#00bcd4] transition-all"
                          title="添加到主体库"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <span className="text-zinc-400 text-xs px-1 truncate">{node.data.title || '图片素材'}</span>
                    </div>
                  ))}
                  {nodes.filter(n => n.type === 'imageNode' && n.data?.imageUrl).length === 0 && (
                     <div className="col-span-3 text-center text-zinc-500 text-sm mt-10">
                       画布中暂无图片素材
                     </div>
                  )}
                </div>
              </>
            )}

            {assetsTab === 'entities' && (
              <>
                <div className="flex items-center justify-between px-5 pb-4 border-b border-zinc-800/50">
                  <div className="flex items-center gap-6 text-sm text-zinc-400 overflow-x-auto no-scrollbar">
                    {['全部', ...entityCategories].map(cat => (
                      <button 
                        key={cat} 
                        onClick={() => setEntitiesCategory(cat)}
                        className={`shrink-0 transition-colors text-xs font-medium ${entitiesCategory === cat ? 'bg-[#00bcd4]/20 text-[#00bcd4] px-3 py-1 rounded-md' : 'hover:text-zinc-200'}`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                  <label className="shrink-0 flex items-center gap-1.5 text-xs text-black bg-white hover:bg-zinc-200 px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer">
                    <Plus size={14} /> 新建主体
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={(e) => {
                         const file = e.target.files?.[0];
                         if (file) {
                           const reader = new FileReader();
                           reader.onload = (ev) => {
                              const imageUrl = ev.target?.result as string;
                              const title = file.name.replace(/\.[^/.]+$/, "") || '未命名主体';
                              setMyEntities([...myEntities, { id: `entity-${Date.now()}`, imageUrl, title, category: inferEntityCategory(title) }]);
                              showToast('已创建新主体');
                           };
                           reader.readAsDataURL(file);
                         }
                         // Reset input so the same file can be selected again
                         e.target.value = '';
                      }} 
                    />
                  </label>
                </div>

                <div className="flex-1 p-5 overflow-y-auto grid grid-cols-3 gap-4 custom-scrollbar content-start">
                  {myEntities
                    .filter(entity => entitiesCategory === '全部' || (entity.category || '其他') === entitiesCategory)
                    .map((entity) => (
                    <div 
                      key={entity.id}
                      className="flex flex-col gap-2 group cursor-pointer"
                      onClick={() => {
                        const rect = reactFlowWrapper.current?.getBoundingClientRect();
                        const position = rect 
                          ? screenToFlowPosition({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }) 
                          : { x: window.innerWidth / 2 - 150, y: window.innerHeight / 2 - 150 };
                        
                        addNode('imageNode', undefined, position, undefined, { imageUrl: entity.imageUrl, title: entity.title });
                        showToast(`已添加主体: ${entity.title}`);
                        setActiveSidebarPopover(null);
                      }}
                    >
                      <div className="aspect-square bg-zinc-800 rounded-xl overflow-hidden relative border-2 border-transparent group-hover:border-[#00bcd4] transition-colors shadow-[0_4px_12px_rgba(0,0,0,0.5)]">
                        <img src={entity.imageUrl} className="w-full h-full object-cover" alt={entity.title} />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEntityCategoryMenuId(entityCategoryMenuId === entity.id ? null : entity.id);
                          }}
                          className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/70 hover:bg-[#00bcd4]/20 backdrop-blur-md rounded text-[9px] text-[#00bcd4] font-medium border border-[#00bcd4]/30 transition-colors"
                          title="点击修改分类"
                        >
                          {entity.category || '未分类'}
                        </button>
                        {entityCategoryMenuId === entity.id && (
                          <div
                            className="absolute top-8 right-2 z-30 w-24 rounded-xl border border-zinc-700/80 bg-[#1E1E1E]/95 shadow-2xl p-1.5 flex flex-col gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {entityCategories.map(cat => (
                              <button
                                key={cat}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMyEntities(entities => entities.map(item => item.id === entity.id ? { ...item, category: cat } : item));
                                  setEntityCategoryMenuId(null);
                                  showToast(`已归类为${cat}`);
                                }}
                                className={`text-left px-2 py-1.5 rounded-lg text-xs transition-colors ${entity.category === cat ? 'bg-[#00bcd4]/20 text-[#00e5ff]' : 'text-zinc-300 hover:bg-zinc-800 hover:text-white'}`}
                              >
                                {cat}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <span className="text-zinc-300 text-xs px-1 font-medium truncate">{entity.title}</span>
                    </div>
                  ))}
                  {myEntities.filter(entity => entitiesCategory === '全部' || (entity.category || '其他') === entitiesCategory).length === 0 && (
                     <div className="col-span-3 flex flex-col items-center justify-center text-center text-zinc-500 text-sm mt-10 gap-3">
                       <div className="w-12 h-12 rounded-2xl bg-zinc-800/50 flex items-center justify-center">
                         <User size={24} className="text-zinc-600" />
                       </div>
                       <span>暂无主体资产</span>
                       <span className="text-xs text-zinc-600">从「我的素材」中添加或手动上传</span>
                     </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Team Assets Popover */}
        {activeSidebarPopover === 'team-assets' && (
          <div className="bg-[#1C1C1E] border border-zinc-800/80 rounded-[20px] shadow-2xl w-[480px] h-[600px] flex flex-col animate-in fade-in zoom-in-95 duration-200 pointer-events-auto overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
              <h2 className="text-[#00bcd4] font-medium text-[15px]">团队共享资产库</h2>
              <button onClick={() => setActiveSidebarPopover(null)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
               <SharedAssetLibrary groupId={groupId} />
            </div>
          </div>
        )}

        {/* Script & Storyboard Popover */}
        {activeSidebarPopover === 'script' && (
          <div
            className="group/script-panel relative bg-[#1C1C1E] border border-zinc-800/80 rounded-[20px] shadow-2xl flex flex-col animate-in fade-in zoom-in-95 duration-200 pointer-events-auto overflow-hidden"
            style={{ width: scriptPanelSize.width, height: scriptPanelSize.height }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
              <h2 className="text-indigo-400 font-medium text-[15px]">?????</h2>
              <button onClick={() => setActiveSidebarPopover(null)} className="text-zinc-500 hover:text-white transition-colors">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">
               <ScriptStoryboardPanel projectId={projectId} groupId={groupId} />
            </div>
            <div
              onMouseDown={handleScriptPanelResizeStart}
              title="Resize panel"
              className="absolute right-0 bottom-0 z-[80] h-9 w-9 cursor-nwse-resize opacity-0 group-hover/script-panel:opacity-100 transition-opacity"
            >
              <div className="absolute right-2 bottom-2 h-5 w-5 rounded-br-[14px] border-r-2 border-b-2 border-[#00e5ff]/70 shadow-[0_0_16px_rgba(0,229,255,0.3)]" />
            </div>
            <div
              onMouseDown={handleScriptPanelResizeStart}
              title="Resize width"
              className="absolute right-0 top-16 bottom-10 z-[70] w-2 cursor-ew-resize opacity-0 hover:opacity-100 transition-opacity bg-gradient-to-b from-transparent via-[#00e5ff]/30 to-transparent"
            />
          </div>
        )}
      </div>
      
      <div className="w-full h-full" ref={reactFlowWrapper}>
        <ReactFlow
          deleteKeyCode={['Backspace', 'Delete']}
          onNodeDragStop={(event, node) => saveHistory('move_node', node.id)}
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onPaneClick={onPaneClick}
          onPaneContextMenu={onPaneContextMenu}
          onSelectionContextMenu={onSelectionContextMenu}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDoubleClick={onNodeDoubleClick}
          onEdgeDoubleClick={onEdgeDoubleClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          connectionRadius={96}
          fitView
          className="bg-[#0E0F11]"
          selectionOnDrag={true}
          panOnDrag={[1, 2]}
          panOnScroll={true}
          selectionMode={SelectionMode.Partial}
          defaultEdgeOptions={{ 
            type: 'animated', 
            animated: true, 
            style: { stroke: 'transparent' }
          }}
        >
          <Background color="rgba(255, 255, 255, 0.1)" gap={20} size={1} variant={BackgroundVariant.Dots} />
          
          <Panel position="top-left" className="flex items-center gap-2 m-4 pointer-events-auto">
            <button
              onClick={() => navigate('/select')}
              className="px-4 py-2 bg-zinc-800/80 hover:bg-zinc-700/80 backdrop-blur-md text-zinc-300 font-medium rounded-xl shadow-lg border border-zinc-700/50 hover:border-zinc-500 transition-all flex items-center gap-2 cursor-pointer"
              title="返回系统主页"
            >
              <svg className="w-4 h-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="text-sm">主页</span>
            </button>
            <div className="flex items-center bg-zinc-800/80 backdrop-blur-md rounded-xl shadow-lg border border-zinc-700/50 p-1 mx-2">
              <button onClick={undo} disabled={!canUndo} className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors" title="撤销 (Ctrl+Z)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
              </button>
              <button onClick={redo} disabled={!canRedo} className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:text-zinc-400 transition-colors" title="重做 (Ctrl+Y)">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
              </button>
            </div>
            
            <div className="flex items-center bg-zinc-800/80 backdrop-blur-md rounded-xl shadow-lg border border-zinc-700/50 px-3 py-1.5 mx-2 min-w-[200px]">
               <svg className="w-4 h-4 text-zinc-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
               </svg>
               <input
                 type="text"
                 placeholder="搜索与筛选节点..."
                 className="bg-transparent text-sm text-white focus:outline-none w-full placeholder-zinc-500"
                 onChange={(e) => {
                    const query = e.target.value.toLowerCase();
                    setNodes(nds => nds.map(n => ({
                      ...n,
                      hidden: query ? !JSON.stringify(n).toLowerCase().includes(query) : false
                    })));
                 }}
               />
            </div>
            <div className="px-4 py-2 bg-zinc-900/50 backdrop-blur-md text-zinc-500 font-medium rounded-xl border border-zinc-800 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500/80 animate-pulse"></span>
              <span className="text-xs">
                {projectName} - {initialDataLoaded ? '已开启自动保存' : '加载中'}
              </span>
            </div>
          </Panel>

          <Controls className="bg-zinc-900 border border-zinc-800 fill-zinc-400 shadow-xl rounded-lg overflow-hidden" showInteractive={false} position="bottom-left" />
          <MiniMap 
            pannable
            zoomable
            nodeColor={(node) => {
              switch (node.type) {
                case 'textNode': return '#71717a';
                case 'imageNode': return '#00bcd4';
                case 'aiGenNode': return '#00bcd4';
                case 'resultNode': return '#22c55e';
                default: return '#eee';
              }
            }}
            className="bg-[#111214] border-zinc-800 rounded-lg overflow-hidden shadow-xl"
            maskColor="rgba(0, 0, 0, 0.8)"
            maskStrokeColor="#00bcd4"
            maskStrokeWidth={2}
            position="bottom-right"
          />
        </ReactFlow>

        {/* Context Menus */}
        {menu && menu.type === 'node' && (
          <div 
            className="fixed z-[1000] bg-[#242424] border border-zinc-800 rounded-xl shadow-2xl min-w-[220px] text-zinc-200 text-sm py-1.5 flex flex-col font-medium"
            style={{ top: menu.top, left: menu.left }}
          >
            {menu.nodeType === 'imageNode' && (
              <>
                <button className="flex items-center justify-between px-3 py-2 text-zinc-200 hover:bg-[#343434] hover:text-white text-left w-full" onClick={() => handleContextMenuAction('save-asset')}>
                  <span>保存到我的素材</span>
                </button>
                <button className="flex items-center justify-between px-3 py-2 text-zinc-200 hover:bg-[#343434] hover:text-white text-left w-full" onClick={() => handleContextMenuAction('enter-panorama')}>
                  <div className="flex items-center gap-1.5">
                    <span>进入全景预览</span>
                    <HelpCircle size={14} className="text-zinc-500" />
                  </div>
                </button>
                <button className="flex items-center justify-between px-3 py-2 text-zinc-200 hover:bg-[#343434] hover:text-white text-left w-full" onClick={() => handleContextMenuAction('create-subject')}>
                  <span>创建主体</span>
                </button>
                
                <div className="h-px bg-zinc-800/80 my-1.5 mx-3"></div>
                
                <button className="flex items-center justify-between px-3 py-2 text-zinc-200 hover:bg-[#343434] hover:text-white text-left w-full" onClick={() => handleContextMenuAction('optimize-layout')}>
                  <div className="flex items-center gap-1.5">
                    <span>优化工作流布局</span>
                    <HelpCircle size={14} className="text-zinc-500" />
                  </div>
                </button>
              </>
            )}

            <button className="flex items-center justify-between px-3 py-2 text-zinc-200 hover:bg-[#343434] hover:text-white text-left w-full" onClick={() => handleContextMenuAction('copy-node')}>
              <div className="flex items-center gap-1.5">
                <span>复制节点</span>
                <HelpCircle size={14} className="text-zinc-500" />
              </div>
              <span className="text-zinc-500 text-xs">⌘C</span>
            </button>
            <button className="flex items-center justify-between px-3 py-2 text-zinc-200 hover:bg-[#343434] hover:text-white text-left w-full" onClick={() => handleContextMenuAction('copy-image')}>
              <span>复制图片</span>
            </button>
            {(menu.nodeType === 'imageNode' || menu.nodeType === 'videoNode') && (
              <button className="flex items-center justify-between px-3 py-2 text-zinc-200 hover:bg-[#343434] hover:text-white text-left w-full" onClick={() => handleContextMenuAction('download-media')}>
                <span>{menu.nodeType === 'videoNode' ? '下载视频' : '下载图片'}</span>
              </button>
            )}
            {(menu.nodeType === 'imageNode' || menu.nodeType === 'videoNode') && (
              <button className="flex items-center justify-between px-3 py-2 text-zinc-200 hover:bg-[#343434] hover:text-white text-left w-full" onClick={() => handleContextMenuAction('add-shared-asset')}>
                <span>添加到组内共享资产库</span>
              </button>
            )}
            <button className="flex items-center justify-between px-3 py-2 text-zinc-200 hover:bg-[#343434] hover:text-white text-left w-full" onClick={() => handleContextMenuAction('duplicate')}>
              <div className="flex items-center gap-1.5">
                <span>创建副本</span>
                <HelpCircle size={14} className="text-zinc-500" />
              </div>
            </button>
            <button className="flex items-center justify-between px-3 py-2 text-zinc-200 hover:bg-[#343434] hover:text-white text-left w-full" onClick={() => handleContextMenuAction('paste')}>
              <span>粘贴</span>
              <span className="text-zinc-500 text-xs">⌘V</span>
            </button>
            <button className="flex items-center justify-between px-3 py-2 text-zinc-200 hover:bg-[#343434] hover:text-white text-left w-full" onClick={() => handleContextMenuAction('delete')}>
              <span>删除</span>
              <span className="text-zinc-500 text-xs">⌘⌫</span>
            </button>

            <div className="h-px bg-zinc-800/80 my-1.5 mx-3"></div>

            <button className="flex items-center justify-between px-3 py-2 text-zinc-200 hover:bg-[#343434] hover:text-white text-left w-full" onClick={() => handleContextMenuAction('copy-clipboard')}>
              <span>复制到剪贴板</span>
            </button>
          </div>
        )}

        {menu && menu.type === 'selection' && (
          <div 
            className="fixed z-[1000] bg-[#242424] border border-zinc-800 rounded-xl shadow-2xl min-w-[200px] py-2 flex flex-col font-medium"
            style={{ top: menu.top, left: menu.left }}
          >
            <button className="flex items-center justify-between px-4 py-2 hover:bg-[#343434] text-rose-500 text-left w-full transition-colors text-sm" onClick={() => handleContextMenuAction('delete')}>
              <span>删除选中项</span>
              <span className="text-zinc-500 text-xs text-rose-500/50">⌘⌫</span>
            </button>
          </div>
        )}

        {menu && menu.type === 'pane' && (
          <div
            className="fixed z-[1000] bg-[#242424] border border-zinc-800 rounded-xl shadow-2xl min-w-[200px] py-2 flex flex-col font-medium"
            style={{ top: menu.top, left: menu.left }}
          >
            <button className="flex items-center justify-between px-4 py-2 text-zinc-200 hover:bg-[#343434] hover:text-white text-left w-full transition-colors text-sm" onClick={() => handlePaneContextMenuAction('create-text')}>
              <span className="flex items-center gap-2"><Type size={14} />新建文本节点</span>
            </button>
            <button className="flex items-center justify-between px-4 py-2 text-zinc-200 hover:bg-[#343434] hover:text-white text-left w-full transition-colors text-sm" onClick={() => handlePaneContextMenuAction('create-image')}>
              <span className="flex items-center gap-2"><ImageIcon size={14} />新建图片节点</span>
            </button>
            <button className="flex items-center justify-between px-4 py-2 text-zinc-200 hover:bg-[#343434] hover:text-white text-left w-full transition-colors text-sm" onClick={() => handlePaneContextMenuAction('create-video')}>
              <span className="flex items-center gap-2"><Video size={14} />新建视频节点</span>
            </button>

            <div className="h-px bg-zinc-800 my-2 mx-4"></div>

            <button className="flex items-center justify-between px-4 py-2 hover:bg-[#343434] text-white text-left w-full transition-colors text-sm" onClick={() => setMenu(null)}>
              <span>上传</span>
            </button>
            <button className="flex items-center justify-between px-4 py-2 text-zinc-500 text-left w-full cursor-not-allowed text-sm" disabled>
              <span>保存到我的素材</span>
            </button>
            
            <div className="h-px bg-zinc-800 my-2 mx-4"></div>
            
            <button className="flex items-center justify-between px-4 py-2 text-zinc-300 hover:bg-[#343434] hover:text-white text-left w-full transition-colors text-sm" onClick={() => setMenu(null)}>
              <span>撤销</span>
              <span className="text-zinc-500 text-xs">⌘Z</span>
            </button>
            <button className="flex items-center justify-between px-4 py-2 text-zinc-500 text-left w-full cursor-not-allowed text-sm" disabled>
              <span>重做</span>
              <span className="text-zinc-600 text-xs">⇧⌘Z</span>
            </button>

            <div className="h-px bg-zinc-800 my-2 mx-4"></div>

            <button className="flex items-center justify-between px-4 py-2 text-zinc-300 hover:bg-[#343434] hover:text-white text-left w-full transition-colors text-sm" onClick={() => handlePaneContextMenuAction('paste')}>
              <span>粘贴</span>
              <span className="text-zinc-500 text-xs">⌘V</span>
            </button>
          </div>
        )}

        {menu && (menu.type === 'add-node' || menu.type === 'add-connected-node') && (
          <div 
            className="fixed z-[1000] bg-[#1C1C1E] border border-zinc-800/80 rounded-xl shadow-2xl p-2 w-48 flex flex-col animate-in fade-in zoom-in-95 duration-200"
            style={{ top: menu.top, left: menu.left }}
          >
            <h3 className="text-zinc-500 text-xs mb-2 px-2 pt-1 font-medium">添加节点 {menu.type === 'add-connected-node' && '(连接)'}</h3>
            <div className="flex flex-col gap-0.5">
              <button onClick={() => { addNode('textNode', undefined, screenToFlowPosition({ x: menu.left, y: menu.top }), menu.sourceNodeId); setMenu(null); }} className="flex items-center gap-3 w-full px-2 py-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-200">
                <div className="w-6 h-6 rounded-md bg-zinc-800/80 flex items-center justify-center text-zinc-400"><Type size={12} /></div>
                <span className="text-sm">文本描述</span>
              </button>
              <button onClick={() => { addNode('imageNode', undefined, screenToFlowPosition({ x: menu.left, y: menu.top }), menu.sourceNodeId); setMenu(null); }} className="flex items-center gap-3 w-full px-2 py-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-200">
                <div className="w-6 h-6 rounded-md bg-zinc-800/80 flex items-center justify-center text-zinc-400"><ImageIcon size={12} /></div>
                <span className="text-sm">视觉资产</span>
              </button>
              <button onClick={() => { addNode('videoNode', undefined, screenToFlowPosition({ x: menu.left, y: menu.top }), menu.sourceNodeId); setMenu(null); }} className="flex items-center gap-3 w-full px-2 py-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-200">
                <div className="w-6 h-6 rounded-md bg-zinc-800/80 flex items-center justify-center text-zinc-400"><Video size={12} /></div>
                <span className="text-sm">视频片段</span>
              </button>
              <button onClick={() => { addNode('audioNode', undefined, screenToFlowPosition({ x: menu.left, y: menu.top }), menu.sourceNodeId); setMenu(null); }} className="flex items-center gap-3 w-full px-2 py-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-200">
                <div className="w-6 h-6 rounded-md bg-zinc-800/80 flex items-center justify-center text-zinc-400"><AudioLines size={12} /></div>
                <span className="text-sm">音频</span>
              </button>
              <button onClick={() => { addNode('scriptNode', undefined, screenToFlowPosition({ x: menu.left, y: menu.top }), menu.sourceNodeId); setMenu(null); }} className="flex items-center gap-3 w-full px-2 py-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-200">
                <div className="w-6 h-6 rounded-md bg-zinc-800/80 flex items-center justify-center text-zinc-400"><FileText size={12} /></div>
                <span className="text-sm">脚本</span>
              </button>

              <div className="h-px bg-zinc-800/50 my-1"></div>
              
              <button onClick={() => { addNode('aiGenNode', 'text2image', screenToFlowPosition({ x: menu.left, y: menu.top }), menu.sourceNodeId); setMenu(null); }} className="flex items-center gap-3 w-full px-2 py-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-[#00bcd4]">
                <div className="w-6 h-6 rounded-md bg-[#00bcd4]/10 flex items-center justify-center"><BrainCircuit size={12} /></div>
                <span className="text-sm">图文生成</span>
              </button>
              <button onClick={() => { addNode('aiGenNode', 'autoStoryboard', screenToFlowPosition({ x: menu.left, y: menu.top }), menu.sourceNodeId); setMenu(null); }} className="flex items-center gap-3 w-full px-2 py-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-[#00bcd4]">
                <div className="w-6 h-6 rounded-md bg-[#00bcd4]/10 flex items-center justify-center"><LayoutGrid size={12} /></div>
                <span className="text-sm">智能分镜生成</span>
              </button>
              <button onClick={() => { addNode('aiGenNode', 'singleFrameRepaint', screenToFlowPosition({ x: menu.left, y: menu.top }), menu.sourceNodeId); setMenu(null); }} className="flex items-center gap-3 w-full px-2 py-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-[#00bcd4]">
                <div className="w-6 h-6 rounded-md bg-[#00bcd4]/10 flex items-center justify-center"><ImageIcon size={12} /></div>
                <span className="text-sm">单帧重绘</span>
              </button>
              {menu.type === 'add-connected-node' && (
                <button onClick={() => { addNode('aiGenNode', 'videoSynth', screenToFlowPosition({ x: menu.left, y: menu.top }), menu.sourceNodeId); setMenu(null); }} className="flex items-center gap-3 w-full px-2 py-1.5 hover:bg-zinc-800 rounded-lg transition-colors text-[#00bcd4]">
                  <div className="w-6 h-6 rounded-md bg-[#00bcd4]/10 flex items-center justify-center"><Video size={12} /></div>
                  <span className="text-sm">视频合成</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Fullscreen Node Overlay */}
      {fullscreenNodeId && (
        <div 
          className="fixed inset-0 z-[1500] bg-black/90 backdrop-blur-xl flex items-center justify-center animate-in fade-in zoom-in-95 duration-200"
          onDoubleClick={() => setFullscreenNodeId(null)}
        >
          <button 
            className="absolute top-6 right-6 p-3 bg-zinc-800 text-white rounded-xl hover:bg-zinc-700 transition-colors"
            onClick={() => setFullscreenNodeId(null)}
          >
            <X size={24} />
          </button>
          
          <div className="w-[80vw] h-[80vh] flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
            {nodes.find(n => n.id === fullscreenNodeId)?.type === 'imageNode' && (
              <img src={nodes.find(n => n.id === fullscreenNodeId)?.data?.imageUrl || undefined} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl" alt="" />
            )}
            {nodes.find(n => n.id === fullscreenNodeId)?.type === 'videoNode' && (
              <video
                src={nodes.find(n => n.id === fullscreenNodeId)?.data?.videoUrl || undefined}
                data-original-src={nodes.find(n => n.id === fullscreenNodeId)?.data?.videoUrl || undefined}
                onError={fallbackVideoToProxy}
                controls
                className="max-w-full max-h-full rounded-xl shadow-2xl"
              />
            )}
            {nodes.find(n => n.id === fullscreenNodeId)?.type === 'textNode' && (
              <div className="w-full h-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
                <textarea 
                  className="w-full h-full bg-transparent text-zinc-200 text-xl resize-none outline-none" 
                  value={nodes.find(n => n.id === fullscreenNodeId)?.data?.text || ''} 
                  readOnly 
                />
              </div>
            )}
            {nodes.find(n => n.id === fullscreenNodeId)?.type === 'scriptNode' && (
              <div className="w-full h-full bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl overflow-auto text-zinc-200 custom-scrollbar">
                {nodes.find(n => n.id === fullscreenNodeId)?.data?.breakdown ? (() => {
                  const bd = nodes.find(n => n.id === fullscreenNodeId)?.data?.breakdown;
                  return (
                    <div className="flex flex-col gap-12 max-w-4xl mx-auto pb-12">
                      <div className="text-center">
                        <h2 className="text-2xl font-bold text-[#00bcd4] mb-4">{bd.overview.title}</h2>
                        <div className="flex items-center justify-center gap-6 text-sm text-zinc-400 mb-6">
                          <span><strong className="text-zinc-500">主题:</strong> {bd.overview.theme}</span>
                          <span><strong className="text-zinc-500">基调:</strong> {bd.overview.overallMood}</span>
                          <span><strong className="text-zinc-500">时空:</strong> {bd.overview.timePeriod}</span>
                        </div>
                        <p className="text-zinc-300 bg-zinc-800/30 p-6 rounded-xl text-left border border-zinc-800/50 leading-relaxed shadow-inner">
                          {bd.overview.synopsis}
                        </p>
                      </div>

                      <div>
                        <h3 className="text-lg font-medium text-zinc-100 mb-4 pb-2 border-b border-zinc-800 flex flex-col"><span>场次列表 (Scenes)</span></h3>
                        <div className="grid gap-4">
                          {bd.scenes.map((scene, i) => (
                            <div key={i} className="bg-zinc-800/20 p-5 rounded-xl border border-zinc-800/50">
                              <div className="flex items-center justify-between mb-3 pb-3 border-b border-zinc-800/50">
                                <span className="text-[#00bcd4] font-medium text-lg">场次 {scene.sceneNo}: {scene.name}</span>
                                <span className="bg-zinc-800 px-3 py-1 rounded-full text-xs text-zinc-400">{scene.setting} · {scene.time}</span>
                              </div>
                              <div className="grid grid-cols-[80px_1fr] gap-y-3 gap-x-4 text-sm">
                                <span className="text-zinc-500">地点</span><span className="text-zinc-200">{scene.location}</span>
                                <span className="text-zinc-500">人物</span><span className="text-zinc-200">{scene.characters.join('、')}</span>
                                <span className="text-zinc-500">事件</span><span className="text-zinc-200">{scene.events}</span>
                                <span className="text-zinc-500">情绪</span><span className="text-zinc-200">{scene.mood}</span>
                                <span className="text-zinc-500">前后场</span><span className="text-zinc-400">{scene.relation}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-medium text-zinc-100 mb-4 pb-2 border-b border-zinc-800">人物列表 (Characters)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {bd.characters.map((char, i) => (
                            <div key={i} className="bg-zinc-800/20 p-5 rounded-xl border border-zinc-800/50">
                              <div className="flex items-center gap-3 mb-3 pb-3 border-b border-zinc-800/50">
                                <span className="text-lg font-medium text-zinc-100">{char.name}</span>
                                <span className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded">{char.role}</span>
                                <span className="text-xs text-zinc-500">{char.ageGroup}</span>
                              </div>
                              <div className="grid gap-y-2 text-sm">
                                <div><span className="text-zinc-500 mr-2">外观:</span><span className="text-zinc-300">{char.appearance}</span></div>
                                <div><span className="text-zinc-500 mr-2">当前状态:</span><span className="text-orange-400/80">{char.currentState}</span></div>
                                <div><span className="text-zinc-500 mr-2">情绪状态:</span><span className="text-rose-400/80">{char.emotionalState}</span></div>
                                <div><span className="text-zinc-500 mr-2">目标:</span><span className="text-emerald-400/80">{char.goal}</span></div>
                                <div><span className="text-zinc-500 mr-2">人物关系:</span><span className="text-zinc-300">{char.relationships}</span></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-medium text-zinc-100 mb-4 pb-2 border-b border-zinc-800">场景列表 (Locations)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {bd.locations.map((loc, i) => (
                            <div key={i} className="bg-zinc-800/20 p-5 rounded-xl border border-zinc-800/50">
                              <div className="text-lg font-medium text-zinc-200 mb-3 pb-3 border-b border-zinc-800/50">{loc.name}</div>
                              <div className="grid grid-cols-[80px_1fr] gap-y-2 gap-x-2 text-sm">
                                <span className="text-zinc-500">空间类型</span><span className="text-zinc-300">{loc.spaceType}</span>
                                <span className="text-zinc-500">空间锚点</span><span className="text-zinc-300">{loc.spatialAnchors}</span>
                                <span className="text-zinc-500">门窗出入</span><span className="text-zinc-300">{loc.ports}</span>
                                <span className="text-zinc-500">家具构件</span><span className="text-zinc-300">{loc.furniture}</span>
                                <span className="text-zinc-500">光线氛围</span><span className="text-zinc-300">{loc.lighting} · {loc.atmosphere}</span>
                                <span className="text-zinc-500">状态变化</span><span className="text-yellow-500/80">{loc.statusChange}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-medium text-zinc-100 mb-4 pb-2 border-b border-zinc-800">道具列表 (Props)</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {bd.props.map((prop, i) => (
                            <div key={i} className="bg-zinc-800/20 p-5 rounded-xl border border-zinc-800/50 flex flex-col gap-3">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-amber-500 text-lg">{prop.name}</span>
                                <span className="text-xs text-zinc-400 bg-zinc-800/50 px-2 py-1 rounded">归属: {prop.owner}</span>
                              </div>
                              <div className="text-sm space-y-2 text-zinc-300 bg-zinc-900/30 p-3 rounded-lg border border-zinc-800/30">
                                <div><span className="text-zinc-500 mr-2">初始位置:</span>{prop.initPosition}</div>
                                <div><span className="text-zinc-500 mr-2">出现时机:</span>{prop.appearTime}</div>
                                <div><span className="text-zinc-500 mr-2">离手时机:</span>{prop.dropTime}</div>
                                <div><span className="text-zinc-500 mr-2">使用动作:</span>{prop.usage}</div>
                                <div><span className="text-zinc-500 mr-2">进入下场:</span>{prop.nextScene ? '是' : '否 - 本场结束'}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-medium text-zinc-100 mb-4 pb-2 border-b border-zinc-800">核心动作链 (Action Chain)</h3>
                        <div className="bg-zinc-800/30 p-6 rounded-xl border border-zinc-800/50 flex flex-wrap items-center gap-3 text-[#00bcd4] font-medium text-base">
                          {bd.actionChain.map((a, i) => (
                            <React.Fragment key={i}>
                              <div className="bg-zinc-900/50 px-4 py-2 rounded-lg border border-[#00bcd4]/20 shadow-sm">{a}</div>
                              {i < bd.actionChain.length - 1 && <span className="text-zinc-600">→</span>}
                            </React.Fragment>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-medium text-zinc-100 mb-4 pb-2 border-b border-zinc-800">Beat 列表</h3>
                        <div className="space-y-4">
                          {bd.beats.map((beat, i) => (
                            <div key={i} className="bg-zinc-800/20 rounded-xl p-5 border-l-4 border-l-purple-500 border border-zinc-800/50 pl-6 relative">
                              <div className="absolute left-0 top-6 -translate-x-1/2 w-6 h-6 rounded-full bg-zinc-900 border-2 border-purple-500 flex items-center justify-center text-xs font-bold font-mono text-zinc-300 shadow-md">
                                {beat.beatNo}
                              </div>
                              <div className="text-xs text-zinc-500 mb-3">属于: 场次 {beat.sceneNo}</div>
                              <div className="flex items-center gap-3 text-sm font-medium text-zinc-200 mb-4 bg-zinc-900/50 p-3 rounded-lg border border-zinc-800/30">
                                <span>{beat.start}</span>
                                <span className="text-zinc-600">→</span>
                                <span>{beat.end}</span>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                <div className="space-y-2">
                                  <div><span className="text-zinc-500 block mb-1">主要动作</span><span className="text-zinc-200">{beat.action}</span></div>
                                  <div><span className="text-zinc-500 block mb-1">台词承载</span><span className="text-zinc-400">{beat.dialogueLoad}</span></div>
                                </div>
                                <div className="space-y-2">
                                  <div><span className="text-zinc-500 block mb-1">情绪变化</span><span className="text-rose-400/90 font-medium">{beat.emotionChange}</span></div>
                                  <div><span className="text-zinc-500 block mb-1">视觉重点</span><span className="text-[#00bcd4]">{beat.visualFocus}</span></div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-lg font-medium text-zinc-100 mb-4 pb-2 border-b border-zinc-800 text-rose-400">连贯性与风险预警</h3>
                        <div className="space-y-2 bg-rose-500/5 p-6 rounded-xl border border-rose-500/20">
                          {bd.continuityRisks.map((risk, i) => (
                            <div key={i} className="flex gap-3 items-start text-sm bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
                              <div className="text-rose-500 mt-0.5 shrink-0"><Zap size={16} /></div>
                              <span className="text-zinc-200 leading-relaxed">{risk}</span>
                            </div>
                          ))}
                          {(!bd.continuityRisks || bd.continuityRisks.length === 0) && (
                            <div className="text-zinc-500 text-center py-4">暂无发现明显连贯性风险</div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })() : (
                 <table className="w-full text-base text-left">
                  <thead className="text-zinc-500 border-b border-zinc-800">
                    <tr><th className="pb-4 font-medium w-16">镜号</th><th className="pb-4 font-medium">画面描述</th><th className="pb-4 font-medium w-32">景别</th></tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    {nodes.find(n => n.id === fullscreenNodeId)?.data?.script?.map((row, i) => (
                      <tr key={i} className="border-b border-zinc-800/50 last:border-0 hover:bg-zinc-800/30 transition-colors">
                        <td className="py-4 text-zinc-500 align-top">{i + 1}</td>
                        <td className="py-4 pr-4 align-top">{row.description}</td>
                        <td className="py-4 text-zinc-500 align-top">{row.shotType || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                 </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.visible && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[2000] bg-zinc-800 text-white px-4 py-2 rounded-xl shadow-2xl text-sm animate-in slide-in-from-bottom-5">
          {toast.message}
        </div>
      )}

      
{showHistoryPanel && <HistoryPanel projectId={projectId} onClose={() => setShowHistoryPanel(false)} />}
{showVersionPanel && <VersionPanel projectId={projectId} onClose={() => setShowVersionPanel(false)} onRestore={(state) => {
  setNodes(state.nodes);
  setEdges(state.edges);
  showToast('已恢复至历史版本');
}} />}
{showProjectSettings && <ProjectSettingsPanel projectId={projectId} onClose={() => setShowProjectSettings(false)} onSaved={handleProjectSettingsSaved} />}
{showAssetLibrary && <AssetLibrary projectId={projectId} onClose={() => setShowAssetLibrary(false)} />}
      {showTaskQueue && (
        <div className="absolute inset-0 z-[240]" onClick={() => setShowTaskQueue(false)}>
          <TaskQueuePanel projectId={projectId} onClose={() => setShowTaskQueue(false)} />
        </div>
      )}
{showActivityPanel && <ActivityPanel projectId={projectId} onClose={() => setShowActivityPanel(false)} />}
{showPromptTemplates && <PromptTemplatePanel onSelect={(t) => showToast('已选择模板: ' + t.slice(0, 10) + '...')} onClose={() => setShowPromptTemplates(false)} />}
      {/* Right Properties Panel */}
      {activeRightPanel && (
         <CapabilityPanel 
            capabilityId={activeRightPanel.type}
            initialValues={activeRightPanel.initialValues}
            onClose={() => setActiveRightPanel(null)}
            onSuccess={(url) => {
               if (activeRightPanel.nodeId) {
                  setNodes(nds => nds.map(n => {
                     if (n.id === activeRightPanel.nodeId) {
                        return { 
                           ...n, 
                           data: { 
                              ...n.data, 
                              imageUrl: activeRightPanel.type.includes('image') ? url : n.data.imageUrl, 
                              videoUrl: activeRightPanel.type.includes('video') ? url : n.data.videoUrl,
                              isGenerating: false 
                           } 
                        };
                     }
                     return n;
                  }));
               }
               setActiveRightPanel(null);
               showToast('生成成功');
            }}
         />
      )}
    </div>
  );
}

interface ProjectMeta {
  id: string;
  name: string;
  updatedAt: number;
}

function ProjectSelectionOverlay({ onSelectProject, onClose, renderTopRight }: { onSelectProject: (id: string, name: string) => void, onClose?: () => void, renderTopRight?: React.ReactNode }) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);

  const fetchProjects = React.useCallback(async () => {
    let apiProjects: ProjectMeta[] = [];
    try {
      const res = await fetch(`/api/projects`).then(r => r.json());
      if (res.success) {
        apiProjects = res.projects || [];
      }
    } catch(e) {
      console.warn('API error, fallback to local', e);
    }

    try {
      const stored = localStorage.getItem('infinite-canvas-projects');
      if (stored) {
        let parsed = JSON.parse(stored);
        if (parsed && !Array.isArray(parsed) && (parsed.nodes || parsed.edges)) {
          const migrationId = 'legacy-project';
          const newProj = { id: migrationId, name: '旧版工作区', updatedAt: Date.now() };
          localStorage.setItem(`infinite-canvas-project-${migrationId}`, stored);
          parsed = [newProj];
          localStorage.setItem('infinite-canvas-projects', JSON.stringify(parsed));
          localStorage.removeItem('infinite-canvas-workspace');
        }
        if (Array.isArray(parsed)) {
          // Merge API and local projects by ID, preferring local for this demo since backend is ephemeral
          const allProjects = [...parsed];
          for (const ap of apiProjects) {
            if (!allProjects.find(p => p.id === ap.id)) {
              allProjects.push(ap);
            }
          }
          setProjects(allProjects.sort((a, b) => b.updatedAt - a.updatedAt));
          return;
        }
      }
      
      // If we reach here, we didn't return from the stored projects block
      if (apiProjects.length > 0) {
        setProjects(apiProjects);
        return;
      }
      
      const oldStored = localStorage.getItem('infinite-canvas-workspace');
      if (oldStored) {
        const migrationId = 'legacy-project';
        const newProj = { id: migrationId, name: '旧版工作区', updatedAt: Date.now() };
        localStorage.setItem(`infinite-canvas-project-${migrationId}`, oldStored);
        localStorage.setItem('infinite-canvas-projects', JSON.stringify([newProj]));
        localStorage.removeItem('infinite-canvas-workspace');
        setProjects([newProj]);
      }
    } catch(e) {
      console.error('Failed to load projects', e);
    }
  }, []);

  React.useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreateNew = async () => {
    const newId = Date.now().toString();
    const newName = '未命名项目 ' + new Date().toLocaleString();
    const newProj: ProjectMeta = { id: newId, name: newName, updatedAt: Date.now() };
    const updatedProjects = [newProj, ...projects];
    
    try {
      await fetch(`/api/projects/${newId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, projectData: { nodes: [], edges: [] } })
      });
    } catch (err) {
      console.warn('API sync err', err);
    }
    
    setProjects(updatedProjects);
    localStorage.setItem('infinite-canvas-projects', JSON.stringify(updatedProjects));
    onSelectProject(newId, newName);
  };

  const handleProjectClick = (id: string, name: string) => {
    onSelectProject(id, name);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('确定要删除此项目吗？该操作不可恢复。')) {
       try {
         await fetch(`/api/projects/${id}`, { method: 'DELETE' });
       } catch(e) {}
      const updated = projects.filter(p => p.id !== id);
      setProjects(updated);
      localStorage.setItem('infinite-canvas-projects', JSON.stringify(updated));
      localStorage.removeItem(`infinite-canvas-project-${id}`);
      import('idb-keyval').then(({ del }) => {
        del(`infinite-canvas-project-${id}`).catch(err => console.warn(err));
      });
    }
  };

  return (
    <div className="absolute inset-0 z-[1000] bg-[#0E0F11] flex flex-col items-center justify-center animate-in fade-in duration-300 overflow-hidden w-full h-full">
      <div className="absolute top-6 right-6 z-[1010] flex items-center gap-3">
        {renderTopRight}
        {onClose && (
          <button 
            onClick={onClose}
            className="p-3 bg-[#111214]/80 backdrop-blur-xl border border-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl shadow-lg transition-all"
          >
            <X size={20} />
          </button>
        )}
      </div>

      <div className="relative z-10 bg-[#1C1C1E] border border-zinc-800 rounded-[24px] p-8 shadow-2xl w-[90%] max-w-4xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between mb-8 shrink-0 flex-wrap gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight mb-2 flex items-center gap-3">
              画布项目管理
            </h1>
            <p className="text-sm text-zinc-400">选择一个项目继续创作，或者新建一个项目。</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={handleCreateNew}
              className="px-5 py-2.5 bg-[#00bcd4] hover:bg-[#00a6bb] text-black font-semibold rounded-xl text-sm transition-all hover:-translate-y-0.5 shadow-[0_4px_20px_rgba(0,188,212,0.3)] flex items-center gap-2"
            >
              <Plus size={18} /> 新建项目
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-4">
              {projects.length === 0 ? (
                <div className="col-span-full h-full min-h-[200px] flex flex-col items-center justify-center text-zinc-500">
                  <Sparkles size={40} className="mb-4 opacity-50" />
                  <p>还没有任何项目，点击上方按钮新建一个吧！</p>
                </div>
              ) : (
                projects.map(proj => (
                  <div 
                    key={proj.id}
                    onClick={() => handleProjectClick(proj.id, proj.name)}
                    className="group relative bg-[#2A2A2E] border border-zinc-700/50 hover:border-[#00bcd4]/50 hover:bg-[#2A2A2E]/80 rounded-2xl p-5 cursor-pointer transition-all duration-300 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col justify-between min-h-[140px]"
                  >
                    <div>
                      <div className="flex items-start justify-between mb-3">
                        <h3 className="font-semibold text-zinc-200 text-lg line-clamp-1 flex-1 group-hover:text-[#00bcd4] transition-colors">{proj.name}</h3>
                        <button 
                          className="h-8 w-8 rounded-lg hover:bg-rose-500/10 flex items-center justify-center text-zinc-500 hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100 shrink-0 relative z-10" 
                          onClick={(e) => handleDelete(e, proj.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      <RotateCw size={12} />
                      更新于: {new Date(proj.updatedAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
        </div>
      </div>
    </div>
  );
}

import { GroupSelectionOverlay } from './workspace/GroupSelectionOverlay';
import { ModernProjectSelection } from './workspace/ModernProjectSelection';

export default function InfiniteCanvasWrapper({ onClose, renderTopRight, currentUser }: { onClose?: () => void, renderTopRight?: React.ReactNode, currentUser?: string }) {
  const [selectedGroup, setSelectedGroup] = useState<{id: string, name: string} | null>(null);
  const [selectedProject, setSelectedProject] = useState<{id: string, name: string} | null>(null);

  if (!selectedGroup) {
    return <GroupSelectionOverlay onSelectGroup={(id, name) => setSelectedGroup({id, name})} onClose={onClose} renderTopRight={renderTopRight} currentUser={currentUser} />;
  }

  if (!selectedProject) {
    return <ModernProjectSelection 
      groupId={selectedGroup.id}
      groupName={selectedGroup.name}
      onSelectProject={(id, name) => setSelectedProject({id, name})} 
      onBackToGroups={() => setSelectedGroup(null)}
      onClose={onClose} 
      renderTopRight={renderTopRight} 
      currentUser={currentUser}
    />;
  }

  return (
    <div className="fixed inset-0 z-[200] bg-[#0E0F11] flex flex-col animate-in fade-in duration-300">
      <div className="absolute top-6 right-6 z-[210] flex items-center gap-3">
        {onClose && (
          <button 
            onClick={onClose}
            className="p-3 bg-[#111214]/80 backdrop-blur-xl border border-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-white rounded-2xl shadow-lg transition-all"
          >
            <X size={20} />
          </button>
        )}
      </div>
      <ReactFlowProvider>
        <Canvas projectId={selectedProject.id} projectName={selectedProject.name} groupId={selectedGroup.id} groupName={selectedGroup.name} onBackToProjects={() => setSelectedProject(null)} currentUser={currentUser} onProjectRenamed={(name) => setSelectedProject(prev => prev ? { ...prev, name } : prev)} />
      </ReactFlowProvider>
    </div>
  );
}





