import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Film, Image as ImageIcon, Loader2, Play, Settings2, ShieldCheck, X } from 'lucide-react';
import { generationRepository } from '../repositories/generationRepository';

interface VideoGeneratorProps {
  onClose: () => void;
}

export function VideoGenerator({ onClose }: VideoGeneratorProps) {
  const [prompt, setPrompt] = useState('第一人称视角果茶宣传片。首帧为参考图 1，手摘下带晨露的红苹果；随后快速切镜，将苹果块投入雪克杯，加入冰块与茶底并摇晃；最后手持成品果茶递到镜头前，背景音为清爽女生音色。');
  const [img1Url, setImg1Url] = useState('https://ark-project.tos-cn-beijing.volces.com/doc_image/r2v_tea_pic1.jpg');
  const [img2Url, setImg2Url] = useState('https://ark-project.tos-cn-beijing.volces.com/doc_image/r2v_tea_pic2.jpg');
  const [ratio, setRatio] = useState('16:9');
  const [duration, setDuration] = useState(8);

  const [isGenerating, setIsGenerating] = useState(false);
  const [providerTaskId, setProviderTaskId] = useState<string | null>(null);
  const [localTaskId, setLocalTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<string>('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('请先填写视频提示词。');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setStatus('正在提交视频生成任务...');
    setVideoUrl(null);
    setProviderTaskId(null);
    setLocalTaskId(null);

    try {
      const imageUrls = [img1Url.trim(), img2Url.trim()].filter(Boolean);
      const { result, task } = await generationRepository.submitVideo({
        prompt,
        imageUrls,
        ratio,
        duration: Number(duration),
        generateAudio: true,
        createdBy: 'system',
        metadata: {
          source: 'VideoGenerator'
        }
      });

      if (task?.id) setLocalTaskId(task.id);
      if (result.providerTaskId) setProviderTaskId(result.providerTaskId);

      if (result.status === 'succeeded' && result.url) {
        setVideoUrl(result.url);
        setStatus('视频生成完成。');
        setIsGenerating(false);
        return;
      }

      if (result.status === 'failed') {
        throw new Error(result.errorMessage || '视频生成失败。');
      }

      setStatus(result.providerTaskId ? `任务已提交：${result.providerTaskId}，正在轮询结果...` : '任务已提交，等待供应商返回任务 ID。');
    } catch (err: any) {
      setError(`提交失败：${err.message}`);
      setIsGenerating(false);
    }
  };

  useEffect(() => {
    if (!providerTaskId) return;

    const pollTask = async () => {
      try {
        const { result, task } = await generationRepository.queryVideo(providerTaskId, {
          taskId: localTaskId || undefined
        });

        if (task?.id) setLocalTaskId(task.id);

        if (result.status === 'succeeded') {
          if (result.url) {
            setVideoUrl(result.url);
            setStatus('视频生成完成。');
          } else {
            setError('视频生成完成，但没有返回可播放链接。');
          }
          setIsGenerating(false);
          setProviderTaskId(null);
          return;
        }

        if (result.status === 'failed') {
          setError(result.errorMessage || '视频生成失败。');
          setIsGenerating(false);
          setProviderTaskId(null);
          return;
        }

        setStatus(`当前状态：${result.status}，10 秒后继续查询...`);
      } catch (err: any) {
        console.error('Video polling error:', err);
        setStatus(`查询暂时失败，稍后重试：${err.message}`);
      }
    };

    const intervalId: ReturnType<typeof setInterval> = setInterval(pollTask, 10000);
    pollTask();

    return () => clearInterval(intervalId);
  }, [providerTaskId, localTaskId]);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-6 animate-in fade-in duration-300">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-6xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        <header className="p-6 border-b border-zinc-800 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <Film size={24} className="text-blue-400" />
            <div>
              <h3 className="text-xl font-bold text-white">Seedance 视频生成工作台</h3>
              <p className="text-sm text-zinc-400">通过后端 provider adapter 提交任务，API Key 只保存在服务器环境变量中。</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          <div className="w-full lg:w-1/2 p-6 overflow-y-auto border-r border-zinc-800 space-y-6">
            <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <h4 className="text-sm font-bold text-emerald-300 flex items-center gap-2">
                <ShieldCheck size={16} />
                后端安全代理
              </h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                前端不再输入或保存火山 API Key。请在服务器 <code className="text-zinc-200">.env</code> 中配置 <code className="text-zinc-200">VIDEO_API_KEY</code>。
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                <Film size={16} className="text-purple-400" />
                导演提示词
              </h4>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={8}
                placeholder="描述镜头、主体动作、参考图使用方式、音频风格等..."
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors resize-none"
              />
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                <ImageIcon size={16} className="text-green-400" />
                参考素材 URL
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">参考图 1</label>
                  <input
                    type="text"
                    value={img1Url}
                    onChange={(e) => setImg1Url(e.target.value)}
                    placeholder="填写图片 URL..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">参考图 2</label>
                  <input
                    type="text"
                    value={img2Url}
                    onChange={(e) => setImg2Url(e.target.value)}
                    placeholder="填写图片 URL..."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                <Settings2 size={16} className="text-orange-400" />
                基础参数
              </h4>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">画面比例</label>
                  <div className="flex flex-wrap gap-2">
                    {['16:9', '9:16', '21:9', '4:3', '1:1'].map(r => (
                      <button
                        key={r}
                        onClick={() => setRatio(r)}
                        className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          ratio === r
                            ? 'bg-blue-600 text-white'
                            : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-2">视频时长：{duration} 秒</label>
                  <input
                    type="range"
                    min="4"
                    max="15"
                    step="1"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={isGenerating}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-900/20"
            >
              {isGenerating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Play size={20} />
                  开始生成视频
                </>
              )}
            </button>
          </div>

          <div className="w-full lg:w-1/2 p-6 bg-zinc-950 flex flex-col">
            <h4 className="text-sm font-bold text-zinc-300 mb-4 flex items-center gap-2">
              <Film size={16} className="text-zinc-500" />
              最终成片
            </h4>

            <div className="flex-1 border border-zinc-800 rounded-xl bg-black flex items-center justify-center overflow-hidden relative min-h-[300px]">
              {videoUrl ? (
                <video src={videoUrl} controls autoPlay className="w-full h-full object-contain" />
              ) : (
                <div className="text-center text-zinc-600 flex flex-col items-center gap-3 px-8">
                  {isGenerating ? (
                    <>
                      <Loader2 size={32} className="animate-spin text-blue-500" />
                      <p className="text-sm animate-pulse">{status}</p>
                    </>
                  ) : (
                    <>
                      <Film size={48} className="opacity-20" />
                      <p className="text-sm">视频将在此处显示</p>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2">
              {status && !error && (
                <div className="flex items-center gap-2 text-sm text-zinc-400 bg-zinc-900 p-3 rounded-lg border border-zinc-800">
                  <CheckCircle2 size={16} className="text-green-500" />
                  {status}
                </div>
              )}
              {error && (
                <div className="flex items-start gap-2 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <div className="break-all">{error}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
