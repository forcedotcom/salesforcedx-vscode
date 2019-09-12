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
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { nls } from '../../messages';
import {
  CompositeParametersGatherer,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../commands';
import {
  FilePathExistsChecker,
  PathStrategyFactory,
  SimpleGatherer,
  SourcePathStrategy
} from '../util';
import { BaseTemplateCommand } from './baseTemplateCommand';
import {
  APEX_TRIGGER_DIRECTORY,
  APEX_TRIGGER_EXTENSION
} from './metadataTypeConstants';

export class ForceApexTriggerCreateExecutor extends BaseTemplateCommand {
  public build(data: LocalComponent): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_apex_trigger_create_text'))
      .withArg('force:apex:trigger:create')
      .withFlag('--triggername', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_apex_trigger_create')
      .build();
  }

  public sourcePathStrategy: SourcePathStrategy = PathStrategyFactory.createDefaultStrategy();

  public getDefaultDirectory() {
    return APEX_TRIGGER_DIRECTORY;
  }

  public getFileExtension() {
    return APEX_TRIGGER_EXTENSION;
  }
}

export async function forceApexTriggerCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(
      new SelectFileName(),
      new SelectOutputDir(APEX_TRIGGER_DIRECTORY),
      new SimpleGatherer({ type: 'ApexTrigger' })
    ),
    new ForceApexTriggerCreateExecutor(),
    new FilePathExistsChecker()
  );
  await commandlet.run();
}
