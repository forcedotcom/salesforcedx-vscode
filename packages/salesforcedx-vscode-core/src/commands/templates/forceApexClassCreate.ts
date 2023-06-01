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
import * as vscode from 'vscode';
import {
  CompositeParametersGatherer,
  MetadataTypeGatherer,
  ProvideOutputDir,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../util';
import { OverwriteComponentPrompt } from '../util/overwriteComponentPrompt';
import { LibraryForceApexClassCreateExecutor } from './executors/LibraryForceApexClassCreateExecutor';
import {
  APEX_CLASS_DIRECTORY,
  APEX_CLASS_NAME_MAX_LENGTH,
  APEX_CLASS_TYPE
} from './metadataTypeConstants';

let fileNameGatherer: ParametersGatherer<any>;
let outputDirGatherer: ParametersGatherer<any>;
let metadataTypeGatherer: ParametersGatherer<any>;
function getParamGatherers(sourceUri: string | undefined) {
  fileNameGatherer = new SelectFileName(APEX_CLASS_NAME_MAX_LENGTH);
  if (!sourceUri) {
    outputDirGatherer = new SelectOutputDir(APEX_CLASS_DIRECTORY);
  } else {
    outputDirGatherer = new ProvideOutputDir(sourceUri);
  }
  metadataTypeGatherer = new MetadataTypeGatherer(APEX_CLASS_TYPE);
  return {
    fileNameGatherer,
    outputDirGatherer,
    metadataTypeGatherer
  };
}

export async function forceApexClassCreate(
  sourceUri: vscode.Uri | undefined,
  uris: vscode.Uri[] | undefined
) {
  const gatherers = getParamGatherers(sourceUri?.fsPath);

  const createTemplateExecutor = new LibraryForceApexClassCreateExecutor();
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
