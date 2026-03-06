/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { sfProjectPreconditionChecker } from '@salesforce/effect-ext-utils';
import { SfCommandlet } from '@salesforce/salesforcedx-utils-vscode';
import { OverwriteComponentPrompt } from '../util/overwriteComponentPrompt';
import { RetrieveComponentOutputGatherer } from '../util/parameterGatherers';
import { LibraryRetrieveSourcePathExecutor } from './libraryRetrieveSourcePathExecutor';
import { RetrieveMetadataTrigger } from './retrieveMetadataTrigger';

export const retrieveComponent = (trigger: RetrieveMetadataTrigger, openAfterRetrieve: boolean = false): void => {
  const retrieveDescriber = trigger.describer();
  const commandlet = new SfCommandlet(
    sfProjectPreconditionChecker,
    new RetrieveComponentOutputGatherer(retrieveDescriber),
    new LibraryRetrieveSourcePathExecutor(openAfterRetrieve),
    new OverwriteComponentPrompt()
  );
  void commandlet.run();
};
