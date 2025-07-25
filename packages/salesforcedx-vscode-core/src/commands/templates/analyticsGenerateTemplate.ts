/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CancelResponse,
  CompositeParametersGatherer,
  ContinueResponse,
  DirFileNameSelection,
  ParametersGatherer,
  SfWorkspaceChecker
} from '@salesforce/salesforcedx-utils-vscode';
import { AnalyticsTemplateOptions, TemplateType } from '@salesforce/templates';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { PathStrategyFactory, SelectOutputDir, SfCommandlet, SourcePathStrategy } from '../util';
import { LibraryBaseTemplateCommand } from './libraryBaseTemplateCommand';
import { ANALYTICS_TEMPLATE_DIRECTORY, ANALYTICS_TEMPLATE_TYPE } from './metadataTypeConstants';

class LibraryAnalyticsGenerateTemplateExecutor extends LibraryBaseTemplateCommand<TemplateAndDir> {
  public executionName = nls.localize('analytics_generate_template_text');
  public telemetryName = 'analytics_generate_template';
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

type TemplateAndDir = DirFileNameSelection & Template;

type Template = {
  // fileName is the templateName
  fileName: string;
};

class SelectProjectTemplate implements ParametersGatherer<Template> {
  public async gather(): Promise<CancelResponse | ContinueResponse<Template>> {
    const projectTemplateInputOptions: vscode.InputBoxOptions = {
      prompt: nls.localize('analytics_template_name_text')
    };
    const fileName = await vscode.window.showInputBox(projectTemplateInputOptions);

    return fileName ? { type: 'CONTINUE', data: { fileName } } : { type: 'CANCEL' };
  }
}

const outputDirGatherer = new SelectOutputDir(ANALYTICS_TEMPLATE_DIRECTORY);

const parameterGatherer = new CompositeParametersGatherer(new SelectProjectTemplate(), outputDirGatherer);

export const analyticsGenerateTemplate = (): void => {
  const createTemplateExecutor = new LibraryAnalyticsGenerateTemplateExecutor();
  const commandlet = new SfCommandlet(new SfWorkspaceChecker(), parameterGatherer, createTemplateExecutor);
  void commandlet.run();
};
