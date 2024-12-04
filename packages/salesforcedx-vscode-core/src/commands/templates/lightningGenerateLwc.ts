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
  MetadataTypeGatherer,
  SelectFileName,
  SelectOutputDir,
  SfCommandlet,
  SfWorkspaceChecker
} from '../util';
import { LwcAuraDuplicateComponentCheckerForCreate } from '../util/lwcAuraDuplicateComponentCheckers';
import { OverwriteComponentPrompt } from '../util/overwriteComponentPrompt';
import { SelectLwcComponentType } from '../util/parameterGatherers';
import { FileInternalPathGatherer, InternalDevWorkspaceChecker } from './internalCommandUtils';
import { LibraryBaseTemplateCommand } from './libraryBaseTemplateCommand';
import { LWC_DIRECTORY, LWC_TYPE } from './metadataTypeConstants';

export class LibraryLightningGenerateLwcExecutor extends LibraryBaseTemplateCommand<DirFileNameSelection> {
  public executionName = nls.localize('lightning_generate_lwc_text');
  public telemetryName = 'lightning_generate_lwc';
  public metadataTypeName = LWC_TYPE;
  public templateType = TemplateType.LightningComponent;
  private templateOptions: LightningComponentOptions | undefined;

  public getOutputFileName(data: DirFileNameSelection) {
    return data.fileName;
  }

  public constructTemplateOptions(data: DirFileNameSelection) {
    const internal = salesforceCoreSettings.getInternalDev();
    const { outputdir, fileName: componentname, extension } = data;
    this.templateOptions = {
      outputdir,
      componentname,
      template: extension === 'TypeScript' ? 'typeScript' : 'default',
      type: 'lwc',
      internal
    };
    return this.templateOptions;
  }

  public getFileExtension(): string {
    return this.templateOptions?.template === 'typeScript' ? '.ts' : '.js';
  }
}

export const lightningGenerateLwc = (): void => {
  const createTemplateExecutor = new LibraryLightningGenerateLwcExecutor();
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(
      new MetadataTypeGatherer(LWC_TYPE),
      new SelectLwcComponentType(),
      new SelectFileName(),
      new SelectOutputDir(LWC_DIRECTORY, true)
    ),
    createTemplateExecutor,
    new CompositePostconditionChecker(new LwcAuraDuplicateComponentCheckerForCreate(), new OverwriteComponentPrompt())
  );
  void commandlet.run();
};

export const internalLightningGenerateLwc = (sourceUri: Uri): void => {
  const createTemplateExecutor = new LibraryLightningGenerateLwcExecutor();
  const commandlet = new SfCommandlet(
    new InternalDevWorkspaceChecker(),
    new CompositeParametersGatherer(new SelectFileName(), new FileInternalPathGatherer(sourceUri)),
    createTemplateExecutor
  );
  void commandlet.run();
};
