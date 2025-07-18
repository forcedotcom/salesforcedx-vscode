/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CompositeParametersGatherer,
  LocalComponent,
  ParametersGatherer,
  SfWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import type { URI } from 'vscode-uri';
import { MetadataTypeGatherer, OverwriteComponentPrompt, SfCommandlet, SimpleGatherer } from '../util';
import { getParamGatherers } from './apexGenerateClass';
import { LibraryApexGenerateUnitTestClassExecutor } from './executors/libraryApexGenerateUnitTestClassExecutor';
import { APEX_CLASS_TYPE } from './metadataTypeConstants';

type OutputDirParameter = {
  outputdir: string;
};

// if called from a file's context menu, will deliver the clicked file URI and an array of selected files
// if called from the command pallet args will be empty
export const apexGenerateUnitTestClass = async (
  outputDirectory?: string | URI,
  unitFileToCreate?: string | URI[],
  template?: 'BasicUnitTest' | 'ApexUnitTest'
) => {
  const gatherers = getParamGatherers();

  let outputDirGatherer: ParametersGatherer<OutputDirParameter>;
  if (outputDirectory) {
    outputDirGatherer =
      typeof outputDirectory === 'string'
        ? new SimpleGatherer<OutputDirParameter>({
            outputdir: outputDirectory
          })
        : new SimpleGatherer<OutputDirParameter>({
            outputdir: outputDirectory.fsPath
          });
  } else {
    outputDirGatherer = gatherers.outputDirGatherer;
  }

  // When called from the context menu in the explorer unexpected values are passed in for unitFileToCreate and unitFileDirectory.
  let fileNameGatherer: ParametersGatherer<any>;
  if (unitFileToCreate && typeof unitFileToCreate === 'string') {
    fileNameGatherer = new SimpleGatherer<{ fileName: string }>({
      fileName: unitFileToCreate
    });
  } else {
    fileNameGatherer = gatherers.fileNameGatherer;
  }

  let templateTypeGatherer: ParametersGatherer<any>;
  if (template && typeof template === 'string') {
    templateTypeGatherer = new SimpleGatherer<{ template: string }>({
      template: template ?? 'ApexUnitTest'
    });
  } else {
    templateTypeGatherer = gatherers.templateGatherer;
  }

  const createTemplateExecutor = new LibraryApexGenerateUnitTestClassExecutor();
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(
      new MetadataTypeGatherer(APEX_CLASS_TYPE),
      fileNameGatherer,
      outputDirGatherer,
      templateTypeGatherer
    ),
    createTemplateExecutor,
    new OverwriteComponentPrompt()
  );
  await commandlet.run();
};
