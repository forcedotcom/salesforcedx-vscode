import { ApexLanguageClient } from '../apexLanguageClient';
import ApexLSPStatusBarItem from '../apexLspStatusBarItem';
import { getTestOutlineProvider } from '../views/testOutlineProvider';
import {
  ClientStatus,
  languageClientUtils
} from './index';

const setClientReady = async (languageClient: ApexLanguageClient, languageServerStatusBarItem: ApexLSPStatusBarItem) => {
  await getTestOutlineProvider().refresh();
  languageServerStatusBarItem.ready();
  languageClientUtils.setStatus(ClientStatus.Ready, '');
  languageClient?.errorHandler?.serviceHasStartedSuccessfully();
};

export const extensionUtils = {
  setClientReady
};
