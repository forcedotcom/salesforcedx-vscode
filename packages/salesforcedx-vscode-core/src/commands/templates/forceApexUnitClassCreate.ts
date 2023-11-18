/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LocalComponent, ParametersGatherer } from '@salesforce/salesforcedx-utils-vscode';
import { CompositeParametersGatherer, MetadataTypeGatherer, OverwriteComponentPrompt, SfdxCommandlet, SfdxWorkspaceChecker, SimpleGatherer } from '../util';
import { LibraryForceApexUnitClassCreateExecutor } from './executors/LibraryForceApexUnitClassCreateExecutor';
import { getParamGatherers } from './forceApexClassCreate';
import { APEX_CLASS_TYPE } from './metadataTypeConstants';

export const forceApexUnitClassCreate = async (unitFileToCreate?: string, unitFileDirectory?: string) => {
  const gatherers = getParamGatherers();

  // When called from the context menu in the explorer unexpected values are passed in for unitFileToCreate and unitFileDirectory.
  let fileNameGatherer: ParametersGatherer<any>;
  if (unitFileToCreate && (typeof unitFileToCreate === 'string')) {
    fileNameGatherer = new SimpleGatherer<{fileName: string}>({fileName: unitFileToCreate});
  } else {
    fileNameGatherer = gatherers.fileNameGatherer;
  }

  let outputDirGatherer: ParametersGatherer<any>;
  if((unitFileDirectory && (typeof unitFileDirectory === 'string'))) {
    outputDirGatherer = new SimpleGatherer<{outputdir: string}>({outputdir: unitFileDirectory});
  } else {
    outputDirGatherer = gatherers.outputDirGatherer;
  }

  const createTemplateExecutor = new LibraryForceApexUnitClassCreateExecutor();
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(
      new MetadataTypeGatherer(APEX_CLASS_TYPE),
      fileNameGatherer,
      outputDirGatherer
    ),
    createTemplateExecutor,
    new OverwriteComponentPrompt()
  );
  await commandlet.run();
};