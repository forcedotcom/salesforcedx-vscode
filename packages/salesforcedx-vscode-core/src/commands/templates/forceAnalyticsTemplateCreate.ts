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
import {
  CancelResponse,
  ContinueResponse,
  DirFileNameSelection,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import {
  CompositeParametersGatherer,
  PathStrategyFactory,
  SelectOutputDir,
  SfdxCommandlet,
  SfdxWorkspaceChecker,
  SourcePathStrategy
} from '../util';
import { BaseTemplateCommand } from './baseTemplateCommand';
import {
  ANALYTICS_TEMPLATE_DIRECTORY,
  ANALYTICS_TEMPLATE_TYPE
} from './metadataTypeConstants';

export class ForceAnalyticsTemplateCreateExecutor extends BaseTemplateCommand {
  constructor() {
    super(ANALYTICS_TEMPLATE_TYPE);
  }
  public getFileExtension(): string {
    return '.json';
  }
  public build(data: TemplateNameAndDir): Command {
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_analytics_template_create_text'))
      .withArg('force:analytics:template:create')
      .withFlag('--outputdir', data.outputdir)
      .withFlag('--templatename', data.templateName)
      .withLogName('force_analytics_template_create')
      .build();
  }

  public sourcePathStrategy: SourcePathStrategy = PathStrategyFactory.createDefaultStrategy();

  public getDefaultDirectory() {
    return ANALYTICS_TEMPLATE_DIRECTORY;
  }
}

export type TemplateNameAndDir = DirFileNameSelection & TemplateName;

export interface TemplateName {
  templateName: string;
}

export class SelectProjectTemplate implements ParametersGatherer<TemplateName> {
  private readonly prefillValueProvider?: () => string;

  constructor(prefillValueProvider?: () => string) {
    this.prefillValueProvider = prefillValueProvider;
  }
  public async gather(): Promise<
    CancelResponse | ContinueResponse<TemplateName>
  > {
    const projectTemplateInputOptions = {
      prompt: 'template name'
    } as vscode.InputBoxOptions;
    if (this.prefillValueProvider) {
      projectTemplateInputOptions.value = this.prefillValueProvider();
    }
    const templateName = await vscode.window.showInputBox(
      projectTemplateInputOptions
    );
    return templateName
      ? { type: 'CONTINUE', data: { templateName } }
      : { type: 'CANCEL' };
  }
}

const outputDirGatherer = new SelectOutputDir(ANALYTICS_TEMPLATE_DIRECTORY);

const parameterGatherer = new CompositeParametersGatherer(
  new SelectProjectTemplate(),
  outputDirGatherer
);

export async function forceAnalyticsTemplateCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    parameterGatherer,
    new ForceAnalyticsTemplateCreateExecutor()
  );
  await commandlet.run();
}
