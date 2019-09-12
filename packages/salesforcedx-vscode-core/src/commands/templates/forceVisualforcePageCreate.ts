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
  VISUALFORCE_PAGE_DIRECTORY,
  VISUALFORCE_PAGE_EXTENSION
} from './metadataTypeConstants';

export class ForceVisualForcePageCreateExecutor extends BaseTemplateCommand {
  public build(data: LocalComponent): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_visualforce_page_create_text'))
      .withArg('force:visualforce:page:create')
      .withFlag('--pagename', data.fileName)
      .withFlag('--label', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_visualforce_page_create')
      .build();
  }

  public sourcePathStrategy: SourcePathStrategy = PathStrategyFactory.createDefaultStrategy();

  public getDefaultDirectory() {
    return VISUALFORCE_PAGE_DIRECTORY;
  }

  public getFileExtension(): string {
    return VISUALFORCE_PAGE_EXTENSION;
  }
}

export async function forceVisualforcePageCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(
      new SelectFileName(),
      new SelectOutputDir(VISUALFORCE_PAGE_DIRECTORY),
      new SimpleGatherer({ type: 'ApexPage' })
    ),
    new ForceVisualForcePageCreateExecutor(),
    new FilePathExistsChecker()
  );
  await commandlet.run();
}
