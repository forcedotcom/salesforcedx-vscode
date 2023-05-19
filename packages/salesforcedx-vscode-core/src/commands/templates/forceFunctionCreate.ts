/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';

import { generateFunction, Language } from '@heroku/functions-core';
import {
    CancelResponse, channelService, ContinueResponse, FunctionInfo, LibraryCommandletExecutor,
    notificationService, ParametersGatherer, workspaceUtils
} from '@salesforce/salesforcedx-utils-vscode';

import { OUTPUT_CHANNEL } from '../../channels';
import { nls } from '../../messages';
import { MetadataDictionary, MetadataInfo } from '../../util';
import { CompositeParametersGatherer, SfdxCommandlet, SfdxWorkspaceChecker } from '../util';
import { FUNCTION_TYPE_JAVA, FUNCTION_TYPE_JS } from './metadataTypeConstants';

const LANGUAGE_JAVA = 'java';
const LANGUAGE_JAVASCRIPT = 'javascript';
const LANGUAGE_TYPESCRIPT = 'typescript';

const LOG_NAME = 'force_function_create';
export class ForceFunctionCreateExecutor extends LibraryCommandletExecutor<
  any
> {
  constructor() {
    super(nls.localize('force_function_create_text'), LOG_NAME, OUTPUT_CHANNEL);
  }
  public async run(response: ContinueResponse<FunctionInfo>): Promise<boolean> {
    const { fileName, language } = response.data;
    let metadata: MetadataInfo | undefined;
    switch (language) {
      case LANGUAGE_JAVASCRIPT:
        metadata = MetadataDictionary.getInfo(FUNCTION_TYPE_JS);
        metadata!.suffix = '.js';
        this.telemetry.addProperty('language', 'node');
        break;
      case LANGUAGE_TYPESCRIPT:
        metadata = MetadataDictionary.getInfo(FUNCTION_TYPE_JS);
        metadata!.suffix = '.ts';
        this.telemetry.addProperty('language', 'node');
        break;
      case LANGUAGE_JAVA:
        metadata = MetadataDictionary.getInfo(FUNCTION_TYPE_JAVA);
        metadata!.suffix = '.java';
        this.telemetry.addProperty('language', 'java');
        break;
    }
    const { path: functionPath, welcomeText } = await generateFunction(
      fileName,
      language as Language,
      workspaceUtils.getRootWorkspacePath()
    );
    channelService.appendLine(
      `Created ${language} function ${fileName} in ${functionPath}.`
    );
    if (welcomeText) channelService.appendLine(welcomeText);
    channelService.showChannelOutput();
    const outputFile = metadata!.pathStrategy.getPathToSource(
      functionPath,
      fileName,
      metadata!.suffix
    );
    const document = await vscode.workspace.openTextDocument(outputFile);
    vscode.window.showTextDocument(document);
    channelService.appendLine('Installing dependencies...');

    if (language === LANGUAGE_JAVA) {
      cp.exec('mvn install', { cwd: path.join(functionPath) }, err => {
        if (err) {
          notificationService.showWarningMessage(
            nls.localize(
              'force_function_install_mvn_dependencies_error',
              err.message
            )
          );
        }
      });
    } else {
      cp.exec('npm install', { cwd: functionPath }, err => {
        if (err) {
          notificationService.showWarningMessage(
            nls.localize(
              'force_function_install_npm_dependencies_error',
              err.message
            )
          );
        }
      });
    }

    return true;
  }
}

export class FunctionInfoGatherer implements ParametersGatherer<FunctionInfo> {
  public async gather(): Promise<
    CancelResponse | ContinueResponse<FunctionInfo>
  > {
    const nameInputOptions = {
      prompt: nls.localize('force_function_enter_function')
    } as vscode.InputBoxOptions;
    const name = await vscode.window.showInputBox(nameInputOptions);
    if (name === undefined) {
      return { type: 'CANCEL' };
    }

    const language = await vscode.window.showQuickPick(
      [LANGUAGE_JAVA, LANGUAGE_JAVASCRIPT, LANGUAGE_TYPESCRIPT],
      {
        placeHolder: nls.localize('force_function_enter_language')
      }
    );

    if (language === undefined) {
      return { type: 'CANCEL' };
    }

    return {
      type: 'CONTINUE',
      data: {
        fileName: name,
        language
      }
    };
  }
}

const parameterGatherer = new CompositeParametersGatherer(
  new FunctionInfoGatherer()
);

export async function forceFunctionCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    parameterGatherer,
    new ForceFunctionCreateExecutor()
  );
  await commandlet.run();
}
