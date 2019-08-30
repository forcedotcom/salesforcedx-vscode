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
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../commands';
import {
  FilePathExistsChecker,
  GlobStrategyFactory,
  PathStrategyFactory,
  SourcePathStrategy
} from '../util';
import { BaseTemplateCommand } from './baseTemplateCommand';
import {
  VISUALFORCE_COMPONENT_DIRECTORY,
  VISUALFORCE_COMPONENT_EXTENSION
} from './metadataTypeConstants';

export class ForceVisualForceComponentCreateExecutor extends BaseTemplateCommand {
  public build(data: DirFileNameSelection): Command {
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

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(VISUALFORCE_COMPONENT_DIRECTORY);

export async function forceVisualforceComponentCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<DirFileNameSelection>(
      fileNameGatherer,
      outputDirGatherer
    ),
    new ForceVisualForceComponentCreateExecutor(),
    new FilePathExistsChecker(
      GlobStrategyFactory.createFileInOutputDirStrategy(
        VISUALFORCE_COMPONENT_EXTENSION
      ),
      nls.localize(
        'warning_prompt_file_overwrite',
        nls.localize('visualforce_component_message_name')
      )
    )
  );
  await commandlet.run();
}
