import React from 'react';
import { UIControlDef, UIControlType } from '../config/uiControlSchema';
import { Upload, X, HelpCircle, Image as ImageIcon } from 'lucide-react';

interface Props {
  control: UIControlDef;
  value: any;
  onChange: (val: any) => void;
  // 支持把所有可选角色配置传进来，用于 multi-reference
  supportedReferenceRoles?: string[];
  disabled?: boolean;
}

export function DynamicControlRenderer({ control, value, onChange, supportedReferenceRoles, disabled }: Props) {
  
  const handleUploadClick = () => {
    // 模拟文件上传机制（因为原项目中 InfiniteCanvas 可能有单独上传，这里为了演示，我们在点击时让用户 mock 填入 URL）
    const dummyUrl = prompt("模拟上传，请输入图片URL:", "https://images.unsplash.com/photo-1542204165-65bf26472b9b?w=200");
    if (dummyUrl) {
      if (control.type === 'multi_image_upload') {
        const arr = Array.isArray(value) ? value : [];
        if (control.maxImages && arr.length >= control.maxImages) {
          alert(`最多只能上传 ${control.maxImages} 张图片`);
          return;
        }
        onChange([...arr, dummyUrl]);
      } else {
        onChange(dummyUrl);
      }
    }
  };

  const removeMultiImage = (index: number) => {
    const arr = Array.isArray(value) ? [...value] : [];
    arr.splice(index, 1);
    onChange(arr);
  };

  switch (control.type) {
    case 'prompt_textarea':
      return (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300 flex items-center justify-between">
            {control.label}
            {control.required && <span className="text-red-400 text-xs">*</span>}
          </label>
          <textarea
            className="w-full h-24 bg-[#111214] border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#00bcd4] resize-none"
            placeholder={control.helpText || '输入描述词...'}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      );

    case 'select':
      return (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300 flex items-center justify-between">
            {control.label}
            {control.required && <span className="text-red-400 text-xs">*</span>}
          </label>
          <select
            className="w-full bg-[#111214] border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#00bcd4]"
            value={value || control.defaultValue || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          >
            {control.options?.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {control.helpText && <p className="text-xs text-zinc-500">{control.helpText}</p>}
        </div>
      );

    case 'text_input':
      return (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300 flex items-center justify-between">
            {control.label}
            {control.required && <span className="text-red-400 text-xs">*</span>}
          </label>
          <input
            type="text"
            className="w-full bg-[#111214] border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#00bcd4]"
            placeholder={control.helpText || ''}
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
        </div>
      );

    case 'number_input':
      return (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300 flex items-center justify-between">
            {control.label}
            {control.required && <span className="text-red-400 text-xs">*</span>}
          </label>
          <input
            type="number"
            min={control.min}
            max={control.max}
            step={control.step || 1}
            className="w-full bg-[#111214] border border-zinc-800 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-[#00bcd4]"
            value={value || control.defaultValue || ''}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled}
          />
          {control.helpText && <p className="text-xs text-zinc-500">{control.helpText}</p>}
        </div>
      );

    case 'slider':
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
             <label className="text-sm font-medium text-zinc-300 flex items-center gap-1">
              {control.label}
              {control.helpText && (
                 <span title={control.helpText}><HelpCircle size={14} className="text-zinc-500"/></span>
              )}
             </label>
             <span className="text-xs text-[#00bcd4] font-mono">{value ?? control.defaultValue}</span>
          </div>
          <input
            type="range"
            min={control.min}
            max={control.max}
            step={control.step || 1}
            className="w-full accent-[#00bcd4]"
            value={value ?? control.defaultValue ?? 0}
            onChange={(e) => onChange(Number(e.target.value))}
            disabled={disabled}
          />
        </div>
      );

    case 'image_upload':
      return (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-zinc-300 flex items-center justify-between">
            {control.label}
            {control.required && <span className="text-red-400 text-xs">*</span>}
          </label>
          <div 
             className="w-full h-32 bg-[#111214] border border-dashed border-zinc-700 rounded-xl flex flex-col justify-center items-center cursor-pointer hover:border-[#00bcd4] hover:bg-[#00bcd4]/5 transition-all overflow-hidden"
             onClick={handleUploadClick}
          >
             {value ? (
                <div className="relative w-full h-full group">
                  <img src={value} alt="Preview" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                     <span className="text-xs text-white">点击更换</span>
                  </div>
                </div>
             ) : (
                <>
                  <Upload size={24} className="text-zinc-500 mb-2" />
                  <span className="text-xs text-zinc-400">点击上传图片</span>
                </>
             )}
          </div>
          {control.helpText && <p className="text-xs text-zinc-500">{control.helpText}</p>}
        </div>
      );

    case 'multi_image_upload':
      const arr = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-zinc-300 flex items-center gap-1">
              {control.label} {control.maxImages && `(${arr.length}/${control.maxImages})`}
            </label>
            {control.required && <span className="text-red-400 text-xs">*</span>}
          </div>
          <div className="flex flex-wrap gap-2">
             {arr.map((img: string, i: number) => (
                <div key={i} className="relative w-16 h-16 rounded-lg bg-[#111214] border border-zinc-700 overflow-hidden group">
                   <img src={img} alt="" className="w-full h-full object-cover" />
                   <button 
                     onClick={() => removeMultiImage(i)}
                     className="absolute top-1 right-1 p-0.5 bg-black/70 rounded-md text-white opacity-0 group-hover:opacity-100 transition-opacity"
                   >
                     <X size={12}/>
                   </button>
                </div>
             ))}
             {(!control.maxImages || arr.length < control.maxImages) && (
                <div 
                  onClick={handleUploadClick}
                  className="w-16 h-16 rounded-lg bg-[#111214] border border-dashed border-zinc-700 hover:border-[#00bcd4] flex items-center justify-center cursor-pointer transition-colors"
                >
                  <Upload size={16} className="text-zinc-500" />
                </div>
             )}
          </div>
          {control.helpText && <p className="text-xs text-zinc-500">{control.helpText}</p>}
        </div>
      );

    case 'reference_role_selector':
      // Requires a parallel structure (value is an array of roles matching the length of the images array)
      // Actually parameter mapping in complex logic might need a custom layout.
      // But we can simplify: we don't render it here stand-alone, or we render a simple hint.
      return (
        <div className="flex flex-col gap-1 text-sm bg-blue-900/20 text-blue-300 p-3 rounded-xl border border-blue-900/50">
          <div className="flex items-center gap-2 mb-1"><ImageIcon size={14}/><span>自动分配参考角色</span></div>
          <p className="text-xs opacity-70">{control.helpText || '角色已根据图片自动配置。'}</p>
        </div>
      );
      
    case 'generate_button':
       // Return nothing here, Button will be handled collectively at the bottom
       return null;

    default:
      return null;
  }
}
