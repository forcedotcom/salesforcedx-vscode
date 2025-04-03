/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LanguageClientManager, ClientStatus, LanguageClientStatus, ProcessDetail } from './languageClientManager';
import { LanguageClientUtils } from './languageClientUtils';

export const languageClientManager = LanguageClientManager.getInstance();
export const languageClientUtils = LanguageClientUtils.getInstance();
export { ClientStatus, LanguageClientStatus, ProcessDetail };

export {
  getLineBreakpointInfo,
  getApexTests,
  getExceptionBreakpointInfo,
  restartLanguageServerAndClient,
  createLanguageClient,
  indexerDoneHandler
} from './languageClientUtils';

export { enableJavaDocSymbols } from './javaDocSymbols';

export { languageServerUtils } from './languageServerUtils';

export { extensionUtils } from './extensionUtils';
