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
  LightningFilePathExistsChecker,
  SelectFileName,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../commands';
import { BaseTemplateCommand, BundlePathStrategy } from './baseTemplateCommand';

const LIGHTNING_LWC_METADATA_DIR = 'lwc';

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
    return LIGHTNING_LWC_METADATA_DIR;
  }

  public getFileExtension() {
    return '.js';
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir(LIGHTNING_LWC_METADATA_DIR, true);

export async function forceLightningLwcCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer(fileNameGatherer, outputDirGatherer),
    new ForceLightningLwcCreateExecutor(),
    new LightningFilePathExistsChecker()
  );
  commandlet.run();
}
