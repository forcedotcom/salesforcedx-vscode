/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LanguageClientManager, ProcessDetail } from './languageClientManager';

export { ProcessDetail } from './languageClientManager';

export const languageServerUtils = {
  findAndCheckOrphanedProcesses: async (): Promise<ProcessDetail[]> =>
    LanguageClientManager.getInstance().findAndCheckOrphanedProcesses(),
  terminateProcess: (pid: number): void => {
    LanguageClientManager.getInstance().terminateProcess(pid);
  },
  canRunCheck: async (isWindows: boolean): Promise<boolean> =>
    LanguageClientManager.getInstance().canRunCheck(isWindows)
};
