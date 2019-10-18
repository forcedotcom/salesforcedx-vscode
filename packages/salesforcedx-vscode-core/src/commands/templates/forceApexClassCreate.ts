/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { DirFileNameSelection } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
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
import { BaseTemplateCommand } from './baseTemplateCommand';
import { APEX_CLASS_DIRECTORY, APEX_CLASS_TYPE } from './metadataTypeConstants';

export class ForceApexClassCreateExecutor extends BaseTemplateCommand {
  constructor() {
    super(APEX_CLASS_TYPE);
  }

  public build(data: DirFileNameSelection): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_class_create_text'))
      .withArg('force:apex:class:create')
      .withFlag('--classname', data.fileName)
      .withFlag('--template', 'DefaultApexClass')
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_apex_class_create')
      .build();
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(APEX_CLASS_DIRECTORY);
const metadataTypeGatherer = new MetadataTypeGatherer(APEX_CLASS_TYPE);

export async function forceApexClassCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<DirFileNameSelection>(
      metadataTypeGatherer,
      fileNameGatherer,
      outputDirGatherer
    ),
    new ForceApexClassCreateExecutor(),
    new OverwriteComponentPrompt()
  );
  await commandlet.run();
}
