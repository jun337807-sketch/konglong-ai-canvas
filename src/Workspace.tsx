import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  RefreshCw, 
  FileText, 
  Clapperboard, 
  Palette, 
  LayoutTemplate,
  FolderOpen,
  Settings,
  Play,
  CheckCircle2,
  Clock,
  TerminalSquare,
  BrainCircuit,
  Layers,
  Film,
  Square,
  Download,
  FileJson,
  Trash2,
  Copy,
  Users,
  Map,
  Box,
  ImagePlus,
  Camera,
  Sparkles,
  X
} from 'lucide-react';

import { runDirectorAnalysis, runArtDesign, runStoryboarding } from './services/aiService';
import { StoryboardCreator } from './components/StoryboardCreator';
import { PhotographyPromptGenerator } from './components/PhotographyPromptGenerator';
import { ImageGenerator } from './components/ImageGenerator';
import { VideoGenerator } from './components/VideoGenerator';
import InfiniteCanvasWrapper from './components/InfiniteCanvas';

interface Log {
  id: number;
  time: string;
  source: string;
  text: string;
  color: string;
}

export default function Workspace({ onClose }: { onClose?: () => void }) {
  // Workflow State: 0 (Idle), 1 (Stage 1), 2 (Stage 2), 3 (Stage 3), 4 (Completed)
  const [stage, setStage] = useState<number>(0);
  
  // Script State
  const [scriptContent, setScriptContent] = useState<string>("");
  const [selectedScriptTitle, setSelectedScriptTitle] = useState<string>("未选择剧本");
  const [scriptSettings, setScriptSettings] = useState({
    genre: "科幻",
    style: "写实摄影",
    aspectRatio: "9:16"
  });
  const [scriptsList, setScriptsList] = useState<{
    title: string, 
    content: string,
    directorData?: any,
    artData?: any,
    storyboardData?: any,
    stage?: number,
    settings?: {
      genre: string,
      style: string,
      aspectRatio: string
    }
  }[]>([]);

  // Load scripts from localStorage on mount
  useEffect(() => {
    const savedScripts = localStorage.getItem('dinosaur_scripts');
    if (savedScripts) {
      try {
        const parsed = JSON.parse(savedScripts);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setScriptsList(parsed);
          setSelectedScriptTitle(parsed[0].title);
          setScriptContent(parsed[0].content);
          
          // Restore results for the first script
          setDirectorData(parsed[0].directorData || null);
          setArtData(parsed[0].artData || null);
          setStoryboardData(parsed[0].storyboardData || null);
          setStage(parsed[0].stage || 0);
          if (parsed[0].settings) {
            setScriptSettings(parsed[0].settings);
          }
        }
      } catch (e) {
        console.error("Failed to parse saved scripts", e);
      }
    }
  }, []);

  // Save scripts to localStorage whenever they change
  useEffect(() => {
    if (scriptsList.length > 0) {
      localStorage.setItem('dinosaur_scripts', JSON.stringify(scriptsList));
    } else {
      localStorage.removeItem('dinosaur_scripts');
    }
  }, [scriptsList]);
  
  // Analysis Options State
  const [analysisOptions, setAnalysisOptions] = useState({
    causalLoop: true,
    entityConcretization: true,
    propAndPersonTracking: true,
    safetySubstitution: true,
    spatialAnchoring: true,
    rhetoricStripping: true,
    microExpression: true
  });

  // Store AI Results
  const [directorData, setDirectorData] = useState<any>(null);
  const [artData, setArtData] = useState<any>(null);
  const [storyboardData, setStoryboardData] = useState<any>(null);
  
  // Editing State
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isConfiguring, setIsConfiguring] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [showStoryboardCreator, setShowStoryboardCreator] = useState<boolean>(false);
  const [showPhotographyPromptGenerator, setShowPhotographyPromptGenerator] = useState<boolean>(false);
  const [showImageGenerator, setShowImageGenerator] = useState<boolean>(false);
  const [showVideoGenerator, setShowVideoGenerator] = useState<boolean>(false);
  const [showInfiniteCanvas, setShowInfiniteCanvas] = useState<boolean>(false);
  const [preferredModel, setPreferredModel] = useState<string>("auto");
  const [editContent, setEditContent] = useState<string>("");
  const [editingStage, setEditingStage] = useState<number | null>(null);
  
  // Progress State
  const [progress, setProgress] = useState({
    analysis: 0,
    assets: 0,
    storyboard: 0
  });
  const [errorStage, setErrorStage] = useState<number | null>(null);

  // Real-time Timers State (in seconds)
  const [stageTimers, setStageTimers] = useState({
    analysis: 0,
    assets: 0,
    storyboard: 0
  });

  // Current Status Text
  const [statusTexts, setStatusTexts] = useState({
    analysis: '等待启动',
    assets: '等待剧本分析',
    storyboard: '等待资产确认'
  });

  // Logs State
  const [logs, setLogs] = useState<Log[]>([
    { id: 1, time: new Date().toLocaleTimeString('en-US', { hour12: false }), source: '[SYS]', text: 'Initialized Dinosaur Workbench v2.4.0', color: 'text-blue-400' },
    { id: 2, time: new Date().toLocaleTimeString('en-US', { hour12: false }), source: '[SYS]', text: 'System ready. Waiting for master control...', color: 'text-zinc-400' }
  ]);

  const consoleEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Helper to add logs
  const addLog = (source: string, text: string, color: string) => {
    setLogs(prev => [...prev, {
      id: Date.now() + Math.random(),
      time: new Date().toLocaleTimeString('en-US', { hour12: false }),
      source,
      text,
      color
    }]);
  };

  // Auto-scroll console
  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Progress & Timer Simulation Effect
  useEffect(() => {
    if (stage === 0 || stage === 4) return;

    const interval = 100; // 0.1s
    const timer = setInterval(() => {
      if (stage === 1) {
        setStageTimers(t => ({ ...t, analysis: t.analysis + interval / 1000 }));
      } else if (stage === 2) {
        setStageTimers(t => ({ ...t, assets: t.assets + interval / 1000 }));
        setProgress(p => {
          const next = p.assets + 1.2;
          if (next < 40) setStatusTexts(s => ({ ...s, assets: '正在提取角色视觉特征锚点...' }));
          else if (next < 80) setStatusTexts(s => ({ ...s, assets: '正在设计环境空间与关键道具...' }));
          return { ...p, assets: Math.min(next, 98) };
        });
      } else if (stage === 3) {
        setStageTimers(t => ({ ...t, storyboard: t.storyboard + interval / 1000 }));
        setProgress(p => {
          const next = p.storyboard + 0.5;
          if (next < 50) setStatusTexts(s => ({ ...s, storyboard: '正在进行 15s 时间轴等距切分...' }));
          else if (next < 90) setStatusTexts(s => ({ ...s, storyboard: '正在推演真人电影感分镜描述...' }));
          return { ...p, storyboard: Math.min(next, 98) };
        });
      }
    }, interval);

    return () => clearInterval(timer);
  }, [stage]);

  const startProductionPipeline = async () => {
    if (stage === 4) {
      resetWorkflow();
      return;
    }

    // Initial Start or Resume
    if (!scriptContent || scriptContent.trim() === "") {
      addLog('[SYSTEM]', '错误：剧本内容为空，请先上传或选择一个剧本。', 'text-red-500');
      alert("请先上传或选择一个剧本！");
      return;
    }

    if (stage === 0) {
      runStage1();
      return;
    }

    if (stage === 1.5) {
      runStage2();
      return;
    }

    if (stage === 2.5) {
      runStage3();
      return;
    }
  };

  const handleClearCache = () => {
    if (window.confirm("确定要清理所有缓存数据吗？这将删除所有保存的剧本和分析结果。")) {
      localStorage.clear();
      window.location.reload();
    }
  };

  const runStage1 = async () => {
    setProgress(p => ({ ...p, analysis: 0 }));
    setStageTimers(t => ({ ...t, analysis: 0 }));
    setErrorStage(null);
    setStage(1);
    addLog('[SYSTEM]', `正在准备分析剧本: ${selectedScriptTitle}...`, 'text-[#39FF14]');

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      addLog('[AGENT:DIRECTOR]', '开始运行导演分析...', 'text-blue-400');
      let result;
      // 传递选中的功能选项
      result = await runDirectorAnalysis(scriptContent, { ...analysisOptions, ...scriptSettings }, (node, text) => {
        setStatusTexts(s => ({ ...s, analysis: text }));
        setProgress(p => ({ ...p, analysis: node * 20 })); // 20, 40, 60, 80, 100
        addLog('[AGENT:DIRECTOR]', text, 'text-blue-400');
      }, preferredModel, controller.signal);
      setDirectorData(result);
      setProgress(p => ({ ...p, analysis: 100 }));
      setStatusTexts(s => ({ ...s, analysis: `分析完成，总耗时 ${stageTimers.analysis.toFixed(1)}s` }));
      setStage(1.5); // 1.5 means Stage 1 completed, waiting for review
      addLog('[SYSTEM]', '剧本分析完成。请点击上方卡片进行审核或点击“继续”进行资产提取。', 'text-[#FFC107]');
      
      // Update scriptsList for persistence
      setScriptsList(prev => prev.map(s => 
        s.title === selectedScriptTitle 
          ? { ...s, directorData: result, stage: 1.5 } 
          : s
      ));
    } catch (error: any) {
      if (error.message === "Task cancelled by user") {
        addLog('[SYSTEM]', '任务已被用户停止。', 'text-yellow-500');
      } else {
        addLog('[ERROR]', `导演分析失败: ${error?.message || String(error)}`, 'text-red-500');
      }
      setStatusTexts(s => ({ ...s, analysis: error.message === "Task cancelled by user" ? '已停止' : '分析中断' }));
      setStage(0);
      setErrorStage(1);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const runStage2 = async () => {
    setStage(2);
    setProgress(p => ({ ...p, assets: 0 }));
    setStageTimers(t => ({ ...t, assets: 0 }));
    setErrorStage(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      addLog('[AGENT:ART]', '开始提取视觉资产...', 'text-pink-400');
      let result;
      // If analysis was skipped, use raw script
      const inputData = directorData || scriptContent;
      result = await runArtDesign(inputData, preferredModel, controller.signal, scriptSettings);
      setArtData(result);
      setProgress(p => ({ ...p, assets: 100 }));
      setStatusTexts(s => ({ ...s, assets: `提取完成，总耗时 ${stageTimers.assets.toFixed(1)}s` }));
      setStage(2.5);
      addLog('[SYSTEM]', '视觉资产提取完成。', 'text-[#FFC107]');

      // Update scriptsList for persistence
      setScriptsList(prev => prev.map(s => 
        s.title === selectedScriptTitle 
          ? { ...s, artData: result, stage: 2.5 } 
          : s
      ));
    } catch (error: any) {
      if (error.message === "Task cancelled by user") {
        addLog('[SYSTEM]', '任务已被用户停止。', 'text-yellow-500');
      } else {
        addLog('[ERROR]', `美术设计失败: ${error?.message || String(error)}`, 'text-red-500');
      }
      setStatusTexts(s => ({ ...s, assets: error.message === "Task cancelled by user" ? '已停止' : '提取中断' }));
      setStage(0);
      setErrorStage(2);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const runStage3 = async () => {
    setStage(3);
    setProgress(p => ({ ...p, storyboard: 0 }));
    setStageTimers(t => ({ ...t, storyboard: 0 }));
    setErrorStage(null);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      addLog('[AGENT:STORYBOARD]', '开始编写分镜脚本...', 'text-purple-400');
      let result;
      // If analysis was skipped, use raw script
      const scriptToUse = directorData?.aiReadyScript || scriptContent;
      result = await runStoryboarding(artData, scriptToUse, preferredModel, controller.signal, scriptSettings);
      setStoryboardData(result);
      setProgress(p => ({ ...p, storyboard: 100 }));
      setStatusTexts(s => ({ ...s, storyboard: `编写完成，总耗时 ${stageTimers.storyboard.toFixed(1)}s` }));
      setStage(4);
      addLog('[SYS]', '全流程处理完毕。', 'text-[#39FF14]');

      // Update scriptsList for persistence
      setScriptsList(prev => prev.map(s => 
        s.title === selectedScriptTitle 
          ? { ...s, storyboardData: result, stage: 4 } 
          : s
      ));
    } catch (error: any) {
      if (error.message === "Task cancelled by user") {
        addLog('[SYSTEM]', '任务已被用户停止。', 'text-yellow-500');
      } else {
        addLog('[ERROR]', `分镜编写失败: ${error?.message || String(error)}`, 'text-red-500');
      }
      setStatusTexts(s => ({ ...s, storyboard: error.message === "Task cancelled by user" ? '已停止' : '编写中断' }));
      setStage(0);
      setErrorStage(3);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleStopTask = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      addLog('[SYSTEM]', '正在停止任务...', 'text-yellow-500');
    }
  };

  const openEditor = (stageNum: number) => {
    if (stageNum === 1) {
      if (stage === 0) {
        // 未开始时，打开配置子界面
        setIsConfiguring(true);
        return;
      }
      if (directorData) {
        setEditingStage(1);
        // 转换为排版良好的文本格式
        const humanText = `🔍 第一步：高危与穿帮诊断报告\n${directorData.diagnosticReport || ''}\n\n💉 第二步：平替与逻辑修复方案\n${directorData.fixingStrategy || ''}\n\n📝 第三步：输出“AI 友好型”润色剧本\n${directorData.aiReadyScript || ''}`;
        setEditContent(humanText);
        setIsEditing(true);
      }
    } else if (stageNum === 2 && artData) {
      setEditingStage(2);
      let text = `【角色资产清单】\n`;
      artData.characters?.forEach((c: any) => {
        text += `ID: ${c.uid}\n描述: ${c.prompt}\n\n`;
      });
      text += `【环境资产清单】\n`;
      artData.environments?.forEach((e: any) => {
        text += `ID: ${e.uid}\n描述: ${e.prompt}\n\n`;
      });
      text += `【关键道具清单】\n`;
      artData.props?.forEach((p: any) => {
        text += `ID: ${p.uid}\n描述: ${p.prompt}\n\n`;
      });
      text += `【空间站位控制】\n${artData.spatialPositioning || ''}`;
      setEditContent(text);
      setIsEditing(true);
    } else if (stageNum === 3 && storyboardData) {
      setEditingStage(3);
      let text = `【分镜脚本表】\n\n`;
      storyboardData.storyboards?.forEach((sb: any) => {
        text += `[Beat ${sb.beatNumber} | 📍场景：${sb.scene} | 🎭核心情绪标签：${sb.emotion} | ⏱总时长: 15s 铁律]\n`;
        text += `[连贯性锁死备忘录]\n`;
        text += `人物状态：${sb.memo?.characterState || ''}\n`;
        text += `轴线与构图：${sb.memo?.axisAndComposition || ''}\n`;
        text += `光效与空间：${sb.memo?.lightingAndSpace || ''}\n\n`;
        
        sb.shots?.forEach((shot: any, idx: number) => {
          text += `[[${shot.timeRange}]]： [[${shot.camera}]] ${shot.action}\n`;
          if (shot.dialogue) text += `  ${shot.dialogue}\n`;
          text += `\n`;
        });
        text += `🎵 Audio Track: ${sb.audioTrack || ''}\n`;
        text += `----------------------------------\n\n`;
      });
      setEditContent(text);
      setIsEditing(true);
    }
  };

  const saveEdit = () => {
    try {
      if (editingStage === 1) {
        // 简单的正则解析回 JSON
        const parts = editContent.split(/【.*?】/).filter(p => p.trim() !== "");
        const updatedData = {
          ...directorData,
          diagnosticReport: parts[0]?.trim() || "",
          fixingStrategy: parts[1]?.trim() || "",
          aiReadyScript: parts[2]?.trim() || ""
        };
        setDirectorData(updatedData);
      } else if (editingStage === 2) {
        // 资产提取阶段通常较复杂，这里保持原样或根据需要解析
        // 为简单起见，如果检测到是 JSON 则解析，否则仅更新备注
        if (editContent.trim().startsWith('{')) {
          setArtData(JSON.parse(editContent));
        } else {
          addLog('[SYS]', '非 JSON 格式修改已保存（仅限预览）。', 'text-zinc-500');
        }
      }
      setIsEditing(false);
      addLog('[SYS]', `已手动更新 Stage ${editingStage} 的分析数据。`, 'text-blue-400');
    } catch (e) {
      alert("保存失败，请确保内容完整。");
    }
  };

  const downloadAsTxt = () => {
    const blob = new Blob([editContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedScriptTitle}_Stage${editingStage}_审核稿.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('[SYS]', '已导出纯文本审核稿。', 'text-[#39FF14]');
  };

  const resetWorkflow = () => {
    setStage(0);
    setProgress({ analysis: 0, assets: 0, storyboard: 0 });
    setDirectorData(null);
    setArtData(null);
    setStoryboardData(null);
    addLog('[SYS]', '工作流已重置。', 'text-zinc-400');
  };

  const handleDownloadResults = () => {
    const combinedData = {
      scriptTitle: selectedScriptTitle,
      directorAnalysis: directorData,
      artDesign: artData,
      storyboard: storyboardData
    };
    const blob = new Blob([JSON.stringify(combinedData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedScriptTitle}_全流程资产包.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addLog('[SYS]', '已触发资产包下载。', 'text-[#39FF14]');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const title = file.name.replace(/\.[^/.]+$/, "");
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    // Define text-based extensions that can be read directly by FileReader
    const textExtensions = ['.txt', '.json', '.xml', '.yaml', '.yml', '.csv', '.md', '.markdown', '.html', '.htm', '.mhtml'];

    if (textExtensions.includes(fileExtension)) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setScriptContent(content);
        setSelectedScriptTitle(title);
        
        setScriptsList(prev => {
          const exists = prev.find(s => s.title === title);
          if (exists) return prev;
          return [{ title, content }, ...prev];
        });
        
        addLog('[SYS]', `成功加载本地文本剧本: ${file.name}`, 'text-blue-400');
        if (stage > 0) resetWorkflow();
      };
      reader.readAsText(file);
    } else if (fileExtension === '.docx') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const mammoth = await import('mammoth/mammoth.browser');
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const result = await mammoth.extractRawText({ arrayBuffer });
          const content = result.value;
          
          setScriptContent(content);
          setSelectedScriptTitle(title);
          
          setScriptsList(prev => {
            const exists = prev.find(s => s.title === title);
            if (exists) return prev;
            return [{ title, content }, ...prev];
          });
          
          addLog('[SYS]', `成功解析 Word 剧本: ${file.name}`, 'text-blue-400');
          if (stage > 0) resetWorkflow();
        } catch (err) {
          console.error("Docx parsing error:", err);
          alert(`解析文件失败：${file.name}。\n请确保文件未损坏。`);
          addLog('[ERROR]', `解析 Word 剧本失败: ${file.name}`, 'text-red-500');
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (fileExtension === '.pdf') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const pdfjsLib = await import('pdfjs-dist');
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;
          
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
          const pdf = await loadingTask.promise;
          let fullText = '';
          
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += pageText + '\n';
          }
          
          setScriptContent(fullText);
          setSelectedScriptTitle(title);
          
          setScriptsList(prev => {
            const exists = prev.find(s => s.title === title);
            if (exists) return prev;
            return [{ title, content: fullText }, ...prev];
          });
          
          addLog('[SYS]', `成功解析 PDF 剧本: ${file.name}`, 'text-blue-400');
          if (stage > 0) resetWorkflow();
        } catch (err) {
          console.error("PDF parsing error:", err);
          alert(`解析 PDF 失败：${file.name}。\n请确保文件未加密且非扫描件。`);
          addLog('[ERROR]', `解析 PDF 剧本失败: ${file.name}`, 'text-red-500');
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (fileExtension === '.xlsx' || fileExtension === '.xls') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const XLSX = await import('xlsx');
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          let fullText = '';
          
          workbook.SheetNames.forEach(sheetName => {
            const worksheet = workbook.Sheets[sheetName];
            // Convert sheet to CSV-like text for script analysis
            const sheetText = XLSX.utils.sheet_to_txt(worksheet);
            fullText += `--- Sheet: ${sheetName} ---\n${sheetText}\n\n`;
          });
          
          setScriptContent(fullText);
          setSelectedScriptTitle(title);
          
          setScriptsList(prev => {
            const exists = prev.find(s => s.title === title);
            if (exists) return prev;
            return [{ title, content: fullText }, ...prev];
          });
          
          addLog('[SYS]', `成功解析 Excel 剧本: ${file.name}`, 'text-blue-400');
          if (stage > 0) resetWorkflow();
        } catch (err) {
          console.error("Excel parsing error:", err);
          alert(`解析 Excel 失败：${file.name}。\n请确保文件未损坏。`);
          addLog('[ERROR]', `解析 Excel 剧本失败: ${file.name}`, 'text-red-500');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Reject non-text files to prevent AI hallucinations from mock strings
      alert(`不支持的文件格式：${fileExtension}。\n\n为了保证剧本分析的准确性，目前仅支持 .txt, .md, .docx, .pdf, .xlsx 等格式。\n请将您的剧本另存为支持的格式后重新上传。`);
      addLog('[SYS]', `文件格式不支持: ${file.name}，请上传 .txt, .md, .docx, .pdf 或 .xlsx 文件。`, 'text-red-400');
    }
    
    // Reset input value so the same file can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const deleteScript = (title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setScriptsList(prev => {
      const newList = prev.filter(s => s.title !== title);
      if (title === selectedScriptTitle) {
        if (newList.length > 0) {
          setSelectedScriptTitle(newList[0].title);
          setScriptContent(newList[0].content);
        } else {
          setSelectedScriptTitle("未选择剧本");
          setScriptContent("");
        }
      }
      return newList;
    });
    addLog('[SYS]', `已删除剧本: ${title}`, 'text-red-400');
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      addLog('[SYS]', '内容已复制到剪贴板。', 'text-[#39FF14]');
    }).catch(err => {
      console.error('Failed to copy: ', err);
      alert('复制失败，请手动选择复制。');
    });
  };

  // UI Helpers
  const getStageClass = (step: number) => {
    if (stage === step) return "bg-zinc-800 border-2 border-[#FFC107] rounded-xl p-5 relative overflow-hidden cursor-pointer shadow-[0_0_20px_rgba(255,193,7,0.15)] transform scale-[1.02] z-10";
    if (stage > step) return "bg-zinc-900/80 border border-[#39FF14]/30 rounded-xl p-5 relative overflow-hidden group cursor-pointer hover:border-[#39FF14]/60 transition-all hover:bg-zinc-900";
    return "bg-zinc-900/80 border border-zinc-800 rounded-xl p-5 relative overflow-hidden group cursor-pointer hover:border-zinc-700 transition-all hover:bg-zinc-900";
  };

  const getStageBarClass = (step: number) => {
    if (stage === step) return "absolute top-0 left-0 w-1.5 h-full bg-[#FFC107] shadow-[0_0_10px_rgba(255,193,7,0.8)]";
    if (stage > step) return "absolute top-0 left-0 w-1 h-full bg-[#39FF14] shadow-[0_0_10px_rgba(57,255,20,0.5)]";
    return "absolute top-0 left-0 w-1 h-full bg-zinc-700";
  };

  const getStageNumClass = (step: number) => {
    if (stage === step) return "text-black font-mono text-sm bg-[#FFC107] px-2 py-0.5 rounded font-bold";
    if (stage > step) return "text-[#39FF14] font-mono text-sm bg-[#39FF14]/10 px-2 py-0.5 rounded";
    return "text-zinc-400 font-mono text-sm bg-zinc-800 px-2 py-0.5 rounded";
  };

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-300 font-sans overflow-hidden selection:bg-[#FFC107] selection:text-black relative">
      {/* Sidebar */}
      <aside className="w-[250px] flex-shrink-0 border-r border-zinc-800 bg-zinc-900 flex flex-col h-full z-10">
        {/* Logo */}
        <div className="p-6 flex items-center gap-3 border-b border-zinc-800">
          <div className="w-8 h-8 rounded bg-[#FFC107] flex items-center justify-center text-black font-bold text-xl shadow-[0_0_10px_rgba(255,193,7,0.5)]">
            D
          </div>
          <h1 className="text-lg font-bold text-white tracking-wider">恐龙工作台</h1>
        </div>

        {/* Actions */}
        <div className="p-4 flex flex-col gap-3 border-b border-zinc-800">
          <input 
            type="file" 
            accept=".txt,.json,.xml,.yaml,.yml,.csv,.md,.markdown,.doc,.docx,.wps,.wpt,.rtf,.odt,.pdf,.epub,.mobi,.azw3,.html,.htm,.mhtml" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            className="hidden" 
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 border border-[#FFC107] text-[#FFC107] rounded hover:bg-[#FFC107] hover:text-black transition-all font-medium shadow-[0_0_10px_rgba(255,193,7,0.1)] hover:shadow-[0_0_15px_rgba(255,193,7,0.3)]"
          >
            <Upload size={16} />
            上传新剧本
          </button>
          <p className="text-[10px] text-zinc-600 mt-1 text-center">支持 .txt, .md, .docx, .pdf (推荐文本型 PDF)</p>
          <button 
            onClick={resetWorkflow}
            className="flex items-center justify-center gap-2 w-full py-2.5 px-4 border border-zinc-700 text-zinc-300 rounded hover:bg-zinc-800 hover:text-white transition-colors"
          >
            <RefreshCw size={16} />
            刷新状态
          </button>
        </div>

        {/* Script Library */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-2 text-xs font-semibold text-zinc-500 tracking-wider uppercase">剧本库 Script Library</div>
          <div className="flex flex-col">
            {scriptsList.length === 0 && (
              <div className="px-4 py-8 text-center">
                <p className="text-xs text-zinc-600">暂无剧本，请上传</p>
              </div>
            )}
            {scriptsList.map((script) => (
              <div 
                key={script.title}
                className={`group relative flex items-center transition-colors ${script.title === selectedScriptTitle ? 'bg-zinc-800/80' : 'hover:bg-zinc-800/40'}`}
              >
                <button 
                  onClick={() => {
                    // Save current results to the current script before switching
                    setScriptsList(prev => prev.map(s => 
                      s.title === selectedScriptTitle 
                        ? { ...s, directorData, artData, storyboardData, stage, settings: scriptSettings } 
                        : s
                    ));

                    setSelectedScriptTitle(script.title);
                    setScriptContent(script.content);
                    
                    // Restore results for the new script
                    setDirectorData(script.directorData || null);
                    setArtData(script.artData || null);
                    setStoryboardData(script.storyboardData || null);
                    setStage(script.stage || 0);
                    if (script.settings) {
                      setScriptSettings(script.settings);
                    } else {
                      setScriptSettings({
                        genre: "科幻",
                        style: "写实摄影",
                        aspectRatio: "9:16"
                      });
                    }
                    
                    addLog('[SYS]', `已切换剧本: ${script.title}`, 'text-zinc-400');
                  }}
                  className={`flex-1 text-left px-4 py-3 text-sm flex items-center gap-3 border-l-2 transition-colors ${script.title === selectedScriptTitle ? 'border-[#FFC107] text-white' : 'border-transparent text-zinc-400 hover:text-zinc-200'}`}
                >
                  <FileText size={16} className={script.title === selectedScriptTitle ? 'text-[#FFC107]' : ''} />
                  <span className="truncate pr-6">{script.title}</span>
                </button>
                
                <button 
                  onClick={(e) => deleteScript(script.title, e)}
                  className="absolute right-2 p-1.5 text-zinc-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                  title="删除剧本"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* AI Agents */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/50">
          <div className="mb-3 text-xs font-semibold text-zinc-500 tracking-wider uppercase">AI Agents</div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-3 text-sm text-zinc-300 p-2.5 rounded hover:bg-zinc-800 cursor-pointer transition-colors">
              <Clapperboard size={16} className="text-blue-400" />
              <span>导演 Director</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-zinc-300 p-2.5 rounded hover:bg-zinc-800 cursor-pointer transition-colors">
              <Palette size={16} className="text-pink-400" />
              <span>美术 Art</span>
            </div>
            <div className="flex items-center gap-3 text-sm text-zinc-300 p-2.5 rounded hover:bg-zinc-800 cursor-pointer transition-colors">
              <LayoutTemplate size={16} className="text-purple-400" />
              <span>分镜 Storyboard</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/40 via-zinc-950 to-zinc-950">
        
        {/* Top Workspace */}
        <div className="flex-1 overflow-y-auto p-8 pb-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">{selectedScriptTitle}</h2>
                <div className="relative group/settings">
                  <button 
                    onClick={() => setIsConfiguring(true)}
                    className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-[#FFC107]/10 text-[#FFC107] rounded border border-[#FFC107]/30 hover:bg-[#FFC107]/20 transition-colors"
                  >
                    {scriptSettings.genre} · {scriptSettings.style} · {scriptSettings.aspectRatio}
                  </button>
                </div>
                <span className="px-2.5 py-1 text-xs font-medium bg-zinc-800 text-zinc-300 rounded border border-zinc-700">
                  {stage === 0 ? '未开始' : stage === 4 ? '已完成' : '进行中'}
                </span>
              </div>
              <p className="text-sm text-zinc-400 flex items-center gap-2">
                <span>最后更新: {new Date().toLocaleDateString()}</span>
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-sm transition-colors border border-zinc-700 shadow-sm">
                <FolderOpen size={16} />
                文件视图
              </button>
              <button 
                onClick={() => setIsSettingsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded text-sm transition-colors border border-zinc-700 shadow-sm"
              >
                <Settings size={16} />
                设置
              </button>
              {onClose && (
                <button 
                  onClick={onClose}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-rose-500/20 text-white hover:text-rose-400 rounded text-sm transition-colors border border-zinc-700 hover:border-rose-500/30 shadow-sm ml-2"
                  title="返回选择界面"
                >
                  <X size={16} />
                  退出工作台
                </button>
              )}
            </div>
          </div>

          {/* Data Dashboard */}
          <div className="mb-10">
            <h3 className="text-sm font-semibold text-zinc-500 tracking-wider uppercase mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-zinc-700 rounded-full"></div>
              数据看板 Dashboard
            </h3>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Card 1 */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 shadow-sm backdrop-blur-sm transition-all duration-300">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-zinc-400">剧本分析进度</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-500">{stageTimers.analysis.toFixed(1)}s</span>
                    {progress.analysis >= 100 ? (
                      <CheckCircle2 size={18} className="text-[#39FF14]" />
                    ) : (
                      <Clock size={18} className={stage === 1 ? "text-[#FFC107] animate-pulse" : "text-zinc-600"} />
                    )}
                  </div>
                </div>
                <div className="text-4xl font-bold text-white mb-3 tracking-tight">
                  {Math.floor(progress.analysis)}<span className="text-2xl text-zinc-500">%</span>
                </div>
                <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className={`h-full transition-all duration-300 ${errorStage === 1 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : progress.analysis >= 100 ? 'bg-[#39FF14] shadow-[0_0_10px_rgba(57,255,20,0.5)]' : 'bg-[#FFC107] shadow-[0_0_10px_rgba(255,193,7,0.5)]'}`} 
                    style={{ width: `${progress.analysis}%` }}
                  ></div>
                </div>
                <div className="mt-4 text-xs text-zinc-500 flex justify-between items-center">
                  <span className={`truncate mr-2 ${errorStage === 1 ? 'text-red-500' : stage === 1 ? 'text-[#FFC107]' : progress.analysis >= 100 ? 'text-[#39FF14]' : ''}`}>
                    {statusTexts.analysis}
                  </span>
                  <span className="shrink-0 text-[10px] opacity-50 uppercase">Stage 01</span>
                </div>
              </div>

              {/* Card 2 */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 shadow-sm backdrop-blur-sm transition-all duration-300">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-zinc-400">视觉资产覆盖</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-500">{stageTimers.assets.toFixed(1)}s</span>
                    {progress.assets >= 100 ? (
                      <CheckCircle2 size={18} className="text-[#39FF14]" />
                    ) : (
                      <Clock size={18} className={stage === 2 ? "text-[#FFC107] animate-pulse" : "text-zinc-600"} />
                    )}
                  </div>
                </div>
                <div className="text-4xl font-bold text-white mb-3 tracking-tight">
                  {Math.floor(progress.assets)}<span className="text-2xl text-zinc-500">%</span>
                </div>
                <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className={`h-full transition-all duration-300 ${errorStage === 2 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : progress.assets >= 100 ? 'bg-[#39FF14] shadow-[0_0_10px_rgba(57,255,20,0.5)]' : 'bg-[#FFC107] shadow-[0_0_10px_rgba(255,193,7,0.5)]'}`} 
                    style={{ width: `${progress.assets}%` }}
                  ></div>
                </div>

                {artData && progress.assets >= 100 && (
                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-2 text-center group hover:border-[#FFC107]/30 transition-colors">
                      <div className="text-[10px] text-zinc-500 uppercase mb-1 flex items-center justify-center gap-1">
                        <Users size={10} /> 角色
                      </div>
                      <div className="text-sm font-bold text-[#FFC107]">{artData.characters?.length || 0}</div>
                    </div>
                    <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-2 text-center group hover:border-blue-400/30 transition-colors">
                      <div className="text-[10px] text-zinc-500 uppercase mb-1 flex items-center justify-center gap-1">
                        <Map size={10} /> 场景
                      </div>
                      <div className="text-sm font-bold text-blue-400">{artData.environments?.length || 0}</div>
                    </div>
                    <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-2 text-center group hover:border-pink-400/30 transition-colors">
                      <div className="text-[10px] text-zinc-500 uppercase mb-1 flex items-center justify-center gap-1">
                        <Box size={10} /> 道具
                      </div>
                      <div className="text-sm font-bold text-pink-400">{artData.props?.length || 0}</div>
                    </div>
                  </div>
                )}

                <div className="mt-4 text-xs text-zinc-500 flex justify-between items-center">
                  <span className={`truncate mr-2 ${errorStage === 2 ? 'text-red-500' : stage === 2 ? 'text-[#FFC107]' : progress.assets >= 100 ? 'text-[#39FF14]' : ''}`}>
                    {statusTexts.assets}
                  </span>
                  <span className="shrink-0 text-[10px] opacity-50 uppercase">Stage 02</span>
                </div>
              </div>

              {/* Card 3 */}
              <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl p-6 shadow-sm backdrop-blur-sm transition-all duration-300">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-zinc-400">分镜脚本产出</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-zinc-500">{stageTimers.storyboard.toFixed(1)}s</span>
                    {progress.storyboard >= 100 ? (
                      <CheckCircle2 size={18} className="text-[#39FF14]" />
                    ) : (
                      <Clock size={18} className={stage === 3 ? "text-[#FFC107] animate-pulse" : "text-zinc-600"} />
                    )}
                  </div>
                </div>
                <div className="text-4xl font-bold text-white mb-3 tracking-tight">
                  {Math.floor(progress.storyboard)}<span className="text-2xl text-zinc-500">%</span>
                </div>
                <div className="w-full bg-zinc-950 h-2 rounded-full overflow-hidden border border-zinc-800">
                  <div 
                    className={`h-full transition-all duration-300 ${errorStage === 3 ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : progress.storyboard >= 100 ? 'bg-[#39FF14] shadow-[0_0_10px_rgba(57,255,20,0.5)]' : 'bg-[#FFC107] shadow-[0_0_10px_rgba(255,193,7,0.5)]'}`} 
                    style={{ width: `${progress.storyboard}%` }}
                  ></div>
                </div>

                {storyboardData && progress.storyboard >= 100 && (
                  <div className="mt-4 bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-2 flex justify-between items-center group hover:border-[#39FF14]/30 transition-colors">
                    <div className="text-[10px] text-zinc-500 uppercase flex items-center gap-1">
                      <Film size={10} /> 生成分镜 Beat 数量
                    </div>
                    <div className="text-sm font-bold text-[#39FF14]">{storyboardData.storyboards?.length || 0}</div>
                  </div>
                )}

                <div className="mt-4 text-xs text-zinc-500 flex justify-between items-center">
                  <span className={`truncate mr-2 ${errorStage === 3 ? 'text-red-500' : stage === 3 ? 'text-[#FFC107]' : progress.storyboard >= 100 ? 'text-[#39FF14]' : ''}`}>
                    {statusTexts.storyboard}
                  </span>
                  <span className="shrink-0 text-[10px] opacity-50 uppercase">Stage 03</span>
                </div>
              </div>
            </div>
          </div>

          {/* Control Center */}
          <div>
            <h3 className="text-sm font-semibold text-zinc-500 tracking-wider uppercase mb-4 flex items-center gap-2">
              <div className="w-1 h-4 bg-zinc-700 rounded-full"></div>
              控制中心 Control Center
            </h3>
            <div className="flex flex-col xl:flex-row gap-6">
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Stage 1 */}
                <div 
                  className={`${getStageClass(1)} relative hover:ring-2 hover:ring-[#FFC107] cursor-pointer`}
                  onClick={() => openEditor(1)}
                >
                  <div className={getStageBarClass(1)}></div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={getStageNumClass(1)}>01</div>
                      <h4 className={stage >= 1 ? "text-white font-medium" : "text-zinc-300 font-medium"}>剧本分析</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      {stage === 0 && <Settings size={16} className="text-zinc-500 hover:text-[#FFC107] transition-colors" />}
                      <BrainCircuit size={20} className={stage >= 1 ? "text-[#39FF14]/70" : "text-zinc-600"} />
                    </div>
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">四节点深度分析：合规、因果、空间、竖屏</p>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      {stage === 0 && <div className="text-[10px] text-zinc-500 font-bold">点击配置分析维度</div>}
                      {stage >= 1.5 && <div className="text-[10px] text-[#FFC107] font-bold animate-pulse">点击查看/修改结果</div>}
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); stage === 1 ? handleStopTask() : runStage1(); }}
                      className={`p-2 rounded-lg transition-all shadow-lg ${stage === 1 ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-[#FFC107] hover:bg-[#e0a800] text-black disabled:bg-zinc-700 disabled:text-zinc-500'}`}
                      title={stage === 1 ? "停止执行" : "单独运行此环节"}
                    >
                      {stage === 1 ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                    </button>
                  </div>
                </div>

                {/* Stage 2 */}
                <div 
                  className={`${getStageClass(2)} relative ${stage >= 2.5 ? 'hover:ring-2 hover:ring-[#FFC107] cursor-pointer' : ''}`}
                  onClick={() => stage >= 2.5 && openEditor(2)}
                >
                  <div className={getStageBarClass(2)}></div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={getStageNumClass(2)}>02</div>
                      <h4 className={stage >= 2 ? "text-white font-medium" : "text-zinc-300 font-medium"}>资产提取</h4>
                    </div>
                    <Layers size={20} className={stage >= 2 ? "text-[#FFC107]" : "text-zinc-600"} />
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">概念图生成、角色三视图、道具设计</p>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      {stage >= 2.5 && (
                        <div className="flex flex-col gap-1">
                          <div className="text-[10px] text-[#FFC107] font-bold animate-pulse">点击查看/修改结果</div>
                          <div className="flex gap-2 text-[9px] text-zinc-500 font-mono">
                            <span>角色:{artData?.characters?.length || 0}</span>
                            <span>场景:{artData?.environments?.length || 0}</span>
                            <span>道具:{artData?.props?.length || 0}</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); stage === 2 ? handleStopTask() : runStage2(); }}
                      className={`p-2 rounded-lg transition-all shadow-lg ${stage === 2 ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-[#FFC107] hover:bg-[#e0a800] text-black disabled:bg-zinc-700 disabled:text-zinc-500'}`}
                      title={stage === 2 ? "停止执行" : "单独运行此环节"}
                    >
                      {stage === 2 ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                    </button>
                  </div>
                </div>

                {/* Stage 3 */}
                <div 
                  className={`${getStageClass(3)} relative ${stage === 4 ? 'hover:ring-2 hover:ring-[#FFC107] cursor-pointer' : ''}`}
                  onClick={() => stage === 4 && openEditor(3)}
                >
                  <div className={getStageBarClass(3)}></div>
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className={getStageNumClass(3)}>03</div>
                      <h4 className={stage >= 3 ? "text-white font-medium" : "text-zinc-300 font-medium"}>分镜编写</h4>
                    </div>
                    <Film size={20} className={stage >= 3 ? "text-zinc-400" : "text-zinc-600"} />
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">镜头规划、运镜设计、动态预演生成</p>
                  
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      {stage === 4 && <div className="text-[10px] text-[#FFC107] font-bold animate-pulse">点击查看/修改结果</div>}
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); stage === 3 ? handleStopTask() : runStage3(); }}
                      className={`p-2 rounded-lg transition-all shadow-lg ${stage === 3 ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-[#FFC107] hover:bg-[#e0a800] text-black disabled:bg-zinc-700 disabled:text-zinc-500'}`}
                      title={stage === 3 ? "停止执行" : "单独运行此环节"}
                    >
                      {stage === 3 ? <Square size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
                    </button>
                  </div>
                </div>
              </div>
              
              {/* Master Control */}
              <div className="w-full xl:w-[220px] h-24 xl:h-auto flex-shrink-0">
                {stage === 1 || stage === 2 || stage === 3 ? (
                  <button 
                    onClick={() => handleStopTask()}
                    className="w-full h-full rounded-xl flex xl:flex-col items-center justify-center gap-3 transition-all p-4 bg-red-600 hover:bg-red-700 text-white shadow-[0_0_20px_rgba(220,38,38,0.2)] hover:shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Square size={24} className="fill-white" />
                    <span className="font-bold tracking-wide text-center text-lg">
                      停止执行
                      <br className="hidden xl:block"/>
                      <span className="text-xs font-semibold opacity-70 xl:mt-1 block uppercase tracking-widest">
                        Stop Task
                      </span>
                    </span>
                  </button>
                ) : (
                  <button 
                    onClick={() => startProductionPipeline()}
                    className="w-full h-full rounded-xl flex xl:flex-col items-center justify-center gap-3 transition-all p-4 bg-[#FFC107] hover:bg-[#e0a800] text-black shadow-[0_0_20px_rgba(255,193,7,0.2)] hover:shadow-[0_0_30px_rgba(255,193,7,0.4)] hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Play size={28} className="fill-black" />
                    <span className="font-bold tracking-wide text-center text-lg">
                      {stage === 0 ? '启动全流程' : 
                       stage === 1.5 ? '继续资产提取' : 
                       stage === 2.5 ? '继续分镜编写' : 
                       stage === 4 ? '重新启动' : '处理中...'}
                      <br className="hidden xl:block"/>
                      <span className="text-xs font-semibold opacity-70 xl:mt-1 block uppercase tracking-widest">
                        {stage === 1.5 || stage === 2.5 ? 'Continue' : 'Master Control'}
                      </span>
                    </span>
                  </button>
                )}
              </div>
            </div>

            {/* Additional Tools */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              <button
                onClick={() => setShowInfiniteCanvas(true)}
                className="w-full flex items-center justify-center gap-3 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl transition-colors border border-zinc-800 hover:border-zinc-700 shadow-sm"
              >
                <Sparkles size={18} className="text-[#39FF14]" />
                <span className="font-medium tracking-wide">无限创作画布</span>
              </button>
              <button
                onClick={() => setShowVideoGenerator(true)}
                className="w-full flex items-center justify-center gap-3 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl transition-colors border border-zinc-800 hover:border-zinc-700 shadow-sm"
              >
                <Film size={18} className="text-blue-400" />
                <span className="font-medium tracking-wide">Seedance 视频生成</span>
              </button>
              <button
                onClick={() => setShowStoryboardCreator(true)}
                className="w-full flex items-center justify-center gap-3 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl transition-colors border border-zinc-800 hover:border-zinc-700 shadow-sm"
              >
                <ImagePlus size={18} className="text-[#FFC107]" />
                <span className="font-medium tracking-wide">分镜生成器 (参考图反推)</span>
              </button>
              <button
                onClick={() => setShowPhotographyPromptGenerator(true)}
                className="w-full flex items-center justify-center gap-3 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl transition-colors border border-zinc-800 hover:border-zinc-700 shadow-sm"
              >
                <Camera size={18} className="text-[#FFC107]" />
                <span className="font-medium tracking-wide">全能摄影提示词生成器</span>
              </button>
              <button
                onClick={() => setShowImageGenerator(true)}
                className="w-full flex items-center justify-center gap-3 py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white rounded-xl transition-colors border border-zinc-800 hover:border-zinc-700 shadow-sm"
              >
                <ImagePlus size={18} className="text-purple-400" />
                <span className="font-medium tracking-wide">AI 图像生成器</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Console and Results */}
        <div className="flex-shrink-0 border-t border-zinc-800 bg-[#050505] p-5 font-mono text-xs overflow-y-auto flex flex-col z-10 shadow-[inset_0_10px_20px_rgba(0,0,0,0.5)] h-[220px]">
          <div className="flex items-center justify-between text-zinc-500 mb-4 sticky top-0 bg-[#050505] pb-2 border-b border-zinc-900/50 z-20">
            <div className="flex items-center gap-2">
              <TerminalSquare size={14} />
              <span className="uppercase tracking-widest font-semibold">Console Logs</span>
            </div>
            
            <div className="flex items-center gap-4">
              {stage === 4 && (
                <button
                  onClick={handleDownloadResults}
                  className="px-3 py-1.5 bg-[#FFC107]/10 hover:bg-[#FFC107]/20 text-[#FFC107] border border-[#FFC107]/30 rounded flex items-center gap-2 transition-colors shadow-[0_0_10px_rgba(255,193,7,0.1)]"
                >
                  <Download size={14} />
                  下载完整资产包 (JSON)
                </button>
              )}
              <div className="flex gap-2">
                <div className="w-2 h-2 rounded-full bg-zinc-700"></div>
                <div className="w-2 h-2 rounded-full bg-zinc-700"></div>
                <div className={`w-2 h-2 rounded-full ${stage > 0 && stage < 4 ? 'bg-[#FFC107] shadow-[0_0_5px_rgba(255,193,7,0.5)] animate-pulse' : 'bg-[#39FF14] shadow-[0_0_5px_rgba(57,255,20,0.5)]'}`}></div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-1 gap-6 min-h-0">
            {/* Logs Area */}
            <div className="flex flex-col gap-2 overflow-y-auto w-full">
              {logs.map((log) => (
                <div key={log.id} className="flex gap-4 hover:bg-zinc-900/50 px-2 py-0.5 rounded transition-colors">
                  <span className="text-zinc-600 w-[80px] shrink-0">[{log.time}]</span>
                  <span className={`${log.color} w-[140px] shrink-0 font-semibold`}>{log.source}</span>
                  <span className={log.color === 'text-zinc-400' ? 'text-zinc-400' : 'text-zinc-300'}>{log.text}</span>
                </div>
              ))}
              
              {/* Blinking Cursor */}
              <div className="flex gap-4 hover:bg-zinc-900/50 px-2 py-0.5 rounded items-center mt-1">
                <span className="text-zinc-600 w-[80px] shrink-0">[{new Date().toLocaleTimeString('en-US', { hour12: false })}]</span>
                <span className="text-zinc-500 w-[140px] shrink-0">[SYS]</span>
                <span className="text-[#39FF14] flex items-center gap-2">
                  {stage > 0 && stage < 4 ? 'Processing workflow...' : 'Waiting for user input'}
                  <span className="w-1.5 h-3 bg-[#39FF14] animate-pulse inline-block"></span>
                </span>
              </div>
              <div ref={consoleEndRef} />
            </div>
          </div>
        </div>
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[150] flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <header className="p-6 border-b border-zinc-800 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <Settings size={20} className="text-[#FFC107]" />
                <h3 className="text-lg font-bold text-white">全局设置</h3>
              </div>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="text-zinc-500 hover:text-white transition-colors"
              >
                <RefreshCw size={18} className="rotate-45" />
              </button>
            </header>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
                  AI 模型选择 (Model Selection)
                </label>
                <div className="space-y-2">
                  {[
                    { id: 'auto', label: '智能模式 (推荐)', desc: '优先使用 Pro 模型，频率受限时自动降级到 Flash。', icon: <BrainCircuit size={16} /> },
                    { id: 'gemini-3.1-pro-preview', label: '性能模式 (Pro)', desc: '强制使用 Pro 模型，逻辑最强但频率限制严。', icon: <Clapperboard size={16} /> },
                    { id: 'gemini-3-flash-preview', label: '极速模式 (Flash)', desc: '强制使用 Flash 模型，响应极快且配额充足。', icon: <Play size={16} /> },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setPreferredModel(m.id)}
                      className={`w-full flex items-start gap-4 p-4 rounded-xl border transition-all text-left ${
                        preferredModel === m.id 
                          ? 'bg-[#FFC107]/10 border-[#FFC107] shadow-[0_0_15px_rgba(255,193,7,0.1)]' 
                          : 'bg-zinc-800/50 border-zinc-700 hover:border-zinc-600'
                      }`}
                    >
                      <div className={`mt-0.5 ${preferredModel === m.id ? 'text-[#FFC107]' : 'text-zinc-500'}`}>
                        {m.icon}
                      </div>
                      <div>
                        <div className={`text-sm font-bold ${preferredModel === m.id ? 'text-white' : 'text-zinc-300'}`}>{m.label}</div>
                        <p className="text-[10px] text-zinc-500 mt-1 leading-relaxed">{m.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-xl">
                <p className="text-[10px] text-blue-400 leading-relaxed">
                  <strong>提示：</strong> 如果您在运行过程中频繁遇到 429 错误，请切换至“极速模式”。Flash 模型虽然逻辑稍弱，但对于标准剧本的处理依然非常出色。
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest mb-3">
                  数据管理 (Data Management)
                </label>
                <div className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl flex items-center justify-between">
                  <div>
                    <div className="text-sm font-bold text-zinc-300">清理本地缓存</div>
                    <p className="text-[10px] text-zinc-500 mt-1">删除所有保存的剧本、分析结果和配置。</p>
                  </div>
                  <button
                    onClick={handleClearCache}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-lg text-xs font-bold transition-all"
                  >
                    <Trash2 size={14} />
                    立即清理
                  </button>
                </div>
              </div>
            </div>
            
            <footer className="p-6 bg-zinc-950/50 border-t border-zinc-800 flex justify-end">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-8 py-2 bg-[#FFC107] hover:bg-[#e0a800] text-black rounded-lg font-bold transition-all"
              >
                确定
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* Configuration Modal - Stage 1 Sub-interface */}
      {isConfiguring && (
        <div className="fixed inset-0 bg-[#050505] z-[100] flex flex-col animate-in slide-in-from-bottom duration-500">
          <header className="h-20 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-8 backdrop-blur-md">
            <div className="flex items-center gap-6">
              <div className="w-10 h-10 rounded-lg bg-[#FFC107] flex items-center justify-center text-black font-black text-xl">
                <Settings size={24} />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">剧本分析配置子界面</h3>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mt-0.5">
                  Configure Analysis Dimensions & AI Logic
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setIsConfiguring(false)}
                className="px-6 py-2.5 text-zinc-400 hover:text-white transition-colors font-medium"
              >
                取消
              </button>
              <button 
                onClick={() => {
                  setIsConfiguring(false);
                  runStage1();
                }}
                className="px-10 py-2.5 bg-[#FFC107] hover:bg-[#e0a800] text-black rounded-xl font-bold transition-all shadow-[0_0_30px_rgba(255,193,7,0.2)] hover:scale-[1.02] active:scale-[0.98]"
              >
                保存并立即开始分析
              </button>
            </div>
          </header>

          <div className="flex-1 p-10 bg-[radial-gradient(circle_at_top,_var(--tw-gradient-stops))] from-zinc-900/20 to-black overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              <div className="mb-12">
                <h4 className="text-[#FFC107] text-sm font-bold uppercase tracking-[0.2em] mb-6">剧本基础设定</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Genre Selection */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">题材分类 (Genre)</label>
                    <select 
                      value={scriptSettings.genre}
                      onChange={(e) => setScriptSettings(prev => ({ ...prev, genre: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FFC107] focus:ring-1 focus:ring-[#FFC107] transition-all outline-none"
                    >
                      {["科幻", "悬疑", "爱情", "动作", "恐怖", "奇幻", "剧情", "古装", "都市", "战争"].map(g => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  {/* Art Style Selection */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">画风分类 (Art Style)</label>
                    <select 
                      value={scriptSettings.style}
                      onChange={(e) => setScriptSettings(prev => ({ ...prev, style: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FFC107] focus:ring-1 focus:ring-[#FFC107] transition-all outline-none"
                    >
                      {["写实摄影", "赛博朋克", "东方武侠", "末日废土", "现代冷硬", "二次元/动漫", "油画质感", "极简主义", "蒸汽朋克", "黑色电影", "水墨画", "3D渲染", "复古胶片"].map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>

                  {/* Aspect Ratio Selection */}
                  <div className="space-y-3">
                    <label className="block text-xs font-bold text-zinc-500 uppercase tracking-widest">画面比例 (Aspect Ratio)</label>
                    <select 
                      value={scriptSettings.aspectRatio}
                      onChange={(e) => setScriptSettings(prev => ({ ...prev, aspectRatio: e.target.value }))}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white focus:border-[#FFC107] focus:ring-1 focus:ring-[#FFC107] transition-all outline-none"
                    >
                      {["9:16", "16:9", "1:1", "4:3", "2.35:1"].map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="mb-12">
                <h4 className="text-[#FFC107] text-sm font-bold uppercase tracking-[0.2em] mb-6">核心分析维度选择</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[
                    { id: 'causalLoop', label: '因果闭环与动作缝合', desc: '严禁瞬移与状态突变，强制补写物理过渡动作。', icon: <RefreshCw size={20} /> },
                    { id: 'entityConcretization', label: '实体绝对具象化', desc: '全面剿灭模糊代词，强制绑定唯一真实姓名与核心外观特征。', icon: <Layers size={20} /> },
                    { id: 'propAndPersonTracking', label: '道具与人员追踪', desc: '交代关键道具来源去向，半句话锚定边缘人物当前状态。', icon: <CheckCircle2 size={20} /> },
                    { id: 'safetySubstitution', label: '视听平替与安全合规', desc: '将暴力血腥与擦边动作替换为无血腥的高张力隐喻描述。', icon: <TerminalSquare size={20} /> },
                    { id: 'spatialAnchoring', label: '空间层级与物理锚点', desc: '合并同级场景，强制母子场景嵌套，强调微观物理边界。', icon: <LayoutTemplate size={20} /> },
                    { id: 'rhetoricStripping', label: '修辞剥离与情绪直译', desc: '彻底绞杀比喻与意象，将抽象情感强制降维翻译为物理动作。', icon: <BrainCircuit size={20} /> },
                    { id: 'microExpression', label: '微表情与情绪映射', desc: '强制植入停顿感，将喜怒哀乐翻译为面部肌肉与呼吸节奏。', icon: <Layers size={20} /> },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setAnalysisOptions(prev => ({ ...prev, [opt.id]: !prev[opt.id as keyof typeof prev] }))}
                      className={`flex items-start gap-5 p-6 rounded-2xl border transition-all text-left ${
                        analysisOptions[opt.id as keyof typeof analysisOptions]
                          ? 'bg-[#FFC107]/5 border-[#FFC107] shadow-[0_0_20px_rgba(255,193,7,0.05)]'
                          : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      <div className={`p-3 rounded-xl ${analysisOptions[opt.id as keyof typeof analysisOptions] ? 'bg-[#FFC107] text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                        {opt.icon}
                      </div>
                      <div>
                        <div className={`font-bold mb-1 ${analysisOptions[opt.id as keyof typeof analysisOptions] ? 'text-white' : 'text-zinc-400'}`}>{opt.label}</div>
                        <p className="text-xs text-zinc-500 leading-relaxed">{opt.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-8 rounded-3xl bg-zinc-900/50 border border-zinc-800 backdrop-blur-sm">
                <h4 className="text-white font-bold mb-4 flex items-center gap-2">
                  <BrainCircuit size={18} className="text-[#FFC107]" />
                  AI 逻辑增强说明
                </h4>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  您所选中的维度将直接注入 <strong>Gemini 3.1 Pro</strong> 的系统指令集。
                  系统将对剧本进行逐行扫描，确保在润色过程中 100% 覆盖上述逻辑。
                  这不仅能提升剧本的文学质量，更能为后续的 AI 视频生成提供“零穿帮”的底层文本支撑。
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal - Full Screen Redesign */}
      {isEditing && (
        <div className="fixed inset-0 bg-[#050505] z-[100] flex flex-col animate-in fade-in duration-300">
          {/* Top Header */}
          <header className="h-20 border-b border-zinc-800 bg-zinc-900/50 flex items-center justify-between px-8 backdrop-blur-md">
            <div className="flex items-center gap-6">
              <div className="w-10 h-10 rounded-lg bg-[#FFC107] flex items-center justify-center text-black font-black text-xl">
                {editingStage}
              </div>
              <div>
                <h3 className="text-xl font-bold text-white tracking-tight">审核并修改分析结果</h3>
                <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold mt-0.5">
                  {editingStage === 1 ? 'Stage 01: Director Analysis' : 
                   editingStage === 2 ? 'Stage 02: Art Assets Design' : 
                   'Stage 03: Storyboard Planning'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button 
                onClick={() => copyToClipboard(editContent)}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all border border-zinc-700 font-medium"
              >
                <Copy size={18} />
                一键复制内容
              </button>
              <button 
                onClick={downloadAsTxt}
                className="flex items-center gap-2 px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl transition-all border border-zinc-700 font-medium"
              >
                <Download size={18} />
                下载文本格式 (.txt)
              </button>
              <div className="w-px h-8 bg-zinc-800 mx-2"></div>
              <button 
                onClick={() => setIsEditing(false)}
                className="px-6 py-2.5 text-zinc-400 hover:text-white transition-colors font-medium"
              >
                取消
              </button>
              <button 
                onClick={saveEdit}
                className="px-10 py-2.5 bg-[#FFC107] hover:bg-[#e0a800] text-black rounded-xl font-bold transition-all shadow-[0_0_30px_rgba(255,193,7,0.2)] hover:scale-[1.02] active:scale-[0.98]"
              >
                保存并应用修改
              </button>
            </div>
          </header>

          {/* Editor Area */}
          <div className="flex-1 flex flex-col p-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-900/20 to-black overflow-hidden">
            <div className="max-w-[95%] w-full mx-auto h-full flex flex-col">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2 text-zinc-500 text-sm">
                  <FileText size={16} />
                  <span>{editingStage === 2 ? '视觉资产宫格预览模式：支持单个资产一键复制。' : '编辑器内容已自动排版，您可以直接在此进行文本编辑。'}</span>
                </div>
                <div className="text-[10px] text-zinc-600 font-mono uppercase tracking-tighter">
                  {editingStage === 2 ? 'Asset Grid Mode' : 'UTF-8 Encoding | Human Readable Mode'}
                </div>
              </div>
              
              <div className="flex-1 relative group overflow-hidden">
                <div className="absolute -inset-1 bg-gradient-to-b from-[#FFC107]/10 to-transparent rounded-2xl blur opacity-20 group-hover:opacity-40 transition-opacity"></div>
                
                {editingStage === 2 ? (
                  <div className="relative w-full h-full bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 overflow-y-auto backdrop-blur-sm transition-all">
                    <div className="space-y-10">
                      {/* Characters */}
                      <div>
                        <h4 className="text-[#FFC107] text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                          <div className="w-1 h-4 bg-[#FFC107] rounded-full"></div>
                          角色资产 Characters
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {artData?.characters?.map((c: any, idx: number) => (
                            <div key={idx} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 hover:border-[#FFC107]/50 transition-all group/card">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-bold font-mono text-zinc-300 uppercase tracking-tight">{c.uid}</span>
                                <button 
                                  onClick={() => copyToClipboard(c.prompt)}
                                  className="p-1.5 bg-zinc-700 hover:bg-[#FFC107] hover:text-black rounded text-zinc-400 transition-all opacity-0 group-hover/card:opacity-100"
                                  title="复制提示词"
                                >
                                  <RefreshCw size={12} className="rotate-45" />
                                </button>
                              </div>
                              <p className="text-sm text-zinc-300 leading-relaxed line-clamp-4">{c.prompt}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Environments */}
                      <div>
                        <h4 className="text-blue-400 text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                          <div className="w-1 h-4 bg-blue-400 rounded-full"></div>
                          场景资产 Environments
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {artData?.environments?.map((e: any, idx: number) => (
                            <div key={idx} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 hover:border-blue-400/50 transition-all group/card">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-bold font-mono text-zinc-300 uppercase tracking-tight">{e.uid}</span>
                                <button 
                                  onClick={() => copyToClipboard(e.prompt)}
                                  className="p-1.5 bg-zinc-700 hover:bg-blue-400 hover:text-black rounded text-zinc-400 transition-all opacity-0 group-hover/card:opacity-100"
                                  title="复制提示词"
                                >
                                  <RefreshCw size={12} className="rotate-45" />
                                </button>
                              </div>
                              <p className="text-sm text-zinc-300 leading-relaxed line-clamp-4">{e.prompt}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Props */}
                      <div>
                        <h4 className="text-pink-400 text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                          <div className="w-1 h-4 bg-pink-400 rounded-full"></div>
                          道具资产 Props
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {artData?.props?.map((p: any, idx: number) => (
                            <div key={idx} className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 hover:border-pink-400/50 transition-all group/card">
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-sm font-bold font-mono text-zinc-300 uppercase tracking-tight">{p.uid}</span>
                                <button 
                                  onClick={() => copyToClipboard(p.prompt)}
                                  className="p-1.5 bg-zinc-700 hover:bg-pink-400 hover:text-black rounded text-zinc-400 transition-all opacity-0 group-hover/card:opacity-100"
                                  title="复制提示词"
                                >
                                  <RefreshCw size={12} className="rotate-45" />
                                </button>
                              </div>
                              <p className="text-sm text-zinc-300 leading-relaxed line-clamp-4">{p.prompt}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Spatial Positioning */}
                      <div>
                        <h4 className="text-purple-400 text-sm font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
                          <div className="w-1 h-4 bg-purple-400 rounded-full"></div>
                          空间站位 Spatial Positioning
                        </h4>
                        <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6">
                          <p className="text-zinc-300 leading-relaxed whitespace-pre-wrap">{artData?.spatialPositioning}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="relative w-full h-full bg-zinc-900/40 border border-zinc-800 rounded-2xl p-10 font-sans text-lg leading-relaxed text-zinc-200 focus:ring-2 focus:ring-[#FFC107]/50 focus:border-[#FFC107]/50 outline-none resize-none shadow-2xl backdrop-blur-sm transition-all"
                    placeholder="在此输入或修改内容..."
                    spellCheck={false}
                  />
                )}
              </div>
              
              <div className="mt-6 flex justify-center">
                <p className="text-zinc-600 text-[10px] uppercase tracking-[0.3em]">
                  Dinosaur Workbench Professional Content Editor
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {showStoryboardCreator && (
        <StoryboardCreator onClose={() => setShowStoryboardCreator(false)} />
      )}

      {showPhotographyPromptGenerator && (
        <PhotographyPromptGenerator onClose={() => setShowPhotographyPromptGenerator(false)} />
      )}

      {showImageGenerator && (
        <ImageGenerator onClose={() => setShowImageGenerator(false)} />
      )}

      {showVideoGenerator && (
        <VideoGenerator onClose={() => setShowVideoGenerator(false)} />
      )}

      {showInfiniteCanvas && (
        <InfiniteCanvasWrapper onClose={onClose || (() => setShowInfiniteCanvas(false))} />
      )}
    </div>
  );
}
