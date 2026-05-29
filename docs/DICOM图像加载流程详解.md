# DICOM 图像加载流程详解

## 概述

OHIF 查看器采用标准的 DICOM Web 协议进行检查查询和图像调阅：
- **QIDO-RS** (Query based on ID for DICOM Objects - RESTful Services): 用于检查/系列/实例的查询
- **WADO-RS** (Web Access to DICOM Objects - RESTful Services): 用于图像数据的获取

---

## 目录

1. [检查查询流程（QIDO-RS）](#检查查询流程qido-rs)
   - 1.1 查询界面交互
   - 1.2 查询参数构建
   - 1.3 QIDO 请求发送

2. [TMTV 模式初始化](#tmtv模式初始化)
   - 2.1 模式入口与导航
   - 2.2 工具组初始化
   - 2.3 Hanging Protocol 匹配

3. [图像调阅流程（WADO-RS）](#图像调阅流程wado-rs)
   - 3.1 ImageId 生成
   - 3.2 WADO Loader 配置
   - 3.3 Volume 创建与缓存
   - 3.4 HTTP 请求与响应

4. [完整调用链](#完整调用链)

5. [关键代码位置汇总](#关键代码位置汇总)

---

## 一、检查查询流程（QIDO-RS）

### 1.1 查询界面交互

用户在工作列表页面输入筛选条件后，触发查询操作：

**文件**: `platform/app/src/routes/WorkList/WorkList.tsx`

```jsx
// 第138-145行：状态更新函数
const setFilterValues = val => {
  if (filterValues.pageNumber === val.pageNumber) {
    val.pageNumber = 1;
  }
  _setFilterValues(val);
  updateSessionQueryFilterValues(val);
  setExpandedRows([]);
};
```

### 1.2 查询参数映射

**文件**: `extensions/default/src/DicomWebDataSource/qido.js`

```javascript
// 第147-213行：参数映射
function mapParams(params, options = {}) {
  const parameters = {
    PatientName: withWildcard(params.patientName),
    '00100020': withWildcard(params.patientId),      // 病历号
    AccessionNumber: withWildcard(params.accessionNumber),
    StudyDescription: withWildcard(params.studyDescription),
    ModalitiesInStudy: params.modalitiesInStudy,
    limit: params.limit || 101,
    offset: params.offset || 0,
    fuzzymatching: options.supportsFuzzyMatching === true,
    includefield: '00081030,00080060',              // StudyDescription, Modality
  };
  return parameters;
}
```

### 1.3 QIDO 请求示例

**URL 格式**:
```
{qidoRoot}/studies?PatientName=*Zhang*&StudyDate=20230101-20231231&limit=101&offset=0&fuzzymatching=true&includefield=00081030%2C00080060
```

**请求方法**: `GET`

---

## 二、TMTV 模式初始化

### 2.1 模式入口与导航

用户点击 TMTV 模式按钮后，导航到 TMTV 路由：

**文件**: `platform/app/src/routes/WorkList/WorkList.tsx`（第415-428行）

```jsx
<Link to={`${mode.routeName}?StudyInstanceUIDs=${studyInstanceUid}`}>
  <Button>{mode.displayName}</Button>
</Link>
```

生成的 URL: `http://localhost:3000/tmtv?StudyInstanceUIDs=1.2.3.4.5`

### 2.2 模式初始化

**文件**: `modes/tmtv/src/index.ts`（第48-90行）

```typescript
onModeEnter: ({ servicesManager, extensionManager, commandsManager }) => {
  // 初始化工具组（CT、PT、Fusion、MIP）
  initToolGroups(toolNames, Enums, toolGroupService, commandsManager);
  
  // 监听视口添加事件
  toolGroupService.subscribe(toolGroupService.EVENTS.VIEWPORT_ADDED, () => {
    setCrosshairsConfiguration(...);
    setFusionActiveVolume(...);
  });
  
  // 注册工具栏按钮
  toolbarService.register(toolbarButtons);
}
```

### 2.3 Hanging Protocol 匹配

**文件**: `extensions/tmtv/src/getHangingProtocolModule.ts`（第307-413行）

**DisplaySet 选择规则**:
- **ctDisplaySet**: Modality=CT + isReconstructable=true + SeriesDescription包含"CT"或"CT WB"
- **ptDisplaySet**: Modality=PT + isReconstructable=true + SeriesDescription包含"Corrected"

**融合视图配置**（`fusionAXIAL`）:
```typescript
const fusionAXIAL = {
  viewportOptions: {
    viewportType: 'volume',
    orientation: 'axial',
    toolGroupId: 'fusionToolGroup',
    syncGroups: [cameraPositionSync('axialSync'), ...],
  },
  displaySets: [
    { id: 'ctDisplaySet' },
    { 
      id: 'ptDisplaySet',
      options: {
        colormap: { name: 'hsv', opacity: [...] },
        voi: { custom: 'getPTVOIRange' },
      },
    },
  ],
};
```

---

## 三、图像调阅流程（WADO-RS）

### 3.1 ImageId 生成

**文件**: `extensions/default/src/DicomWebDataSource/index.ts`（第652-686行）

```typescript
// 获取DisplaySet的所有图像ID
getImageIdsForDisplaySet(displaySet) {
  const images = displaySet.images;
  const imageIds = [];

  displaySet.images.forEach(instance => {
    const NumberOfFrames = instance.NumberOfFrames;

    if (NumberOfFrames > 1) {
      for (let frame = 1; frame <= NumberOfFrames; frame++) {
        const imageId = this.getImageIdsForInstance({ instance, frame });
        imageIds.push(imageId);
      }
    } else {
      const imageId = this.getImageIdsForInstance({ instance });
      imageIds.push(imageId);
    }
  });

  return imageIds;
}

// 为单个实例生成ImageId
getImageIdsForInstance({ instance, frame = undefined }) {
  const imageIds = getImageId({ instance, frame, config: dicomWebConfig });
  return imageIds;
}
```

**WADO-RS URL 构建**: `extensions/default/src/DicomWebDataSource/utils/getWADORSImageId.js`（第1-50行）

```javascript
function buildInstanceWadoRsUri(instance, config) {
  const { StudyInstanceUID, SeriesInstanceUID, SOPInstanceUID } = instance;
  return `${config.wadoRoot}/studies/${StudyInstanceUID}/series/${SeriesInstanceUID}/instances/${SOPInstanceUID}`;
}

function buildInstanceFrameWadoRsUri(instance, config, frame) {
  const baseWadoRsUri = buildInstanceWadoRsUri(instance, config);
  frame = frame || 1;
  return `${baseWadoRsUri}/frames/${frame}`;
}

export default function getWADORSImageId(instance, config, frame) {
  const uri = buildInstanceFrameWadoRsUri(instance, config, frame);
  return `wadors:${uri}`;  // 添加 wadors: 前缀
}
```

**生成的 ImageId 示例**:
```
wadors:http://localhost:8042/dicom-web/studies/1.2.3.4/series/5.6.7.8/instances/9.10.11.12/frames/1
```

### 3.2 WADO Loader 配置

**文件**: `extensions/cornerstone/src/initWADOImageLoader.js`（第1-52行）

```javascript
export default function initWADOImageLoader(userAuthenticationService, appConfig, extensionManager) {
  // 注册 Volume Loader
  registerVolumeLoader('cornerstoneStreamingImageVolume', cornerstoneStreamingImageVolumeLoader);
  registerVolumeLoader('cornerstoneStreamingDynamicImageVolume', cornerstoneStreamingDynamicImageVolumeLoader);

  // 初始化 DICOM Image Loader
  dicomImageLoader.init({
    maxWebWorkers: Math.min(
      Math.max(navigator.hardwareConcurrency - 1, 1),
      appConfig.maxNumberOfWebWorkers
    ),
    // 请求发送前处理（注入认证头）
    beforeSend: function (xhr) {
      const headers = userAuthenticationService.getAuthorizationHeader();
      const xhrRequestHeaders = {
        Accept: acceptHeader,
      };
      if (headers) {
        Object.assign(xhrRequestHeaders, headers);
      }
      return xhrRequestHeaders;
    },
    errorInterceptor: error => {
      errorHandler.getHTTPErrorHandler(error);
    },
  });
}
```

**调用位置**: `extensions/cornerstone/src/init.tsx`（第198行）

```typescript
initWADOImageLoader(userAuthenticationService, appConfig, extensionManager);
```

### 3.3 Volume 创建与缓存

**文件**: `extensions/cornerstone/src/services/CornerstoneCacheService/CornerstoneCacheService.ts`（第223-306行）

```typescript
private async _getVolumeViewportData(dataSource, displaySets, viewportType) {
  const volumeData = [];

  for (const displaySet of displaySets) {
    const volumeId = `${VOLUME_LOADER_SCHEME}:${displaySet.displaySetInstanceUID}`;
    
    let volumeImageIds = this.volumeImageIds.get(displaySet.displaySetInstanceUID);
    let volume = cs3DCache.getVolume(volumeId);

    // 如果缓存不存在，创建新Volume
    if (!volumeImageIds || !volume) {
      volumeImageIds = this._getCornerstoneVolumeImageIds(displaySet, dataSource);
      
      // 创建并缓存Volume（内部会逐个加载图像）
      volume = await volumeLoader.createAndCacheVolume(volumeId, {
        imageIds: volumeImageIds,
      });
      
      this.volumeImageIds.set(displaySet.displaySetInstanceUID, volumeImageIds);
      displaySet.imageIds = volumeImageIds;
    }

    volumeData.push({
      StudyInstanceUID: displaySet.StudyInstanceUID,
      displaySetInstanceUID: displaySet.displaySetInstanceUID,
      volume,
      volumeId,
      imageIds: volumeImageIds,
    });
  }

  return { viewportType, data: volumeData };
}
```

### 3.4 HTTP 请求与响应

**请求格式**:
```http
GET /dicom-web/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/frames/{frame} HTTP/1.1
Host: localhost:8042
Accept: application/dicom; transfer-syntax=*
Authorization: Bearer <token>
```

**响应格式**:
- **状态码**: `200 OK`
- **Content-Type**: `application/dicom`
- **Body**: DICOM 文件二进制流（.dcm 格式）

---

## 四、完整调用链

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        完整调用链流程                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  1. 用户查询检查                                                           │
│     └── WorkList.tsx → setFilterValues() → 更新状态                        │
│           ↓                                                               │
│     └── qido.js → mapParams() → 构建查询参数                              │
│           ↓                                                               │
│     └── 发送 QIDO-RS 请求 → 获取检查列表                                   │
│                                                                           │
│  2. 用户选择检查并进入 TMTV 模式                                           │
│     └── WorkList.tsx → 导航到 /tmtv?StudyInstanceUIDs=xxx                 │
│           ↓                                                               │
│     └── modes/tmtv/src/index.ts → onModeEnter()                           │
│           ├── initToolGroups()                                            │
│           └── 注册工具栏按钮                                               │
│                                                                           │
│  3. Hanging Protocol 匹配                                                  │
│     └── extensions/tmtv/src/getHangingProtocolModule.ts                   │
│           ├── 匹配 CT 和 PT 系列                                          │
│           └── 配置融合视图                                                 │
│                                                                           │
│  4. Volume 创建                                                           │
│     └── CornerstoneCacheService.ts → _getVolumeViewportData()             │
│           ├── getImageIdsForDisplaySet() → 生成 wadors:URL                 │
│           └── volumeLoader.createAndCacheVolume()                         │
│                                                                           │
│  5. 图像加载                                                              │
│     └── dicomImageLoader → 发送 WADO-RS 请求                              │
│           ├── 注入 Authorization 头                                       │
│           ├── 接收 DICOM 二进制流                                         │
│           └── 解码为像素数据                                               │
│                                                                           │
│  6. 渲染到视口                                                             │
│     └── Cornerstone Viewport → 应用窗宽窗位、颜色映射、渲染图像             │
│                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 五、关键代码位置汇总

| 阶段 | 文件路径 | 行号 | 功能 |
|------|----------|------|------|
| 查询状态更新 | `platform/app/src/routes/WorkList/WorkList.tsx` | 138-145 | 更新筛选条件 |
| QIDO 参数映射 | `extensions/default/src/DicomWebDataSource/qido.js` | 147-213 | 构建查询参数 |
| TMTV 模式初始化 | `modes/tmtv/src/index.ts` | 48-90 | 模式入口逻辑 |
| Hanging Protocol | `extensions/tmtv/src/getHangingProtocolModule.ts` | 307-413 | 视图布局配置 |
| ImageId 生成 | `extensions/default/src/DicomWebDataSource/index.ts` | 652-686 | 获取图像ID列表 |
| WADO URL 构建 | `extensions/default/src/DicomWebDataSource/utils/getWADORSImageId.js` | 1-50 | 构建WADO-RS URL |
| WADO Loader 配置 | `extensions/cornerstone/src/initWADOImageLoader.js` | 1-52 | 初始化图像加载器 |
| Volume 创建 | `extensions/cornerstone/src/services/CornerstoneCacheService/CornerstoneCacheService.ts` | 223-306 | 创建并缓存Volume |
| DICOM二进制流获取 | `extensions/cornerstone/src/utils/dicomLoaderService.js` | 72-77 | 获取完整DICOM实例 |

---

## 六、技术要点

1. **协议**: 使用 DICOM Web 标准协议（QIDO-RS + WADO-RS）
2. **ImageId 格式**: `wadors:{WADO-RS URL}`
3. **数据格式**: 服务端返回完整的 DICOM 文件二进制流（.dcm 格式）
4. **认证**: 通过 `beforeSend` 回调注入 `Authorization` 头
5. **缓存**: Volume 和 ImageId 都有本地缓存机制
6. **异步加载**: 使用 Web Worker 进行 DICOM 解码，避免阻塞主线程

---

**文档版本**: v1.0  
**生成日期**: 2026-05-28  
**适用项目**: OHIF Viewer