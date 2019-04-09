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

class ForceLightningInterfaceCreateExecutor extends BaseTemplateCommand {
  public build(data: DirFileNameSelection): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_lightning_interface_create_text'))
      .withArg('force:lightning:interface:create')
      .withFlag('--interfacename', data.fileName)
      .withFlag('--outputdir', data.outputdir)
      .withLogName('force_lightning_interface_create')
      .build();
  }

  public sourcePathStrategy = new BundlePathStrategy();

  public getDefaultDirectory() {
    return 'aura';
  }

  public getFileExtension() {
    return '.intf';
  }
}

const fileNameGatherer = new SelectFileName();
const outputDirGatherer = new SelectOutputDir('aura', true);

export async function forceLightningInterfaceCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<DirFileNameSelection>(
      fileNameGatherer,
      outputDirGatherer
    ),
    new ForceLightningInterfaceCreateExecutor(),
    new LightningFilePathExistsChecker()
  );
  await commandlet.run();
}
