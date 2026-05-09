import { MIN_SEGMENTATION_DRAWING_RADIUS, MAX_SEGMENTATION_DRAWING_RADIUS } from './constants';
import { PlanarFreehandROITool } from '@cornerstonejs/tools';

export const toolGroupIds = {
  CT: 'ctToolGroup',
  PT: 'ptToolGroup',
  Fusion: 'fusionToolGroup',
  MIP: 'mipToolGroup',
  default: 'default',
  // 2026-04-28 - 新增MPR布局工具组，用于支持十字线等工具（三维不需要）
  MPR: 'mpr',
};

function _initToolGroups(toolNames, Enums, toolGroupService, commandsManager) {
  const tools = {
    active: [
      {
        toolName: toolNames.WindowLevel,
        bindings: [{ mouseButton: Enums.MouseBindings.Primary }],
      },
      {
        toolName: toolNames.Pan,
        bindings: [{ mouseButton: Enums.MouseBindings.Auxiliary }],
      },
      {
        toolName: toolNames.Zoom,
        bindings: [{ mouseButton: Enums.MouseBindings.Secondary }, { numTouchPoints: 2 }],
      },
      {
        toolName: toolNames.StackScroll,
        bindings: [{ mouseButton: Enums.MouseBindings.Wheel }, { numTouchPoints: 3 }],
      },
    ],
    passive: [
      { toolName: toolNames.Length },
      { toolName: toolNames.SegmentBidirectional },
      {
        toolName: toolNames.ArrowAnnotate,
        configuration: {
          getTextCallback: (callback, eventDetails) => {
            commandsManager.runCommand('arrowTextCallback', {
              callback,
              eventDetails,
            });
          },
          changeTextCallback: (data, eventDetails, callback) => {
            commandsManager.runCommand('arrowTextCallback', {
              callback,
              data,
              eventDetails,
            });
          },
        },
      },
      { toolName: toolNames.Bidirectional },
      { toolName: toolNames.DragProbe },
      { toolName: toolNames.Probe },
      { toolName: toolNames.EllipticalROI },
      { toolName: toolNames.RectangleROI },
      // 2026-04-29 - 添加多边形测量和圆测量工具到passive数组
      { toolName: toolNames.PlanarFreehandROI },
      { toolName: toolNames.CircleROI },
      { toolName: toolNames.StackScroll },
      { toolName: toolNames.Angle },
      { toolName: toolNames.CobbAngle },
      { toolName: toolNames.Magnify },
      {
        toolName: 'CircularBrush',
        parentTool: 'Brush',
        configuration: {
          activeStrategy: 'FILL_INSIDE_CIRCLE',
          minRadius: MIN_SEGMENTATION_DRAWING_RADIUS,
          maxRadius: MAX_SEGMENTATION_DRAWING_RADIUS,
        },
      },
      {
        toolName: 'CircularEraser',
        parentTool: 'Brush',
        configuration: {
          activeStrategy: 'ERASE_INSIDE_CIRCLE',
          minRadius: MIN_SEGMENTATION_DRAWING_RADIUS,
          maxRadius: MAX_SEGMENTATION_DRAWING_RADIUS,
        },
      },
      {
        toolName: 'SphereBrush',
        parentTool: 'Brush',
        configuration: {
          activeStrategy: 'FILL_INSIDE_SPHERE',
          minRadius: MIN_SEGMENTATION_DRAWING_RADIUS,
          maxRadius: MAX_SEGMENTATION_DRAWING_RADIUS,
        },
      },
      {
        toolName: 'SphereEraser',
        parentTool: 'Brush',
        configuration: {
          activeStrategy: 'ERASE_INSIDE_SPHERE',
          minRadius: MIN_SEGMENTATION_DRAWING_RADIUS,
          maxRadius: MAX_SEGMENTATION_DRAWING_RADIUS,
        },
      },
      {
        toolName: 'ThresholdCircularBrush',
        parentTool: 'Brush',
        configuration: {
          activeStrategy: 'THRESHOLD_INSIDE_CIRCLE',
          minRadius: MIN_SEGMENTATION_DRAWING_RADIUS,
          maxRadius: MAX_SEGMENTATION_DRAWING_RADIUS,
        },
      },
      {
        toolName: 'ThresholdSphereBrush',
        parentTool: 'Brush',
        configuration: {
          activeStrategy: 'THRESHOLD_INSIDE_SPHERE',
          minRadius: MIN_SEGMENTATION_DRAWING_RADIUS,
          maxRadius: MAX_SEGMENTATION_DRAWING_RADIUS,
        },
      },
      {
        toolName: 'ThresholdCircularBrushDynamic',
        parentTool: 'Brush',
        configuration: {
          activeStrategy: 'THRESHOLD_INSIDE_CIRCLE',
          // preview: {
          //   enabled: true,
          // },
          threshold: {
            isDynamic: true,
            dynamicRadius: 3,
          },
          minRadius: MIN_SEGMENTATION_DRAWING_RADIUS,
          maxRadius: MAX_SEGMENTATION_DRAWING_RADIUS,
        },
      },
    ],
    enabled: [],
    disabled: [
      {
        toolName: toolNames.Crosshairs,
        configuration: {
          disableOnPassive: true,
          autoPan: {
            enabled: false,
            panSize: 10,
          },
        },
      },
    ],
  };

  toolGroupService.createToolGroupAndAddTools(toolGroupIds.CT, tools);
  toolGroupService.createToolGroupAndAddTools(toolGroupIds.PT, {
    active: tools.active,
    passive: [...tools.passive, { toolName: 'RectangleROIStartEndThreshold' }],
    enabled: tools.enabled,
    disabled: tools.disabled,
  });
  toolGroupService.createToolGroupAndAddTools(toolGroupIds.Fusion, tools);
  toolGroupService.createToolGroupAndAddTools(toolGroupIds.default, tools);

  // 2026-04-29 - MIP工具组配置保持原始状态
  // 注意：MIP视图与十字线工具不兼容，但修改MIP工具组会影响其他布局
  // 因此暂不对MIP工具组进行修改
  const mipTools = {
    active: [
      {
        toolName: toolNames.VolumeRotate,
        bindings: [{ mouseButton: Enums.MouseBindings.Wheel }],
        configuration: {
          rotateIncrementDegrees: 5,
        },
      },
      {
        toolName: toolNames.MipJumpToClick,
        configuration: {
          toolGroupId: toolGroupIds.PT,
        },
        bindings: [{ mouseButton: Enums.MouseBindings.Primary }],
      },
    ],
    enabled: [
      {
        toolName: toolNames.OrientationMarker,
        configuration: {
          orientationWidget: {
            viewportCorner: 'BOTTOM_LEFT',
          },
        },
      },
    ],
  };

  toolGroupService.createToolGroupAndAddTools(toolGroupIds.MIP, mipTools);

  // 2026-04-28 - 初始化MPR布局工具组，支持十字线等工具（三维不需要十字线）
  // [2026-04-29] 更新：MPR toolGroup 使用标准工具配置
  // 注意：Crosshairs 在此配置中被禁用（disableOnPassive: true），
  //       但用户可以通过工具栏手动激活十字线功能
  toolGroupService.createToolGroupAndAddTools(toolGroupIds.MPR, tools);

  // ====================================================================
  // Patch PlanarFreehandROITool.renderAnnotationInstance
  // 修改时间：2026-04-29
  //
  // 解决问题：在TMTV模式下，使用多边形测量(PlanarFreehandROI)工具在CT视口绘制后，
  //          PT视口无法显示测量标签文字（只有轮廓线，没有Area/Max/Mean等数据）
  //
  // 根因分析：
  //   Cornerstone3D的PlanarFreehandROITool在renderAnnotationInstance方法中，
  //   通过 annotation.invalidated 标志来决定是否计算统计值(stats)：
  //     if (annotation.invalidated) {
  //       this._calculateStatsIfActive(...);  // 只有invalidated=true才计算
  //     }
  //   计算完成后会立即将 invalidated 设为 false（第198-199行原始代码）：
  //     annotation.invalidated = false;
  //
  // 竞态条件（Race Condition）：
  //   当OHIF触发全局渲染时（如切换布局、添加测量等），CT和PT视口在同一轮渲染循环中执行。
  //   ┌─ CT视口 renderAnnotationInstance 执行
  //   │   → annotation.invalidated = true ✅ → 进入stats计算
  //   │   → 计算 ctVolumeId 的 stats（面积、最大值、平均值等）
  //   │   → annotation.invalidated = false ❌ （关键！关闭了stats计算的"门"）
  //   │
  //   └─ PT视口 renderAnnotationInstance 执行
  //       → annotation.invalidated = false ❌ 被"门"挡住！
  //       → 跳过 _calculateStatsIfActive()
  //       → cachedStats[ptVolumeId] 不存在
  //       → _renderStats() → textLines=[] → 无标签显示 ❌
  //
  // 修复方案：
  //   覆盖renderAnnotationInstance原型方法，在调用_calculateStatsIfActive前
  //   强制将annotation.invalidated设为true，确保每个viewport都能独立计算stats。
  //   计算完成后恢复原值，不影响其他逻辑。
  //
  // 影响范围：
  //   - 仅影响 PlanarFreehandROITool（多边形/自由手绘ROI工具）
  //   - 不影响 CircleROI、EllipticalROI 等其他工具（它们有独立的stats计算逻辑）
  //   - 对所有使用 PlanarFreehandROITool 的布局生效（Default、2x3、2x4等）
  // ====================================================================
  if (PlanarFreehandROITool?.prototype?.renderAnnotationInstance) {
    const originalRender = PlanarFreehandROITool.prototype.renderAnnotationInstance;

    // [2026-04-29] 覆盖原型方法：替换为自定义的渲染函数
    PlanarFreehandROITool.prototype.renderAnnotationInstance = function (renderContext) {

      // === 第一步：解构渲染上下文 ===
      const { enabledElement, targetId, svgDrawingHelper } = renderContext;
      const annotation = renderContext.annotation;    // 当前要渲染的annotation对象
      const { viewport, renderingEngine } = enabledElement;
      const data = annotation.data;                   // annotation数据（包含contour、cachedStats等）

      let renderStatus = false;
      const isDrawing = this.isDrawing;               // 是否正在绘制中
      const isEditingOpen = this.isEditingOpen;       // 是否正在编辑开放轮廓
      const isEditingClosed = this.isEditingClosed;   // 是否正在编辑闭合轮廓

      // === 第二步：渲染轮廓线（与原始逻辑完全一致） ===
      // [2026-04-29] 说明：此部分保持Cornerstone3D原始行为不变
      // 三种状态的处理：
      //   1. 静态状态（非绘制、非编辑）→ 渲染完整轮廓
      //   2. 绘制/编辑当前annotation → 渲染动态轮廓（带交互点）
      //   3. 绘制/编辑其他annotation → 渲染静态轮廓（作为背景参考）
      if (!(isDrawing || isEditingOpen || isEditingClosed)) {
        // 状态1：静态渲染
        if (this.configuration.displayOnePointAsCrosshairs &&
            annotation.data.contour.polyline.length === 1) {
          // 单点标记模式：用十字线显示
          this.renderPointContourWithMarker(enabledElement, svgDrawingHelper, annotation);
        } else {
          // 正常模式：渲染多边形轮廓
          this.renderContour(enabledElement, svgDrawingHelper, annotation);
        }
      } else {
        // 状态2或3：动态渲染（正在绘制或编辑）
        const activeAnnotationUID = this.commonData.annotation.annotationUID;
        if (annotation.annotationUID === activeAnnotationUID) {
          // 状态2：正在操作当前annotation（显示交互点）
          if (isDrawing) {
            this.renderContourBeingDrawn(enabledElement, svgDrawingHelper, annotation);
          } else if (isEditingClosed) {
            this.renderClosedContourBeingEdited(enabledElement, svgDrawingHelper, annotation);
          } else if (isEditingOpen) {
            this.renderOpenContourBeingEdited(enabledElement, svgDrawingHelper, annotation);
          }
        } else {
          // 状态3：正在操作其他annotation（当前annotation作为背景）
          if (this.configuration.displayOnePointAsCrosshairs &&
              annotation.data.contour.polyline.length === 1) {
            this.renderPointContourWithMarker(enabledElement, svgDrawingHelper, annotation);
          } else {
            this.renderContour(enabledElement, svgDrawingHelper, annotation);
          }
        }
        renderStatus = true;  // 标记为正在交互（用于返回给调用方）
      }

      // === 第三步：检查是否需要计算并渲染统计数据（标签） ===
      if (!this.configuration.calculateStats) {
        return renderStatus;  // 配置禁用了stats计算，直接返回
      }

      // === 第四步：【核心修复】强制进入stats计算 ===
      // [2026-04-29] 修复说明：确保每个viewport都能独立计算自己的stats
      //
      // 原始问题流程：
      //   CT渲染: invalidated=true → 计算ctVolumeId stats → 设invalidated=false
      //   PT渲染: invalidated=false → 跳过计算 → 无标签 ❌
      //
      // 修复后流程：
      //   CT渲染: hasCachedStats=false → 强制invalidated=true → 计算ctVolumeId stats → 恢复
      //   PT渲染: hasCachedStats=false → 强制invalidated=true → 计算ptVolumeId stats → 恢复 ✅
      //   后续渲染: hasCachedStats=true → 跳过强制（已有数据）→ 正常走原始逻辑 ✅
      const savedInvalidated = annotation.invalidated;

      // [2026-04-29] 核心检查：该viewport对应的targetId是否已有缓存数据
      // 说明：
      //   - cachedStats 是一个以targetId为key的对象
      //   - CT视口的targetId类似 "volumeId:ctVolume"
      //   - PT视口的targetId类似 "volumeId:ptVolume"
      //   - 两者不同！所以CT有缓存不代表PT也有缓存
      const hasCachedStats = data.cachedStats && data.cachedStats[targetId];

      // 判断是否需要强制计算stats的条件：
      // 条件A: !hasCachedStats → 该viewport还没有自己的缓存数据（如PT首次渲染）
      // 条件B: savedInvalidated → 原始逻辑要求计算（正常刷新场景）
      // 满足任一条件就进入stats计算
      if (!hasCachedStats || savedInvalidated) {
        // [2026-04-29] 关键：临时将invalidated设为true，打开stats计算的"门"
        annotation.invalidated = true;
        try {
          // 调用原始的stats计算方法
          // 此方法内部会：
          //   1. 检查commonData（活动annotation拦截）→ 我们已绕过
          //   2. 调用_calculateCachedStats() → 实际计算面积、最大值等
          //   3. 将结果存入data.cachedStats[targetId]
          //   4. 设置annotation.invalidated = false（我们会在finally中恢复）
          this._calculateStatsIfActive(annotation, targetId, viewport, renderingEngine, enabledElement);
        } catch (e) {
          // [2026-04-29] 异常保护：忽略stats计算错误
          // 常见异常场景：
          //   - 切换布局时viewport的context pool还未初始化完成
          //   - Volume未加载完成时获取renderer失败
          // 处理策略：
          //   - 不抛出错误，避免影响轮廓线的正常渲染
          //   - 下次渲染时会重试（此时viewport应该已准备好）
        } finally {
          // [2026-04-29] 无论成功还是失败，都恢复原来的invalidated状态
          // 这很重要，因为后续可能有其他逻辑依赖这个标志位
          annotation.invalidated = savedInvalidated;
        }
      }

      // === 第五步：渲染统计信息文本框（标签） ===
      // [2026-04-29] 此时cachedStats[targetId]应该已经有数据了
      // _renderStats会从cachedStats中读取数据并生成文本标签：
      //   - Area: xxx mm²（面积）
      //   - Max: xxx SUVbw（最大值，PET图像）
      //   - Mean: xxx HU/SUVbw（平均值）
      //   - Min: xxx（最小值）
      //   - Std.Dev: xxx（标准差）
      this._renderStats(annotation, viewport, enabledElement, svgDrawingHelper);

      return renderStatus;
    };
  }
}

function initToolGroups(toolNames, Enums, toolGroupService, commandsManager) {
  _initToolGroups(toolNames, Enums, toolGroupService, commandsManager);
}

export default initToolGroups;
