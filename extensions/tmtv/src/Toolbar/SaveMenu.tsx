import React, { useState } from 'react';
import PropTypes from 'prop-types';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  Button,
  Icons,
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '@ohif/ui-next';

function SaveMenu({ commandsManager, servicesManager, ...props }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSaveImage = () => {
    setIsMenuOpen(false);
    commandsManager.runCommand('showDownloadViewportModal');
  };

  const handleSaveSeries = () => {
    setIsMenuOpen(false);
  };

  return (
    <div id="SaveMenu" data-cy="SaveMenu">
      <Popover open={isMenuOpen} onOpenChange={setIsMenuOpen}>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground/80 hover:bg-background hover:text-highlight"
                aria-label="保存"
              >
                <Icons.ByName name="tool-save" className="h-7 w-7" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <div>保存</div>
          </TooltipContent>
        </Tooltip>
        <PopoverContent
          className="w-48 rounded-lg border-none p-1 shadow-lg"
          align="center"
          sideOffset={8}
        >
          <div className="flex flex-col gap-0.5">
            <Button
              variant="ghost"
              className="flex h-8 w-full items-center justify-start px-2 py-1 text-sm text-common-bright hover:bg-primary-dark"
              onClick={handleSaveImage}
            >
              图像
            </Button>
            <Button
              variant="ghost"
              className="flex h-8 w-full items-center justify-start px-2 py-1 text-sm text-common-bright hover:bg-primary-dark"
              onClick={handleSaveSeries}
            >
              序列
            </Button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

SaveMenu.propTypes = {
  commandsManager: PropTypes.object,
  servicesManager: PropTypes.object,
};

export default SaveMenu;
