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
  SfCommandlet,
  SfWorkspaceChecker
} from '../util';
import { OverwriteComponentPrompt } from '../util/overwriteComponentPrompt';
import { ApexTestTemplateGatherer } from '../util/parameterGatherers';
import { LibraryApexGenerateClassExecutor } from './executors/LibraryApexGenerateClassExecutor';
import {
  APEX_CLASS_DIRECTORY,
  APEX_CLASS_NAME_MAX_LENGTH,
  APEX_CLASS_TYPE,
  APEX_TEST_TEMPLATE
} from './metadataTypeConstants';

let initialized = false;
let fileNameGatherer: ParametersGatherer<any>;
let outputDirGatherer: ParametersGatherer<any>;
let metadataTypeGatherer: ParametersGatherer<any>;
let templateGatherer: ParametersGatherer<any>;

export const getParamGatherers = () => {
  if (!initialized) {
    fileNameGatherer = new SelectFileName(APEX_CLASS_NAME_MAX_LENGTH);
    outputDirGatherer = new SelectOutputDir(APEX_CLASS_DIRECTORY);
    metadataTypeGatherer = new MetadataTypeGatherer(APEX_CLASS_TYPE);
    templateGatherer = new ApexTestTemplateGatherer(APEX_TEST_TEMPLATE);
    initialized = true;
  }
  return {
    fileNameGatherer,
    outputDirGatherer,
    metadataTypeGatherer,
    templateGatherer
  };
};

export const apexGenerateClass = async () => {
  const gatherers = getParamGatherers();

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
