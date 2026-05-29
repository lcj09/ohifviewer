# OHIF Segmentation 模块技术文档

## 目录

1. [模块概述](#1-模块概述)
2. [核心功能](#2-核心功能)
3. [三种分割类型详解](#3-三种分割类型详解)
4. [实现架构](#4-实现架构)
5. [API 参考](#5-API-参考)
6. [适用场景](#6-适用场景)
7. [操作说明](#7-操作说明)
8. [事件系统](#8-事件系统)
9. [目录结构](#9-目录结构)

---

## 1. 模块概述

### 1.1 简介

OHIF 的 Segmentation 模块基于 **Cornerstone3D** 构建，提供完整的医学影像分割功能，支持多种分割表示类型、交互式编辑、DICOM RTSTRUCT 导入导出等核心能力。

### 1.2 技术栈

| 依赖 | 版本 | 说明 |
|------|------|------|
| `@cornerstonejs/core` | 4.21.2 | 3D 渲染引擎核心 |
| `@cornerstonejs/tools` | 4.21.2 | 分割工具和状态管理 |
| `@ohif/core` | 3.13.0 | OHIF 核心服务框架 |

### 1.3 模块定位

Segmentation 模块是 OHIF 医学影像查看器的核心功能模块之一，负责：
- 医学影像分割的创建与管理
- 多种分割表示类型的支持
- 交互式分割编辑工具集成
- DICOM 标准格式的导入导出

---

## 2. 核心功能

### 2.1 功能矩阵

| 功能类别 | 功能名称 | 描述 | 状态 |
|---------|---------|------|------|
| **分割创建** | Labelmap 创建 | 基于 DisplaySet 创建体素分割 | ✅ |
| | Contour 创建 | 基于 DisplaySet 创建轮廓分割 | ✅ |
| | SEG 导入 | 从 DICOM SEG 文件导入分割 | ✅ |
| **分割管理** | 添加/删除 | 动态管理分割对象 | ✅ |
| | 表示切换 | Labelmap/Contour/Surface 切换 | ✅ |
| | 状态持久化 | 分割状态保存与恢复 | ✅ |
| **交互式编辑** | 画笔工具 | 2D 切片上的自由绘制 | ✅ |
| | 轮廓编辑 | Contour 模式下的顶点编辑 | ✅ |
| | 区域填充 | 自动填充封闭区域 | ✅ |
| **可视化** | 多视口同步 | 分割在不同视口同步显示 | ✅ |
| | 颜色配置 | 自定义分割区域颜色 | ✅ |
| | 透明度控制 | 调整分割叠加透明度 | ✅ |
| **数据导出** | RTSTRUCT 导出 | 导出为 DICOM RTSTRUCT | ✅ |
| | Labelmap 导出 | 导出为 DICOM SEG | ✅ |

---

## 3. 三种分割类型详解

### 3.1 Labelmap（标签图）

**定义**: 体素级别的分割表示，每个像素存储一个整数标签。

**实现原理**:
```typescript
// 创建 Labelmap 分割
const segmentationId = await segmentationService.createLabelmapForDisplaySet(
  displaySet,
  {
    label: 'My Segmentation',
    segments: {
      1: { label: 'Tumor', active: true },
      2: { label: 'Organ', active: false },
    },
  }
);
```

**文件参考**: `src/services/SegmentationService/SegmentationService.ts`

**特点**:
- ✅ 像素级精确
- ✅ 支持画笔编辑
- ❌ 内存占用大

**适用场景**:
- 2D 切片编辑
- MPR（多平面重建）
- 需要精确像素控制的场景

---

### 3.2 Contour（轮廓）

**定义**: 基于几何轮廓的分割表示，存储多边形边界点。

**实现原理**:
```typescript
// 创建 Contour 分割
const segmentationId = await segmentationService.createContourForDisplaySet(
  displaySet,
  { label: 'Contour Segmentation' }
);
```

**文件参考**: `src/services/SegmentationService/SegmentationService.ts`

**特点**:
- ✅ 存储高效
- ✅ DICOM RTSTRUCT 原生支持
- ❌ 不支持直接体素编辑

**适用场景**:
- RTSTRUCT 导入导出
- 放疗计划系统
- 复杂解剖结构标记

---

### 3.3 Surface（表面）

**定义**: 3D 三角网格表面表示，用于高质量三维渲染。

**实现原理**:
```typescript
// 在 3D 视口中添加 Surface 表示
await segmentationService.addSegmentationRepresentation(viewportId, {
  segmentationId,
  type: SegmentationRepresentations.Surface,
});
```

**文件参考**: `src/services/SegmentationService/SegmentationService.ts`

**特点**:
- ✅ 视觉效果优秀
- ✅ 适合 VR 可视化
- ❌ 计算开销大

**适用场景**:
- 3D 体渲染视图
- 手术规划
- 教学演示

---

### 3.4 类型对比表

| 特性 | Labelmap | Contour | Surface |
|------|----------|---------|---------|
| **存储方式** | 像素数组 | 轮廓点坐标 | 三角网格 |
| **空间精度** | 高（像素级） | 中等 | 中等 |
| **内存占用** | 高 | 低 | 中等 |
| **编辑方式** | 画笔/填充 | 顶点编辑 | 不支持直接编辑 |
| **3D 渲染** | 体渲染 | 不支持 | 表面渲染 |
| **RTSTRUCT** | 需要转换 | 原生支持 | 需要转换 |
| **典型用途** | 2D 编辑、MPR | RTSTRUCT 导入导出 | 3D 可视化 |

---

## 4. 实现架构

### 4.1 架构层次

```
┌─────────────────────────────────────────────────────────────┐
│                     UI 层                                  │
│  ┌─────────────┐  ┌──────────────────┐                     │
│  │PanelSegment │  │ SegmentationTools│                     │
│  │  (控制面板)  │  │   (交互工具)      │                     │
│  └──────┬──────┘  └────────┬─────────┘                     │
└─────────┼───────────────────┼───────────────────────────────┘
          │                   │
┌─────────▼───────────────────▼───────────────────────────────┐
│                     Hooks 层                               │
│  ┌─────────────┐  ┌────────────────────────┐               │
│  │useSegmentations│ │useActiveViewportSegRep│               │
│  │ (数据订阅)   │  │    (活动视口状态)      │               │
│  └──────┬──────┘  └────────┬───────────────┘               │
└─────────┼───────────────────┼───────────────────────────────┘
          │                   │
┌─────────▼───────────────────▼───────────────────────────────┐
│                  SegmentationService                        │
│  ┌─────────────────────────────────────────────────┐        │
│  │ 核心方法:                                        │        │
│  │  • createLabelmapForDisplaySet()               │        │
│  │  • createContourForDisplaySet()                │        │
│  │  • addSegmentationRepresentation()             │        │
│  │  • getSegmentation()                           │        │
│  │  • removeSegmentation()                        │        │
│  └─────────────────────────────────────────────────┘        │
└──────────────────────────────┬──────────────────────────────┘
                              │
┌──────────────────────────────▼──────────────────────────────┐
│               Cornerstone3D Core                           │
│  ┌────────────────┐  ┌────────────────────┐               │
│  │  Segmentation  │  │   Tools            │               │
│  │    State       │  │  (画笔/轮廓工具)    │               │
│  └────────────────┘  └────────────────────┘               │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 核心服务类

**SegmentationService** 是模块的核心，提供以下能力：

```typescript
class SegmentationService extends PubSubService {
  // 1. Segmentation 管理
  getSegmentation(segmentationId);    // 获取单个分割
  getSegmentations();                  // 获取所有分割
  addOrUpdateSegmentation(input);      // 添加/更新分割
  removeSegmentation(segmentationId); // 删除分割
  
  // 2. Representation 管理
  addSegmentationRepresentation(viewportId, options);
  getSegmentationRepresentations(viewportId, specifier);
  
  // 3. 创建方法
  createLabelmapForDisplaySet(displaySet, options);
  createContourForDisplaySet(displaySet, options);
  createSegmentationForSEGDisplaySet(segDisplaySet);
  
  // 4. 状态同步
  getPresentation(viewportId);
}
```

**文件参考**: `src/services/SegmentationService/SegmentationService.ts`

---

## 5. API 参考

### 5.1 创建分割

#### 5.1.1 createLabelmapForDisplaySet

```typescript
/**
 * 创建 Labelmap 分割
 * @param displaySet - 目标 DisplaySet
 * @param options - 可选参数
 */
async createLabelmapForDisplaySet(
  displaySet: AppTypes.DisplaySet,
  options?: {
    segmentationId?: string;
    segments?: { [segmentIndex: number]: Partial<Segment> };
    FrameOfReferenceUID?: string;
    label?: string;
  }
): Promise<string>;
```

**示例**:
```typescript
const segmentationId = await segmentationService.createLabelmapForDisplaySet(
  displaySet,
  {
    label: 'Liver Segmentation',
    segments: {
      1: { label: 'Liver', active: true },
      2: { label: 'Tumor', active: false },
    },
  }
);
```

#### 5.1.2 createContourForDisplaySet

```typescript
async createContourForDisplaySet(
  displaySet: AppTypes.DisplaySet,
  options?: {
    segmentationId?: string;
    segments?: { [segmentIndex: number]: Partial<Segment> };
    FrameOfReferenceUID?: string;
    label?: string;
  }
): Promise<string>;
```

### 5.2 添加表示

#### 5.2.1 addSegmentationRepresentation

```typescript
/**
 * 为视口添加分割表示
 * @param viewportId - 视口 ID
 * @param options - 配置选项
 */
async addSegmentationRepresentation(
  viewportId: string,
  {
    segmentationId,
    predecessorImageId,
    type,  // Labelmap | Contour | Surface
    config: { blendMode },
    suppressEvents = false,
  }
): Promise<void>;
```

**示例**:
```typescript
await segmentationService.addSegmentationRepresentation('viewport-1', {
  segmentationId: 'seg-123',
  type: SegmentationRepresentations.Labelmap,
  config: { blendMode: BlendModes.OVERLAY },
});
```

### 5.3 查询方法

#### 5.3.1 getSegmentationRepresentations

```typescript
/**
 * 获取视口的分割表示
 * @param viewportId - 视口 ID
 * @param specifier - 过滤条件
 */
getSegmentationRepresentations(
  viewportId: string,
  specifier?: {
    segmentationId?: string;
    type?: SegmentationRepresentations;
  }
): SegmentationRepresentation[];
```

---

## 6. 适用场景

### 6.1 临床应用场景

| 场景 | 推荐类型 | 说明 |
|------|---------|------|
| **放射治疗计划** | Contour | RTSTRUCT 原生支持 |
| **肿瘤体积测量** | Labelmap | 精确体积计算 |
| **手术导航** | Surface | 3D 可视化引导 |
| **教学演示** | Surface | 清晰的解剖结构展示 |
| **AI 分割结果展示** | Labelmap | 像素级结果呈现 |
| **多模态融合** | Labelmap | 跨模态配准 |

### 6.2 技术决策指南

```
选择分割类型的决策流程:

用户需求
    │
    ├─ 需要与 RTSTRUCT 交互?
    │       └─ YES → Contour
    │       └─ NO  → 继续
    │
    ├─ 需要 3D 表面渲染?
    │       └─ YES → Surface
    │       └─ NO  → 继续
    │
    └─ 默认选择: Labelmap
            (最灵活，支持编辑)
```

---

## 7. 操作说明

### 7.1 创建新分割

**步骤**:
1. 打开 Segmentation 面板
2. 选择目标视口
3. 点击 "Create Segmentation"
4. 选择分割类型（Labelmap/Contour）
5. 输入分割名称
6. 点击确认

**代码示例**:
```typescript
// 通过工具函数创建
import { createSegmentationForViewport } from './utils/createSegmentationForViewport';

const segmentationId = await createSegmentationForViewport(
  servicesManager,
  {
    viewportId: 'viewport-1',
    segmentationType: SegmentationRepresentations.Labelmap,
    options: {
      label: 'My New Segmentation',
      createInitialSegment: true,
    },
  }
);
```

**文件参考**: `src/utils/createSegmentationForViewport.ts`

### 7.2 编辑分割

**Labelmap 编辑**:
1. 选择画笔工具
2. 选择目标分割区域（segment）
3. 在切片上绘制

**Contour 编辑**:
1. 选择轮廓编辑工具
2. 点击轮廓顶点进行编辑
3. 添加/删除顶点

### 7.3 导出分割

**导出为 RTSTRUCT**:
```typescript
// 通过命令执行导出
commandsManager.runCommand('exportSegmentation', {
  viewportId: 'viewport-1',
  segmentationId: 'seg-123',
  exportType: 'RTSTRUCT',
});
```

---

## 8. 事件系统

### 8.1 事件列表

| 事件名称 | 触发时机 | 数据结构 |
|---------|---------|---------|
| `SEGMENTATION_MODIFIED` | 分割数据修改 | `{ segmentationId }` |
| `SEGMENTATION_ADDED` | 分割添加 | `{ segmentationId }` |
| `SEGMENTATION_REMOVED` | 分割删除 | `{ segmentationId }` |
| `SEGMENTATION_DATA_MODIFIED` | 分割内容变更 | `{ segmentationId }` |
| `SEGMENTATION_REPRESENTATION_MODIFIED` | 表示修改 | `{ segmentationId }` |
| `SEGMENTATION_REPRESENTATION_REMOVED` | 表示删除 | `{ segmentationId, viewportId }` |
| `SEGMENT_LOADING_COMPLETE` | 单个 segment 加载完成 | `{ segmentationId }` |
| `SEGMENTATION_LOADING_COMPLETE` | 所有 segments 加载完成 | `{ segmentationId }` |

### 8.2 订阅示例

```typescript
// 订阅分割修改事件
segmentationService.subscribe(
  segmentationService.EVENTS.SEGMENTATION_MODIFIED,
  ({ segmentationId }) => {
    console.log('Segmentation modified:', segmentationId);
    // 更新 UI 或执行其他操作
  }
);
```

---

## 9. 目录结构

```
extensions/cornerstone/src/
├── services/
│   └── SegmentationService/
│       ├── SegmentationService.ts      # 核心服务类
│       ├── SegmentationService.test.ts # 测试用例
│       └── RTSTRUCT/                   # RTSTRUCT 相关工具
├── hooks/
│   ├── useSegmentations.ts                  # 分割数据订阅
│   ├── useViewportSegmentations.ts          # 视口分割
│   └── useActiveViewportSegmentationRepresentations.ts
├── stores/
│   ├── useSegmentationPresentationStore.ts        # 展示状态
│   └── useSelectedSegmentationsForViewportStore.ts # 选中状态
├── panels/
│   └── PanelSegmentation.tsx              # 分割控制面板
├── components/
│   ├── SegmentationUtilityButton.tsx      # 工具按钮
│   ├── SegmentationToolConfig.tsx        # 工具配置
│   └── ExportSegmentationSubMenuItem.tsx # 导出菜单
└── utils/
    ├── createSegmentationForViewport.ts   # 创建工具
    ├── segmentationExportUtils.ts         # 导出工具
    ├── setUpSegmentationEventHandlers.ts # 事件设置
    └── updateSegmentationStats.ts        # 统计更新
```

---

**文档版本**: v1.0  
**生成日期**: 2026-05-26  
**适用版本**: OHIF 3.13.0-beta.58