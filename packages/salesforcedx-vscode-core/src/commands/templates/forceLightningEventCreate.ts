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
import { LightningEventOptions, TemplateType } from '@salesforce/templates';
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
import {
  FileInternalPathGatherer,
  InternalDevWorkspaceChecker
} from './internalCommandUtils';
import { LibraryBaseTemplateCommand } from './libraryBaseTemplateCommand';
import {
  AURA_DIRECTORY,
  AURA_EVENT_EXTENSION,
  AURA_TYPE
} from './metadataTypeConstants';

export class LibraryForceLightningEventCreateExecutor extends LibraryBaseTemplateCommand<
  DirFileNameSelection
> {
  public executionName = nls.localize('force_lightning_event_create_text');
  public telemetryName = 'force_lightning_event_create';
  public metadataTypeName = AURA_TYPE;
  public templateType = TemplateType.LightningEvent;
  public getOutputFileName(data: DirFileNameSelection) {
    return data.fileName;
  }
  public getFileExtension() {
    return AURA_EVENT_EXTENSION;
  }
  public constructTemplateOptions(data: DirFileNameSelection) {
    const internal = sfdxCoreSettings.getInternalDev();
    const templateOptions: LightningEventOptions = {
      outputdir: data.outputdir,
      eventname: data.fileName,
      template: 'DefaultLightningEvt',
      internal
    };
    return templateOptions;
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(AURA_DIRECTORY, true);
const metadataTypeGatherer = new MetadataTypeGatherer(AURA_TYPE);

export async function forceLightningEventCreate() {
  const createTemplateExecutor = new LibraryForceLightningEventCreateExecutor();
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

export async function forceInternalLightningEventCreate(sourceUri: Uri) {
  const createTemplateExecutor = new LibraryForceLightningEventCreateExecutor();
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
