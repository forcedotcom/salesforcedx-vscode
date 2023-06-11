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
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxWorkspaceChecker,
  SimpleGatherer
} from '../util';
import { OverwriteComponentPrompt } from '../util/overwriteComponentPrompt';
import { LibraryForceApexClassCreateExecutor } from './executors/LibraryForceApexClassCreateExecutor';
import {
  APEX_CLASS_DIRECTORY,
  APEX_CLASS_NAME_MAX_LENGTH,
  APEX_CLASS_TYPE
} from './metadataTypeConstants';

class GathererProvider {
  private static selectOutputDirInstance: SelectOutputDir;
  private static simpleGathererInstance: SimpleGatherer<{
    outputdir: string;
  }>;

  public getGatherer(
    sourceUri?: vscode.Uri
  ):
    | SelectOutputDir
    | SimpleGatherer<{
        outputdir: string;
      }> {
    if (!sourceUri) {
      if (!GathererProvider.selectOutputDirInstance) {
        GathererProvider.selectOutputDirInstance = new SelectOutputDir(
          APEX_CLASS_DIRECTORY
        );
      }
      return GathererProvider.selectOutputDirInstance;
    } else {
      const outputDirPath = { outputdir: sourceUri.fsPath };
      GathererProvider.simpleGathererInstance = new SimpleGatherer(
        outputDirPath
      );
      return GathererProvider.simpleGathererInstance;
    }
  }
}

let initialized = false;
let fileNameGatherer: ParametersGatherer<any>;
let outputDirGatherer: ParametersGatherer<any>;
let metadataTypeGatherer: ParametersGatherer<any>;
const gathererProvider = new GathererProvider();
function getParamGatherers(sourceUri?: vscode.Uri) {
  if (!initialized) {
    fileNameGatherer = new SelectFileName(APEX_CLASS_NAME_MAX_LENGTH);
    metadataTypeGatherer = new MetadataTypeGatherer(APEX_CLASS_TYPE);
    initialized = true;
  }
  outputDirGatherer = gathererProvider.getGatherer(sourceUri);
  return {
    fileNameGatherer,
    outputDirGatherer,
    metadataTypeGatherer
  };
}

export async function forceApexClassCreate(sourceUri: vscode.Uri | undefined) {
  const gatherers = getParamGatherers(sourceUri);

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
