// [2026-06-26 新增] 球体测量工具 (SphereROITool)
//
// 功能：
//   在视口上绘制一个圆形（与CircleROI相同的交互），
//   但以该圆的半径构建一个3D球体进行体素级统计计算。
//
//   统计输出：
//     - Radius: 球体半径 (mm)
//     - Area:   横截面积 π·r² (mm²)
//     - Volume: 球体体积 (4/3)·π·r³ (mm³)
//     - Max:    球体内最大像素值 (SUVbw / HU)
//     - Min:    球体内最小像素值
//     - Mean:   球体内平均像素值
//     - Std Dev: 标准差
//
// 适用场景：
//   - PT视口: 显示 SUV Max/Min/Mean（需预缩放）
//   - CT视口: 显示 HU Max/Min/Mean + Volume
//
// 实现原理：
//   继承 CircleROITool 以复用绘制/拖拽/编辑逻辑，
//   仅覆盖 _calculateCachedStats 使用球体3D体素迭代：
//     1. getSphereBoundsInfo 获取球体在IJK空间的边界框
//     2. pointInSphere 判断每个体素是否在球体内
//     3. BasicStatsCalculator 累积 max/min/mean/stdDev
//     4. 体积 = (4/3)·π·r³，面积 = π·r²

import {
  CircleROITool,
  BaseTool,
  utilities,
  Enums,
  annotation as csAnnotation,
} from '@cornerstonejs/tools';
import { utilities as csUtils } from '@cornerstonejs/core';

const { ChangeTypes } = Enums;
const { triggerAnnotationModified } = csAnnotation.state;
const {
  getCalibratedLengthUnitsAndScale,
  getPixelValueUnits,
  getSphereBoundsInfo,
  throttle,
} = utilities;
const { isViewportPreScaled } = utilities.viewport;
// 注意: utilities.math.BasicStatsCalculator 是命名空间对象，需再取一层 .BasicStatsCalculator
const BasicStatsCalculator = utilities.math.BasicStatsCalculator.BasicStatsCalculator;

/**
 * 判断点是否在球体内
 * 与 @cornerstonejs/tools 内部 pointInSphere 实现一致
 */
function pointInSphere(sphere: { center: number[]; radius: number; radius2?: number }, pointLPS: number[]): boolean {
  const { center, radius } = sphere;
  const radius2 = sphere.radius2 || radius * radius;
  const dx = pointLPS[0] - center[0];
  const dy = pointLPS[1] - center[1];
  const dz = pointLPS[2] - center[2];
  return dx * dx + dy * dy + dz * dz <= radius2;
}

/**
 * 球体测量统计文本生成
 * 显示: Radius, Area, Volume, Mean, Max, Min, Std Dev
 */
function sphereGetTextLines(data, targetId) {
  const cachedVolumeStats = data.cachedStats[targetId];
  if (!cachedVolumeStats) {
    return [];
  }
  const {
    radius,
    radiusUnit,
    area,
    areaUnit,
    volume,
    volumeUnit,
    mean,
    stdDev,
    max,
    min,
    modalityUnit,
  } = cachedVolumeStats;

  const textLines = [];

  if (csUtils.isNumber(radius)) {
    textLines.push(`Radius: ${csUtils.roundNumber(radius)} ${radiusUnit || ''}`);
  }
  if (csUtils.isNumber(area)) {
    textLines.push(`Area: ${csUtils.roundNumber(area)} ${areaUnit || ''}`);
  }
  if (csUtils.isNumber(volume)) {
    textLines.push(`Volume: ${csUtils.roundNumber(volume)} ${volumeUnit || ''}`);
  }
  if (csUtils.isNumber(mean)) {
    textLines.push(`Mean: ${csUtils.roundNumber(mean)} ${modalityUnit || ''}`);
  }
  if (csUtils.isNumber(max)) {
    textLines.push(`Max: ${csUtils.roundNumber(max)} ${modalityUnit || ''}`);
  }
  if (csUtils.isNumber(min)) {
    textLines.push(`Min: ${csUtils.roundNumber(min)} ${modalityUnit || ''}`);
  }
  if (csUtils.isNumber(stdDev)) {
    textLines.push(`Std Dev: ${csUtils.roundNumber(stdDev)} ${modalityUnit || ''}`);
  }
  return textLines;
}

class SphereROITool extends CircleROITool {
  static toolName = 'SphereROI';

  constructor(toolProps = {}, defaultToolProps = {
    supportedInteractionTypes: ['Mouse', 'Touch'],
    configuration: {
      shadow: true,
      preventHandleOutsideImage: false,
      storePointData: false,
      centerPointRadius: 0,
      calculateStats: true,
      getTextLines: sphereGetTextLines,
      statsCalculator: BasicStatsCalculator,
      simplified: true,
    },
  }) {
    super(toolProps, defaultToolProps);

    // 确保使用球体专用的文本生成函数
    this.configuration.getTextLines = sphereGetTextLines;

    // [核心] 覆盖 _calculateCachedStats，使用球体3D体素迭代
    this._calculateCachedStats = (annotation, viewport, renderingEngine, _enabledElement) => {
      if (!this.configuration.calculateStats) {
        return;
      }

      const data = annotation.data;
      const { element } = viewport;
      const wasInvalidated = annotation.invalidated;
      const { points } = data.handles;
      const { cachedStats } = data;

      const targetIds = Object.keys(cachedStats);

      for (let i = 0; i < targetIds.length; i++) {
        const targetId = targetIds[i];
        const image = this.getTargetImageData(targetId);

        if (!image) {
          delete cachedStats[targetId];
          continue;
        }

        const { dimensions, imageData, metadata, voxelManager } = image;

        // 使用 getSphereBoundsInfo 计算球体3D边界（用于体素迭代）
        // points[0] = 球心, points[1] = 边缘点（均为world坐标）
        const sphereBounds = getSphereBoundsInfo(points, imageData);
        const { boundsIJK, centerWorld, radiusWorld } = sphereBounds;

        // 校准单位计算 - 与 CircleROITool 完全一致的方式计算半径
        // handles 是索引空间坐标，calculateLengthInIndex 将索引距离转换为校准后的mm
        const handles = points.map(point => imageData.worldToIndex(point));
        const calibrate = getCalibratedLengthUnitsAndScale(image, handles);
        const { unit, areaUnit, volumeUnit } = calibrate;

        // 使用与 CircleROITool 相同的 calculateLengthInIndex 计算校准半径
        // 避免直接用 radiusWorld / scale（radiusWorld 已是mm，会重复乘以 pixelSpacing）
        const calibratedRadius = CircleROITool.calculateLengthInIndex(calibrate, handles.slice(0, 2));
        // 横截面积 = π · r²
        const area = Math.PI * calibratedRadius * calibratedRadius;
        // 球体体积 = (4/3) · π · r³
        const volume = (4 / 3) * Math.PI * calibratedRadius * calibratedRadius * calibratedRadius;

        // 检查手柄是否在体积范围外
        this.isHandleOutsideImage = !BaseTool.isInsideVolume(dimensions, [
          imageData.worldToIndex(points[0]),
          imageData.worldToIndex(points[1]),
        ]);

        // 像素单位（PT→SUV, CT→HU）
        const pixelUnitsOptions = {
          isPreScaled: isViewportPreScaled(viewport, targetId),
          isSuvScaled: this.isSuvScaled(viewport, targetId, annotation.metadata.referencedImageId),
        };
        const modalityUnit = getPixelValueUnits(
          metadata.Modality,
          annotation.metadata.referencedImageId,
          pixelUnitsOptions
        );

        // 球体对象用于 pointInSphere 判断
        const sphereObj = {
          center: centerWorld,
          radius: radiusWorld,
        };

        // 初始化 cachedStats 基础字段
        cachedStats[targetId] = {
          Modality: metadata.Modality,
          radius: calibratedRadius,
          radiusUnit: unit,
          area,
          areaUnit,
          volume,
          volumeUnit,
          mean: null,
          max: null,
          min: null,
          stdDev: null,
          modalityUnit,
          pointsInShape: null,
          statsArray: [],
        };

        // 如果手柄不在体积外，进行3D体素迭代统计
        if (!this.isHandleOutsideImage && voxelManager) {
          voxelManager.forEach(
            this.configuration.statsCalculator.statsCallback,
            {
              isInObject: (pointLPS: number[]) => pointInSphere(sphereObj, pointLPS),
              boundsIJK,
              imageData,
              returnPoints: this.configuration.storePointData,
            }
          );

          const stats = this.configuration.statsCalculator.getStatistics();

          cachedStats[targetId] = {
            ...cachedStats[targetId],
            Modality: metadata.Modality,
            mean: stats.mean?.value,
            max: stats.max?.value,
            min: stats.min?.value,
            stdDev: stats.stdDev?.value,
            statsArray: stats.array,
          };
        }
      }

      annotation.invalidated = false;
      if (wasInvalidated) {
        triggerAnnotationModified(annotation, element, ChangeTypes.StatsUpdated);
      }
      return cachedStats;
    };

    // 重建节流版本（指向新的 _calculateCachedStats）
    this._throttledCalculateCachedStats = throttle(
      this._calculateCachedStats,
      100,
      { trailing: true }
    );
  }
}

export default SphereROITool;
