export const promptTemplates = [
  {
    id: 'default',
    name: '默认电影化模板',
    description: '适用于生成高质量电影感画面',
    template: 'Cinematic lighting, hyper-realistic, 8k resolution, highly detailed, {subject}, {environment}, {action}, {style}',
    variables: ['subject', 'environment', 'action', 'style']
  },
  {
    id: 'anime',
    name: '日系动漫模板',
    description: '二次元风格生成模板',
    template: 'Anime style, Studio Ghibli, 2d animation, masterpiece, best quality, {subject}, {environment}, {action}, lush details',
    variables: ['subject', 'environment', 'action']
  },
  {
    id: 'product',
    name: '产品展示模板',
    description: '适用于电商或产品展示',
    template: 'Product photography, studio lighting, clean background, macro details, {subject}, highly detailed, 8k',
    variables: ['subject']
  }
];
