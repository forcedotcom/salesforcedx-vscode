/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../util';
import { RetrieveComponentOutputGatherer } from '../util/parameterGatherers';
import { OverwriteComponentPrompt } from '../util/postconditionCheckers';
import { LibraryRetrieveSourcePathExecutor } from './libraryRetrieveSourcePathExecutor';
import { RetrieveMetadataTrigger } from './retrieveMetadataTrigger';

export async function forceSourceRetrieveCmp(
  trigger: RetrieveMetadataTrigger,
  openAfterRetrieve: boolean = false
) {
  const retrieveDescriber = trigger.describer();
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new RetrieveComponentOutputGatherer(retrieveDescriber),
    new LibraryRetrieveSourcePathExecutor(openAfterRetrieve),
    new OverwriteComponentPrompt()
  );
  await commandlet.run();
}
