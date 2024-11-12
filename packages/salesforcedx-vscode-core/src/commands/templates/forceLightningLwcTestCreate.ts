/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Command, DirFileNameSelection, LocalComponent, SfCommandBuilder } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'path';
import { nls } from '../../messages';
import { workspaceUtils } from '../../util';
import {
  CompositeParametersGatherer,
  MetadataTypeGatherer,
  PathStrategyFactory,
  SfCommandlet,
  SfWorkspaceChecker,
  SourcePathStrategy
} from '../util';
import { OverwriteComponentPrompt } from '../util/overwriteComponentPrompt';
import { SelectLwcComponentDir } from '../util/parameterGatherers';
import { BaseTemplateCommand } from './baseTemplateCommand';
import { LWC_TYPE } from './metadataTypeConstants';

export class ForceLightningLwcTestCreateExecutor extends BaseTemplateCommand {
  constructor() {
    super();
  }

  public build(data: DirFileNameSelection): Command {
    this.metadata = LWC_TYPE;
    const builder = new SfCommandBuilder()
      .withDescription(nls.localize('force_lightning_lwc_test_create_text'))
      .withArg('force:lightning:lwc:test:create')
      .withFlag('--filepath', path.join(workspaceUtils.getRootWorkspacePath(), data.outputdir, data.fileName + '.js'))
      .withLogName('force_lightning_web_component_test_create');
    return builder.build();
  }

  public getSourcePathStrategy(): SourcePathStrategy {
    return PathStrategyFactory.createLwcTestStrategy();
  }
}

const filePathGatherer = new SelectLwcComponentDir();
const metadataTypeGatherer = new MetadataTypeGatherer(LWC_TYPE);
export const forceLightningLwcTestCreate = (): void => {
  const commandlet = new SfCommandlet(
    new SfWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(metadataTypeGatherer, filePathGatherer),
    new ForceLightningLwcTestCreateExecutor(),
    new OverwriteComponentPrompt()
  );
  void commandlet.run();
};
