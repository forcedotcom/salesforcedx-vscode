/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CancelResponse,
  ContinueResponse,
  DirFileNameSelection,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode';
import { AnalyticsTemplateOptions, TemplateType } from '@salesforce/templates';
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
import { LibraryBaseTemplateCommand } from './libraryBaseTemplateCommand';
import {
  ANALYTICS_TEMPLATE_DIRECTORY,
  ANALYTICS_TEMPLATE_TYPE
} from './metadataTypeConstants';

export class LibraryForceAnalyticsTemplateCreateExecutor extends LibraryBaseTemplateCommand<
  TemplateAndDir
> {
  public executionName = nls.localize('force_analytics_template_create_text');
  public telemetryName = 'force_analytics_template_create';
  public metadataTypeName = ANALYTICS_TEMPLATE_TYPE;
  public templateType = TemplateType.AnalyticsTemplate;
  public getFileExtension(): string {
    return '.json';
  }
  public getOutputFileName(data: TemplateAndDir) {
    return data.fileName;
  }
  public constructTemplateOptions(data: TemplateAndDir) {
    const templateOptions: AnalyticsTemplateOptions = {
      outputdir: data.outputdir,
      templatename: data.fileName
    };
    return templateOptions;
  }
  public getDefaultDirectory() {
    return ANALYTICS_TEMPLATE_DIRECTORY;
  }
  public getSourcePathStrategy(): SourcePathStrategy {
    return PathStrategyFactory.createWaveTemplateBundleStrategy();
  }
}

export type TemplateAndDir = DirFileNameSelection & Template;

export interface Template {
  // fileName is the templateName
  fileName: string;
}

export class SelectProjectTemplate implements ParametersGatherer<Template> {
  public async gather(): Promise<CancelResponse | ContinueResponse<Template>> {
    const projectTemplateInputOptions = {
      prompt: nls.localize('force_analytics_template_name_text')
    } as vscode.InputBoxOptions;
    const fileName = await vscode.window.showInputBox(
      projectTemplateInputOptions
    );

    return fileName
      ? { type: 'CONTINUE', data: { fileName } }
      : { type: 'CANCEL' };
  }
}

const outputDirGatherer = new SelectOutputDir(ANALYTICS_TEMPLATE_DIRECTORY);

const parameterGatherer = new CompositeParametersGatherer(
  new SelectProjectTemplate(),
  outputDirGatherer
);

export async function forceAnalyticsTemplateCreate() {
  const createTemplateExecutor = new LibraryForceAnalyticsTemplateCreateExecutor();
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    parameterGatherer,
    createTemplateExecutor
  );
  await commandlet.run();
}
