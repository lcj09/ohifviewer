# OHIF Viewer PET/CT 融合显示完整架构文档

---

## 目录

1. [整体架构概览](#一整体架构概览)
2. [PET/CT 专用组件](#二petct-专用组件)
   - 2.1 Hanging Protocol Viewport 配置（hpViewports.ts）
   - 2.2 PET/CT 查询逻辑
   - 2.3 PET 窗宽窗位处理
3. [核心组件详解](#三核心组件详解)
   - 3.1 数据层（Data Source Layer）
   - 3.2 元数据存储（Metadata Store）
   - 3.3 DisplaySet 服务
   - 3.4 Viewport 层
4. [像素加载机制](#四像素加载机制)
   - 4.1 加载触发时机
   - 4.2 核心加载代码
   - 4.3 加载流程
5. [PET/CT 融合机制](#五petct-融合机制)
   - 5.1 融合模式
   - 5.2 颜色映射
   - 5.3 融合配置示例
   - 5.4 同步组配置
6. [PET/CT 完整流程](#六petct-完整流程)
   - 6.1 查询阶段
   - 6.2 元数据加载
   - 6.3 DisplaySet 创建
   - 6.4 Viewport 配置
   - 6.5 像素加载与融合渲染
7. [事件广播机制](#七事件广播机制)
8. [数据流总览](#八数据流总览)
9. [关键设计模式](#九关键设计模式)
10. [性能优化策略](#十性能优化策略)
11. [扩展点说明](#十一扩展点说明)
12. [PET/CT 核心文件清单](#十二petct-核心文件清单)
13. [总结](#十三总结)

---

## 一、整体架构概览

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     PET/CT 融合显示架构                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   QIDO-RS    │    │    WADO-RS   │    │   WADO-URI   │                   │
│  │  (PET/CT查询) │    │  (像素获取)   │    │  (传统调图)   │                   │
│  └──────┬───────┘    └──────┬───────┘    └──────┬───────┘                   │
│         │                   │                   │                           │
│         ▼                   ▼                   ▼                           │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │              Data Source Layer (PET/CT专用)                   │           │
│  │  DicomWebDataSource + hpViewports.ts 预设配置                 │           │
│  └──────────────────────────────┬───────────────────────────────┘           │
│                                 │                                           │
│                                 ▼                                           │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │                    Metadata Store                            │           │
│  │  Study → Series → Instance (CT + PT 元数据)                 │           │
│  └──────────────────────────────┬───────────────────────────────┘           │
│                                 │                                           │
│                                 ▼                                           │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │                   DisplaySet Service                         │           │
│  │  CT/PET分别创建DisplaySet + 事件广播                         │           │
│  └──────────────────────────────┬───────────────────────────────┘           │
│                                 │                                           │
│                                 ▼                                           │
│  ┌──────────────────────────────────────────────────────────────┐           │
│  │                    Viewport Layer                            │           │
│  │  ViewportGrid → 融合Viewport(MIP模式 + HSV颜色映射)         │           │
│  └──────────────────────────────────────────────────────────────┘           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、PET/CT 专用组件

### 2.1 Hanging Protocol Viewport 配置

**文件**：`extensions/tmtv/src/utils/hpViewports.ts`

这是 PET/CT 融合的核心配置文件，定义了多种预设布局：

| 配置名称 | 用途 | 视图类型 |
|---------|------|---------|
| `ctAXIAL` | CT 轴位视图 | volume |
| `ctSAGITTAL` | CT 矢状位视图 | volume |
| `ctCORONAL` | CT 冠状位视图 | volume |
| `ptAXIAL` | PET 轴位视图 | volume |
| `ptSAGITTAL` | PET 矢状位视图 | volume |
| `ptCORONAL` | PET 冠状位视图 | volume |
| `fusionAXIAL` | PET/CT 轴位融合视图 | volume |
| `fusionSAGITTAL` | PET/CT 矢状位融合视图 | volume |
| `fusionCORONAL` | PET/CT 冠状位融合视图 | volume |
| `mipSAGITTAL` | PET MIP 视图 | volume |

**CT 视图配置示例**：

```typescript
const ctAXIAL: AppTypes.HangingProtocol.Viewport = {
viewportOptions: {
    viewportId: 'ctAXIAL',
    viewportType: 'volume',
    orientation: 'axial',
    toolGroupId: 'ctToolGroup',
    initialImageOptions: {
    preset: 'first', // 'first', 'last', 'middle'
    },
    syncGroups: [
    cameraPositionSync('axialSync'),  // 同步相机位置
    {
        type: 'voi',
        id: 'ctWLSync',              // 同步CT窗宽窗位
        source: true,
        target: true,
        options: { syncColormap: true },
    },
    hydrateSegSync,                   // 同步分割重建
    ],
},
displaySets: [{ id: 'ctDisplaySet' }],
};
```

**PET/CT 融合视图配置示例**：

```typescript
const fusionAXIAL: AppTypes.HangingProtocol.Viewport = {
viewportOptions: {
    viewportId: 'fusionAXIAL',
    viewportType: 'volume',
    orientation: 'axial',
    toolGroupId: 'fusionToolGroup',
    syncGroups: [
    cameraPositionSync('axialSync'),  // 与CT/PET视图同步相机位置
    {
        type: 'voi',
        id: 'ctWLSync',              // 跟随CT窗宽窗位变化
        source: false,
        target: true,
    },
    {
        type: 'voi',
        id: 'fusionWLSync',          // 融合视图专用窗宽窗位同步
        source: true,
        target: true,
        options: { syncColormap: true },
    },
    {
        type: 'voi',
        id: 'ptFusionWLSync',        // PET融合专用窗宽窗位
        source: false,
        target: true,
        options: { syncColormap: false, syncInvertState: false },
    },
    hydrateSegSync,
    ],
},
displaySets: [
    { id: 'ctDisplaySet' },           // CT作为底层
    {
    id: 'ptDisplaySet',              // PET作为叠加层
    options: {
        colormap: {
        name: 'hsv',                 // PET使用HSV颜色映射
        opacity: [
            { value: 0, opacity: 0 },
            { value: 0.1, opacity: 0.8 },
            { value: 1, opacity: 0.9 },
        ],
        },
        voi: { custom: 'getPTVOIRange' },  // PET专用窗宽窗位计算
    },
    },
],
};
```

### 2.2 PET/CT 查询逻辑

**文件**：`extensions/default/src/DicomWebDataSource/index.ts`

PET/CT 查询需要同时获取 CT 和 PT 模态：

```typescript
// 查询包含 PET/CT 的 Study
const studies = await dataSource.query.studies.search({
Modality: ['CT', 'PT'],           // 同时查询CT和PET
StudyDate: '20240101-20241231',
});

// 查询特定Study的Series
const series = await dataSource.query.series.search(studyInstanceUID);

// 分离CT和PET系列
const ctSeries = series.filter(s => s.Modality === 'CT');
const ptSeries = series.filter(s => s.Modality === 'PT');

// 匹配CT和PET系列（通常基于时间或协议）
const matchedSeries = matchCtPtSeries(ctSeries, ptSeries);
```

### 2.3 PET 窗宽窗位处理

PET 图像使用专用的窗宽窗位计算函数：

```typescript
// 获取PET的VOI范围
const getPTVOIRange = (imageData) => {
const pixelData = imageData.getPixelData();
const min = Math.min(...pixelData);
const max = Math.max(...pixelData);

// PET窗宽窗位计算
const windowWidth = max - min;
const windowCenter = (max + min) / 2;

return { windowWidth, windowCenter };
};
```

---

## 三、核心组件详解

### 3.1 数据层（Data Source Layer）

| 组件 | 文件路径 | 职责 |
|------|---------|------|
| **DicomWebDataSource** | `extensions/default/src/DicomWebDataSource/index.ts` | QIDO/WADO 请求封装 |
| **hpViewports** | `extensions/tmtv/src/utils/hpViewports.ts` | PET/CT 预设布局配置 |
| **元数据检索** | `extensions/default/src/DicomWebDataSource/retrieveStudyMetadata.js` | Study/Series/Instance 元数据获取 |
| **ImageId生成** | `platform/core/src/utils/getWADORSImageId.js` | 生成图像引用标识 |

**PET/CT 元数据加载流程**：

```typescript
// 1. 查询PET/CT Study元数据
const studyMetadata = await qidoSearch(qidoDicomWebClient, {
Modality: ['CT', 'PT'],
StudyInstanceUID: studyInstanceUid,
});

// 2. 获取CT和PET的Series/Instance详情
const ctMetadata = await retrieveStudyMetadata(wadoDicomWebClient, ctSeriesInstanceUID);
const ptMetadata = await retrieveStudyMetadata(wadoDicomWebClient, ptSeriesInstanceUID);

// 3. 转换为自然化格式并生成ImageId
const ctInstances = ctMetadata.map(instance => ({
...naturalizeDataset(instance),
imageId: getWADORSImageId(instance),
Modality: 'CT',
}));

const ptInstances = ptMetadata.map(instance => ({
...naturalizeDataset(instance),
imageId: getWADORSImageId(instance),
Modality: 'PT',
}));

// 4. 注册到元数据提供者
[...ctInstances, ...ptInstances].forEach(instance => {
metadataProvider.addImageIdToUIDs(instance.imageId, {
    StudyInstanceUID: instance.StudyInstanceUID,
    SeriesInstanceUID: instance.SeriesInstanceUID,
    SOPInstanceUID: instance.SOPInstanceUID,
});
});
```

### 3.2 元数据存储（Metadata Store）

**数据结构**：

```typescript
// PET/CT Study Metadata
{
StudyInstanceUID: string,
StudyDescription: string,
ModalitiesInStudy: ['CT', 'PT'],  // PET/CT研究包含两种模态
isLoaded: boolean,
series: [
    {
    SeriesInstanceUID: string,
    Modality: 'CT',
    instances: InstanceMetadata[]
    },
    {
    SeriesInstanceUID: string,
    Modality: 'PT',
    instances: InstanceMetadata[]
    }
]
}

// Instance Metadata（PET/CT专用）
{
SOPInstanceUID: string,
StudyInstanceUID: string,
SeriesInstanceUID: string,
Modality: 'CT' | 'PT',           // 标识模态类型
imageId: string,                  // 图像引用
wadoRoot: string,                 // WADO服务地址
frameOfReferenceUID: string,      // 用于融合对齐
// ... 其他DICOM标签
}
```

### 3.3 DisplaySet 服务

**核心文件**：`platform/core/src/services/DisplaySetService/DisplaySetService.ts`

**PET/CT 专用 SOP Class Handler**：

| Handler名称 | 处理模态 | 文件位置 |
|------------|---------|---------|
| **stack** | CT/MR/PET等常规图像 | `getSopClassHandlerModule.js` |
| **tmtv** | PET/CT融合专用 | `extensions/tmtv` |

**PET/CT DisplaySet 创建流程**：

```typescript
makeDisplaySets = (input, options) => {
const displaySetsAdded = [];
const { modality } = options;

// 按模态分别创建DisplaySet
const ctInstances = input.filter(i => i.Modality === 'CT');
const ptInstances = input.filter(i => i.Modality === 'PT');

// CT DisplaySet
if (ctInstances.length) {
    const ctDisplaySet = createStackDisplaySet(ctInstances, {
    displaySetInstanceUID: 'ctDisplaySet',
    Modality: 'CT',
    });
    displaySetsAdded.push(ctDisplaySet);
}

// PET DisplaySet
if (ptInstances.length) {
    const ptDisplaySet = createStackDisplaySet(ptInstances, {
    displaySetInstanceUID: 'ptDisplaySet',
    Modality: 'PT',
    });
    displaySetsAdded.push(ptDisplaySet);
}

// 广播事件
this._broadcastEvent(EVENTS.DISPLAY_SETS_ADDED, { displaySetsAdded });

return displaySetsAdded;
};
```

### 3.4 Viewport 层

**PET/CT 专用 Viewport 配置**：

```typescript
interface PetCtViewportConfig {
viewportId: string;
viewportType: 'volume';           // PET/CT使用volume视图
orientation: 'axial' | 'sagittal' | 'coronal';
displaySetInstanceUIDs: string[];  // ['ctDisplaySet', 'ptDisplaySet']
displaySetOptions: PetCtDisplaySetOptions[];
syncGroups: SyncGroup[];          // 同步组配置
}

interface PetCtDisplaySetOptions {
id: string;
voi?: VOI | { custom: string };   // 支持自定义VOI计算
voiInverted?: boolean;            // PET通常反转显示
blendMode?: 'mip';               // PET/CT融合使用MIP
colormap?: { 
    name: string; 
    opacity: Array<{ value: number; opacity: number }>; 
};
slabThickness?: number | 'fullVolume';
}
```

---

## 四、像素加载机制

### 4.1 加载触发时机

| 触发场景 | 加载优先级 | PET/CT特殊性 |
|---------|-----------|-------------|
| 用户切换到某帧 | **最高**（Interaction） | 需要同时加载CT和PET |
| 缩略图生成 | 高（Thumbnail） | 可能只加载CT |
| 后台预加载 | 中（Prefetch） | 按优先级预加载 |
| 后台计算 | 低（Compute） | MIP计算等 |

### 4.2 核心加载代码

**文件**：`extensions/cornerstone/src/utils/dicomLoaderService.js`

```javascript
// PET/CT专用加载器
const loadPetCtImages = async (ctImageId, ptImageId) => {
// 并行加载CT和PET
const [ctImage, ptImage] = await Promise.all([
    imageLoader.loadAndCacheImage(ctImageId),
    imageLoader.loadAndCacheImage(ptImageId),
]);

return { ctImage, ptImage };
};
```

### 4.3 加载流程

```
PET/CT Viewport渲染请求
        ↓
    检查CT和PET缓存
        ↓ (任一未缓存)
    并行HTTP请求(WADO-RS)
        ↓
    DICOM像素解码(CT + PET)
        ↓
    缓存到cornerstone-cache
        ↓
    MIP融合算法处理
        ↓
    渲染到Canvas/WebGL
```

---

## 五、PET/CT 融合机制

### 5.1 融合模式

| 模式 | Cornerstone枚举 | 算法说明 | PET/CT适用场景 |
|------|----------------|---------|---------------|
| **MIP** | `MAXIMUM_INTENSITY_BLEND` | 取各层最大值 | **推荐** - 突出PET高摄取区域 |
| **MINIP** | `MINIMUM_INTENSITY_BLEND` | 取各层最小值 | 肺部CT |
| **AVG** | `AVERAGE_INTENSITY_BLEND` | 取各层平均值 | 平滑融合效果 |
| **COMPOSITE** | `COMPOSITE` | 简单叠加 | 默认 |

**文件**：`extensions/cornerstone/src/utils/getCornerstoneBlendMode.ts`

```typescript
export default function getCornerstoneBlendMode(blendMode: string) {
switch (blendMode.toLowerCase()) {
    case 'mip':
    return Enums.BlendModes.MAXIMUM_INTENSITY_BLEND;
    case 'minip':
    return Enums.BlendModes.MINIMUM_INTENSITY_BLEND;
    case 'avg':
    return Enums.BlendModes.AVERAGE_INTENSITY_BLEND;
    default:
    return Enums.BlendModes.COMPOSITE;
}
}
```

### 5.2 颜色映射

**文件**：`extensions/cornerstone/src/utils/colormaps.js`

| 颜色映射名称 | 用途 | PET/CT角色 |
|------------|------|-----------|
| **Grayscale** | CT/MR等灰度图像 | CT底层 |
| **s_pet / hsv** | PET专用 | PET叠加层 |
| **hot_iron** | 热力图 | PET备选 |

### 5.3 融合配置示例

```typescript
// PET/CT融合Viewport完整配置
const petCtFusionViewport: AppTypes.HangingProtocol.Viewport = {
viewportOptions: {
    viewportId: 'petCtFusion',
    viewportType: 'volume',
    orientation: 'axial',
    toolGroupId: 'fusionToolGroup',
    background: [1, 1, 1],  // 白色背景
},
displaySets: [
    {
    id: 'ctDisplaySet',
    options: {
        colormap: { name: 'Grayscale' },
        voi: { windowWidth: 400, windowCenter: 40 },  // 肺部窗
    },
    },
    {
    id: 'ptDisplaySet',
    options: {
        blendMode: 'mip',
        colormap: {
        name: 'hsv',
        opacity: [
            { value: 0, opacity: 0 },      // 低摄取完全透明
            { value: 0.1, opacity: 0.8 },  // 中等摄取80%透明
            { value: 1, opacity: 0.9 },    // 高摄取90%透明
        ],
        },
        voi: { custom: 'getPTVOIRange' },  // 自定义PET窗宽窗位
        voiInverted: true,                 // PET反转显示
    },
    },
],
};
```

### 5.4 同步组配置

**PET/CT 多视图联动配置**：

```typescript
const syncGroups = [
// 1. 相机位置同步（MPR联动）
{
    type: 'cameraPosition',
    id: 'axialSync',
    source: true,
    target: true,
},

// 2. CT窗宽窗位同步
{
    type: 'voi',
    id: 'ctWLSync',
    source: true,
    target: true,
    options: { syncColormap: true },
},

// 3. PET窗宽窗位同步（仅PET视图）
{
    type: 'voi',
    id: 'ptWLSync',
    source: true,
    target: true,
    options: { syncColormap: true },
},

// 4. 融合视图CT窗同步（跟随CT视图）
{
    type: 'voi',
    id: 'fusionCtWLSync',
    source: false,  // 融合视图不作为源
    target: true,   // 融合视图接收同步
},

// 5. 融合视图PET窗同步
{
    type: 'voi',
    id: 'fusionPtWLSync',
    source: true,
    target: true,
    options: { syncColormap: false, syncInvertState: false },
},

// 6. 分割重建同步
{
    type: 'hydrateseg',
    id: 'sameFORId',
    source: true,
    target: true,
    options: { matchingRules: ['sameFOR'] },
},
];
```

---

## 六、PET/CT 完整流程

### 6.1 查询阶段

```typescript
// 1. 查询PET/CT Study
const studies = await dataSource.query.studies.search({
Modality: ['CT', 'PT'],
StudyDate: '20240101-20241231',
});

// 2. 选择目标Study
const targetStudy = studies.find(s => s.StudyInstanceUID === targetUid);

// 3. 查询Series
const series = await dataSource.query.series.search(targetStudy.StudyInstanceUID);

// 4. 分离CT和PET
const ctSeries = series.filter(s => s.Modality === 'CT');
const ptSeries = series.filter(s => s.Modality === 'PT');
```

### 6.2 元数据加载

```typescript
// 加载CT和PET元数据
const [ctMetadata, ptMetadata] = await Promise.all([
retrieveStudyMetadata(wadoClient, ctSeries[0].SeriesInstanceUID),
retrieveStudyMetadata(wadoClient, ptSeries[0].SeriesInstanceUID),
]);

// 生成ImageId
const ctInstances = ctMetadata.map(instance => ({
...naturalizeDataset(instance),
imageId: getWADORSImageId(instance),
}));

const ptInstances = ptMetadata.map(instance => ({
...naturalizeDataset(instance),
imageId: getWADORSImageId(instance),
}));

// 存储到MetadataStore
DicomMetadataStore.addSeriesMetadata(ctSeries[0].SeriesInstanceUID, ctInstances);
DicomMetadataStore.addSeriesMetadata(ptSeries[0].SeriesInstanceUID, ptInstances);
```

### 6.3 DisplaySet 创建

```typescript
// 创建CT DisplaySet
const ctDisplaySet = {
displaySetInstanceUID: 'ctDisplaySet',
SeriesInstanceUID: ctSeries[0].SeriesInstanceUID,
StudyInstanceUID: targetStudy.StudyInstanceUID,
Modality: 'CT',
instances: ctInstances,
imageIds: ctInstances.map(i => i.imageId),
};

// 创建PET DisplaySet
const ptDisplaySet = {
displaySetInstanceUID: 'ptDisplaySet',
SeriesInstanceUID: ptSeries[0].SeriesInstanceUID,
StudyInstanceUID: targetStudy.StudyInstanceUID,
Modality: 'PT',
instances: ptInstances,
imageIds: ptInstances.map(i => i.imageId),
};

// 注册到DisplaySetService
displaySetService.add([ctDisplaySet, ptDisplaySet]);
```

### 6.4 Viewport 配置

```typescript
// 使用预设的PET/CT融合配置
import { ctAXIAL, ptAXIAL, fusionAXIAL } from './hpViewports';

// 应用配置到ViewportGrid
viewportGridService.setViewports([ctAXIAL, ptAXIAL, fusionAXIAL], {
studyInstanceUID: targetStudy.StudyInstanceUID,
displaySets: {
    ctDisplaySet,
    ptDisplaySet,
},
});
```

### 6.5 像素加载与融合渲染

```typescript
// Viewport渲染时触发像素加载
viewportGridService.onViewportReady(viewportId => {
const viewport = getEnabledElementByViewportId(viewportId);

// 加载CT和PET像素
viewport.loadVolumes([
    { volumeId: 'ctVolume', displaySetInstanceUID: 'ctDisplaySet' },
    { volumeId: 'ptVolume', displaySetInstanceUID: 'ptDisplaySet' },
], {
    blendMode: 'mip',
    colormaps: ['Grayscale', { name: 'hsv', opacity: [...] }],
});
});
```

---

## 七、事件广播机制

### 7.1 事件定义

**文件**：`platform/core/src/services/DisplaySetService/EVENTS.js`

```typescript
const EVENTS = {
DISPLAY_SETS_ADDED: 'event::displaySetService:displaySetsAdded',
DISPLAY_SETS_CHANGED: 'event::displaySetService:displaySetsChanged',
DISPLAY_SETS_REMOVED: 'event::displaySetService:displaySetsRemoved',
DISPLAY_SET_SERIES_METADATA_INVALIDATED: 
    'event::displaySetService:displaySetSeriesMetadataInvalidated',
};
```

### 7.2 PET/CT 相关订阅示例

```typescript
// PET/CT融合视图订阅DisplaySet变化
displaySetService.subscribe(displaySetService.EVENTS.DISPLAY_SETS_ADDED, data => {
const { displaySetsAdded } = data;

// 检查是否同时有CT和PET DisplaySet
const hasCt = displaySetsAdded.some(ds => ds.Modality === 'CT');
const hasPt = displaySetsAdded.some(ds => ds.Modality === 'PT');

if (hasCt && hasPt) {
    // 自动创建融合视图
    createFusionViewport(displaySetsAdded);
}
});
```

---

## 八、数据流总览

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      PET/CT 完整数据流                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  DICOM Server                                                           │
│      │                                                                  │
│      ├── QIDO-RS ──→ 查询CT和PT模态的Study/Series/Instance             │
│      │                                                                  │
│      └── WADO-RS ──→ 并行获取CT和PET像素数据                           │
│              │                                                          │
│              ▼                                                          │
│  ┌───────────────────────────────────────────────────────┐              │
│  │           DicomWebDataSource                           │              │
│  │  - query.studies/search({Modality: ['CT', 'PT']})     │              │
│  │  - retrieve.studyMetadata()                           │              │
│  └──────────────────┬────────────────────────────┘                      │
│                     │                                                   │
│                     ▼                                                   │
│  ┌───────────────────────────────────────────────────────┐              │
│  │           DicomMetadataStore                          │              │
│  │  - CT Series + PT Series                             │              │
│  │  - imageId作为像素引用                                │              │
│  └──────────────────┬────────────────────────────┘                      │
│                     │                                                   │
│                     ▼                                                   │
│  ┌───────────────────────────────────────────────────────┐              │
│  │           DisplaySetService                           │              │
│  │  - 创建ctDisplaySet和ptDisplaySet                    │              │
│  │  - 广播DISPLAY_SETS_ADDED事件                        │              │
│  └──────────────────┬────────────────────────────┘                      │
│                     │                                                   │
│                     ▼                                                   │
│  ┌───────────────────────────────────────────────────────┐              │
│  │           ViewportGridService                         │              │
│  │  - 应用hpViewports预设配置                           │              │
│  │  - 创建CT/PT/Fusion三个Viewport                      │              │
│  └──────────────────┬────────────────────────────┘                      │
│                     │                                                   │
│                     ▼                                                   │
│  ┌───────────────────────────────────────────────────────┐              │
│  │           Viewport (Cornerstone Volume)              │              │
│  │  - loadVolumes(CT + PT)                             │              │
│  │  - blendMode: MIP + colormap: HSV                   │              │
│  │  - 执行融合渲染                                      │              │
│  └───────────────────────────────────────────────────────┘              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 九、关键设计模式

| 模式 | PET/CT应用场景 | 示例 |
|------|--------------|------|
| **策略模式** | SOP Class Handler | CT和PET使用不同的处理逻辑 |
| **观察者模式** | 事件广播系统 | DisplaySet变化触发融合视图创建 |
| **模板方法模式** | hpViewports预设 | 预定义PET/CT布局模板 |
| **池化模式** | 图像加载管理 | 控制CT+PET并行加载数量 |

---

## 十、性能优化策略

| 优化点 | PET/CT实现方式 |
|--------|--------------|
| **延迟加载** | 仅加载当前视口需要的CT和PET图像 |
| **并行加载** | Promise.all同时加载CT和PET |
| **预加载** | StudyPrefetcherService后台加载相邻帧 |
| **交错加载** | nthLoader渐进式加载，优先显示关键帧 |
| **缓存机制** | cornerstone-cache避免重复请求 |
| **请求池化** | 控制CT+PET并发请求数量 |

---

## 十一、扩展点说明

| 扩展类型 | PET/CT用途 |
|---------|-----------|
| **DataSource** | 添加PET/CT专用查询逻辑 |
| **SOPClassHandler** | PET专用DisplaySet处理 |
| **Viewport** | PET/CT融合视图类型 |
| **ToolGroup** | PET/CT专用工具组 |
| **HangingProtocol** | PET/CT预设布局 |

---

## 十二、PET/CT 工具栏系统

### 12.1 工具栏核心文件

| 文件路径 | 职责 |
|---------|------|
| `modes/tmtv/src/initToolGroups.js` | 定义PET/CT专用工具组 |
| `modes/tmtv/src/toolbarButtons.ts` | 定义工具栏按钮配置 |
| `platform/core/src/services/ToolBarService/ToolbarService.ts` | 工具栏服务核心实现 |

### 12.2 工具组定义

PET/CT 有四个专用工具组：

```typescript
export const toolGroupIds = {
CT: 'ctToolGroup',
PT: 'ptToolGroup',
Fusion: 'fusionToolGroup',
MIP: 'mipToolGroup',
default: 'default',
};
```

**工具组配置差异**：

| 工具组 | 特殊配置 |
|--------|---------|
| **CT** | 标准工具配置 |
| **PT** | 额外包含 `RectangleROIStartEndThreshold` 工具 |
| **Fusion** | 标准工具配置 |
| **MIP** | 使用特殊配置（VolumeRotate、MipJumpToClick） |

### 12.3 工具栏按钮类型

| uiType | 说明 | 示例 |
|--------|------|------|
| `ohif.toolButton` | 普通工具按钮 | Length、Pan、Zoom |
| `ohif.toolBoxButton` | 工具箱按钮 | SegmentationTools |
| `ohif.toolBoxButtonGroup` | 工具箱按钮组 | BrushTools |
| `ohif.toolButtonList` | 工具按钮列表 | MeasurementTools |
| `ohif.advancedRenderingControls` | 高级渲染控制 | AdvancedRenderingControls |

### 12.4 PET/CT 专用按钮

| 按钮ID | 用途 | 特殊说明 |
|--------|------|---------|
| `RectangleROIStartEndThreshold` | PET阈值工具 | 仅在PT视图可用 |
| `modalityLoadBadge` | 模态加载状态 | 显示加载进度 |
| `Colorbar` | 颜色条 | PET视图颜色映射指示 |
| `trackingStatus` | 跟踪状态 | 管理测量跟踪 |
| `dataOverlayMenu` | 数据叠加菜单 | 管理前景/背景显示集 |
| `orientationMenu` | 方向菜单 | 切换轴位/矢状位/冠状位 |
| `windowLevelMenu` | 窗宽窗位菜单 | 调整图像对比度 |

### 12.5 按钮配置示例

```typescript
{
id: 'Length',
uiType: 'ohif.toolButton',
props: {
    icon: 'tool-length',
    label: i18n.t('Buttons:Length'),
    tooltip: i18n.t('Buttons:Length Tool'),
    commands: {
    commandName: 'setToolActive',
    commandOptions: {
        toolName: 'Length',
        toolGroupIds: ['ctToolGroup', 'ptToolGroup', 'fusionToolGroup'],
    },
    },
    evaluate: 'evaluate.cornerstoneTool',
},
}
```

### 12.6 在工具栏添加新功能

#### 方法一：添加普通按钮

```typescript
{
id: 'MyCustomTool',
uiType: 'ohif.toolButton',
props: {
    icon: 'tool-custom',
    label: i18n.t('Buttons:My Custom Tool'),
    tooltip: i18n.t('Buttons:Description'),
    commands: {
    commandName: 'setToolActive',
    commandOptions: {
        toolName: 'MyCustomTool',
        toolGroupIds: ['ctToolGroup', 'ptToolGroup', 'fusionToolGroup'],
    },
    },
    evaluate: 'evaluate.cornerstoneTool',
},
}
```

#### 方法二：添加带选项的按钮

```typescript
{
id: 'MyToolWithOptions',
uiType: 'ohif.toolButton',
props: {
    icon: 'tool-custom',
    label: i18n.t('Buttons:My Tool'),
    evaluate: [
    {
        name: 'evaluate.cornerstoneTool',
        disabledText: i18n.t('Buttons:Select a viewport'),
    },
    ],
    options: [
    {
        name: i18n.t('Buttons:Radius'),
        id: 'my-tool-radius',
        type: 'range',
        min: 1,
        max: 100,
        value: 50,
        commands: {
        commandName: 'setMyToolRadius',
        commandOptions: { /* ... */ },
        },
    },
    ],
},
}
```

#### 方法三：注册新工具到工具组

```javascript
// initToolGroups.js
tools.passive.push({
toolName: 'MyCustomTool',
configuration: {
    // 工具配置
},
});

// toolbarButtons.ts
{
id: 'MyCustomTool',
uiType: 'ohif.toolButton',
props: {
    icon: 'tool-custom',
    label: i18n.t('Buttons:My Custom Tool'),
    commands: {
    commandName: 'setToolActive',
    commandOptions: {
        toolName: 'MyCustomTool',
        toolGroupIds: ['ctToolGroup', 'ptToolGroup', 'fusionToolGroup'],
    },
    },
    evaluate: 'evaluate.cornerstoneTool',
},
}
```

### 12.7 评估函数（控制按钮状态）

评估函数用于控制按钮的启用/禁用状态：

```typescript
// 单个评估函数
evaluate: 'evaluate.cornerstoneTool'

// 多个评估函数
evaluate: [
{
    name: 'evaluate.cornerstone.segmentation',
    disabledText: i18n.t('Buttons:Create new segmentation'),
},
{
    name: 'evaluate.cornerstoneTool',
},
]
```

常用评估函数：

| 评估函数名 | 用途 |
|-----------|------|
| `evaluate.cornerstoneTool` | 检查工具是否可用 |
| `evaluate.cornerstone.segmentation` | 检查是否有分割 |
| `evaluate.windowLevelMenu` | 检查窗宽窗位菜单 |
| `evaluate.dataOverlayMenu` | 检查数据叠加菜单 |

### 12.8 ToolbarService API

| 方法 | 用途 |
|------|------|
| `register(buttons, replace)` | 注册按钮 |
| `removeButton(buttonId)` | 移除按钮 |
| `updateSection(key, buttons)` | 更新按钮组 |
| `recordInteraction(interaction)` | 执行按钮交互 |
| `refreshToolbarState(props)` | 刷新工具栏状态 |
| `registerEvaluateFunction(name, handler)` | 注册评估函数 |

---

## 十三、PET/CT 核心文件清单

| 层级 | 文件路径 | 说明 |
|------|---------|------|
| **PET/CT配置** | `extensions/tmtv/src/utils/hpViewports.ts` | PET/CT预设布局配置 |
| **工具组** | `modes/tmtv/src/initToolGroups.js` | PET/CT工具组定义 |
| **工具栏按钮** | `modes/tmtv/src/toolbarButtons.ts` | 工具栏按钮配置 |
| **布局选择器** | `extensions/tmtv/src/Toolbar/TmtvLayoutSelector.tsx` | TMTV专用布局选择器组件 |
| **Toolbar Module** | `extensions/tmtv/src/getToolbarModule.tsx` | TMTV工具栏模块注册 |
| **数据层** | `extensions/default/src/DicomWebDataSource/index.ts` | QIDO/WADO封装 |
| **元数据** | `extensions/default/src/DicomWebDataSource/retrieveStudyMetadata.js` | 元数据加载 |
| **DisplaySet** | `platform/core/src/services/DisplaySetService/DisplaySetService.ts` | DisplaySet创建 |
| **Viewport** | `extensions/cornerstone/src/services/ViewportService/Viewport.ts` | 视图配置 |
| **融合模式** | `extensions/cornerstone/src/utils/getCornerstoneBlendMode.ts` | MIP融合转换 |
| **像素加载** | `extensions/cornerstone/src/utils/dicomLoaderService.js` | 像素加载器 |
| **预加载** | `platform/core/src/services/StudyPrefetcherService/StudyPrefetcherService.ts` | 后台预加载 |
| **工具栏服务** | `platform/core/src/services/ToolBarService/ToolbarService.ts` | 工具栏服务核心 |

---

## 十四、图标资源文件位置

### 14.1 布局相关图标

**文件路径**：`platform/ui-next/src/components/Icons/Sources/Layout.tsx`

包含布局选择器使用的所有图标：

| 图标ID | 图标名称 | 用途 |
|--------|---------|------|
| `layout-common-2x2` | LayoutCommon2x2 | 2x2网格布局 |
| `layout-common-2x3` | LayoutCommon2x3 | 2行多列布局 |
| `layout-advanced-mpr` | LayoutAdvancedMPR | 多平面重建布局 |
| `layout-advanced-3d-only` | LayoutAdvanced3DOnly | 仅三维视图布局 |
| `layout-advanced-3d-four-up` | LayoutAdvanced3DFourUp | 三维四窗格布局 |
| `layout-advanced-3d-main` | LayoutAdvanced3DMain | 三维主视图布局 |
| `layout-advanced-3d-primary` | LayoutAdvanced3DPrimary | 三维主视图 |
| `layout-advanced-axial-primary` | LayoutAdvancedAxialPrimary | 轴位主视图 |
| `layout-common-1x1` | LayoutCommon1x1 | 单视图布局 |
| `layout-common-1x2` | LayoutCommon1x2 | 1x2布局 |

### 14.2 工具相关图标

**文件路径**：`platform/ui-next/src/components/Icons/Sources/Tools.tsx`

包含工具栏工具按钮使用的图标：

| 图标ID | 图标名称 | 用途 |
|--------|---------|------|
| `tool-layout` | ToolLayout | 布局工具图标 |
| `tool-length` | ToolLength | 长度测量工具 |
| `tool-pan` | ToolPan | 平移工具 |
| `tool-zoom` | ToolZoom | 缩放工具 |
| `tool-window-level` | ToolWindowLevel | 窗宽窗位工具 |
| `tool-crosshairs` | ToolCrosshairs | 十字准星工具 |

### 14.3 图标导出文件

**文件路径**：`platform/ui-next/src/components/Icons/Icons.tsx`

统一导出所有图标组件，方便其他模块引用。

### 14.4 TMTV布局选择器使用的图标

| 布局名称 | 使用图标 | 图标ID |
|---------|---------|--------|
| 默认布局 | 2行多列网格 | `layout-common-2x3` |
| 2x2 | 2x2网格 | `layout-common-2x2` |
| 2x4 | 2行多列网格 | `layout-common-2x3` |
| MPR | 多平面重建 | `layout-advanced-mpr` |
| 三维 | 仅三维视图 | `layout-advanced-3d-only` |

---

## 十四、总结

OHIF Viewer 中 PET/CT 融合显示的核心流程：

1. **查询阶段**：通过 QIDO 同时查询 CT 和 PT 模态
2. **元数据加载**：分别获取 CT 和 PET 的 Series/Instance 信息
3. **DisplaySet 创建**：CT 和 PET 分别创建独立的 DisplaySet
4. **Viewport 配置**：使用 `hpViewports.ts` 预设配置，包括同步组和融合选项
5. **像素加载**：并行加载 CT 和 PET 像素数据
6. **融合渲染**：Cornerstone 执行 MIP 融合算法，CT 使用灰度映射，PET 使用 HSV 颜色映射

**PET/CT 核心特性**：
- 使用 **MIP（最大强度投影）** 作为融合模式
- PET 使用 **HSV 颜色映射**，配合透明度渐变
- 通过 **同步组** 实现多视图联动（相机位置、窗宽窗位）
- 支持 **MPR（多平面重建）** 显示

**工具栏扩展**：
- 通过 `toolbarButtons.ts` 配置工具栏按钮
- 通过 `initToolGroups.js` 注册工具到工具组
- 使用评估函数控制按钮状态
- 支持添加自定义按钮和工具

---

**文档版本**：v2.2（PET/CT 布局选择器增强版）  
**生成日期**：2026年4月28日  
**适用项目**：OHIF Viewer（PET/CT 融合场景）