import RectangleROIOptions from './Panels/RectangleROIOptions';
import TmtvLayoutSelector from './Toolbar/TmtvLayoutSelector';

// 2026-04-28 - TMTV专用toolbar模块
// 注意：必须使用工厂函数模式，接收 commandsManager 和 servicesManager
export default function getToolbarModule({ commandsManager, servicesManager }) {
  return [
    {
      name: 'tmtv.RectangleROIThresholdOptions',
      defaultComponent: RectangleROIOptions,
    },
    // 2026-04-28 - TMTV专用布局选择器：仅显示融合相关布局和三维布局
    {
      name: 'ohif.tmtvLayoutSelector',
      defaultComponent: props =>
        TmtvLayoutSelector({ ...props, commandsManager, servicesManager }),
    },
  ];
}
