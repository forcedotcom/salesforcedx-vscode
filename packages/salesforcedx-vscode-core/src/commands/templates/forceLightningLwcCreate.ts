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
  FilePathExistsChecker2
} from './baseTemplateCommand';
import {
  LWC_DEFINITION_FILE_EXTS,
  LWC_DIRECTORY,
  LWC_JS_EXTENSION
} from './metadataTypeConstants';

class ForceLightningLwcCreateExecutor extends BaseTemplateCommand {
  public build(data: DirFileNameSelection): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_lightning_lwc_create_text'))
      .withArg('force:lightning:component:create')
      .withFlag('--type', 'lwc')
      .withFlag('--componentname', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_lightning_web_component_create')
      .build();
  }

  public sourcePathStrategy = new BundlePathStrategy();

  public getDefaultDirectory() {
    return LWC_DIRECTORY;
  }

  public getFileExtension() {
    return LWC_JS_EXTENSION;
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(LWC_DIRECTORY, true);

export async function forceLightningLwcCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer(fileNameGatherer, outputDirGatherer),
    new ForceLightningLwcCreateExecutor(),
    new FilePathExistsChecker2(
      LWC_DEFINITION_FILE_EXTS,
      new BundlePathStrategy(),
      nls.localize('lwc_message_name')
    )
  );
  await commandlet.run();
}
