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
import { TemplateType, VisualforceComponentOptions } from '@salesforce/templates';
import { nls } from '../../messages';
import { MetadataTypeGatherer, SelectFileName, SelectOutputDir, SfCommandlet } from '../util';
import { OverwriteComponentPrompt } from '../util/overwriteComponentPrompt';
import { LibraryBaseTemplateCommand } from './libraryBaseTemplateCommand';
import { VISUALFORCE_COMPONENT_DIRECTORY, VISUALFORCE_COMPONENT_TYPE } from './metadataTypeConstants';

class LibraryVisualforceGenerateComponentExecutor extends LibraryBaseTemplateCommand<DirFileNameSelection> {
  public executionName = nls.localize('visualforce_generate_component_text');
  public telemetryName = 'visualforce_generate_component';
  public metadataTypeName = VISUALFORCE_COMPONENT_TYPE;
  public templateType = TemplateType.VisualforceComponent;
  public getOutputFileName(data: DirFileNameSelection) {
    return data.fileName;
  }
  public constructTemplateOptions(data: DirFileNameSelection) {
    const templateOptions: VisualforceComponentOptions = {
      outputdir: data.outputdir,
      componentname: data.fileName,
      label: data.fileName,
      template: 'DefaultVFComponent'
    };
    return templateOptions;
  }
}

export const visualforceGenerateComponent = (): void => {
  const createTemplateExecutor = new LibraryVisualforceGenerateComponentExecutor();
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(
      new MetadataTypeGatherer(VISUALFORCE_COMPONENT_TYPE),
      new SelectFileName(),
      new SelectOutputDir(VISUALFORCE_COMPONENT_DIRECTORY)
    ),
    createTemplateExecutor,
    new OverwriteComponentPrompt()
  );
  void commandlet.run();
};
