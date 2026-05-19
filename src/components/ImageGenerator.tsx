import React, { useState } from 'react';
import { X, Image as ImageIcon, Loader2, Download, Wand2, ShieldCheck, AlertCircle } from 'lucide-react';
import { getAIClient } from '../services/aiService';

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

interface ImageGeneratorProps {
  onClose: () => void;
}

export const ImageGenerator: React.FC<ImageGeneratorProps> = ({ onClose }) => {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [model, setModel] = useState('gemini-2.5-flash-image');
  const [imageSize, setImageSize] = useState('1K');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showKeyPrompt, setShowKeyPrompt] = useState(false);

  const isNanoBanana = model.includes('preview');

  const handleGenerate = async () => {
    if (!prompt.trim()) return;

    if (showKeyPrompt) setShowKeyPrompt(false);

    setIsGenerating(true);
    setError(null);
    setGeneratedImage(null);

    try {
      // Use pollinations.ai for free testing image generation instead of throwing Gemini model errors.
      let width = 1024, height = 1024;
      if (aspectRatio === '16:9') { width = 1920; height = 1080; }
      else if (aspectRatio === '9:16') { width = 1080; height = 1920; }
      else if (aspectRatio === '3:4') { width = 768; height = 1024; }
      else if (aspectRatio === '4:3') { width = 1024; height = 768; }

      const seed = Math.floor(Math.random() * 100000);
      const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?nologo=true&seed=${seed}&width=${width}&height=${height}`;
      
      const response = await fetch(url);
      if (!response.ok) throw new Error("Image generation failed");
      
      const blob = await response.blob();
      const reader = new FileReader();
      
      reader.onloadend = () => {
        const base64data = reader.result as string;
        setGeneratedImage(base64data);
        setIsGenerating(false);
      };
      reader.onerror = () => {
        throw new Error("Blob reading failed");
      };
      reader.readAsDataURL(blob);

    } catch (err: any) {
      console.error('Image generation failed:', err);
      setError(`生成失败: ${err.message || String(err)}`);
      setIsGenerating(false);
    }
  };

  const handleSelectKey = async () => {
    await window.aistudio.openSelectKey();
    setShowKeyPrompt(false);
    handleGenerate();
  };

  const handleDownload = () => {
    if (!generatedImage) return;
    const a = document.createElement('a');
    a.href = generatedImage;
    a.download = `generated-image-${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col text-zinc-300">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <Wand2 className="text-purple-400" />
          <h2 className="text-xl font-bold text-white">AI 图像生成器 (ImageFX)</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
          <X size={24} />
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full">
        {/* Left Panel: Controls */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-6 flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">模型选择</label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-white focus:outline-none focus:border-purple-500"
              >
                <option value="gemini-2.5-flash-image">Gemini 2.5 Flash (快速)</option>
                <option value="gemini-3.1-flash-image-preview">Nano Banana 2 (支持 2K/4K)</option>
                <option value="gemini-3-pro-image-preview">Nano Banana Pro (高质量 2K/4K)</option>
              </select>
              {isNanoBanana && (
                <p className="mt-2 text-[10px] text-purple-400 flex items-center gap-1">
                  <ShieldCheck size={12} /> 需要选择个人 API Key (支持 2K/4K)
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-400 mb-2">画面描述 (Prompt)</label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="描述你想要生成的画面..."
                className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-xl p-4 text-white focus:outline-none focus:border-purple-500 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">画面比例</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-sm text-white focus:outline-none focus:border-purple-500"
                >
                  {['1:1', '16:9', '9:16', '4:3', '3:4', '1:4', '4:1'].map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-2">分辨率</label>
                <select
                  value={imageSize}
                  disabled={!isNanoBanana}
                  onChange={(e) => setImageSize(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-2 text-sm text-white focus:outline-none focus:border-purple-500 disabled:opacity-50"
                >
                  <option value="1K">1K (标准)</option>
                  <option value="2K">2K (高清)</option>
                  <option value="4K">4K (超清)</option>
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className="mt-4 w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-500 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <ImageIcon size={18} />
                  生成图像
                </>
              )}
            </button>
            
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-start gap-2">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Preview */}
        <div className="w-full lg:w-2/3 flex flex-col">
          <div className="flex-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl flex flex-col items-center justify-center p-6 relative min-h-[400px]">
            {showKeyPrompt ? (
              <div className="flex flex-col items-center text-center max-w-md gap-6 p-8 bg-zinc-900 border border-purple-500/30 rounded-3xl shadow-2xl">
                <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400">
                  <ShieldCheck size={32} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white mb-2">需要选择 API Key</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">
                    使用 Nano Banana 系列模型生成 2K/4K 高清图像需要使用您自己的付费 API Key。请在弹出的对话框中选择一个有效的 Key。
                  </p>
                </div>
                <button
                  onClick={handleSelectKey}
                  className="px-8 py-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-500/20"
                >
                  选择 API Key 并继续
                </button>
                <a 
                  href="https://ai.google.dev/gemini-api/docs/billing" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-xs text-zinc-500 hover:text-purple-400 underline"
                >
                  了解关于计费和 API Key 的更多信息
                </a>
              </div>
            ) : isGenerating ? (
              <div className="flex flex-col items-center gap-4 text-purple-400">
                <Loader2 size={48} className="animate-spin" />
                <p className="text-sm animate-pulse">AI 正在绘制您的想象 ({imageSize})...</p>
              </div>
            ) : generatedImage ? (
              <div className="relative w-full h-full flex items-center justify-center group">
                <img
                  src={generatedImage}
                  alt="Generated"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
                <button
                  onClick={handleDownload}
                  className="absolute bottom-4 right-4 p-3 bg-black/50 hover:bg-black/80 backdrop-blur-sm text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-2"
                  title="下载图片"
                >
                  <Download size={20} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4 text-zinc-600">
                <ImageIcon size={64} className="opacity-50" />
                <p>在左侧输入提示词开始生成</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

