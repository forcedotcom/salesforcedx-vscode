/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CompositeParametersGatherer,
  DirFileNameSelection,
  LocalComponent,
  SfWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import { TemplateType, VisualforcePageOptions } from '@salesforce/templates';
import { nls } from '../../messages';
import { MetadataTypeGatherer, SelectFileName, SelectOutputDir, SfCommandlet } from '../util';
import { OverwriteComponentPrompt } from '../util/overwriteComponentPrompt';
import { LibraryBaseTemplateCommand } from './libraryBaseTemplateCommand';
import { VISUALFORCE_PAGE_DIRECTORY, VISUALFORCE_PAGE_TYPE } from './metadataTypeConstants';

class LibraryVisualforceGeneratePageExecutor extends LibraryBaseTemplateCommand<DirFileNameSelection> {
  public executionName = nls.localize('visualforce_generate_page_text');
  public telemetryName = 'visualforce_generate_page';
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

export const visualforceGeneratePage = (): void => {
  const createTemplateExecutor = new LibraryVisualforceGeneratePageExecutor();
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(
      new MetadataTypeGatherer(VISUALFORCE_PAGE_TYPE),
      new SelectFileName(),
      new SelectOutputDir(VISUALFORCE_PAGE_DIRECTORY)
    ),
    createTemplateExecutor,
    new OverwriteComponentPrompt()
  );
  void commandlet.run();
};
