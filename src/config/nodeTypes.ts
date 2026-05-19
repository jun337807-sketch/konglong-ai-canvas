export const availableNodeTypes = {
  content: [
    { type: 'textNode', label: '文本描述', icon: 'Type' },
    { type: 'imageNode', label: '视觉资产', icon: 'ImageIcon' },
    { type: 'videoNode', label: '视频片段', icon: 'Video' },
    { type: 'audioNode', label: '音频', icon: 'AudioLines' },
    { type: 'scriptNode', label: '脚本', icon: 'FileText' },
  ],
  generation: [
    { type: 'aiGenNode', label: 'AI 生成节点', icon: 'BrainCircuit' },
    { type: 'storyboardNode', label: '分镜节点', icon: 'LayoutGrid' },
  ],
  control: [
    { type: 'groupNode', label: '组合节点', icon: 'Layers' },
    { type: 'conditionNode', label: '条件分支', icon: 'Split' },
  ]
};
