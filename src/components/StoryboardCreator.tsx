import React, { useState, useRef } from 'react';
import { X, Upload, Image as ImageIcon, Languages, Loader2, Trash2 } from 'lucide-react';
import { analyzeImagesForScene } from '../services/aiService';

interface StoryboardCreatorProps {
  onClose: () => void;
}

const SHOT_TYPES = [
  "特写 (Extreme Close-up)",
  "近景 (Close-up)",
  "中景 (Medium Shot)",
  "全景 (Full Shot)",
  "远景 (Long Shot)",
  "极远景 (Extreme Long Shot)",
  "过肩镜头 (Over-the-shoulder)",
  "主观镜头 (POV)",
  "仰视镜头 (Low Angle)",
  "俯视镜头 (High Angle)",
  "航拍镜头 (Aerial Shot)"
];

export const StoryboardCreator: React.FC<StoryboardCreatorProps> = ({ onClose }) => {
  const [images, setImages] = useState<string[]>([]);
  const [scenePromptCN, setScenePromptCN] = useState('');
  const [scenePromptEN, setScenePromptEN] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [shots, setShots] = useState<string[]>(Array(9).fill(SHOT_TYPES[2]));
  const [finalPromptCN, setFinalPromptCN] = useState('');
  const [finalPromptEN, setFinalPromptEN] = useState('');
  const [showEnglish, setShowEnglish] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setImages(prev => [...prev, event.target!.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (images.length === 0) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeImagesForScene(images);
      setScenePromptCN(result.cn);
      setScenePromptEN(result.en);
      generateFinalPrompt(result.cn, result.en, shots);
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("分析失败，请重试。");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleShotChange = (index: number, value: string) => {
    const newShots = [...shots];
    newShots[index] = value;
    setShots(newShots);
    generateFinalPrompt(scenePromptCN, scenePromptEN, newShots);
  };

  const generateFinalPrompt = (cn: string, en: string, currentShots: string[]) => {
    if (!cn || !en) return;

    const cnPrompt = `根据[${cn}]，生成一张具有凝聚力的[3x3]网格图像，包含在同一环境中的[9]个不同摄像机镜头，严格保持人物/物体、服装和光线的一致性，[8K]分辨率，[16:9]画幅。\n` + 
      currentShots.map((shot, i) => `镜头0${i + 1}: ${shot.split(' ')[0]}`).join('\n');
      
    const enPrompt = `Based on [${en}], generate a cohesive [3x3] grid image containing [9] different camera shots in the same environment, strictly maintaining consistency of characters/objects, clothing, and lighting, [8K] resolution, [16:9] aspect ratio.\n` + 
      currentShots.map((shot, i) => `Shot 0${i + 1}: ${shot.split('(')[1].replace(')', '')}`).join('\n');

    setFinalPromptCN(cnPrompt);
    setFinalPromptEN(enPrompt);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col text-zinc-300">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <ImageIcon className="text-[#FFC107]" />
          <h2 className="text-xl font-bold text-white">分镜生成器 (参考图反推)</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
          <X size={24} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
        {/* Left Panel: Images & Scene Prompt */}
        <div className="w-full lg:w-1/3 p-6 border-r border-zinc-800 flex flex-col gap-6 overflow-y-auto">
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">1. 上传参考图</h3>
            <div 
              className="border-2 border-dashed border-zinc-700 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-[#FFC107] hover:bg-zinc-800/50 transition-all"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={32} className="text-zinc-500" />
              <div className="text-center">
                <p className="text-sm text-zinc-300 font-medium">点击上传图片</p>
                <p className="text-xs text-zinc-500 mt-1">支持多张图片，用于反推场景和人物特征</p>
              </div>
              <input 
                type="file" 
                multiple 
                accept="image/*" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleImageUpload}
              />
            </div>

            {images.length > 0 && (
              <div className="mt-4 grid grid-cols-3 gap-2">
                {images.map((img, i) => (
                  <div key={i} className="relative group aspect-square rounded-lg overflow-hidden border border-zinc-700">
                    <img src={img} alt={`Upload ${i}`} className="w-full h-full object-cover" />
                    <button 
                      onClick={() => removeImage(i)}
                      className="absolute top-1 right-1 p-1 bg-black/70 text-red-400 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <button 
              onClick={handleAnalyze}
              disabled={images.length === 0 || isAnalyzing}
              className="w-full py-3 bg-[#FFC107] hover:bg-[#e0a800] text-black font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isAnalyzing ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
              {isAnalyzing ? '正在反推提示词...' : '反推场景提示词'}
            </button>
          </div>

          {scenePromptCN && (
            <div className="flex flex-col gap-2 flex-1">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">反推结果 (场景描述)</h3>
              <textarea 
                value={showEnglish ? scenePromptEN : scenePromptCN}
                onChange={(e) => {
                  if (showEnglish) setScenePromptEN(e.target.value);
                  else setScenePromptCN(e.target.value);
                  generateFinalPrompt(showEnglish ? scenePromptCN : e.target.value, showEnglish ? e.target.value : scenePromptEN, shots);
                }}
                className="w-full flex-1 min-h-[150px] bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-sm text-zinc-300 focus:outline-none focus:border-[#FFC107] resize-none"
              />
            </div>
          )}
        </div>

        {/* Right Panel: Grid & Final Prompt */}
        <div className="w-full lg:w-2/3 p-6 flex flex-col gap-6 overflow-y-auto bg-zinc-950">
          <div>
            <h3 className="text-sm font-semibold text-zinc-400 mb-3 uppercase tracking-wider">2. 配置 3x3 分镜网格</h3>
            <div className="grid grid-cols-3 gap-4">
              {shots.map((shot, i) => (
                <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 flex flex-col gap-2">
                  <span className="text-xs text-zinc-500 font-mono">镜头 0{i + 1}</span>
                  <select 
                    value={shot}
                    onChange={(e) => handleShotChange(i, e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-700 rounded p-2 text-sm text-zinc-300 focus:outline-none focus:border-[#FFC107]"
                  >
                    {SHOT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">3. 最终生成提示词</h3>
              <button 
                onClick={() => setShowEnglish(!showEnglish)}
                className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-xs font-medium transition-colors border border-zinc-700"
              >
                <Languages size={14} />
                切换为 {showEnglish ? '中文' : 'English'}
              </button>
            </div>
            <textarea 
              readOnly
              value={showEnglish ? finalPromptEN : finalPromptCN}
              className="w-full flex-1 min-h-[200px] bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-sm text-zinc-300 focus:outline-none font-mono leading-relaxed resize-none"
              placeholder="请先上传图片并反推场景提示词..."
            />
            <button 
              onClick={() => {
                navigator.clipboard.writeText(showEnglish ? finalPromptEN : finalPromptCN);
                alert("已复制到剪贴板！");
              }}
              disabled={!finalPromptCN}
              className="w-full py-3 bg-zinc-800 hover:bg-zinc-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-zinc-700"
            >
              复制提示词
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
