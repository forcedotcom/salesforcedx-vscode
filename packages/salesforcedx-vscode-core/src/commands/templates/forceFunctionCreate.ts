/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  Measurements,
  Properties
} from '@salesforce/salesforcedx-utils-vscode/out/src';
import {
  Command,
  SfdxCommandBuilder
} from '@salesforce/salesforcedx-utils-vscode/out/src/cli';
import {
  CancelResponse,
  ContinueResponse,
  FunctionInfo,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as cp from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../../messages';
import { notificationService } from '../../notifications';
import { sfdxCoreSettings } from '../../settings';
import { telemetryService } from '../../telemetry';
import {
  CompositeParametersGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../util';
import { BaseTemplateCommand } from './baseTemplateCommand';
import { FUNCTION_TYPE_JAVA, FUNCTION_TYPE_JS } from './metadataTypeConstants';

const LANGUAGE_JAVA = 'java';
const LANGUAGE_JAVASCRIPT = 'javascript';
const LOG_NAME = 'force_function_create';
export class ForceFunctionCreateExecutor extends BaseTemplateCommand {

  public build(data: FunctionInfo): Command {
    if (data.language === LANGUAGE_JAVASCRIPT) {
      this.metadata = FUNCTION_TYPE_JS;
      this.setFileExtension('js');
    } else if (data.language === LANGUAGE_JAVA) {
      this.metadata = FUNCTION_TYPE_JAVA;
      this.setFileExtension('java');
    }
    return new SfdxCommandBuilder()
      .withDescription(nls.localize('force_function_create_text'))
      .withArg('generate:function')
      .withFlag('--name', data.fileName)
      .withFlag('--language', data.language)
      .withLogName(LOG_NAME)
      .build();
  }

  public runPostCommandTasks(data: FunctionInfo) {
    const language = data.language;
    if (language === LANGUAGE_JAVA) {
      const pathToSource = this.getPathToSource(data.outputdir, data.fileName);
      const targetDir = path.join(path.dirname(pathToSource), '..', '..', '..', '..', '..');
      return new Promise((resolve, reject) => {
        cp.exec('mvn install', { cwd: path.join(targetDir) }, err => {
          if (err) {
            notificationService.showWarningMessage(
              nls.localize(
                'force_function_install_mvn_dependencies_error',
                err.message
              )
            );
            reject(err);
          }
          resolve();
        });
      });
    } else {
      return new Promise((resolve, reject) => {
        const pathToSource = this.getPathToSource(data.outputdir, data.fileName);
        const targetDir = path.dirname(pathToSource);
        cp.exec('npm install', { cwd: targetDir }, err => {
          if (err) {
            notificationService.showWarningMessage(
              nls.localize(
                'force_function_install_npm_dependencies_error',
                err.message
              )
            );
            reject(err);
          }
          resolve();
        });
      });
    }
  }

  public logMetric(
    logName: string | undefined,
    hrstart: [number, number],
    properties?: Properties,
    measurements?: Measurements
  ) {
    if (properties) {
      const fileExtension = this.getFileExtension();
      if (fileExtension === '.js') {
        properties.language = 'node';
      } else if (fileExtension === '.java') {
        properties.language = 'java';
      }
    }
    super.logMetric(logName, hrstart, properties, measurements);
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
      [LANGUAGE_JAVA, LANGUAGE_JAVASCRIPT],
      {
        placeHolder: nls.localize('force_function_enter_language')
      }
    );

    if (language === undefined) {
      return { type: 'CANCEL' };
    }

    // In order to reuse code used by other templates that have outputdir
    // and extends DirFileNameSelection, we are passing an empty outputdir
    return {
      type: 'CONTINUE',
      data: {
        fileName: name,
        language,
        outputdir: ''
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
