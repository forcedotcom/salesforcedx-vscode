/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { TemplateType, VisualforcePageOptions } from '@salesforce/templates';
import { LibraryBaseTemplateCommand } from './libraryBaseTemplateCommand';

import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import { DirFileNameSelection } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode/src/types';
import { nls } from '../../messages';
import { sfdxCoreSettings } from '../../settings';
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

export class LibraryForceVisualForcePageCreateExecutor extends LibraryBaseTemplateCommand<
  DirFileNameSelection
> {
  public executionName = nls.localize('force_visualforce_page_create_text');
  public telemetryName = 'force_visualforce_page_create';
  public metadataTypeName = VISUALFORCE_PAGE_TYPE;
  public templateType = TemplateType.VisualforcePage;
  public getOutputFileName(data: DirFileNameSelection) {
    return data.fileName;
  }
  public constructTemplateOptions(data: DirFileNameSelection) {
    const templateOptions: VisualforcePageOptions = {
      outputdir: data.outputdir,
      pagename: data.fileName,
      label: data.fileName,
      template: 'DefaultVFPage'
    };
    return templateOptions;
  }
}

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
  const createTemplateExecutor = sfdxCoreSettings.getTemplatesLibrary()
    ? new LibraryForceVisualForcePageCreateExecutor()
    : new ForceVisualForcePageCreateExecutor();
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(
      metadataTypeGatherer,
      fileNameGatherer,
      outputDirGatherer
    ),
    createTemplateExecutor,
    new OverwriteComponentPrompt()
  );
  await commandlet.run();
}
