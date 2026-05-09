/**
 * [2026-04-29 新增功能] TMTV模式实时像素信息探针组件 (PixelInfoOverlay)
 *
 * ============================================================================
 * 功能概述：
 *   在TMTV模式下为PET/CT图像提供实时像素值探针功能，
 *   医生无需点击或拖动，只需移动鼠标即可快速查看任意位置的SUV值和HU值。
 *
 * ============================================================================
 * 核心特性：
 *
 * 1. 实时显示（Real-time Display）
 *    - 鼠标移入viewport区域 → 自动显示像素信息浮动提示
 *    - 鼠标在图像上移动 → 实时更新坐标和数值
 *    - 鼠标移出viewport → 自动隐藏提示
 *
 * 2. 智能模态识别（Smart Modality Detection）
 *    - CT视口：显示HU值（Hounsfield Unit）
 *    - PT视口：显示SUVbw值（Standardized Uptake Value body weight）
 *    - Fusion融合视口：优先显示PT volume的SUVbw值
 *
 * 3. 多视口独立（Viewport Independence）
 *    - 每个viewport维护独立的组件实例
 *    - 各viewport的显示状态互不干扰
 *    - 支持CT/PT/Fusion/MIP等多种视口类型
 *
 * 4. 全局开关控制（Global Toggle Control）
 *    - 通过工具栏[🔬探针]按钮统一控制所有viewport的开关状态
 *    - 默认关闭，需用户手动激活
 *    - 与测量工具互斥（启用探针时自动取消测量工具激活状态）
 *
 * ============================================================================
 * 显示内容格式：
 *
 * ┌──────────────────────────────┐
 * │ P:256 A:320 F:45            │  ← IJK坐标 (P=I, A=J, F=K)
 * │ Value:3.25 SUV bw           │  ← 像素值 + 单位
 * └──────────────────────────────┘
 *   样式：黑色半透明背景 + #00ff00绿色文字 + 跟随鼠标移动
 *
 * ============================================================================
 * 技术架构：
 *
 * 组件层级关系：
 *   CornerstoneOverlays.tsx (容器组件)
 *     └── PixelInfoOverlay.tsx (本组件) × N个实例 (每个viewport一个)
 *
 * 数据流：
 *   用户点击[探针]按钮
 *     → commandsModule.togglePixelInfo命令执行
 *       → PixelInfoManager.enable()/disable()
 *         → 更新全局变量 isPixelInfoEnabled
 *           → 触发 CustomEvent('pixelInfoStateChanged')
 *             → 本组件监听事件并更新enabled状态
 *               → enabled=true时响应mousemove事件
 *                 → 调用Cornerstone3D API获取像素数据
 *                   → 渲染浮动提示DOM元素
 *
 * API调用链：
 *   mousemove事件
 *     → getEnabledElement(element) 获取启用的元素
 *       → viewport.canvasToWorld(canvasPoint) 坐标转换
 *         → viewport.getAllVolumeIds() 获取volume列表
 *           → cache.getVolume(volId) 从缓存获取volume对象
 *             → csUtils.transformWorldToIndex() 世界坐标→IJK坐标
 *               → voxelManager.getAtIJKPoint(ijk) 获取像素值
 *
 * ============================================================================
 * 文件位置：
 *   extensions/cornerstone/src/Viewport/Overlays/PixelInfoOverlay.tsx
 *
 * 使用范围：
 *   仅在TMTV模式中使用（不影响基础查看器basic viewer）
 *
 * 修改历史：
 *   [2026-04-29] 初始创建 - 基础浮动提示功能
 *   [2026-04-29] 添加Fusion视口PT volume优先逻辑
 *   [2026-04-29] 修复API错误：getVolumes() → getAllVolumeIds() + cache.getVolume()
 *   [2026-04-29] 简化功能：移除十字标记和固定标注功能
 *   [2026-04-29] 改进互斥逻辑：使用toolGroup.setToolPassive()实现与测量工具互斥
 *
 * ============================================================================
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { utilities as csUtils, VolumeViewport, cache } from '@cornerstonejs/core';
import { getEnabledElement } from '@cornerstonejs/core';

// ============================================================================
// [2026-04-29 新增] 全局状态管理模块
// ============================================================================

// [2026-04-29] 探针功能的总开关状态
// - 默认值: false（页面加载时不自动启动，避免干扰用户操作）
// - 作用域: 全局单例（所有viewport共享同一个开关状态）
// - 修改时机: 用户点击工具栏[🔬探针]按钮时切换
let isPixelInfoEnabled = false;

// [2026-04-29] 将状态暴露到window对象
// 目的: 供getToolbarModule.tsx中的evaluate函数读取，控制按钮高亮状态
// 避免循环依赖: PixelInfoOverlay ↔ getToolbarModule
(window as any).__pixelInfoEnabled = isPixelInfoEnabled;

// [2026-04-29] PixelInfoManager - 探针功能的外部控制接口
//
// 设计模式: 单例管理器（Singleton Manager Pattern）
// 职责:
//   1. 管理全局开关状态 (isPixelInfoEnabled)
//   2. 同步状态到window对象 (供UI层读取)
//   3. 触发自定义事件 (通知组件更新)
//
// 使用方式:
//   import { PixelInfoManager } from './PixelInfoOverlay';
//   PixelInfoManager.enable();   // 开启探针功能
//   PixelInfoManager.disable();  // 关闭探针功能
//   const isEnabled = PixelInfoManager.toggle(); // 切换并返回新状态
//
export const PixelInfoManager = {
  /**
   * [2026-04-29] 查询当前是否启用
   * @returns {boolean} 当前启用状态
   */
  isEnabled: () => isPixelInfoEnabled,

  /**
   * [2026-04-29] 启用探针功能
   *
   * 执行操作:
   *   1. 设置 isPixelInfoEnabled = true
   *   2. 同步到 window.__pixelInfoEnabled (供evaluate函数读取)
   *   3. 触发 'pixelInfoStateChanged' 自定义事件
   *      → 所有PixelInfoOverlay组件实例监听此事件
   *      → 组件更新本地enabled state
   *      → 开始响应mousemove事件显示浮动提示
   */
  enable: () => {
    isPixelInfoEnabled = true;
    (window as any).__pixelInfoEnabled = true;
    window.dispatchEvent(new CustomEvent('pixelInfoStateChanged', { detail: { enabled: true } }));
  },

  /**
   * [2026-04-29] 禁用探针功能
   *
   * 执行操作:
   *   1. 设置 isPixelInfoEnabled = false
   *   2. 同步到 window.__pixelInfoEnabled
   *   3. 触发 'pixelInfoStateChanged' 自定义事件
   *      → 所有组件停止响应mousemove
   *      → 已显示的浮动提示立即隐藏
   */
  disable: () => {
    isPixelInfoEnabled = false;
    (window as any).__pixelInfoEnabled = false;
    window.dispatchEvent(new CustomEvent('pixelInfoStateChanged', { detail: { enabled: false } }));
  },

  /**
   * [2026-04-29] 切换探针功能开关状态
   * @returns {boolean} 切换后的新状态 (true=已开启, false=已关闭)
   *
   * 使用场景: togglePixelInfo命令调用此方法实现按钮点击切换
   */
  toggle: () => {
    if (isPixelInfoEnabled) {
      PixelInfoManager.disable();
    } else {
      PixelInfoManager.enable();
    }
    return isPixelInfoEnabled;
  },
};

interface PixelInfo {
  ijk: [number, number, number] | null;
  value: number | null;
  unit: string | null;
  worldPos: [number, number, number] | null;
}

function PixelInfoOverlay({
  viewportId,
  element,
  servicesManager,
}: {
  viewportId: string;
  element: HTMLElement;
  servicesManager: AppTypes.ServicesManager;
}) {
  const [pixelInfo, setPixelInfo] = useState<PixelInfo>({
    ijk: null,
    value: null,
    unit: null,
    worldPos: null,
  });
  const [mousePosition, setMousePosition] = useState<{ x: number; y: number } | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [enabled, setEnabled] = useState(isPixelInfoEnabled);
  const isInsideViewport = useRef(false);

  // 监听全局状态变化事件
  useEffect(() => {
    const handleStateChange = (event: CustomEvent) => {
      setEnabled(event.detail.enabled);
    };
    window.addEventListener('pixelInfoStateChanged', handleStateChange as EventListener);
    return () => {
      window.removeEventListener('pixelInfoStateChanged', handleStateChange as EventListener);
    };
  }, []);

  // 鼠标移动事件处理函数
  const handleMouseMove = useCallback(
    (evt: MouseEvent) => {
      if (!isInsideViewport.current || !element || !isPixelInfoEnabled) return;

      try {
        const enabledElement = getEnabledElement(element);
        if (!enabledElement) return;

        const { viewport } = enabledElement;
        if (!viewport) return;

        // 获取鼠标相对于element的坐标
        const rect = element.getBoundingClientRect();
        const x = evt.clientX - rect.left;
        const y = evt.clientY - rect.top;

        // 将canvas坐标转换为世界坐标
        const canvasPoint = [x, y] as [number, number];
        const worldPos = viewport.canvasToWorld(canvasPoint);

        // 检查世界坐标是否有效
        if (!worldPos || !Number.isFinite(worldPos[0])) {
          setIsVisible(false);
          return;
        }

        let value = null;
        let unit = 'HU';
        let ijk: [number, number, number] | null = null;

        if (viewport instanceof VolumeViewport) {
          // 使用正确的Cornerstone3D API获取volume数据
          const volumeIds = viewport.getAllVolumeIds();

          if (!volumeIds || volumeIds.length === 0) {
            setIsVisible(false);
            return;
          }

          // 遍历所有volumes，优先找PT volume
          let targetVolume = null;
          for (const volId of volumeIds) {
            try {
              const vol = cache.getVolume(volId);
              if (vol) {
                const modality = vol.metadata?.Modality;
                if (modality === 'PT') {
                  targetVolume = vol;
                  break;
                } else if (!targetVolume) {
                  targetVolume = vol;
                }
              }
            } catch (e) {
              console.error(`[PixelInfo] Error getting volume ${volId}:`, e);
            }
          }

          // 从targetVolume获取像素数据
          if (targetVolume && targetVolume.voxelManager) {
            const imageData = targetVolume.imageData;
            const dimensions = targetVolume.dimensions;
            const metadata = targetVolume.metadata;
            const voxelManager = targetVolume.voxelManager;

            if (imageData && dimensions && voxelManager) {
              let tempIjk = csUtils.transformWorldToIndex(imageData, worldPos);
              tempIjk = [
                Math.round(tempIjk[0]),
                Math.round(tempIjk[1]),
                Math.round(tempIjk[2]),
              ] as [number, number, number];

              const isWithinBounds =
                tempIjk[0] >= 0 &&
                tempIjk[0] < dimensions[0] &&
                tempIjk[1] >= 0 &&
                tempIjk[1] < dimensions[1] &&
                tempIjk[2] >= 0 &&
                tempIjk[2] < dimensions[2];

              if (isWithinBounds) {
                ijk = tempIjk;
                value = voxelManager.getAtIJKPoint(ijk);

                const modality = metadata?.Modality || '';
                if (modality === 'PT') {
                  unit = 'SUV bw';
                } else if (modality === 'CT') {
                  unit = 'HU';
                }
              }
            }
          }
        } else {
          // 非VolumeViewport的处理
          const image = viewport.getImageData();
          if (!image || !image.voxelManager) {
            setIsVisible(false);
            return;
          }

          const { imageData, dimensions, metadata, voxelManager } = image;

          let tempIjk = csUtils.transformWorldToIndex(imageData, worldPos);
          tempIjk = [
            Math.round(tempIjk[0]),
            Math.round(tempIjk[1]),
            Math.round(tempIjk[2]),
          ] as [number, number, number];

          const isWithinBounds =
            tempIjk[0] >= 0 &&
            tempIjk[0] < dimensions[0] &&
            tempIjk[1] >= 0 &&
            tempIjk[1] < dimensions[1] &&
            tempIjk[2] >= 0 &&
            tempIjk[2] < dimensions[2];

          if (!isWithinBounds) {
            setIsVisible(false);
            return;
          }

          ijk = tempIjk;
          value = voxelManager.getAtIJKPoint(ijk);

          const modality = metadata?.Modality || '';
          if (modality === 'PT') {
            unit = 'SUV bw';
          } else if (modality === 'CT') {
            unit = 'HU';
          }
        }

        if (ijk) {
          setMousePosition({ x, y });
          setPixelInfo({
            ijk,
            value: value ?? null,
            unit,
            worldPos: worldPos as [number, number, number],
          });
          setIsVisible(true);
        } else {
          setIsVisible(false);
        }
      } catch (e) {
        console.error('[PixelInfo] Error:', e);
        setIsVisible(false);
      }
    },
    [element]
  );

  // 鼠标进入viewport事件
  const handleMouseEnter = useCallback(() => {
    isInsideViewport.current = true;
  }, []);

  // 鼠标离开viewport事件
  const handleMouseLeave = useCallback(() => {
    isInsideViewport.current = false;
    setIsVisible(false);
  }, []);

  useEffect(() => {
    if (!element) return;

    // 只绑定鼠标移动、进入、离开事件（不绑定mousedown）
    element.addEventListener('mousemove', handleMouseMove);
    element.addEventListener('mouseenter', handleMouseEnter);
    element.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      element.removeEventListener('mousemove', handleMouseMove);
      element.removeEventListener('mouseenter', handleMouseEnter);
      element.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [element, handleMouseMove, handleMouseEnter, handleMouseLeave]);

  // 格式化像素值显示
  const formatValue = (value: number): string => {
    if (Number.isInteger(value)) {
      return value.toString();
    }
    return value.toFixed(2);
  };

  // 不显示浮动提示时返回null
  if (!enabled || !isVisible || !pixelInfo.ijk || mousePosition === null) {
    return null;
  }

  return (
    <>
      {/* 实时浮动的像素信息提示（跟随鼠标） */}
      {(enabled && isVisible && pixelInfo.ijk && mousePosition !== null) && (
        <div
          className="pixel-info-overlay"
          style={{
            position: 'absolute',
            left: mousePosition.x + 15,
            top: mousePosition.y - 10,
            pointerEvents: 'none',
            zIndex: 100,
            fontFamily: 'monospace',
            fontSize: '12px',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            color: '#00ff00',
            padding: '4px 8px',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            lineHeight: '1.4',
          }}
        >
          {/* 第一行：IJK坐标 (P=I, A=J, F=K) */}
          <div>
            P:{formatValue(pixelInfo.ijk[0])} A:{formatValue(pixelInfo.ijk[1])} F:
            {formatValue(pixelInfo.ijk[2])}
          </div>

          {/* 第二行：像素值和单位 */}
          {pixelInfo.value !== null && (
            <div>
              Value:{formatValue(pixelInfo.value)} {pixelInfo.unit}
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default PixelInfoOverlay;
