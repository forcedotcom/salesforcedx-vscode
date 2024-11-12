/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ApexLanguageClient } from '../apexLanguageClient';
import ApexLSPStatusBarItem from '../apexLspStatusBarItem';
import { getTestOutlineProvider } from '../views/testOutlineProvider';
import { ClientStatus, languageClientUtils } from './index';

const setClientReady = async (
  languageClient: ApexLanguageClient,
  languageServerStatusBarItem: ApexLSPStatusBarItem
): Promise<void> => {
  await getTestOutlineProvider().refresh();
  languageServerStatusBarItem.ready();
  languageClientUtils.setStatus(ClientStatus.Ready, '');
  languageClient?.errorHandler?.serviceHasStartedSuccessfully();
};

export const extensionUtils = {
  setClientReady
};
