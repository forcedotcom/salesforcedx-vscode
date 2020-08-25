/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  TemplateType,
  VisualforceComponentOptions
} from '@salesforce/templates';
import { LibraryBaseTemplateCommand } from './libraryBaseTemplateCommand';

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { DirFileNameSelection } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode/src/types';
import { nls } from '../../messages';
import { sfdxCoreSettings } from '../../settings';
import {
  CompositeParametersGatherer,
  MetadataTypeGatherer,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../util';
import { OverwriteComponentPrompt } from '../util/postconditionCheckers';
import { BaseTemplateCommand } from './baseTemplateCommand';
import {
  VISUALFORCE_COMPONENT_DIRECTORY,
  VISUALFORCE_COMPONENT_TYPE
} from './metadataTypeConstants';

export class LibraryForceVisualForceComponentCreateExecutor extends LibraryBaseTemplateCommand<
  DirFileNameSelection
> {
  public executionName = nls.localize(
    'force_visualforce_component_create_text'
  );
  public telemetryName = 'force_visualforce_component_create';
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

export class ForceVisualForceComponentCreateExecutor extends BaseTemplateCommand {
  constructor() {
    super(VISUALFORCE_COMPONENT_TYPE);
  }

  public build(data: DirFileNameSelection): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_visualforce_component_create_text'))
      .withArg('force:visualforce:component:create')
      .withFlag('--componentname', data.fileName)
      .withFlag('--label', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_visualforce_component_create')
      .build();
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(VISUALFORCE_COMPONENT_DIRECTORY);
const metadataTypeGatherer = new MetadataTypeGatherer(
  VISUALFORCE_COMPONENT_TYPE
);

export async function forceVisualforceComponentCreate() {
  const createTemplateExecutor = sfdxCoreSettings.getTemplatesLibrary()
    ? new LibraryForceVisualForceComponentCreateExecutor()
    : new ForceVisualForceComponentCreateExecutor();
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
