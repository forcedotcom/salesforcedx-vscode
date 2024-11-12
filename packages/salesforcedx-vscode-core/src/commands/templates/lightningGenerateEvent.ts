/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DirFileNameSelection, LocalComponent } from '@salesforce/salesforcedx-utils-vscode';
import { LightningEventOptions, TemplateType } from '@salesforce/templates';
import { Uri } from 'vscode';
import { nls } from '../../messages';
import { salesforceCoreSettings } from '../../settings';
import {
  CompositeParametersGatherer,
  MetadataTypeGatherer,
  SelectFileName,
  SelectOutputDir,
  SfCommandlet,
  SfWorkspaceChecker
} from '../util';
import { OverwriteComponentPrompt } from '../util/overwriteComponentPrompt';
import { FileInternalPathGatherer, InternalDevWorkspaceChecker } from './internalCommandUtils';
import { LibraryBaseTemplateCommand } from './libraryBaseTemplateCommand';
import { AURA_DIRECTORY, AURA_EVENT_EXTENSION, AURA_TYPE } from './metadataTypeConstants';

export class LibraryLightningGenerateEventExecutor extends LibraryBaseTemplateCommand<DirFileNameSelection> {
  public executionName = nls.localize('lightning_generate_event_text');
  public telemetryName = 'lightning_generate_event';
  public metadataTypeName = AURA_TYPE;
  public templateType = TemplateType.LightningEvent;
  public getOutputFileName(data: DirFileNameSelection) {
    return data.fileName;
  }
  public getFileExtension() {
    return AURA_EVENT_EXTENSION;
  }
  public constructTemplateOptions(data: DirFileNameSelection) {
    const internal = salesforceCoreSettings.getInternalDev();
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

export const lightningGenerateEvent = (): void => {
  const createTemplateExecutor = new LibraryLightningGenerateEventExecutor();
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(metadataTypeGatherer, fileNameGatherer, outputDirGatherer),
    createTemplateExecutor,
    new OverwriteComponentPrompt()
  );
  void commandlet.run();
};

export const internalLightningGenerateEvent = (sourceUri: Uri): void => {
  const createTemplateExecutor = new LibraryLightningGenerateEventExecutor();
  const commandlet = new SfCommandlet(
    new InternalDevWorkspaceChecker(),
    new CompositeParametersGatherer(fileNameGatherer, new FileInternalPathGatherer(sourceUri)),
    createTemplateExecutor
  );
  void commandlet.run();
};
