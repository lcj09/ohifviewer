/**
 * SingleSliceLineTool - 单切线旋转工具
 *
 * 继承自 CrosshairsTool，与十字线功能类似，但旋转参考线时
 * 仅影响该参考线对应的一个视口，而非所有其他视口。
 *
 * 例如：
 *   - 旋转横截面(axial)中的横线 → 仅冠状位(coronal)图像发生变化
 *   - 旋转横截面(axial)中的竖线 → 仅矢状位(sagittal)图像发生变化
 *
 * 与 CrosshairsTool 的区别：
 *   CrosshairsTool: 旋转参考线时，所有其他视口都会被旋转
 *   SingleSliceLineTool: 旋转参考线时，仅旋转该参考线对应的那个视口
 *
 * 实现方式：
 *   1. 重写 _getRotationHandleNearImagePoint() 以在 editData 中存储目标视口 ID
 *   2. 在构造函数中替换 _getAnnotationsForViewportsWithDifferentCameras，
 *      当旋转操作激活时，仅返回目标视口的注解
 *   3. 在构造函数中替换 _endCallback 以清理 targetViewportId
 *   4. 在构造函数中替换 mouseMoveCallback 添加 undefined 检查
 *
 * 注意：不能修改已有的 CrosshairsTool 功能
 */

import { vec2 } from 'gl-matrix';
import { CrosshairsTool } from '@cornerstonejs/tools';

const OPERATION = {
  DRAG: 1,
  ROTATE: 2,
  SLAB: 3,
};

class SingleSliceLineTool extends CrosshairsTool {
  static toolName = 'SingleSliceLine';

  // 不设置 defaultToolProps 的默认值，让 CrosshairsTool 的默认配置生效
  // CrosshairsTool 的默认配置包含：
  //   - supportedInteractionTypes: ['Mouse'] - 鼠标交互支持
  //   - configuration: { handleRadius, referenceLinesCenterGapRadius, ... } - 渲染配置
  // 如果设置 defaultToolProps = {}，会覆盖这些默认值，导致工具无法交互和渲染
  constructor(toolProps: any, defaultToolProps?: any) {
    super(toolProps, defaultToolProps);

    // ====================================================================
    // 替换 _getAnnotationsForViewportsWithDifferentCameras - 核心修改
    //
    // 当旋转操作激活时（editData.targetViewportId 存在），
    // 仅返回目标视口的注解，使旋转只影响该视口。
    //
    // 其他操作（DRAG、SLAB）不受影响，仍返回所有视口注解。
    // ====================================================================
    const originalGetAnnotationsForViewportsWithDifferentCameras =
      this._getAnnotationsForViewportsWithDifferentCameras.bind(this);

    this._getAnnotationsForViewportsWithDifferentCameras = (enabledElement, annotations) => {
      const result = originalGetAnnotationsForViewportsWithDifferentCameras(
        enabledElement,
        annotations
      );
      const targetViewportId = (this.editData as any)?.targetViewportId;
      // 仅在旋转操作激活时过滤，其他操作不受影响
      if (targetViewportId) {
        return result.filter(
          annotation => annotation.data.viewportId === targetViewportId
        );
      }
      return result;
    };

    // ====================================================================
    // 替换 _endCallback - 清理 editData 中的 targetViewportId
    // ====================================================================
    const originalEndCallback = this._endCallback.bind(this);

    this._endCallback = (evt) => {
      // 先清理 targetViewportId
      if (this.editData) {
        (this.editData as any).targetViewportId = undefined;
      }
      // 调用原始回调
      originalEndCallback(evt);
    };

    // ====================================================================
    // 替换 mouseMoveCallback - 添加 undefined 检查
    // 与 initToolGroups.js 中对 CrosshairsTool 的 patch 相同
    // ====================================================================
    const originalMouseMoveCallback = this.mouseMoveCallback.bind(this);
    this.mouseMoveCallback = function (evt, filteredToolAnnotations) {
      if (!filteredToolAnnotations) {
        return false;
      }
      return originalMouseMoveCallback(evt, filteredToolAnnotations);
    };
  }

  // ====================================================================
  // 重写 _getRotationHandleNearImagePoint（原型方法，可以重写）
  // 与 CrosshairsTool 的区别：在 editData 中额外存储 targetViewportId
  // ====================================================================
  _getRotationHandleNearImagePoint(viewport, annotation, canvasCoords, proximity) {
    const { data } = annotation;
    const { rotationPoints } = data.handles;

    // 获取最小化十字线配置
    const minimalCrosshairConfig =
      this.configuration?.minimal?.enabled
        ? this.configuration.minimal
        : { enabled: false };

    for (let i = 0; i < rotationPoints.length; i++) {
      const point = rotationPoints[i][0];
      const otherViewport = rotationPoints[i][1];
      const viewportControllable = this._getReferenceLineControllable(otherViewport.id);
      if (!viewportControllable) {
        continue;
      }
      const viewportDraggableRotatable =
        !minimalCrosshairConfig.enabled &&
        this._getReferenceLineDraggableRotatable(otherViewport.id);
      if (!viewportDraggableRotatable) {
        continue;
      }
      const annotationCanvasCoordinate = viewport.worldToCanvas(point);
      if (vec2.distance(canvasCoords, annotationCanvasCoordinate) < proximity) {
        data.handles.activeOperation = OPERATION.ROTATE;
        this.editData = {
          annotation,
          // 【关键新增】存储目标视口ID，旋转时仅影响此视口
          targetViewportId: otherViewport.id,
        } as any;
        return point;
      }
    }
    return null;
  }
}

export default SingleSliceLineTool;
