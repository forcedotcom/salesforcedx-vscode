/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  LocalComponent,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode';
import {
  CompositeParametersGatherer,
  MetadataTypeGatherer,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../util';
import { OverwriteComponentPrompt } from '../util/overwriteComponentPrompt';
import { LibraryForceApexTriggerCreateExecutor } from './executors/libraryForceApexTriggerCreateExecutor';
import {
  APEX_TRIGGER_DIRECTORY,
  APEX_TRIGGER_NAME_MAX_LENGTH,
  APEX_TRIGGER_TYPE
} from './metadataTypeConstants';

let initialized = false;
let fileNameGatherer: ParametersGatherer<any>;
let outputDirGatherer: ParametersGatherer<any>;
let metadataTypeGatherer: ParametersGatherer<any>;
function getGatherers() {
  if (!initialized) {
    initialized = true;
    fileNameGatherer = new SelectFileName(APEX_TRIGGER_NAME_MAX_LENGTH);
    outputDirGatherer = new SelectOutputDir(APEX_TRIGGER_DIRECTORY);
    metadataTypeGatherer = new MetadataTypeGatherer(APEX_TRIGGER_TYPE);
  }
  return {
    fileNameGatherer,
    outputDirGatherer,
    metadataTypeGatherer
  };
}

export async function forceApexTriggerCreate() {
  const gatherers = getGatherers();

  const createTemplateExecutor = new LibraryForceApexTriggerCreateExecutor();
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(
      gatherers.metadataTypeGatherer,
      gatherers.fileNameGatherer,
      gatherers.outputDirGatherer
    ),
    createTemplateExecutor,
    new OverwriteComponentPrompt()
  );
  await commandlet.run();
}
