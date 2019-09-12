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
  VISUALFORCE_COMPONENT_DIRECTORY,
  VISUALFORCE_COMPONENT_EXTENSION
} from './metadataTypeConstants';

export class ForceVisualForceComponentCreateExecutor extends BaseTemplateCommand {
  public build(data: LocalComponent): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_visualforce_component_create_text'))
      .withArg('force:visualforce:component:create')
      .withFlag('--componentname', data.fileName)
      .withFlag('--label', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_visualforce_component_create')
      .build();
  }

  public sourcePathStrategy: SourcePathStrategy = PathStrategyFactory.createDefaultStrategy();

  public getDefaultDirectory() {
    return VISUALFORCE_COMPONENT_DIRECTORY;
  }

  public getFileExtension(): string {
    return VISUALFORCE_COMPONENT_EXTENSION;
  }
}

export async function forceVisualforceComponentCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(
      new SelectFileName(),
      new SelectOutputDir(VISUALFORCE_COMPONENT_DIRECTORY),
      new SimpleGatherer({ type: 'ApexComponent' })
    ),
    new ForceVisualForceComponentCreateExecutor(),
    new FilePathExistsChecker()
  );
  await commandlet.run();
}
