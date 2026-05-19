import { MediaCapability, MediaType } from '../types/task';
import { CapabilityRegistryEntry } from '../types/capability';

// 供多处复用的通用宽高比选项
const aspectRatioOptions = [
  { label: '16:9 (横屏)', value: '16:9' },
  { label: '9:16 (竖屏)', value: '9:16' },
  { label: '1:1 (方图)', value: '1:1' },
  { label: '4:3 (标准)', value: '4:3' }
];

export const capabilityRegistry: Record<MediaCapability, CapabilityRegistryEntry> = {
  text_to_image: {
    id: 'text_to_image',
    label: '文生图',
    apiType: 'image_api',
    mediaType: 'image',
    description: '只输入文字生成图片',
    requiredInputs: [
      { name: 'prompt', type: 'string', label: '提示词' }
    ],
    optionalInputs: [
      { name: 'aspect_ratio', type: 'string', label: '画面比例' },
      { name: 'size', type: 'string', label: '分辨率大小' },
      { name: 'style', type: 'string', label: '风格' }
    ],
    maxImages: 0,
    defaultParams: { aspect_ratio: '16:9' },
    uiControls: [
      { id: 'ctrl_t2i_prompt', type: 'prompt_textarea', label: '提示词', paramKey: 'prompt', required: true },
      { id: 'ctrl_t2i_aspect', type: 'select', label: '画面比例', paramKey: 'aspect_ratio', required: false, defaultValue: '16:9', options: aspectRatioOptions },
      { id: 'ctrl_t2i_size', type: 'select', label: '分辨率', paramKey: 'size', required: false, defaultValue: '1080p', options: [
          { label: '720p', value: '720p' }, { label: '1080p', value: '1080p' }, { label: '4k', value: '4k' }
      ]},
      { id: 'ctrl_t2i_style', type: 'text_input', label: '画面风格', paramKey: 'style', required: false, helpText: '例如: 赛博朋克, 写实, 二次元' },
      { id: 'ctrl_t2i_gen', type: 'generate_button', label: '生成图片', paramKey: '_gen', required: false }
    ]
  },
  image_to_image: {
    id: 'image_to_image',
    label: '图生图',
    apiType: 'image_api',
    mediaType: 'image',
    description: '上传参考图并结合文字进行重绘、换背景、风格统一、融合重绘',
    requiredInputs: [
      { name: 'prompt', type: 'string', label: '提示词' },
      { name: 'reference_images', type: 'image_array', label: '参考图片' }
    ],
    optionalInputs: [
      { name: 'aspect_ratio', type: 'string', label: '画面比例' },
      { name: 'size', type: 'string', label: '分辨率大小' },
      { name: 'strength', type: 'number', label: '重绘幅度(0-1)' }
    ],
    maxImages: 4,
    supportedReferenceRoles: ['reference', 'style'],
    defaultParams: { strength: 0.5 },
    uiControls: [
      { id: 'ctrl_i2i_images', type: 'multi_image_upload', label: '参考图(最多4张)', paramKey: 'reference_images', required: true, maxImages: 4 },
      { id: 'ctrl_i2i_prompt', type: 'prompt_textarea', label: '提示词', paramKey: 'prompt', required: true },
      { id: 'ctrl_i2i_aspect', type: 'select', label: '画面比例', paramKey: 'aspect_ratio', required: false, defaultValue: '16:9', options: aspectRatioOptions },
      { id: 'ctrl_i2i_strength', type: 'slider', label: '重绘幅度', paramKey: 'strength', required: false, defaultValue: 0.5, min: 0, max: 1, step: 0.05, helpText: '值越大，和原图差异越大' },
      { id: 'ctrl_i2i_gen', type: 'generate_button', label: '生成图片', paramKey: '_gen', required: false }
    ]
  },
  text_to_video: {
    id: 'text_to_video',
    label: '文生视频',
    apiType: 'video_api',
    mediaType: 'video',
    description: '只输入文字生成视频',
    requiredInputs: [
      { name: 'prompt', type: 'string', label: '提示词' }
    ],
    optionalInputs: [
      { name: 'aspect_ratio', type: 'string', label: '画面比例' },
      { name: 'duration', type: 'number', label: '视频时长(秒)' },
      { name: 'style', type: 'string', label: '风格' }
    ],
    maxImages: 0,
    defaultParams: { duration: 5 },
    uiControls: [
      { id: 'ctrl_t2v_prompt', type: 'prompt_textarea', label: '提示词', paramKey: 'prompt', required: true },
      { id: 'ctrl_t2v_aspect', type: 'select', label: '画面比例', paramKey: 'aspect_ratio', required: false, defaultValue: '16:9', options: aspectRatioOptions },
      { id: 'ctrl_t2v_duration', type: 'number_input', label: '视频时长 (秒)', paramKey: 'duration', required: false, defaultValue: 5, min: 1, max: 60, step: 1 },
      { id: 'ctrl_t2v_style', type: 'text_input', label: '画面风格', paramKey: 'style', required: false },
      { id: 'ctrl_t2v_gen', type: 'generate_button', label: '生成视频', paramKey: '_gen', required: false }
    ]
  },
  image_to_video: {
    id: 'image_to_video',
    label: '图生视频',
    apiType: 'video_api',
    mediaType: 'video',
    description: '上传一张图，让图片动起来',
    requiredInputs: [
      { name: 'prompt', type: 'string', label: '提示词' },
      { name: 'reference_images', type: 'image_array', label: '参考图片' }
    ],
    optionalInputs: [
      { name: 'aspect_ratio', type: 'string', label: '画面比例' },
      { name: 'duration', type: 'number', label: '视频时长(秒)' },
      { name: 'motion_strength', type: 'number', label: '运动幅度' }
    ],
    maxImages: 1,
    supportedReferenceRoles: ['reference'],
    defaultParams: { duration: 5, motion_strength: 5 },
    uiControls: [
      { id: 'ctrl_i2v_image', type: 'image_upload', label: '参考图片', paramKey: 'reference_image', required: true, maxImages: 1 },
      { id: 'ctrl_i2v_prompt', type: 'prompt_textarea', label: '运动提示词', paramKey: 'prompt', required: true, helpText: '描述物体如何运动' },
      { id: 'ctrl_i2v_aspect', type: 'select', label: '画面比例', paramKey: 'aspect_ratio', required: false, defaultValue: '16:9', options: aspectRatioOptions },
      { id: 'ctrl_i2v_duration', type: 'number_input', label: '视频时长 (秒)', paramKey: 'duration', required: false, defaultValue: 5, min: 1, max: 60 },
      { id: 'ctrl_i2v_motion', type: 'slider', label: '运动幅度', paramKey: 'motion_strength', required: false, defaultValue: 5, min: 0, max: 10, step: 1 },
      { id: 'ctrl_i2v_gen', type: 'generate_button', label: '生成视频', paramKey: '_gen', required: false }
    ]
  },
  first_frame_video: {
    id: 'first_frame_video',
    label: '首帧视频',
    apiType: 'video_api',
    mediaType: 'video',
    description: '明确指定上传图片作为视频第一帧，用于镜头承接',
    requiredInputs: [
      { name: 'prompt', type: 'string', label: '提示词' },
      { name: 'first_frame', type: 'image', label: '首帧图片' }
    ],
    optionalInputs: [
      { name: 'aspect_ratio', type: 'string', label: '画面比例' },
      { name: 'duration', type: 'number', label: '视频时长(秒)' },
      { name: 'motion_strength', type: 'number', label: '运动幅度' }
    ],
    maxImages: 1,
    supportedReferenceRoles: ['first_frame'],
    defaultParams: { duration: 5, motion_strength: 5 },
    uiControls: [
      { id: 'ctrl_ff_image', type: 'image_upload', label: '首帧图片', paramKey: 'first_frame', required: true, maxImages: 1 },
      { id: 'ctrl_ff_prompt', type: 'prompt_textarea', label: '镜头延续提示词', paramKey: 'prompt', required: true },
      { id: 'ctrl_ff_aspect', type: 'select', label: '画面比例', paramKey: 'aspect_ratio', required: false, defaultValue: '16:9', options: aspectRatioOptions },
      { id: 'ctrl_ff_duration', type: 'number_input', label: '视频时长 (秒)', paramKey: 'duration', required: false, defaultValue: 5 },
      { id: 'ctrl_ff_motion', type: 'slider', label: '运动幅度', paramKey: 'motion_strength', required: false, defaultValue: 5, min: 0, max: 10, step: 1 },
      { id: 'ctrl_ff_gen', type: 'generate_button', label: '生成视频', paramKey: '_gen', required: false }
    ]
  },
  first_last_frame_video: {
    id: 'first_last_frame_video',
    label: '首尾帧视频',
    apiType: 'video_api',
    mediaType: 'video',
    description: '上传首帧和尾帧，让模型生成中间过渡视频',
    requiredInputs: [
      { name: 'prompt', type: 'string', label: '提示词' },
      { name: 'first_frame', type: 'image', label: '首帧图片' },
      { name: 'last_frame', type: 'image', label: '尾帧图片' }
    ],
    optionalInputs: [
      { name: 'aspect_ratio', type: 'string', label: '画面比例' },
      { name: 'duration', type: 'number', label: '视频时长(秒)' },
      { name: 'transition_strength', type: 'number', label: '过渡强度' }
    ],
    maxImages: 2,
    supportedReferenceRoles: ['first_frame', 'last_frame'],
    defaultParams: { duration: 5, transition_strength: 5 },
    uiControls: [
      { id: 'ctrl_fl_first', type: 'image_upload', label: '首帧图片', paramKey: 'first_frame', required: true, maxImages: 1 },
      { id: 'ctrl_fl_last', type: 'image_upload', label: '尾帧图片', paramKey: 'last_frame', required: true, maxImages: 1 },
      { id: 'ctrl_fl_prompt', type: 'prompt_textarea', label: '过渡提示词', paramKey: 'prompt', required: true },
      { id: 'ctrl_fl_aspect', type: 'select', label: '画面比例', paramKey: 'aspect_ratio', required: false, defaultValue: '16:9', options: aspectRatioOptions },
      { id: 'ctrl_fl_duration', type: 'number_input', label: '视频时长 (秒)', paramKey: 'duration', required: false, defaultValue: 5 },
      { id: 'ctrl_fl_trans', type: 'slider', label: '过渡强度', paramKey: 'transition_strength', required: false, defaultValue: 5, min: 0, max: 10, step: 1 },
      { id: 'ctrl_fl_gen', type: 'generate_button', label: '生成视频', paramKey: '_gen', required: false }
    ]
  },
  multi_reference_video: {
    id: 'multi_reference_video',
    label: '全能参考',
    apiType: 'video_api',
    mediaType: 'video',
    description: '支持多张参考图，每张图有不同职责',
    requiredInputs: [
      { name: 'prompt', type: 'string', label: '提示词' },
      { name: 'reference_images', type: 'image_array', label: '参考图片组' }
    ],
    optionalInputs: [
      { name: 'aspect_ratio', type: 'string', label: '画面比例' },
      { name: 'duration', type: 'number', label: '视频时长(秒)' },
      { name: 'reference_roles', type: 'role_array', label: '角色分配' }
    ],
    maxImages: 8,
    supportedReferenceRoles: ['character', 'scene', 'prop', 'last_frame', 'style'],
    defaultParams: { duration: 5 },
    uiControls: [
      { id: 'ctrl_mr_images', type: 'multi_image_upload', label: '多张参考图', paramKey: 'reference_images', required: true, maxImages: 8 },
      { id: 'ctrl_mr_roles', type: 'reference_role_selector', label: '图片职责分配', paramKey: 'reference_roles', required: false, helpText: '设置各图片的参考类型' },
      { id: 'ctrl_mr_prompt', type: 'prompt_textarea', label: '综合提示词', paramKey: 'prompt', required: true },
      { id: 'ctrl_mr_aspect', type: 'select', label: '画面比例', paramKey: 'aspect_ratio', required: false, defaultValue: '16:9', options: aspectRatioOptions },
      { id: 'ctrl_mr_duration', type: 'number_input', label: '视频时长 (秒)', paramKey: 'duration', required: false, defaultValue: 5 },
      { id: 'ctrl_mr_gen', type: 'generate_button', label: '生成视频', paramKey: '_gen', required: false }
    ]
  }
};

export const getAllCapabilities = () => Object.values(capabilityRegistry);
export const getCapabilitiesByMediaType = (mediaType: MediaType) => 
  Object.values(capabilityRegistry).filter(cap => cap.mediaType === mediaType);
