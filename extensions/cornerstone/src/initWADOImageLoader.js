import { volumeLoader } from '@cornerstonejs/core';
import {
  cornerstoneStreamingImageVolumeLoader,
  cornerstoneStreamingDynamicImageVolumeLoader,
} from '@cornerstonejs/core/loaders';
import dicomImageLoader from '@cornerstonejs/dicom-image-loader';
import { errorHandler, utils } from '@ohif/core';

const { registerVolumeLoader } = volumeLoader;
//初始化WADO Image Loader
export default function initWADOImageLoader(
  userAuthenticationService,
  appConfig,
  extensionManager
) {
  registerVolumeLoader('cornerstoneStreamingImageVolume', cornerstoneStreamingImageVolumeLoader);

  registerVolumeLoader(
    'cornerstoneStreamingDynamicImageVolume',
    cornerstoneStreamingDynamicImageVolumeLoader
  );
// 初始化 DICOM Image Loader
  dicomImageLoader.init({
    maxWebWorkers: Math.min(
      Math.max(navigator.hardwareConcurrency - 1, 1),
      appConfig.maxNumberOfWebWorkers
    ),
    // // 请求发送前处理（注入认证头）
    beforeSend: function (xhr) {
      //TODO should be removed in the future and request emitted by DicomWebDataSource
      const sourceConfig = extensionManager.getActiveDataSource()?.[0].getConfig() ?? {};
      const headers = userAuthenticationService.getAuthorizationHeader();
      const acceptHeader = utils.generateAcceptHeader(
        sourceConfig.acceptHeader,
        sourceConfig.requestTransferSyntaxUID,
        sourceConfig.omitQuotationForMultipartRequest
      );

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

export function destroy() {
  console.debug('Destroying WADO Image Loader');
}
