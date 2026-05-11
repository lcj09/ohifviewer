import {
  ctAXIAL,
  ctCORONAL,
  ctSAGITTAL,
  fusionAXIAL,
  fusionCORONAL,
  fusionSAGITTAL,
  mipAXIAL,    // [2026-05-11 新增] MIP轴位视图，用于轴位2x2布局
  mipCORONAL,  // [2026-05-11 新增] MIP冠状位视图，用于冠状位2x2布局
  mipSAGITTAL,
  ptAXIAL,
  ptCORONAL,
  ptSAGITTAL,
} from './utils/hpViewports';

/**
 * represents a 3x4 viewport layout configuration. The layout displays CT axial, sagittal, and coronal
 * images in the first row, PT axial, sagittal, and coronal images in the second row, and fusion axial,
 * sagittal, and coronal images in the third row. The fourth column is fully spanned by a MIP sagittal
 * image, covering all three rows. It has synchronizers for windowLevel for all CT and PT images, and
 * also camera synchronizer for each orientation
 */
const stage1: AppTypes.HangingProtocol.ProtocolStage = {
  name: 'default',
  id: 'default',
  viewportStructure: {
    layoutType: 'grid',
    properties: {
      rows: 3,
      columns: 4,
      layoutOptions: [
        {
          x: 0,
          y: 0,
          width: 1 / 4,
          height: 1 / 3,
        },
        {
          x: 1 / 4,
          y: 0,
          width: 1 / 4,
          height: 1 / 3,
        },
        {
          x: 2 / 4,
          y: 0,
          width: 1 / 4,
          height: 1 / 3,
        },
        {
          x: 0,
          y: 1 / 3,
          width: 1 / 4,
          height: 1 / 3,
        },
        {
          x: 1 / 4,
          y: 1 / 3,
          width: 1 / 4,
          height: 1 / 3,
        },
        {
          x: 2 / 4,
          y: 1 / 3,
          width: 1 / 4,
          height: 1 / 3,
        },
        {
          x: 0,
          y: 2 / 3,
          width: 1 / 4,
          height: 1 / 3,
        },
        {
          x: 1 / 4,
          y: 2 / 3,
          width: 1 / 4,
          height: 1 / 3,
        },
        {
          x: 2 / 4,
          y: 2 / 3,
          width: 1 / 4,
          height: 1 / 3,
        },
        {
          x: 3 / 4,
          y: 0,
          width: 1 / 4,
          height: 1,
        },
      ],
    },
  },
  viewports: [
    ctAXIAL,
    ctSAGITTAL,
    ctCORONAL,
    ptAXIAL,
    ptSAGITTAL,
    ptCORONAL,
    fusionAXIAL,
    fusionSAGITTAL,
    fusionCORONAL,
    mipSAGITTAL,
  ],
  createdDate: '2021-02-23T18:32:42.850Z',
};

/**
 * The layout displays CT axial image in the top-left viewport, fusion axial image
 * in the top-right viewport, PT axial image in the bottom-left viewport, and MIP
 * sagittal image in the bottom-right viewport. The layout follows a simple grid
 * pattern with 2 rows and 2 columns. It includes synchronizers as well.
 */
const stage2 = {
  name: 'Fusion 2x2',
  id: 'Fusion-2x2',
  viewportStructure: {
    layoutType: 'grid',
    properties: {
      rows: 2,
      columns: 2,
    },
  },
  viewports: [ctAXIAL, fusionAXIAL, ptAXIAL, mipSAGITTAL],
};

/**
 * [2026-05-11 修改] 轴位 2×2 布局
 *
 * 布局结构：2行 × 2列
 *   ┌─────────────┬─────────────┐
 *   │  CT 轴位    │  PET 轴位   │
 *   ├─────────────┼─────────────┤
 *   │ Fusion 轴位 │   MIP 图    │
 *   └─────────────┴─────────────┘
 *
 * 注意：此布局中每个 toolGroup 只有1个视口，
 * 十字线工具无法在不同方向之间画参考线（需要至少2个不同方向的视口）。
 * 但通过安全补丁，十字线工具不会崩溃。
 */
const stage3: AppTypes.HangingProtocol.ProtocolStage = {
  name: 'Axial',
  id: '2x3-layout',
  viewportStructure: {
    layoutType: 'grid',
    properties: {
      rows: 2,
      columns: 2,
    },
  },
  viewports: [ctAXIAL, ptAXIAL, fusionAXIAL, mipSAGITTAL],
};

/**
 * [2026-05-11 修改] 矢状位 2×2 布局
 *
 * 布局结构：2行 × 2列
 *   ┌─────────────┬─────────────┐
 *   │ CT 矢状位   │ PET 矢状位  │
 *   ├─────────────┼─────────────┤
 *   │Fusion矢状位 │   MIP 图    │
 *   └─────────────┴─────────────┘
 */
const stage4: AppTypes.HangingProtocol.ProtocolStage = {
  name: 'Sagittal',
  id: '2x4-layout',
  viewportStructure: {
    layoutType: 'grid',
    properties: {
      rows: 2,
      columns: 2,
    },
  },
  viewports: [ctSAGITTAL, ptSAGITTAL, fusionSAGITTAL, mipSAGITTAL],
};

/**
 * [2026-05-11 新增] 冠状位 2×2 布局
 *
 * 布局结构：2行 × 2列
 *   ┌─────────────┬─────────────┐
 *   │ CT 冠状位   │ PET 冠状位  │
 *   ├─────────────┼─────────────┤
 *   │Fusion冠状位 │   MIP 图    │
 *   └─────────────┴─────────────┘
 */
const stage5: AppTypes.HangingProtocol.ProtocolStage = {
  name: 'Coronal',
  id: 'coronal-mip-layout',
  viewportStructure: {
    layoutType: 'grid',
    properties: {
      rows: 2,
      columns: 2,
    },
  },
  viewports: [ctCORONAL, ptCORONAL, fusionCORONAL, mipCORONAL],
};

/**
 * [2026-05-11 恢复] 原始 2×3 布局（CT + PT 三视图）
 *
 * 布局结构：2行 × 3列
 *   ┌─────────────┬─────────────┬─────────────┐
 *   │  CT 轴位    │ CT 矢状位   │ CT 冠状位   │
 *   ├─────────────┼─────────────┼─────────────┤
 *   │  PT 轴位    │ PT 矢状位   │ PT 冠状位   │
 *   └─────────────┴─────────────┴─────────────┘
 *
 * 十字线：✅ 正常工作（每个toolGroup有3个不同方向视口）
 */
const stage6: AppTypes.HangingProtocol.ProtocolStage = {
  name: '2x3',
  id: '2x3-original-layout',
  viewportStructure: {
    layoutType: 'grid',
    properties: {
      rows: 2,
      columns: 3,
    },
  },
  viewports: [ctAXIAL, ctSAGITTAL, ctCORONAL, ptAXIAL, ptSAGITTAL, ptCORONAL],
};

/**
 * [2026-05-11 恢复] 原始 2×4 布局（PT三视图 + MIP + Fusion三视图）
 *
 * 布局结构：2行 × 4列（MIP跨行）
 *   ┌─────────────┬─────────────┬─────────────┬─────────────┐
 *   │ PT 冠状位   │ PT 矢状位   │  PT 轴位    │             │
 *   ├─────────────┼─────────────┼─────────────┤   MIP 图    │
 *   │Fusion冠状位 │Fusion矢状位 │Fusion轴位   │             │
 *   └─────────────┴─────────────┴─────────────┴─────────────┘
 *
 * 十字线：✅ 正常工作（ptToolGroup和fusionToolGroup各有3个方向视口）
 */
const stage7: AppTypes.HangingProtocol.ProtocolStage = {
  name: '2x4',
  id: '2x4-original-layout',
  viewportStructure: {
    layoutType: 'grid',
    properties: {
      rows: 2,
      columns: 4,
      layoutOptions: [
        { x: 0, y: 0, width: 1 / 4, height: 1 / 2 },
        { x: 1 / 4, y: 0, width: 1 / 4, height: 1 / 2 },
        { x: 2 / 4, y: 0, width: 1 / 4, height: 1 / 2 },
        { x: 3 / 4, y: 0, width: 1 / 4, height: 1 },
        { x: 0, y: 1 / 2, width: 1 / 4, height: 1 / 2 },
        { x: 1 / 4, y: 1 / 2, width: 1 / 4, height: 1 / 2 },
        { x: 2 / 4, y: 1 / 2, width: 1 / 4, height: 1 / 2 },
      ],
    },
  },
  viewports: [
    ptCORONAL,
    ptSAGITTAL,
    ptAXIAL,
    mipSAGITTAL,
    fusionCORONAL,
    fusionSAGITTAL,
    fusionAXIAL,
  ],
};

/**
 * [2026-05-11 新增] TMTV 专用 MPR 布局（Fusion 三视图 + 十字线）
 *
 * 布局结构：1行 × 3列
 *   ┌─────────────┬─────────────┬─────────────┐
 *   │Fusion 轴位  │Fusion矢状位 │Fusion冠状位  │
 *   └─────────────┴─────────────┴─────────────┘
 *
 * 特点：
 *   - 所有视口使用 fusionToolGroup，加载 Fusion 融合图像
 *   - fusionToolGroup 有3个不同方向视口 → Crosshairs 正常工作 ✅
 *   - 无论选中 CT/PET/Fusion 视口，都显示 Fusion 图像
 */
const stage8: AppTypes.HangingProtocol.ProtocolStage = {
  name: 'MPR',
  id: 'tmtv-mpr-layout',
  viewportStructure: {
    layoutType: 'grid',
    properties: {
      rows: 1,
      columns: 3,
    },
  },
  viewports: [fusionAXIAL, fusionSAGITTAL, fusionCORONAL],
};

// const stage0: AppTypes.HangingProtocol.ProtocolStage = {
//   name: 'Fusion 1x3',
//   viewportStructure: {
//     layoutType: 'grid',
//     properties: {
//       rows: 1,
//       columns: 3,
//     },
//   },
//   viewports: [fusionAXIAL, fusionSAGITTAL, fusionCORONAL],
// };

const ptCT: AppTypes.HangingProtocol.Protocol = {
  id: '@ohif/extension-tmtv.hangingProtocolModule.ptCT',
  locked: true,
  name: 'Default',
  createdDate: '2021-02-23T19:22:08.894Z',
  modifiedDate: '2022-10-04T19:22:08.894Z',
  availableTo: {},
  editableBy: {},
  imageLoadStrategy: 'interleaveTopToBottom', // "default" , "interleaveTopToBottom",  "interleaveCenter"
  protocolMatchingRules: [
    {
      attribute: 'ModalitiesInStudy',
      constraint: {
        contains: ['CT', 'PT'],
      },
    },
    {
      attribute: 'StudyDescription',
      constraint: {
        contains: 'PETCT',
      },
    },
    {
      attribute: 'StudyDescription',
      constraint: {
        contains: 'PET/CT',
      },
    },
  ],
  displaySetSelectors: {
    ctDisplaySet: {
      seriesMatchingRules: [
        {
          attribute: 'Modality',
          constraint: {
            equals: {
              value: 'CT',
            },
          },
          required: true,
        },
        {
          attribute: 'isReconstructable',
          constraint: {
            equals: {
              value: true,
            },
          },
          required: true,
        },
        {
          attribute: 'SeriesDescription',
          constraint: {
            contains: 'CT',
          },
        },
        {
          attribute: 'SeriesDescription',
          constraint: {
            contains: 'CT WB',
          },
        },
      ],
    },
    ptDisplaySet: {
      seriesMatchingRules: [
        {
          attribute: 'Modality',
          constraint: {
            equals: 'PT',
          },
          required: true,
        },
        {
          attribute: 'isReconstructable',
          constraint: {
            equals: {
              value: true,
            },
          },
          required: true,
        },
        {
          attribute: 'SeriesDescription',
          constraint: {
            contains: 'Corrected',
          },
        },
        {
          weight: 2,
          attribute: 'SeriesDescription',
          constraint: {
            doesNotContain: {
              value: 'Uncorrected',
            },
          },
        },
      ],
    },
  },
  // [2026-05-11 修改] 扩展stages数组，新增冠状位2x2、原始2x3、原始2x4、TMTV MPR布局
  stages: [stage1, stage2, stage3, stage4, stage5, stage6, stage7, stage8],
  numberOfPriorsReferenced: -1,
};

function getHangingProtocolModule() {
  return [
    {
      name: ptCT.id,
      protocol: ptCT,
    },
  ];
}

export default getHangingProtocolModule;
