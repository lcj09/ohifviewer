import React from 'react';
import { Label } from '../Label';
import { Tabs, TabsList, TabsTrigger } from '../Tabs';
import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '../Tooltip';

interface RadioValue {
  value: string;
  label: string;
}

interface RadioOption {
  id: string;
  name: string;
  value: string;
  values: RadioValue[];
  onChange?: (val: string) => void;
  tooltip?: string;
}

interface RowSegmentedControlProps {
  option: RadioOption;
  className?: string;
  onChange?: (val: string) => void;
}

export const RowSegmentedControl: React.FC<RowSegmentedControlProps> = ({
  option,
  className,
  onChange,
}) => {
  const handleValueChange = (newVal: string) => {
    if (onChange) {
      onChange(newVal);
    }
  };

  return (
    <div
      className={cn('flex items-center justify-between text-[13px]', className)}
      key={option.id}
    >
      <Label className="mr-2">
        {option.tooltip ? (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="cursor-help">{option.name}</span>
            </TooltipTrigger>
            <TooltipContent side="top">{option.tooltip}</TooltipContent>
          </Tooltip>
        ) : (
          option.name
        )}
      </Label>
      <div className="max-w-1/2">
        <Tabs
          value={option.value}
          onValueChange={handleValueChange}
        >
          {/* [2026-06-24 修改] Shape选择器样式优化：选中项蓝色背景，未选中项透明与背景融合 */}
          <TabsList className="inline-flex gap-1 bg-transparent p-0">
            {option.values.map(({ label, value: itemValue }, index) => (
              <TabsTrigger
                value={itemValue}
                key={`button-${option.id}-${index}`}
                className="data-[state=active]:!bg-blue-600 data-[state=active]:!text-white data-[state=inactive]:!bg-transparent data-[state=inactive]:text-foreground/70 rounded-md px-3 py-1 text-sm transition-colors hover:data-[state=inactive]:bg-white/10"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>
    </div>
  );
};

export default RowSegmentedControl;
