/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  Command,
  DirFileNameSelection,
  LocalComponent,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'path';
import { nls } from '../../messages';
import { workspaceUtils } from '../../util';
import {
  CompositeParametersGatherer,
  MetadataTypeGatherer,
  PathStrategyFactory,
  SfdxCommandlet,
  SfdxWorkspaceChecker,
  SourcePathStrategy
} from '../util';
import { OverwriteComponentPrompt } from '../util/overwriteComponentPrompt';
import { SelectLwcComponentDir } from '../util/parameterGatherers';
import { BaseTemplateCommand } from './baseTemplateCommand';
import { LWC_TYPE } from './metadataTypeConstants';

export class LightningGenerateTestExecutor extends BaseTemplateCommand {
  constructor() {
    super();
  }

  public build(data: DirFileNameSelection): Command {
    this.metadata = LWC_TYPE;
    const builder = new SfdxCommandBuilder()
      .withDescription(nls.localize('lightning_generate_test_text'))
      .withArg('lightning:generate:test')
      .withFlag(
        '--filepath',
        path.join(
          workspaceUtils.getRootWorkspacePath(),
          data.outputdir,
          data.fileName + '.js'
        )
      )
      .withLogName('lightning_web_component_generate_test');
    return builder.build();
  }

  public getSourcePathStrategy(): SourcePathStrategy {
    return PathStrategyFactory.createLwcTestStrategy();
  }
}

const filePathGatherer = new SelectLwcComponentDir();
const metadataTypeGatherer = new MetadataTypeGatherer(LWC_TYPE);
export async function lightningGenerateTest() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new CompositeParametersGatherer<LocalComponent>(
      metadataTypeGatherer,
      filePathGatherer
    ),
    new LightningGenerateTestExecutor(),
    new OverwriteComponentPrompt()
  );
  await commandlet.run();
}
