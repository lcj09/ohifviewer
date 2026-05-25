// [2026-05-22 新增] 融合图像微调工具
//
// 功能：在融合视口中：
//   - 左键拖拽平移PET图像，不影响CT图像
//   - 右键拖拽旋转PET图像（绕视图平面法线方向旋转）
//   同时同步变换到同方向的PT独立视口
//   不同步MIP视口和其他截面的PET图像
//
// 实现原理：
//   使用vtkVolume actor的UserMatrix统一管理平移和旋转变换
//   变换顺序：M = Translation * Rotation（先旋转再平移）
//   旋转轴为相机视图平面法线方向，实现面内旋转效果
//
// 视口ID对应关系：
//   fusionAXIAL    → ptAXIAL
//   fusionSAGITTAL → ptSAGITTAL
//   fusionCoronal  → ptCORONAL
//   MIP视口不参与同步
//
// 鼠标按键检测：
//   通过document级mousedown事件监听器追踪当前按下的鼠标按键
//   button=0(左键)→平移, button=2(右键)→旋转

import { BaseTool } from '@cornerstonejs/tools';
import { getEnabledElement, getRenderingEngines } from '@cornerstonejs/core';
import { mat4 } from 'gl-matrix';

class FusionAdjustTool extends BaseTool {
  static toolName = 'FusionAdjust';

  // 每个视口的累计变换矩阵（4x4，包含平移+旋转）
  // key: viewportId, value: number[16]
  private _transforms: Map<string, number[]> = new Map();

  // 当前拖拽的鼠标按键：0=左键(平移), 2=右键(旋转)
  private _activeButton: number = 0;
  private _onMouseDown: ((e: MouseEvent) => void) | null = null;
  private _onMouseUp: (() => void) | null = null;

  constructor(toolProps = {}, defaultToolProps = {
    supportedInteractionTypes: ['Mouse'],
    configuration: {
      rotationSensitivity: 0.3, // 每像素水平拖拽对应的旋转角度（度）
    },
  }) {
    super(toolProps, defaultToolProps);

    // 通过document级事件监听器追踪鼠标按键状态
    // Cornerstone3D的事件detail中不包含原始DOM事件的buttons信息
    // 因此需要用原生事件来区分左键和右键拖拽
    if (typeof document !== 'undefined') {
      this._onMouseDown = (e: MouseEvent) => {
        this._activeButton = e.button; // 0=左键, 1=中键, 2=右键
      };
      this._onMouseUp = () => {
        this._activeButton = 0;
      };
      document.addEventListener('mousedown', this._onMouseDown, true);
      document.addEventListener('mouseup', this._onMouseUp, true);
    }
  }

  mouseDragCallback(evt: any) {
    const { element, deltaPoints } = evt.detail;
    const enabledElement = getEnabledElement(element);
    const { viewport } = enabledElement;

    // 右键→旋转，左键/其他→平移
    if (this._activeButton === 2) {
      this._handleRotate(viewport, deltaPoints.canvas);
    } else {
      this._handlePan(viewport, deltaPoints.world);
    }
  }

  // ========== 左键平移 ==========

  private _handlePan(viewport: any, deltaPointsWorld: number[]) {
    if (deltaPointsWorld[0] === 0 && deltaPointsWorld[1] === 0 && deltaPointsWorld[2] === 0) return;

    const actors = viewport.getActors();
    if (actors.length < 2) return;

    const viewportId = viewport.id;
    const transform = this._getTransform(viewportId);

    // 创建增量平移矩阵
    const deltaMat = mat4.create() as Float32Array;
    mat4.translate(deltaMat, deltaMat, deltaPointsWorld as [number, number, number]);

    // 前乘：新变换 = 增量平移 * 当前变换
    // 效果：在世界坐标系中平移，不受当前旋转影响
    const newTransform = mat4.create() as Float32Array;
    mat4.multiply(newTransform, deltaMat, transform);

    this._setTransform(viewportId, newTransform);
    this._applyTransformToActor(actors[1].actor, newTransform);
    viewport.render();

    this._syncToCorrespondingPTViewport(viewportId, newTransform);
  }

  // ========== 右键旋转 ==========

  private _handleRotate(viewport: any, deltaPointsCanvas: number[]) {
    const actors = viewport.getActors();
    if (actors.length < 2) return;

    // 根据水平canvas位移计算旋转角度
    const sensitivity = (this.configuration as any).rotationSensitivity || 0.3;
    const angleDegrees = deltaPointsCanvas[0] * sensitivity;
    const angleRadians = angleDegrees * (Math.PI / 180);

    if (Math.abs(angleRadians) < 0.0001) return;

    const viewportId = viewport.id;
    const transform = this._getTransform(viewportId);

    // 获取相机视图平面法线作为旋转轴，实现面内旋转
    const camera = viewport.getCamera();
    const viewPlaneNormal = camera.viewPlaneNormal as [number, number, number];

    // 创建绕视图平面法线的旋转矩阵
    const rotMat = mat4.create() as Float32Array;
    mat4.rotate(rotMat, rotMat, angleRadians, viewPlaneNormal);

    // 前乘：新变换 = 增量旋转 * 当前变换
    // 效果：在世界坐标系中旋转，绕视图中心面内旋转
    const newTransform = mat4.create() as Float32Array;
    mat4.multiply(newTransform, rotMat, transform);

    this._setTransform(viewportId, newTransform);
    this._applyTransformToActor(actors[1].actor, newTransform);
    viewport.render();

    this._syncToCorrespondingPTViewport(viewportId, newTransform);
  }

  // ========== 变换矩阵管理 ==========

  private _getTransform(viewportId: string): Float32Array {
    const stored = this._transforms.get(viewportId);
    if (stored) {
      return new Float32Array(stored);
    }
    return new Float32Array(mat4.create() as Float32Array); // 单位矩阵
  }

  private _setTransform(viewportId: string, transform: Float32Array) {
    this._transforms.set(viewportId, Array.from(transform));
  }

  // 将变换矩阵应用到PET actor的UserMatrix
  // 同时重置position为[0,0,0]避免与UserMatrix冲突
  private _applyTransformToActor(actor: any, transform: Float32Array) {
    actor.setPosition(0, 0, 0);
    actor.setUserMatrix(new Float64Array(transform));
    actor.modified();
  }

  // ========== PT视口同步 ==========

  // 同步变换到同方向的PT独立视口
  private _syncToCorrespondingPTViewport(fusionViewportId: string, transform: Float32Array) {
    const ptViewportId = this._getCorrespondingPTViewportId(fusionViewportId);
    if (!ptViewportId) return;

    try {
      const ptViewport = this._getViewportById(ptViewportId);
      if (!ptViewport) return;

      const ptActor = ptViewport.getActors()[0]?.actor as any;
      if (!ptActor) return;

      this._applyTransformToActor(ptActor, transform);
      this._transforms.set(ptViewportId, Array.from(transform));
      ptViewport.render();
    } catch (e) {
      // 同步失败不影响融合视口的操作
    }
  }

  // 根据融合视口ID推算同方向PT视口ID
  // fusionAXIAL → ptAXIAL, fusionSAGITTAL → ptSAGITTAL, fusionCoronal → ptCORONAL
  private _getCorrespondingPTViewportId(fusionViewportId: string): string | null {
    const lower = fusionViewportId.toLowerCase();
    if (lower.startsWith('fusion')) {
      const orientation = fusionViewportId.slice(6);
      return 'pt' + orientation.toUpperCase();
    }
    return null;
  }

  // 通过renderingEngine获取指定ID的视口
  private _getViewportById(viewportId: string): any | null {
    try {
      const renderingEngines = getRenderingEngines();
      const renderingEngine = renderingEngines?.[0];
      if (!renderingEngine) return null;
      return renderingEngine.getViewport(viewportId);
    } catch (e) {
      return null;
    }
  }

  // ========== 重置功能 ==========

  // 重置指定视口的PET变换，同时重置同方向PT视口
  resetOffset(viewport: any) {
    const viewportId = viewport.id;
    if (!this._transforms.has(viewportId)) return;

    const actors = viewport.getActors();
    if (actors.length < 2) return;

    // 恢复为单位矩阵
    const identity = new Float32Array(mat4.create() as Float32Array);
    this._applyTransformToActor(actors[1].actor, identity);
    this._transforms.delete(viewportId);
    viewport.render();

    // 同步重置同方向PT视口
    this._resetCorrespondingPTViewport(viewportId);
  }

  // 重置同方向PT视口的变换
  private _resetCorrespondingPTViewport(fusionViewportId: string) {
    const ptViewportId = this._getCorrespondingPTViewportId(fusionViewportId);
    if (!ptViewportId || !this._transforms.has(ptViewportId)) return;

    try {
      const ptViewport = this._getViewportById(ptViewportId);
      if (!ptViewport) return;

      const ptActor = ptViewport.getActors()[0]?.actor as any;
      if (!ptActor) return;

      const identity = new Float32Array(mat4.create() as Float32Array);
      this._applyTransformToActor(ptActor, identity);
      this._transforms.delete(ptViewportId);
      ptViewport.render();
    } catch (e) {
      // 同步重置失败不影响融合视口
    }
  }

  // 获取指定视口的变换矩阵
  getOffset(viewportId: string): number[] | undefined {
    return this._transforms.get(viewportId);
  }

  // 重置所有视口的PET变换（融合视口+对应PT视口）
  resetAllOffsets(getViewportFn: (viewportId: string) => any) {
    const identity = new Float32Array(mat4.create());
    this._transforms.forEach((_, viewportId) => {
      const viewport = getViewportFn(viewportId);
      if (!viewport) return;

      const actors = viewport.getActors();
      const ptActorEntry = actors.length >= 2 ? actors[1] : actors[0];
      if (ptActorEntry) {
        this._applyTransformToActor(ptActorEntry.actor, identity);
        viewport.render();
      }
    });
    this._transforms.clear();
  }
}

export default FusionAdjustTool;
