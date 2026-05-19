import React, { useEffect, useRef, useState } from 'react';
import { Camera, Check, Copy, Image as ImageIcon, Loader2, MessageSquare, Send, Sparkles, X } from 'lucide-react';
import Markdown from 'react-markdown';
import { PHOTOGRAPHY_PROMPT } from '../config/prompts';
import { getAIClient } from '../services/aiService';

interface PhotographyPromptGeneratorProps {
  onClose: () => void;
}

interface Message {
  role: 'user' | 'model';
  text: string;
  images?: string[];
}

const MODE_OPTIONS = [
  { value: '智能模式', label: '智能模式（输出 Prompt）' },
  { value: '直接出图模式', label: '直接出图模式（自动执行）' },
  { value: '手动模式', label: '手动模式（逐步确认）' }
];

export const PhotographyPromptGenerator: React.FC<PhotographyPromptGeneratorProps> = ({ onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [mode, setMode] = useState('智能模式');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMessages([
      {
        role: 'model',
        text: `✅ **全能摄影风格关键词已就位**\n\n我是你的专业 AI 摄影指导。请上传参考图或输入画面描述，我会帮你转化为摄影写实风格的图生视频源图 Prompt。\n\n当前模式：**${mode}**。你可以随时切换为智能模式、直接出图模式或手动模式。`
      }
    ]);
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

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

  const handleCopy = (text: string, index: number) => {
    void navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleSend = async () => {
    if (!input.trim() && images.length === 0) return;

    const userMessage: Message = {
      role: 'user',
      text: input,
      images: [...images]
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setImages([]);
    setIsGenerating(true);

    try {
      const ai = getAIClient();
      const historyParts: any[] = [];

      messages.forEach(message => {
        if (message.role === 'model' && message.text.includes('全能摄影风格关键词已就位')) return;
        if (message.text) historyParts.push({ text: message.text });
        message.images?.forEach(image => {
          const match = image.match(/^data:(.+);base64,(.*)$/);
          if (match) {
            historyParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
          }
        });
      });

      const currentParts: any[] = [];
      if (userMessage.text) currentParts.push({ text: userMessage.text });
      userMessage.images?.forEach(image => {
        const match = image.match(/^data:(.+);base64,(.*)$/);
        if (match) {
          currentParts.push({ inlineData: { mimeType: match[1], data: match[2] } });
        }
      });

      if (historyParts.length === 0 && !userMessage.text.includes('模式')) {
        currentParts.unshift({ text: `[系统指令：当前用户选择的模式是 ${mode}] ` });
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: [...historyParts, ...currentParts],
        config: {
          systemInstruction: PHOTOGRAPHY_PROMPT,
          temperature: 0.7
        }
      });

      setMessages(prev => [...prev, {
        role: 'model',
        text: response.text || '生成失败，请重试。'
      }]);
    } catch (error: any) {
      console.error('Generation failed:', error);
      setMessages(prev => [...prev, {
        role: 'model',
        text: `❌ 发生错误：${error.message || String(error)}`
      }]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex flex-col text-zinc-300">
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <Camera className="text-[#FFC107]" />
          <h2 className="text-xl font-bold text-white">全能摄影提示词生成器</h2>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-[#FFC107]"
          >
            {MODE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((message, index) => (
          <div key={index} className={`flex gap-4 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.role === 'model' && (
              <div className="w-8 h-8 rounded-full bg-[#FFC107]/20 flex items-center justify-center shrink-0">
                <Sparkles size={16} className="text-[#FFC107]" />
              </div>
            )}

            <div className={`group relative max-w-[80%] rounded-2xl p-4 ${message.role === 'user' ? 'bg-zinc-800 text-white' : 'bg-zinc-900/80 border border-zinc-800'}`}>
              <button
                onClick={() => handleCopy(message.text, index)}
                className="absolute top-2 right-2 p-1.5 rounded-md bg-zinc-950/50 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                title="复制内容"
              >
                {copiedIndex === index ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
              </button>

              {message.images && message.images.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {message.images.map((image, imageIndex) => (
                    <img key={imageIndex} src={image} alt="uploaded" className="h-32 object-contain rounded-lg border border-zinc-700 bg-black/50" />
                  ))}
                </div>
              )}
              <div className="prose prose-invert max-w-none prose-sm prose-p:leading-relaxed prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 pr-6">
                <Markdown>{message.text}</Markdown>
              </div>
            </div>

            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center shrink-0">
                <MessageSquare size={16} className="text-zinc-300" />
              </div>
            )}
          </div>
        ))}
        {isGenerating && (
          <div className="flex gap-4 justify-start">
            <div className="w-8 h-8 rounded-full bg-[#FFC107]/20 flex items-center justify-center shrink-0">
              <Loader2 size={16} className="text-[#FFC107] animate-spin" />
            </div>
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-2xl p-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" />
              <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
              <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      <div className="p-6 border-t border-zinc-800 bg-zinc-900/50">
        <div className="max-w-4xl mx-auto">
          {images.length > 0 && (
            <div className="flex gap-4 mb-4 overflow-x-auto pb-2">
              {images.map((image, index) => (
                <div key={index} className="relative shrink-0">
                  <img src={image} alt="preview" className="h-20 w-20 object-cover rounded-lg border border-zinc-700" />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors shadow-lg"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-4 items-end">
            <input
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              ref={fileInputRef}
              onChange={handleImageUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-colors border border-zinc-700 shrink-0"
              title="上传参考图"
            >
              <ImageIcon size={20} className="text-zinc-400" />
            </button>

            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="描述你想要的画面，或直接发送参考图..."
              className="flex-1 bg-zinc-900 border border-zinc-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#FFC107] resize-none min-h-[50px] max-h-[200px]"
              rows={1}
            />

            <button
              onClick={handleSend}
              disabled={isGenerating || (!input.trim() && images.length === 0)}
              className="p-3 bg-[#FFC107] hover:bg-[#e0a800] disabled:bg-zinc-800 disabled:text-zinc-600 text-black rounded-xl transition-colors shrink-0"
            >
              {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            </button>
          </div>
          <div className="text-xs text-zinc-500 mt-2 text-center">
            提示：你可以上传多张图片进行风格混合，或上传线稿进行解析。支持 Shift+Enter 换行。
          </div>
        </div>
      </div>
    </div>
  );
};
