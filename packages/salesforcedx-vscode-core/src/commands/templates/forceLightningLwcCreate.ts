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
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../util';
import { MetadataTypeGatherer } from '../util';
import { OverwriteComponentPrompt } from '../util/postconditionCheckers';
import { BaseTemplateCommand } from './baseTemplateCommand';
import {
  FileInternalPathGatherer,
  InternalDevWorkspaceChecker
} from './internalCommandUtils';
import { LWC_DIRECTORY, LWC_TYPE } from './metadataTypeConstants';

export class LibraryForceLightningLwcCreateExecutor extends LibraryBaseTemplateCommand<
  DirFileNameSelection
> {
  public executionName = nls.localize('force_lightning_lwc_create_text');
  public telemetryName = 'force_lightning_web_component_create';
  public metadataTypeName = LWC_TYPE;
  public templateType = TemplateType.LightningComponent;
  public getOutputFileName(data: DirFileNameSelection) {
    return data.fileName;
  }
  public constructTemplateOptions(data: DirFileNameSelection) {
    const internal = sfdxCoreSettings.getInternalDev();
    const templateOptions: LightningComponentOptions = {
      outputdir: data.outputdir,
      componentname: data.fileName,
      template: 'DefaultLightningCmp',
      type: 'lwc',
      internal
    };
    return templateOptions;
  }
}

export class ForceLightningLwcCreateExecutor extends BaseTemplateCommand {
  constructor() {
    super(LWC_TYPE);
  }

  public build(data: DirFileNameSelection): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_lightning_lwc_create_text'))
      .withArg('force:lightning:component:create')
      .withFlag('--type', 'lwc')
      .withFlag('--componentname', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_lightning_web_component_create');

    if (sfdxCoreSettings.getInternalDev()) {
      builder.withArg('--internal');
    }

    return builder.build();
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(LWC_DIRECTORY, true);
const metadataTypeGatherer = new MetadataTypeGatherer(LWC_TYPE);

export async function forceLightningLwcCreate() {
  const createTemplateExecutor = sfdxCoreSettings.getTemplatesLibrary()
    ? new LibraryForceLightningLwcCreateExecutor()
    : new ForceLightningLwcCreateExecutor();
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

export async function forceInternalLightningLwcCreate(sourceUri: Uri) {
  const createTemplateExecutor = sfdxCoreSettings.getTemplatesLibrary()
    ? new LibraryForceLightningLwcCreateExecutor()
    : new ForceLightningLwcCreateExecutor();
  const commandlet = new SfdxCommandlet(
    new InternalDevWorkspaceChecker(),
    new CompositeParametersGatherer(
      fileNameGatherer,
      new FileInternalPathGatherer(sourceUri)
    ),
    createTemplateExecutor
  );
  await commandlet.run();
}
