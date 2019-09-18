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
import {
  CompositeParametersGatherer,
  LwcOssWorkspaceChecker,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet
} from '../commands';
import {
  FilePathExistsChecker,
  GlobStrategyFactory,
  PathStrategyFactory,
  SourcePathStrategy
} from '../util';
import { BaseTemplateCommand } from './baseTemplateCommand';
import { FileInternalPathGatherer } from './internalCommandUtils';
import {
  LWC_DEFINITION_FILE_EXTS,
  LWC_JS_EXTENSION
} from './metadataTypeConstants';

const LWC_OSS_DIRECTORY = 'modules';

export class LwcOssCreateExecutor extends BaseTemplateCommand {
  public build(data: DirFileNameSelection): Command {
    console.log('in the builder');
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize('force_lightning_lwc_create_text'))
      .withArg('force:lightning:component:create')
      .withArg('--internal')
      .withFlag('--type', 'lwc')
      .withFlag('--componentname', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_lightning_web_component_create');

    return builder.build();
  }

  public sourcePathStrategy: SourcePathStrategy = PathStrategyFactory.createBundleStrategy();

  public getDefaultDirectory() {
    return LWC_OSS_DIRECTORY;
  }

  public getFileExtension() {
    return LWC_JS_EXTENSION;
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(LWC_OSS_DIRECTORY, true);

export async function lwcOssCreate(sourceUri: Uri) {
  const commandlet = new SfdxCommandlet(
    new LwcOssWorkspaceChecker(),
    new CompositeParametersGatherer(
      fileNameGatherer,
      new FileInternalPathGatherer(sourceUri)
    ),
    new LwcOssCreateExecutor(),
    new FilePathExistsChecker(
      GlobStrategyFactory.createCheckBundleInGivenPath(
        ...LWC_DEFINITION_FILE_EXTS
      ),
      nls.localize(
        'warning_prompt_file_overwrite',
        nls.localize('lwc_message_name')
      )
    )
  );
  await commandlet.run();
}
