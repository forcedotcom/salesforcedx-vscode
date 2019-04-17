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
  BaseTemplateCommand,
  BundlePathStrategy,
  FilePathExistsChecker
} from './baseTemplateCommand';
import {
  AURA_APP_EXTENSION,
  AURA_DEFINITION_FILE_EXTS,
  AURA_DIRECTORY
} from './metadataTypeConstants';

export class ForceLightningAppCreateExecutor extends BaseTemplateCommand {
  public build(data: DirFileNameSelection): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_lightning_app_create_text'))
      .withArg('force:lightning:app:create')
      .withFlag('--appname', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_lightning_app_create')
      .build();
  }

  public sourcePathStrategy = new BundlePathStrategy();

  public getDefaultDirectory() {
    return AURA_DIRECTORY;
  }
  public getFileExtension() {
    return AURA_APP_EXTENSION;
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(AURA_DIRECTORY, true);

export async function forceLightningAppCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<DirFileNameSelection>(
      fileNameGatherer,
      outputDirGatherer
    ),
    new ForceLightningAppCreateExecutor(),
    new FilePathExistsChecker(
      AURA_DEFINITION_FILE_EXTS,
      new BundlePathStrategy(),
      nls.localize('aura_bundle_message_name')
    )
  );
  await commandlet.run();
}
