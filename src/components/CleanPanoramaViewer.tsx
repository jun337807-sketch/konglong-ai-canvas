import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef, useCallback } from 'react';
import * as THREE from 'three';
import { ZoomIn, ZoomOut, Compass } from 'lucide-react';

export interface SpatialObject {
  id: string;
  yaw: number;   // 水平偏航角（弧度，0代表正前方）
  pitch: number; // 垂直俯仰角（弧度，0代表水平）
  element: React.ReactNode;
}

export interface CleanPanoramaProps {
  /** 全景图地址 (推荐 2:1 比例的 Equirectangular 图像) */
  imageUrl: string;
  /** 初始视场角 (Zoom) */
  defaultFov?: number;
  /** 放置在 3D 空间中的标准 React DOM 元素 */
  spatialObjects?: SpatialObject[];
  /** 点击全景空间曲面时的回调，返回偏航、俯仰弧度和世界坐标 */
  onSpaceClick?: (yaw: number, pitch: number, point: THREE.Vector3) => void;
  /** 外部传入样式类名 */
  className?: string;
}

export interface CleanPanoramaRef {
  resetView: () => void;
  setZoom: (fov: number) => void;
  getCameraPose: () => { yaw: number; pitch: number; fov: number };
  takeScreenshot: () => { dataUrl: string; width: number; height: number } | null;
}

/**
 * 无依赖纯净版全景浏览器组件
 * 基于 Three.js + React + Tailwind
 */
export const CleanPanoramaViewer = forwardRef<CleanPanoramaRef, CleanPanoramaProps>(({
  imageUrl,
  defaultFov = 65,
  spatialObjects = [],
  onSpaceClick,
  className = ''
}, ref) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 用于渲染 SpatialObject 的 2D 屏幕坐标映射表
  const [objectPositions, setObjectPositions] = useState<Record<string, { x: number, y: number, visible: boolean }>>({});

  // 将原生 Three.js 引擎包裹于 Ref，避免侵入 React 渲染周期
  const engine = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    sphere: THREE.Mesh;
    yaw: number;
    pitch: number;
    fov: number;
    isDragging: boolean;
    dragStartX: number;
    dragStartY: number;
    yawStart: number;
    pitchStart: number;
    rafId: number;
    width: number;
    height: number;
  } | null>(null);

  // === 1. 初始化与清理 Three 引擎 ===
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(defaultFov, width / height, 0.1, 100);
    const renderer = new THREE.WebGLRenderer({ canvas: canvasRef.current, antialias: true, alpha: true, preserveDrawingBuffer: true });
    
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    // 创建反向翻转的全景球体 (经典内切映射算法)
    const geometry = new THREE.SphereGeometry(30, 60, 40);
    geometry.scale(-1, 1, 1); 
    
    // MeshBasicMaterial 不受光照影响，非常适合展示全景纹理
    const material = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const sphere = new THREE.Mesh(geometry, material);
    scene.add(sphere);

    engine.current = {
      scene, camera, renderer, sphere,
      yaw: 0, pitch: 0, fov: defaultFov,
      isDragging: false, dragStartX: 0, dragStartY: 0, yawStart: 0, pitchStart: 0,
      rafId: 0, width, height
    };

    // 原生相机控制更新
    const updateCamera = () => {
      const e = engine.current;
      if (!e) return;
      
      // 限制 Pitch 避免越过极点发生视口翻转 (-85度 到 85度)
      const PITCH_LIMIT = Math.PI / 2 * 0.95;
      e.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, e.pitch));
      // 限制 FOV 缩放防穿模 (20度 到 120度)
      e.fov = Math.max(20, Math.min(120, e.fov));
      
      e.camera.fov = e.fov;
      e.camera.updateProjectionMatrix();

      // 数学转换将拖拽产生的 偏航(Yaw)/俯仰(Pitch) 角计算为空间3D坐标点
      const phi = Math.PI / 2 - e.pitch; 
      const theta = Math.PI + e.yaw; // 加 PI 使其默认注视 -Z

      const targetX = Math.sin(phi) * Math.sin(theta);
      const targetY = Math.cos(phi);
      const targetZ = Math.sin(phi) * Math.cos(theta);

      e.camera.lookAt(targetX, targetY, targetZ);
      e.renderer.render(e.scene, e.camera);
    };

    // 动画自渲染循环
    const animate = () => {
      const e = engine.current;
      if (!e) return;
      e.rafId = requestAnimationFrame(animate);
      updateCamera();
      
      // 触发自定义事件，让 React 框架层同步 3D 浮标在屏幕上的 2D 跟随位置
      window.dispatchEvent(new CustomEvent('panorama-render-tick'));
    };
    
    updateCamera();
    animate();

    return () => {
      if (engine.current?.rafId) cancelAnimationFrame(engine.current.rafId);
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    };
  }, [defaultFov]);

  // === 2. 加载全景纹理 ===
  useEffect(() => {
    if (!engine.current || !imageUrl) return;
    setIsReady(false);
    setError(null);
    
    const loader = new THREE.TextureLoader();
    loader.setCrossOrigin('anonymous');
    loader.load(
      imageUrl,
      (texture) => {
        texture.colorSpace = THREE.SRGBColorSpace;
        if (engine.current) {
          (engine.current.sphere.material as THREE.MeshBasicMaterial).map = texture;
          (engine.current.sphere.material as THREE.MeshBasicMaterial).needsUpdate = true;
        }
        setIsReady(true);
      },
      undefined,
      () => setError('全景图像加载失败')
    );
  }, [imageUrl]);

  // === 3. 暴露给外层的 Ref API ===
  useImperativeHandle(ref, () => ({
    resetView: () => {
      if (!engine.current) return;
      engine.current.yaw = 0;
      engine.current.pitch = 0;
      engine.current.fov = defaultFov;
    },
    setZoom: (targetFov: number) => {
      if (engine.current) engine.current.fov = targetFov;
    },
    getCameraPose: () => {
      if (!engine.current) return { yaw: 0, pitch: 0, fov: defaultFov };
      return { yaw: engine.current.yaw, pitch: engine.current.pitch, fov: engine.current.fov };
    },
    takeScreenshot: () => {
      if (!engine.current || !canvasRef.current) return null;
      engine.current.renderer.render(engine.current.scene, engine.current.camera);
      return {
        dataUrl: canvasRef.current.toDataURL('image/jpeg', 0.9),
        width: canvasRef.current.width,
        height: canvasRef.current.height
      };
    }
  }));

  // === 4. 视角与交互处理 (漫游与空间选点) ===
  const handlePointerDown = (e: React.PointerEvent) => {
    if (!engine.current) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    engine.current.isDragging = true;
    engine.current.dragStartX = e.clientX;
    engine.current.dragStartY = e.clientY;
    engine.current.yawStart = engine.current.yaw;
    engine.current.pitchStart = engine.current.pitch;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!engine.current || !engine.current.isDragging) return;
    const deltaX = e.clientX - engine.current.dragStartX;
    const deltaY = e.clientY - engine.current.dragStartY;

    // FOV越小（拉得越近），视角移动越跟手缓慢，还原原版阻尼感
    const sensitivity = (engine.current.fov / 100) * 0.003; 
    
    engine.current.yaw = engine.current.yawStart + deltaX * sensitivity;
    engine.current.pitch = engine.current.pitchStart + deltaY * sensitivity; 
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    const eState = engine.current;
    if (!eState) return;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    eState.isDragging = false;

    // Raycast: 如果位移微小则判定为合法 Click 进行空间着落
    const dist = Math.hypot(e.clientX - eState.dragStartX, e.clientY - eState.dragStartY);
    if (dist < 5 && onSpaceClick) {
      const rect = eState.renderer.domElement.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), eState.camera);
      const intersects = raycaster.intersectObject(eState.sphere);
      
      if (intersects.length > 0) {
        const point = intersects[0].point;
        const radius = Math.hypot(point.x, point.y, point.z);
        if (radius > 0) {
          const pitch = Math.asin(point.y / radius);
          const yaw = Math.atan2(point.x, -point.z);
          onSpaceClick(yaw, pitch, point);
        }
      }
    }
  };

  const handleWheel = (e: React.WheelEvent) => {
    if (!engine.current) return;
    const zoomSensitivity = 0.05;
    engine.current.fov += e.deltaY * zoomSensitivity;
  };

  // === 5. 将配置的 3D 对象的世界坐标实时正交投影为 2D 坐标系 ===
  const updateObjectProjections = useCallback(() => {
    if (!engine.current || spatialObjects.length === 0) {
      setObjectPositions({});
      return;
    }
    const e = engine.current;
    const newPositions: Record<string, { x: number, y: number, visible: boolean }> = {};
    const radius = 29.5; // 设置在球面上一层防止穿模被过滤

    spatialObjects.forEach(obj => {
      const phi = Math.PI / 2 - obj.pitch;
      const theta = Math.PI + obj.yaw; 

      const pos3D = new THREE.Vector3(
        radius * Math.sin(phi) * Math.sin(theta),
        radius * Math.cos(phi),
        radius * Math.sin(phi) * Math.cos(theta)
      );

      const projected = pos3D.clone().project(e.camera);
      // z > 1 说明转到相机的背面，不再绘制
      const visible = projected.z < 1.0 && projected.z > -1.0; 
      
      const x = ((projected.x + 1) / 2) * e.width;
      const y = ((-projected.y + 1) / 2) * e.height;

      newPositions[obj.id] = { x, y, visible };
    });
    
    setObjectPositions(newPositions);
  }, [spatialObjects]);

  useEffect(() => {
    window.addEventListener('panorama-render-tick', updateObjectProjections);
    return () => window.removeEventListener('panorama-render-tick', updateObjectProjections);
  }, [updateObjectProjections]);

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full h-full bg-zinc-950 overflow-hidden rounded-2xl border border-zinc-800 ${className}`}
    >
      <canvas 
        ref={canvasRef}
        className={`w-full h-full touch-none cursor-move ${!isReady ? 'opacity-0' : 'opacity-100 transition-opacity duration-700'}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
      />
      
      {/* 渲染注入的 3D 浮标容器元素*/}
      {isReady && spatialObjects.map((obj) => {
        const pos = objectPositions[obj.id];
        if (!pos || !pos.visible) return null;
        return (
          <div 
            key={obj.id}
            className="absolute top-0 left-0 pointer-events-auto transform -translate-x-1/2 -translate-y-1/2"
            style={{ 
              transform: `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%)`,
              opacity: (pos.x < -100 || pos.x > (containerRef.current?.clientWidth || 0) + 100) ? 0 : 1 
            }}
          >
            {obj.element}
          </div>
        );
      })}

      {/* 小工具栏，原汁原味的 React 编排样式 */}
      {isReady && (
        <div className="absolute right-4 bottom-4 flex flex-col gap-2 pointer-events-none z-10">
          <div className="bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-xl p-1 shadow-xl flex flex-col pointer-events-auto">
            <button 
              type="button" 
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              onClick={() => { if(engine.current) engine.current.fov = Math.max(20, engine.current.fov - 10) }}
            >
              <ZoomIn size={18} />
            </button>
            <button 
              type="button" 
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              onClick={() => { if(engine.current) engine.current.fov = Math.min(120, engine.current.fov + 10) }}
            >
              <ZoomOut size={18} />
            </button>
            <div className="w-full h-px bg-zinc-800 my-1"/>
            <button 
              type="button" 
              className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
              onClick={() => {
                if(engine.current) {
                  engine.current.yaw = 0;
                  engine.current.pitch = 0;
                }
              }}
            >
              <Compass size={18} />
            </button>
          </div>
        </div>
      )}

      {/* 加载态 */}
      {!isReady && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-zinc-900">
           {error ? (
             <div className="text-red-400 p-4 bg-red-400/10 border border-red-400/20 rounded-xl text-sm">
               {error}
             </div>
           ) : (
             <div className="flex flex-col items-center gap-4 text-zinc-500">
               <div className="w-6 h-6 border-2 border-zinc-400 border-t-zinc-200 rounded-full animate-spin"/>
               <span className="text-sm font-medium tracking-widest">LOADING</span>
             </div>
           )}
        </div>
      )}
    </div>
  );
});
