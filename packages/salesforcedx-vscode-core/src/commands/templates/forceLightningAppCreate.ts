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
import { Uri } from 'vscode';
import { nls } from '../../messages';
import { sfdxCoreSettings } from '../../settings';
import {
  BundlePathStrategy,
  CompositeParametersGatherer,
  FilePathExistsChecker,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxWorkspaceChecker,
  SinglePackageDirectory
} from '../commands';
import { BaseTemplateCommand } from './baseTemplateCommand';
import {
  FileInternalPathGatherer,
  InternalDevWorkspaceChecker
} from './internalCommandUtils';
import {
  AURA_APP_EXTENSION,
  AURA_DEFINITION_FILE_EXTS,
  AURA_DIRECTORY
} from './metadataTypeConstants';

export class ForceLightningAppCreateExecutor extends BaseTemplateCommand {
  public build(data: DirFileNameSelection): Command {
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_lightning_app_create_text'))
      .withArg('force:lightning:app:create')
      .withFlag('--appname', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_lightning_app_create');

    if (sfdxCoreSettings.getInternalDev()) {
      builder.withArg('--internal');
    }

    return builder.build();
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
      new SinglePackageDirectory(),
      nls.localize(
        'warning_prompt_file_overwrite',
        nls.localize('aura_bundle_message_name')
      )
    )
  );
  await commandlet.run();
}

export async function forceInternalLightningAppCreate(sourceUri: Uri) {
  const commandlet = new SfdxCommandlet(
    new InternalDevWorkspaceChecker(),
    new CompositeParametersGatherer(
      fileNameGatherer,
      new FileInternalPathGatherer(sourceUri)
    ),
    new ForceLightningAppCreateExecutor()
  );
  await commandlet.run();
}
