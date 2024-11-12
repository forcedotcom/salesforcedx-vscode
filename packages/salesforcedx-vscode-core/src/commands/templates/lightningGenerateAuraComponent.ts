/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DirFileNameSelection, LocalComponent } from '@salesforce/salesforcedx-utils-vscode';
import { LightningComponentOptions, TemplateType } from '@salesforce/templates';
import { Uri } from 'vscode';
import { nls } from '../../messages';
import { salesforceCoreSettings } from '../../settings';
import {
  CompositeParametersGatherer,
  CompositePostconditionChecker,
  LwcAuraDuplicateComponentCheckerForCreate,
  MetadataTypeGatherer,
  SelectFileName,
  SelectOutputDir,
  SfCommandlet,
  SfWorkspaceChecker
} from '../util';
import { OverwriteComponentPrompt } from '../util/overwriteComponentPrompt';
import { FileInternalPathGatherer, InternalDevWorkspaceChecker } from './internalCommandUtils';
import { LibraryBaseTemplateCommand } from './libraryBaseTemplateCommand';
import { AURA_COMPONENT_EXTENSION, AURA_DIRECTORY, AURA_TYPE } from './metadataTypeConstants';

export class LibraryLightningGenerateAuraComponentExecutor extends LibraryBaseTemplateCommand<DirFileNameSelection> {
  public executionName = nls.localize('lightning_generate_aura_component_text');
  public telemetryName = 'lightning_generate_aura_component';
  public metadataTypeName = AURA_TYPE;
  public templateType = TemplateType.LightningComponent;
  public getOutputFileName(data: DirFileNameSelection) {
    return data.fileName;
  }
  public getFileExtension() {
    return AURA_COMPONENT_EXTENSION;
  }
  public constructTemplateOptions(data: DirFileNameSelection) {
    const internal = salesforceCoreSettings.getInternalDev();
    const templateOptions: LightningComponentOptions = {
      outputdir: data.outputdir,
      componentname: data.fileName,
      template: 'default',
      type: 'aura',
      internal
    };
    return templateOptions;
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(AURA_DIRECTORY, true);
const metadataTypeGatherer = new MetadataTypeGatherer(AURA_TYPE);

export const lightningGenerateAuraComponent = (): void => {
  const createTemplateExecutor = new LibraryLightningGenerateAuraComponentExecutor();
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(metadataTypeGatherer, fileNameGatherer, outputDirGatherer),
    createTemplateExecutor,
    new CompositePostconditionChecker(new LwcAuraDuplicateComponentCheckerForCreate(), new OverwriteComponentPrompt())
  );
  void commandlet.run();
};

export const internalLightningGenerateAuraComponent = (sourceUri: Uri): void => {
  const createTemplateExecutor = new LibraryLightningGenerateAuraComponentExecutor();

  const commandlet = new SfCommandlet(
    new InternalDevWorkspaceChecker(),
    new CompositeParametersGatherer<DirFileNameSelection>(fileNameGatherer, new FileInternalPathGatherer(sourceUri)),
    createTemplateExecutor
  );
  void commandlet.run();
};
