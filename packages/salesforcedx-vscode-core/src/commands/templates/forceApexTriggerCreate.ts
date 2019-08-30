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
  DefaultPathStrategy,
  FilePathExistsChecker,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxWorkspaceChecker,
  SinglePackageDirectory
} from '../commands';
import { BaseTemplateCommand } from './baseTemplateCommand';
import {
  APEX_TRIGGER_DIRECTORY,
  APEX_TRIGGER_EXTENSION
} from './metadataTypeConstants';

export class ForceApexTriggerCreateExecutor extends BaseTemplateCommand {
  public build(data: DirFileNameSelection): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_trigger_create_text'))
      .withArg('force:apex:trigger:create')
      .withFlag('--triggername', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_apex_trigger_create')
      .build();
  }

  public sourcePathStrategy = new DefaultPathStrategy();

  public getDefaultDirectory() {
    return APEX_TRIGGER_DIRECTORY;
  }

  public getFileExtension() {
    return APEX_TRIGGER_EXTENSION;
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(APEX_TRIGGER_DIRECTORY);

export async function forceApexTriggerCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<DirFileNameSelection>(
      fileNameGatherer,
      outputDirGatherer
    ),
    new ForceApexTriggerCreateExecutor(),
    new FilePathExistsChecker(
      [APEX_TRIGGER_EXTENSION],
      new DefaultPathStrategy(),
      new SinglePackageDirectory(),
      nls.localize(
        'warning_prompt_file_overwrite',
        nls.localize('apex_trigger_message_name')
      )
    )
  );
  await commandlet.run();
}
