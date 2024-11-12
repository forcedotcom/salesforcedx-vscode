/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DirFileNameSelection, LocalComponent } from '@salesforce/salesforcedx-utils-vscode';
import { LightningInterfaceOptions, TemplateType } from '@salesforce/templates';
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
import { AURA_DIRECTORY, AURA_INTERFACE_EXTENSION, AURA_TYPE } from './metadataTypeConstants';

export class LibraryLightningGenerateInterfaceExecutor extends LibraryBaseTemplateCommand<DirFileNameSelection> {
  public executionName = nls.localize('lightning_generate_interface_text');
  public telemetryName = 'lightning_generate_interface';
  public metadataTypeName = AURA_TYPE;
  public templateType = TemplateType.LightningInterface;
  public getOutputFileName(data: DirFileNameSelection) {
    return data.fileName;
  }
  public getFileExtension() {
    return AURA_INTERFACE_EXTENSION;
  }
  public constructTemplateOptions(data: DirFileNameSelection) {
    const internal = salesforceCoreSettings.getInternalDev();
    const templateOptions: LightningInterfaceOptions = {
      outputdir: data.outputdir,
      interfacename: data.fileName,
      template: 'DefaultLightningIntf',
      internal
    };
    return templateOptions;
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(AURA_DIRECTORY, true);
const metadataTypeGatherer = new MetadataTypeGatherer(AURA_TYPE);

export const lightningGenerateInterface = (): void => {
  const createTemplateExecutor = new LibraryLightningGenerateInterfaceExecutor();
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(metadataTypeGatherer, fileNameGatherer, outputDirGatherer),
    createTemplateExecutor,
    new OverwriteComponentPrompt()
  );
  void commandlet.run();
};

export const internalLightningGenerateInterface = (sourceUri: Uri): void => {
  const createTemplateExecutor = new LibraryLightningGenerateInterfaceExecutor();
  const commandlet = new SfCommandlet(
    new InternalDevWorkspaceChecker(),
    new CompositeParametersGatherer(fileNameGatherer, new FileInternalPathGatherer(sourceUri)),
    createTemplateExecutor
  );
  void commandlet.run();
};
