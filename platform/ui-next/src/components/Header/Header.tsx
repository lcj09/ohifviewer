import React, { ReactNode } from 'react';
import classNames from 'classnames';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  Icons,
  Button,
  ToolButton,
} from '../';
import { IconPresentationProvider } from '@ohif/ui-next';
import i18n from 'i18next';

import NavBar from '../NavBar';

// 语言切换选项（中文 / 英文）
const LANGUAGE_OPTIONS = [
  { value: 'zh', label: '中文' },
  { value: 'en-US', label: 'English' },
];

// 全局语言切换按钮组件
function LanguageSwitcher() {
  const currentLanguage = i18n.language || 'en-US';

  const handleLanguageChange = (langValue) => {
    i18n.changeLanguage(langValue);
    window.location.reload();
  };

  return (
    <div className="flex items-center gap-1 rounded border border-primary-light/30 px-2 py-0.5">
      <span className="text-xs text-primary-light">语</span>
      {LANGUAGE_OPTIONS.map(opt => (
        <button
          key={opt.value}
          onClick={() => handleLanguageChange(opt.value)}
          className={`rounded px-1.5 py-0.5 text-xs font-medium transition-colors ${
            currentLanguage === opt.value || (currentLanguage.startsWith('zh') && opt.value === 'zh')
              ? 'bg-primary-active text-white'
              : 'text-primary-light hover:text-white'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// Todo: we should move this component to composition and remove props base

interface HeaderProps {
  children?: ReactNode;
  menuOptions: Array<{
    title: string;
    icon?: string;
    onClick: () => void;
  }>;
  isReturnEnabled?: boolean;
  onClickReturnButton?: () => void;
  isSticky?: boolean;
  WhiteLabeling?: {
    createLogoComponentFn?: (React: any, props: any) => ReactNode;
  };
  PatientInfo?: ReactNode;
  Secondary?: ReactNode;
  UndoRedo?: ReactNode;
  showLogoText?: boolean;
}

function Header({
  children,
  menuOptions,
  isReturnEnabled = true,
  onClickReturnButton,
  isSticky = false,
  WhiteLabeling,
  PatientInfo,
  UndoRedo,
  Secondary,
  showLogoText = true,
  ...props
}: HeaderProps): ReactNode {
  const onClickReturn = () => {
    if (isReturnEnabled && onClickReturnButton) {
      onClickReturnButton();
    }
  };

  return (
    <IconPresentationProvider
      size="large"
      IconContainer={ToolButton}
      showLabel={true}
    >
      <NavBar
        isSticky={isSticky}
        {...props}
      >
        <div className="relative h-[56px] items-center">
          {/* 工具栏容器：gap-[12px] 统一控制所有按钮组之间的间距（按钮+文字作为整体） */}
          <div className="absolute left-0 top-1/2 flex -translate-y-1/2 items-center gap-[12px]">
            <div
              className={classNames(
                'inline-flex items-center',
                isReturnEnabled && 'cursor-pointer'
              )}
              onClick={onClickReturn}
              data-cy="return-to-work-list"
            >
              {isReturnEnabled && <Icons.ArrowLeft className="text-primary ml-1 h-7 w-7" />}
              {/* 东华医为 Logo */}
              {showLogoText && (
              <div className="ml-2 font-bold text-white" style={{ fontSize: '18px' }}>
                东华医为
              </div>
              )}
              {/* 暂时屏蔽东华医为Logo
              <div className="ml-1">
                {WhiteLabeling?.createLogoComponentFn?.(React, props) || <Icons.OHIFLogo />}
              </div>
              */}
            </div>
            {/* 工具栏按钮紧跟在 Logo 右侧左对齐 */}
            {Secondary}
            <div className="flex items-center space-x-2">{children}</div>
          </div>
          <div className="absolute right-0 top-1/2 flex -translate-y-1/2 select-none items-center">
            {UndoRedo}
            <div className="border-muted mx-1.5 h-[25px] border-r"></div>
            {PatientInfo}
            <div className="border-muted mx-1.5 h-[25px] border-r"></div>
            {/* 设置按钮 - 当 menuOptions 为空时隐藏 */}
            {menuOptions.length > 0 && (
            <div className="flex-shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-primary hover:bg-muted mt-2 h-full w-full"
                  >
                    <Icons.GearSettings />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {menuOptions.map((option, index) => {
                    const IconComponent = option.icon
                      ? Icons[option.icon as keyof typeof Icons]
                      : null;
                    return (
                      <DropdownMenuItem
                        key={index}
                        onSelect={option.onClick}
                        className="flex items-center gap-2 py-2"
                      >
                        {IconComponent && (
                          <span className="flex h-4 w-4 items-center justify-center">
                            <Icons.ByName name={option.icon} />
                          </span>
                        )}
                        <span className="flex-1">{option.title}</span>
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            )}
          </div>
        </div>
      </NavBar>
    </IconPresentationProvider>
  );
}

export default Header;
