/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LightningComponentOptions, TemplateType } from '@salesforce/templates';
import { LibraryBaseTemplateCommand } from './libraryBaseTemplateCommand';

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { DirFileNameSelection } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode/src/types';
import { Uri } from 'vscode';
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
  FileInternalPathGatherer,
  InternalDevWorkspaceChecker
} from './internalCommandUtils';
import {
  AURA_COMPONENT_EXTENSION,
  AURA_DIRECTORY,
  AURA_TYPE
} from './metadataTypeConstants';

export class LibraryForceLightningComponentCreateExecutor extends LibraryBaseTemplateCommand<
  DirFileNameSelection
> {
  public executionName = nls.localize('force_lightning_component_create_text');
  public telemetryName = 'force_lightning_component_create';
  public metadataTypeName = AURA_TYPE;
  public templateType = TemplateType.LightningComponent;
  public getOutputFileName(data: DirFileNameSelection) {
    return data.fileName;
  }
  public getFileExtension() {
    return AURA_COMPONENT_EXTENSION;
  }
  public constructTemplateOptions(data: DirFileNameSelection) {
    const internal = sfdxCoreSettings.getInternalDev();
    const templateOptions: LightningComponentOptions = {
      outputdir: data.outputdir,
      componentname: data.fileName,
      template: 'DefaultLightningCmp',
      type: 'aura',
      internal
    };
    return templateOptions;
  }
}

export class ForceLightningComponentCreateExecutor extends BaseTemplateCommand {
  constructor() {
    super(AURA_TYPE);
  }

  public build(data: DirFileNameSelection): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_lightning_component_create_text'))
      .withArg('force:lightning:component:create')
      .withFlag('--componentname', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_lightning_component_create');

    if (sfdxCoreSettings.getInternalDev()) {
      builder.withArg('--internal');
    }

    return builder.build();
  }

  public getFileExtension() {
    return AURA_COMPONENT_EXTENSION;
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(AURA_DIRECTORY, true);
const metadataTypeGatherer = new MetadataTypeGatherer(AURA_TYPE);

export async function forceLightningComponentCreate() {
  const createTemplateExecutor = sfdxCoreSettings.getTemplatesLibrary()
    ? new LibraryForceLightningComponentCreateExecutor()
    : new ForceLightningComponentCreateExecutor();
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

export async function forceInternalLightningComponentCreate(sourceUri: Uri) {
  const createTemplateExecutor = sfdxCoreSettings.getTemplatesLibrary()
    ? new LibraryForceLightningComponentCreateExecutor()
    : new ForceLightningComponentCreateExecutor();

  const commandlet = new SfdxCommandlet(
    new InternalDevWorkspaceChecker(),
    new CompositeParametersGatherer<DirFileNameSelection>(
      fileNameGatherer,
      new FileInternalPathGatherer(sourceUri)
    ),
    createTemplateExecutor
  );
  await commandlet.run();
}
