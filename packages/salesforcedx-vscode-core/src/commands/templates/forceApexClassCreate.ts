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
  FileInOutputDir,
  FilePathExistsChecker,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../commands';
import { BaseTemplateCommand } from './baseTemplateCommand';
import {
  APEX_CLASS_DIRECTORY,
  APEX_CLASS_EXTENSION
} from './metadataTypeConstants';

export class ForceApexClassCreateExecutor extends BaseTemplateCommand {
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

  public sourcePathStrategy = new DefaultPathStrategy();

  public getDefaultDirectory() {
    return APEX_CLASS_DIRECTORY;
  }

  public getFileExtension() {
    return APEX_CLASS_EXTENSION;
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(APEX_CLASS_DIRECTORY);

export async function forceApexClassCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<DirFileNameSelection>(
      fileNameGatherer,
      outputDirGatherer
    ),
    new ForceApexClassCreateExecutor(),
    new FilePathExistsChecker(
      new FileInOutputDir(APEX_CLASS_EXTENSION),
      nls.localize(
        'warning_prompt_file_overwrite',
        nls.localize('apex_class_message_name')
      )
    )
  );
  await commandlet.run();
}
