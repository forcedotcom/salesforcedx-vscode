/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { DirFileNameSelection } from '@salesforce/salesforcedx-utils-vscode';
import { ApexTriggerOptions, TemplateType } from '@salesforce/templates';
import { nls } from '../../../messages';
import { LibraryBaseTemplateCommand } from '../libraryBaseTemplateCommand';
import { APEX_TRIGGER_TYPE } from '../metadataTypeConstants';

export class LibraryForceApexTriggerCreateExecutor extends LibraryBaseTemplateCommand<
  DirFileNameSelection
> {
  public executionName = nls.localize('force_apex_trigger_create_text');
  public telemetryName = 'force_apex_trigger_create';
  public metadataTypeName = APEX_TRIGGER_TYPE;
  public templateType = TemplateType.ApexTrigger;
  public getOutputFileName(data: DirFileNameSelection) {
    return data.fileName;
  }
  public constructTemplateOptions(data: DirFileNameSelection) {
    const templateOptions: ApexTriggerOptions = {
      outputdir: data.outputdir,
      triggername: data.fileName,
      triggerevents: ['before insert'],
      sobject: 'SOBJECT',
      template: 'ApexTrigger'
    };
    return templateOptions;
  }
}
