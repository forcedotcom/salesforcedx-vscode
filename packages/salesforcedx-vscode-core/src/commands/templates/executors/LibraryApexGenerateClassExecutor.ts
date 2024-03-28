/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DirFileNameSelection } from '@salesforce/salesforcedx-utils-vscode';
import { ApexClassOptions, TemplateType } from '@salesforce/templates';
import { nls } from '../../../messages';
import { LibraryBaseTemplateCommand } from '../libraryBaseTemplateCommand';
import { APEX_CLASS_TYPE } from '../metadataTypeConstants';

export class LibraryApexGenerateClassExecutor extends LibraryBaseTemplateCommand<DirFileNameSelection> {
  public executionName = nls.localize('apex_generate_class_text');
  public telemetryName = 'apex_generate_class';
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
