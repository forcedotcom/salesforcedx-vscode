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
import { ApexClassOptions, TemplateType } from '@salesforce/templates';
import { nls } from '../../messages';
import {
  CompositeParametersGatherer,
  MetadataTypeGatherer,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../util';
import { OverwriteComponentPrompt } from '../util/postconditionCheckers';
import { LibraryBaseTemplateCommand } from './libraryBaseTemplateCommand';
import { APEX_CLASS_DIRECTORY, APEX_CLASS_TYPE } from './metadataTypeConstants';

export class LibraryForceApexClassCreateExecutor extends LibraryBaseTemplateCommand<
  DirFileNameSelection
> {
  public executionName = nls.localize('force_apex_class_create_text');
  public telemetryName = 'force_apex_class_create';
  public metadataTypeName = APEX_CLASS_TYPE;
  public templateType = TemplateType.ApexClass;
  public getOutputFileName(data: DirFileNameSelection) {
    return data.fileName;
  }
  public constructTemplateOptions(data: DirFileNameSelection) {
    const templateOptions: ApexClassOptions = {
      template: 'DefaultApexClass',
      classname: data.fileName,
      outputdir: data.outputdir
    };
    return templateOptions;
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(APEX_CLASS_DIRECTORY);
const metadataTypeGatherer = new MetadataTypeGatherer(APEX_CLASS_TYPE);

export async function forceApexClassCreate() {
  const createTemplateExecutor = new LibraryForceApexClassCreateExecutor();
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
