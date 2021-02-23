/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  DirFileNameSelection,
  LocalComponent
} from '@salesforce/salesforcedx-utils-vscode/src/types';
import { TemplateType, VisualforcePageOptions } from '@salesforce/templates';
import { nls } from '../../messages';
import {
  CompositeParametersGatherer,
  MetadataTypeGatherer,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../util';
import { OverwriteComponentPrompt } from '../util/postconditionCheckers';
import { LibraryBaseTemplateCommand } from './libraryBaseTemplateCommand';
import {
  VISUALFORCE_PAGE_DIRECTORY,
  VISUALFORCE_PAGE_TYPE
} from './metadataTypeConstants';

export class LibraryForceVisualForcePageCreateExecutor extends LibraryBaseTemplateCommand<
  DirFileNameSelection
> {
  public executionName = nls.localize('force_visualforce_page_create_text');
  public telemetryName = 'force_visualforce_page_create';
  public metadataTypeName = VISUALFORCE_PAGE_TYPE;
  public templateType = TemplateType.VisualforcePage;
  public getOutputFileName(data: DirFileNameSelection) {
    return data.fileName;
  }
  public constructTemplateOptions(data: DirFileNameSelection) {
    const templateOptions: VisualforcePageOptions = {
      outputdir: data.outputdir,
      pagename: data.fileName,
      label: data.fileName,
      template: 'DefaultVFPage'
    };
    return templateOptions;
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(VISUALFORCE_PAGE_DIRECTORY);
const metadataTypeGatherer = new MetadataTypeGatherer(VISUALFORCE_PAGE_TYPE);

export async function forceVisualforcePageCreate() {
  const createTemplateExecutor = new LibraryForceVisualForcePageCreateExecutor();
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(
      metadataTypeGatherer,
      fileNameGatherer,
      outputDirGatherer
    ),
    createTemplateExecutor,
    new OverwriteComponentPrompt()
  );
  await commandlet.run();
}
