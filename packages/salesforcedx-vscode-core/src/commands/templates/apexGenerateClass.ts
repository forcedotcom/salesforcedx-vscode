/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LocalComponent, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import * as vscode from 'vscode';
import {
  CompositeParametersGatherer,
  MetadataTypeGatherer,
  SelectFileName,
  SelectOutputDir,
  SfCommandlet,
  SfWorkspaceChecker,
  SimpleGatherer
} from '../util';
import { OverwriteComponentPrompt } from '../util/overwriteComponentPrompt';
import {
  ApexTestTemplateGatherer,
  FileNameParameter,
  MetadataTypeParameter,
  OutputDirParameter
} from '../util/parameterGatherers';
import { LibraryApexGenerateClassExecutor } from './executors/LibraryApexGenerateClassExecutor';
import {
  APEX_CLASS_DIRECTORY,
  APEX_CLASS_NAME_MAX_LENGTH,
  APEX_CLASS_TYPE,
  APEX_TEST_TEMPLATE
} from './metadataTypeConstants';

let fileNameGatherer: ParametersGatherer<FileNameParameter> | undefined;
let outputDirGatherer: ParametersGatherer<OutputDirParameter> | undefined;
let metadataTypeGatherer: ParametersGatherer<MetadataTypeParameter> | undefined;
let templateGatherer: ParametersGatherer<any> | undefined;

export const getParamGatherers = () => {
  fileNameGatherer ??= new SelectFileName(APEX_CLASS_NAME_MAX_LENGTH);
  outputDirGatherer ??= new SelectOutputDir(APEX_CLASS_DIRECTORY);
  metadataTypeGatherer ??= new MetadataTypeGatherer(APEX_CLASS_TYPE);
  templateGatherer ??= new ApexTestTemplateGatherer(APEX_TEST_TEMPLATE);
  return {
    fileNameGatherer,
    outputDirGatherer,
    metadataTypeGatherer,
    templateGatherer
  };
};

// if called from a file's context menu, will deliver the clicked file URI,
// ignoring an additional arg that is array of selected
// if called from the command pallet args will be empty
export const apexGenerateClass = async (sourceUri?: vscode.Uri) => {
  const gatherers = getParamGatherers();

  if (sourceUri) {
    gatherers.outputDirGatherer = new SimpleGatherer<OutputDirParameter>({
      outputdir: sourceUri.fsPath
    });
  }

  const createTemplateExecutor = new LibraryApexGenerateClassExecutor();
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(
      gatherers.metadataTypeGatherer,
      gatherers.fileNameGatherer,
      gatherers.outputDirGatherer
    ),
    createTemplateExecutor,
    new OverwriteComponentPrompt()
  );
  await commandlet.run();
};

export const clearGathererCache = () => {
  fileNameGatherer = undefined;
  outputDirGatherer = undefined;
  metadataTypeGatherer = undefined;
  templateGatherer = undefined;
};
