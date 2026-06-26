import SUPPORTED_TOOLS from './constants/supportedTools';
import { getDisplayUnit } from './utils';
import getSOPInstanceAttributes from './utils/getSOPInstanceAttributes';
import { utils } from '@ohif/core';
import { getStatisticDisplayString } from './utils/getValueDisplayString';
import { getIsLocked } from './utils/getIsLocked';
import { getIsVisible } from './utils/getIsVisible';

// [2026-06-26 新增] SphereROI 测量服务映射
// 基于 CircleROI 映射，增加 Volume 字段显示
const SphereROI = {
  toAnnotation: measurement => {},
  toMeasurement: (
    csToolsEventDetail,
    displaySetService,
    CornerstoneViewportService,
    getValueTypeFromToolType,
    customizationService
  ) => {
    const { annotation } = csToolsEventDetail;
    const { metadata, data, annotationUID } = annotation;

    const isLocked = getIsLocked(annotationUID);
    const isVisible = getIsVisible(annotationUID);

    if (!metadata || !data) {
      console.warn('SphereROI tool: Missing metadata or data');
      return null;
    }

    const { toolName, referencedImageId, FrameOfReferenceUID } = metadata;
    const validToolType = SUPPORTED_TOOLS.includes(toolName);

    if (!validToolType) {
      throw new Error('Tool not supported');
    }

    const { SOPInstanceUID, SeriesInstanceUID, StudyInstanceUID } = getSOPInstanceAttributes(
      referencedImageId,
      displaySetService,
      annotation
    );

    let displaySet;

    if (SOPInstanceUID) {
      displaySet = displaySetService.getDisplaySetForSOPInstanceUID(
        SOPInstanceUID,
        SeriesInstanceUID
      );
    } else {
      displaySet = displaySetService.getDisplaySetsForSeries(SeriesInstanceUID)[0];
    }

    const { points, textBox } = data.handles;

    const mappedAnnotations = getMappedAnnotations(annotation, displaySetService);

    const displayText = getDisplayText(mappedAnnotations, displaySet);
    const getReport = () =>
      _getReport(mappedAnnotations, points, FrameOfReferenceUID, customizationService);

    return {
      uid: annotationUID,
      SOPInstanceUID,
      FrameOfReferenceUID,
      points,
      textBox,
      isLocked,
      isVisible,
      metadata,
      referenceSeriesUID: SeriesInstanceUID,
      referenceStudyUID: StudyInstanceUID,
      referencedImageId,
      frameNumber: mappedAnnotations[0]?.frameNumber || 1,
      toolName: metadata.toolName,
      displaySetInstanceUID: displaySet.displaySetInstanceUID,
      label: data.label,
      displayText: displayText,
      data: data.cachedStats,
      type: getValueTypeFromToolType(toolName),
      getReport,
    };
  },
};

function getMappedAnnotations(annotation, displaySetService) {
  const { metadata, data } = annotation;
  const { cachedStats={} } = data;
  const { referencedImageId } = metadata;
  const targets = Object.keys(cachedStats);

  if (!targets.length) {
    return [];
  }

  const annotations = [];
  const addedModalities = new Set();
  Object.keys(cachedStats).forEach(targetId => {
    const targetStats = cachedStats[targetId];

    const { SOPInstanceUID, SeriesInstanceUID, frameNumber } = getSOPInstanceAttributes(
      referencedImageId,
      displaySetService,
      annotation
    );

    const displaySet = displaySetService.getDisplaySetsForSeries(SeriesInstanceUID)[0];

    const { SeriesNumber } = displaySet;
    const {
      mean, stdDev, max, min,
      area, volume,
      Modality, areaUnit, volumeUnit, modalityUnit, radiusUnit,
    } = targetStats;

    if (Modality && addedModalities.has(Modality)) {
      return;
    }

    addedModalities.add(Modality);

    annotations.push({
      SeriesInstanceUID,
      SOPInstanceUID,
      SeriesNumber,
      frameNumber,
      Modality,
      unit: modalityUnit,
      mean,
      stdDev,
      max,
      min,
      area,
      volume,
      areaUnit,
      volumeUnit,
      radiusUnit,
    });
  });

  return annotations;
}

function _getReport(mappedAnnotations, points, FrameOfReferenceUID, customizationService) {
  const columns = [];
  const values = [];

  columns.push('AnnotationType');
  values.push('Cornerstone:SphereROI');

  mappedAnnotations.forEach(annotation => {
    const { mean, stdDev, max, min, area, volume, unit, areaUnit, volumeUnit } = annotation;

    if (!mean || !unit || !max) {
      return;
    }

    columns.push(`max (${unit})`, `min (${unit})`, `mean (${unit})`, `std (${unit})`, 'Area', 'Volume');
    values.push(max, min, mean, stdDev, area, volume);
  });

  if (FrameOfReferenceUID) {
    columns.push('FrameOfReferenceUID');
    values.push(FrameOfReferenceUID);
  }

  if (points) {
    columns.push('points');
    values.push(points.map(p => p.join(' ')).join(';'));
  }

  return {
    columns,
    values,
  };
}

function getDisplayText(mappedAnnotations, displaySet) {
  const displayText = {
    primary: [],
    secondary: [],
  };

  if (!mappedAnnotations || !mappedAnnotations.length) {
    return displayText;
  }

  const { area, volume, SOPInstanceUID, frameNumber, areaUnit, volumeUnit } = mappedAnnotations[0];

  const instance = displaySet.instances.find(image => image.SOPInstanceUID === SOPInstanceUID);

  let InstanceNumber;
  if (instance) {
    InstanceNumber = instance.InstanceNumber;
  }

  const instanceText = InstanceNumber ? ` I: ${InstanceNumber}` : '';
  const frameText = displaySet.isMultiFrame ? ` F: ${frameNumber}` : '';

  if (!isNaN(volume)) {
    const roundedVolume = utils.roundNumber(volume || 0, 2);
    displayText.primary.push(`${roundedVolume} ${getDisplayUnit(volumeUnit)}`);
  }

  if (!isNaN(area)) {
    const roundedArea = utils.roundNumber(area || 0, 2);
    displayText.primary.push(`${roundedArea} ${getDisplayUnit(areaUnit)}`);
  }

  mappedAnnotations.forEach(mappedAnnotation => {
    const { unit, max, min, mean, SeriesNumber } = mappedAnnotation;

    if (!isNaN(max)) {
      const maxStr = getStatisticDisplayString(max, unit, 'max');
      displayText.primary.push(maxStr);
    }
    if (!isNaN(min)) {
      const minStr = getStatisticDisplayString(min, unit, 'min');
      displayText.primary.push(minStr);
    }
    if (!isNaN(mean)) {
      const meanStr = getStatisticDisplayString(mean, unit, 'mean');
      displayText.primary.push(meanStr);
    }
    displayText.secondary.push(`S: ${SeriesNumber}${instanceText}${frameText}`);
  });

  return displayText;
}

export default SphereROI;
