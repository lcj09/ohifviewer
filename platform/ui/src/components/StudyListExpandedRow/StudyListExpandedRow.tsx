import React from 'react';
import PropTypes from 'prop-types';
import { Checkbox } from '@ohif/ui-next';

import Table from '../Table';
import TableHead from '../TableHead';
import TableBody from '../TableBody';
import TableRow from '../TableRow';
import TableCell from '../TableCell';

const StudyListExpandedRow = ({
  seriesTableColumns,
  seriesTableDataSource,
  children,
  selectedSeries,
  onSeriesToggle,
  onLaunchTMTV,
}) => {
  const selectedCount = selectedSeries ? selectedSeries.size : 0;
  const canLaunch = selectedCount === 2 && onLaunchTMTV;

  return (
    <div className="w-full bg-black py-4 pl-12 pr-2">
      {children && <div className="block">{children}</div>}
      <div className="mt-4">
        <Table>
          <TableHead>
            <TableRow>
              {Object.keys(seriesTableColumns).map(columnKey => {
                return <TableCell key={columnKey}>{seriesTableColumns[columnKey]}</TableCell>;
              })}
            </TableRow>
          </TableHead>

          <TableBody>
            {seriesTableDataSource.map((row, i) => (
              <TableRow key={i}>
                <TableCell className="truncate border-r-0">
                  <div className="flex items-center">
                    <Checkbox
                      className="mr-2 inline-flex"
                      checked={selectedSeries.has(row.seriesInstanceUid)}
                      onCheckedChange={() => {
                        if (onSeriesToggle) {
                          onSeriesToggle(row.seriesInstanceUid);
                        }
                      }}
                    />
                    {row.description}
                  </div>
                </TableCell>
                <TableCell className="truncate border-r-0">{row.seriesNumber}</TableCell>
                <TableCell className="truncate border-r-0">{row.modality}</TableCell>
                <TableCell className="truncate border-r-0">{row.instances}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* 启动TMTV按钮 */}
        <div className="mt-4 flex items-center gap-2">
          <span className="text-sm text-gray-400">
            {selectedCount}/2 已选择
          </span>
          <button
            className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
              canLaunch
                ? 'bg-primary-main text-white hover:bg-primary-dark cursor-pointer'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!canLaunch}
            onClick={() => {
              if (canLaunch && onLaunchTMTV) {
                onLaunchTMTV(Array.from(selectedSeries));
              }
            }}
          >
            总体积代谢(TMTV)
          </button>
        </div>
      </div>
    </div>
  );
};

StudyListExpandedRow.propTypes = {
  seriesTableDataSource: PropTypes.arrayOf(PropTypes.object).isRequired,
  seriesTableColumns: PropTypes.object.isRequired,
  children: PropTypes.node,
  selectedSeries: PropTypes.object,
  onSeriesToggle: PropTypes.func,
  onLaunchTMTV: PropTypes.func,
};

StudyListExpandedRow.defaultProps = {
  selectedSeries: new Set(),
  onSeriesToggle: null,
  onLaunchTMTV: null,
};

export default StudyListExpandedRow;
