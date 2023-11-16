/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode';
import { CompositeParametersGatherer, MetadataTypeGatherer, OverwriteComponentPrompt, SfdxCommandlet, SfdxWorkspaceChecker, SimpleGatherer } from '../util';
import { LibraryForceApexUnitClassCreateExecutor } from './executors/LibraryForceApexUnitClassCreateExecutor';
import { getParamGatherers } from './forceApexClassCreate';
import { APEX_CLASS_TYPE } from './metadataTypeConstants';

export const forceApexUnitClassCreate = async (unitFileToCreate?: string, unitFileDirectory?: string) => {
  const gatherers = getParamGatherers();

  const createTemplateExecutor = new LibraryForceApexUnitClassCreateExecutor();
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(
      new MetadataTypeGatherer(APEX_CLASS_TYPE),
      unitFileToCreate ? new SimpleGatherer<string>(unitFileToCreate): gatherers.fileNameGatherer,
      unitFileDirectory ? new SimpleGatherer<string>(unitFileDirectory): gatherers.outputDirGatherer
    ),
    createTemplateExecutor,
    new OverwriteComponentPrompt()
  );
  await commandlet.run();
};