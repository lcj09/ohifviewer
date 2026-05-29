# OHIF 与第三方 Web 应用集成技术方案

## 一、文档概述

### 1.1 目的
本文档描述如何将 OHIF Viewer 与第三方 Web 应用集成，实现从第三方应用直接启动 OHIF TMTV 模式并加载已缓存的 DICOM 数据。

### 1.2 适用场景
- 第三方 Web 应用已将 DICOM 数据缓存到浏览器 IndexedDB
- 需要跳过传统的 QIDO 查询步骤，直接加载本地缓存数据
- 两个应用在**同一域名**下部署（同源策略允许共享 IndexedDB）

### 1.3 术语定义

| 术语 | 定义 |
|------|------|
| OHIF | Open Health Imaging Foundation Viewer |
| TMTV | Total Metabolic Tumor Volume 模式 |
| IndexedDB | 浏览器本地数据库 |
| StudyUID | DICOM 检查实例唯一标识 |
| DisplaySet | OHIF 中用于渲染的图像集合 |

---

## 二、整体架构

### 2.1 架构图

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        系统架构图                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────┐        ┌──────────────────┐                     │
│  │   第三方Web应用   │        │      OHIF        │                     │
│  │   (IndexedDB)    │        │    Viewer        │                     │
│  └────────┬─────────┘        └────────┬─────────┘                     │
│           │                           │                               │
│           │  1. 打开OHIF窗口          │                               │
│           │  2. URL传递StudyUID       │                               │
│           │                           │                               │
│           └──────────┬────────────────┘                               │
│                      │                                                │
│                      ▼                                                │
│           ┌──────────────────┐                                        │
│           │   IndexedDB      │ ← 共享数据库                            │
│           │   (DICOMCache)   │                                        │
│           └──────────────────┘                                        │
│                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### 2.2 数据流

| 步骤 | 描述 | 涉及组件 |
|------|------|----------|
| 1 | 用户点击第三方应用按钮 | 第三方应用 UI |
| 2 | 打开 OHIF 窗口并传递参数 | `window.open()` |
| 3 | OHIF 解析 URL 参数 | DataSourceWrapper |
| 4 | 从 IndexedDB 读取数据 | DicomWebDataSource |
| 5 | 创建 Volume 并渲染 | CornerstoneCacheService |

---

## 三、需求分析

### 3.1 功能需求

| 编号 | 需求描述 | 来源 |
|------|----------|------|
| FR-001 | 第三方应用点击按钮启动 OHIF TMTV 模式 | 用户需求 |
| FR-002 | 通过 URL 参数传递 StudyUID | 用户需求 |
| FR-003 | 跳过 QIDO 查询，直接从 IndexedDB 加载 | 用户需求 |
| FR-004 | 支持从 IndexedDB 读取 DICOM 像素数据 | 用户需求 |
| FR-005 | 加载失败时自动回退到服务器查询 | 可靠性要求 |

### 3.2 非功能需求

| 编号 | 需求描述 | 要求 |
|------|----------|------|
| NFR-001 | 加载时间 | < 3秒（本地缓存） |
| NFR-002 | 兼容性 | Chrome 90+, Firefox 88+ |
| NFR-003 | 安全性 | 同源验证、数据校验 |

---

## 四、技术方案

### 4.1 IndexedDB 数据结构

#### 4.1.1 数据库配置

```javascript
{
  name: 'DICOMCache',
  version: 1,
  stores: {
    studies: { keyPath: 'studyUID', indexes: ['studyUID'] },
    series: { keyPath: 'seriesUID', indexes: ['studyUID', 'seriesUID'] },
    instances: { keyPath: 'instanceUID', indexes: ['studyUID', 'seriesUID', 'instanceUID'] },
  }
}
```

#### 4.1.2 Study 数据结构

| 字段 | 类型 | 说明 |
|------|------|------|
| studyUID | string | DICOM Study Instance UID |
| metadata | object | 检查级元数据 |
| series | array | 系列数组 |

#### 4.1.3 Series 数据结构

| 字段 | 类型 | 说明 |
|------|------|------|
| seriesUID | string | DICOM Series Instance UID |
| studyUID | string | 所属检查 UID |
| modality | string | 模态（CT/MR/PET等） |
| instances | array | 实例数组 |

#### 4.1.4 Instance 数据结构

| 字段 | 类型 | 说明 |
|------|------|------|
| instanceUID | string | DICOM SOP Instance UID |
| seriesUID | string | 所属系列 UID |
| studyUID | string | 所属检查 UID |
| pixelData | ArrayBuffer | DICOM 像素数据 |
| metadata | object | 图像级元数据（Rows、Columns、WindowCenter等） |

### 4.2 URL 参数规范

#### 4.2.1 URL 格式

```
{OHIF_BASE_URL}/tmtv?StudyInstanceUIDs={studyUID}&source=indexeddb
```

#### 4.2.2 参数说明

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| StudyInstanceUIDs | string | 是 | 要加载的检查 UID |
| source | string | 是 | 数据源类型，固定为 `indexeddb` |

### 4.3 核心修改点

#### 4.3.1 路由层修改

**文件**: `platform/app/src/routes/DataSourceWrapper.tsx`

**修改内容**: 解析 URL 参数，判断数据源模式

```typescript
useEffect(() => {
  const searchParams = new URLSearchParams(window.location.search);
  const studyUID = searchParams.get('StudyInstanceUIDs');
  const source = searchParams.get('source');
  
  if (studyUID && source === 'indexeddb') {
    setDataSourceMode('indexeddb');
    setTargetStudyUID(studyUID);
  }
}, [location.search]);
```

#### 4.3.2 数据源层修改

**文件**: `extensions/default/src/DicomWebDataSource/index.ts`

**修改内容**: 添加从 IndexedDB 读取数据的方法

```typescript
async loadStudyFromIndexedDB(studyUID: string): Promise<StudyLoadResult> {
  const db = await this._openIndexedDB('DICOMCache');
  const studyData = await db.get('studies', studyUID);
  
  if (!studyData || !this._validateStudyData(studyData)) {
    throw new Error(`Study ${studyUID} not found or invalid in IndexedDB`);
  }
  
  const displaySets = this._createDisplaySetsFromIndexedDB(studyData);
  
  return {
    studies: [{ StudyInstanceUID: studyUID, ...studyData.metadata }],
    displaySets,
  };
}

private _openIndexedDB(dbName: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

private _createDisplaySetsFromIndexedDB(studyData: StudyData): DisplaySet[] {
  return studyData.series.map(series => ({
    StudyInstanceUID: studyData.studyUID,
    SeriesInstanceUID: series.seriesUID,
    displaySetInstanceUID: `series-${series.seriesUID}`,
    Modality: series.modality,
    images: series.instances.map(instance => ({
      SOPInstanceUID: instance.instanceUID,
      imageId: `indexeddb:${instance.instanceUID}`,
      frameNumbers: instance.frameNumbers,
    })),
    isReconstructable: true,
  }));
}
```

#### 4.3.3 Volume 创建层修改

**文件**: `extensions/cornerstone/src/services/CornerstoneCacheService/CornerstoneCacheService.ts`

**修改内容**: 添加从 IndexedDB 创建 Volume 的方法

```typescript
private async _getVolumeViewportDataFromIndexedDB(displaySets: DisplaySet[]): Promise<VolumeViewportData> {
  const volumeData = [];

  for (const displaySet of displaySets) {
    const volumeId = `${VOLUME_LOADER_SCHEME}:${displaySet.displaySetInstanceUID}`;
    const imageDataList = await this._getImageDataFromIndexedDB(displaySet);
    
    const volume = await volumeLoader.createAndCacheVolume(volumeId, {
      imageDataList,
    });
    
    volumeData.push({
      StudyInstanceUID: displaySet.StudyInstanceUID,
      displaySetInstanceUID: displaySet.displaySetInstanceUID,
      volume,
      volumeId,
    });
  }

  return { viewportType: Enums.ViewportType.ORTHOGRAPHIC, data: volumeData };
}

private async _getImageDataFromIndexedDB(displaySet: DisplaySet): Promise<ImageData[]> {
  const db = await this._openIndexedDB('DICOMCache');
  const imageDataList = [];
  
  for (const image of displaySet.images) {
    const instanceData = await db.get('instances', image.SOPInstanceUID);
    if (instanceData) {
      imageDataList.push({
        imageId: image.imageId,
        pixelData: instanceData.pixelData,
        metadata: instanceData.metadata,
      });
    }
  }
  
  return imageDataList;
}
```

#### 4.3.4 模式初始化修改

**文件**: `modes/tmtv/src/index.ts`

**修改内容**: 修改初始化逻辑支持 IndexedDB 模式

```typescript
onModeEnter: async ({ servicesManager, viewportGridService }) => {
  const { cornerstoneCacheService, dataSource } = servicesManager.services;
  
  const searchParams = new URLSearchParams(window.location.search);
  const studyUID = searchParams.get('StudyInstanceUIDs');
  const source = searchParams.get('source');
  
  if (studyUID && source === 'indexeddb') {
    try {
      const { displaySets } = await dataSource.loadStudyFromIndexedDB(studyUID);
      const volumeData = await cornerstoneCacheService._getVolumeViewportDataFromIndexedDB(displaySets);
      
      viewportGridService.setDisplaySets(volumeData.data);
      initToolGroups(toolNames, Enums, toolGroupService, commandsManager);
      
      return;
    } catch (e) {
      console.error('Failed to load from IndexedDB:', e);
    }
  }
  
  // 原有服务器查询逻辑...
}
```

---

## 五、第三方应用集成指南

### 5.1 打开 OHIF 窗口

```javascript
function openOHIF(studyUID) {
  const OHIF_BASE_URL = 'http://localhost:3000';
  const url = `${OHIF_BASE_URL}/tmtv?StudyInstanceUIDs=${studyUID}&source=indexeddb`;
  
  window.open(url, '_blank', 'width=1200,height=800');
}
```

### 5.2 IndexedDB 数据写入

```javascript
async function saveToIndexedDB(studyData) {
  const db = await openIndexedDB('DICOMCache');
  
  // 写入检查数据
  await db.put('studies', studyData);
  
  // 写入系列数据
  for (const series of studyData.series) {
    await db.put('series', series);
    
    // 写入实例数据
    for (const instance of series.instances) {
      await db.put('instances', instance);
    }
  }
}
```

---

## 六、安全考虑

### 6.1 同源验证

```typescript
private _validateOrigin(): boolean {
  if (!window.isSecureContext) {
    console.warn('IndexedDB may not work in insecure context');
    return false;
  }
  return true;
}
```

### 6.2 数据验证

```typescript
private _validateStudyData(studyData: any): boolean {
  if (!studyData.studyUID) return false;
  if (!studyData.series || !Array.isArray(studyData.series)) return false;
  
  for (const series of studyData.series) {
    if (!series.seriesUID || !series.instances) return false;
    for (const instance of series.instances) {
      if (!instance.instanceUID || !instance.pixelData) return false;
    }
  }
  
  return true;
}
```

---

## 七、部署说明

### 7.1 同一域名部署

```
域名: http://localhost:3000
  ├── 第三方应用: http://localhost:3000/app
  └── OHIF: http://localhost:3000/ohif
```

### 7.2 注意事项

1. **IndexedDB 版本管理**：数据库版本变更时需要处理迁移
2. **存储空间限制**：IndexedDB 通常限制为 50MB-500MB，取决于浏览器
3. **清理策略**：建议定期清理过期的缓存数据

---

## 八、错误处理

### 8.1 错误场景

| 场景 | 错误类型 | 处理策略 |
|------|----------|----------|
| IndexedDB 不可用 | SecurityError | 回退到服务器查询 |
| 数据不存在 | NotFoundError | 回退到服务器查询 |
| 数据格式错误 | DataError | 记录日志，回退到服务器查询 |
| 存储空间不足 | QuotaExceededError | 提示用户清理缓存 |

### 8.2 回退机制

```typescript
try {
  const { displaySets } = await dataSource.loadStudyFromIndexedDB(studyUID);
  // 使用 IndexedDB 数据
} catch (e) {
  console.warn('IndexedDB load failed, falling back to server:', e);
  // 执行原有服务器查询逻辑
  const { displaySets } = await dataSource.query.studies.search({ StudyInstanceUID: studyUID });
}
```

---

## 九、代码位置汇总

| 模块 | 文件路径 | 修改内容 |
|------|----------|----------|
| 路由层 | `platform/app/src/routes/DataSourceWrapper.tsx` | 解析 URL 参数 |
| 数据源层 | `extensions/default/src/DicomWebDataSource/index.ts` | 添加 IndexedDB 读取方法 |
| 缓存服务 | `extensions/cornerstone/src/services/CornerstoneCacheService/CornerstoneCacheService.ts` | 添加 Volume 创建方法 |
| 模式初始化 | `modes/tmtv/src/index.ts` | 修改初始化逻辑 |

---

## 十、版本历史

| 版本 | 日期 | 作者 | 变更说明 |
|------|------|------|----------|
| v1.0 | 2026-05-28 | Author | 初始版本 |

---

**文档版本**: v1.0  
**生成日期**: 2026-05-28  
**适用项目**: OHIF Viewer