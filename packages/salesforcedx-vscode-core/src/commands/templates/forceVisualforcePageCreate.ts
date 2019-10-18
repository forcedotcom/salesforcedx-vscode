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
import {
  VISUALFORCE_PAGE_DIRECTORY,
  VISUALFORCE_PAGE_TYPE
} from './metadataTypeConstants';

export class ForceVisualForcePageCreateExecutor extends BaseTemplateCommand {
  constructor() {
    super(VISUALFORCE_PAGE_TYPE);
  }

  public build(data: DirFileNameSelection): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_visualforce_page_create_text'))
      .withArg('force:visualforce:page:create')
      .withFlag('--pagename', data.fileName)
      .withFlag('--label', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_visualforce_page_create')
      .build();
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(VISUALFORCE_PAGE_DIRECTORY);
const metadataTypeGatherer = new MetadataTypeGatherer(VISUALFORCE_PAGE_TYPE);

export async function forceVisualforcePageCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<DirFileNameSelection>(
      metadataTypeGatherer,
      fileNameGatherer,
      outputDirGatherer
    ),
    new ForceVisualForcePageCreateExecutor(),
    new OverwriteComponentPrompt()
  );
  await commandlet.run();
}
