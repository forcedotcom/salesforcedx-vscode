/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as which from 'which';
import { nls } from '../../messages';
import { telemetryService } from '../../telemetry';
import { workspaceService } from './workspaceService';

/**
 * Get the absolute path to LWC Test runner executable, installed in a SFDX Project.
 * @param cwd path to the workspace folder
 * @returns path to LWC Test runner
 */
export const getLwcTestRunnerExecutable = (cwd: string) => {
  const workspaceType = workspaceService.getCurrentWorkspaceType();
  if (workspaceService.isSFDXWorkspace(workspaceType)) {
    const lwcTestRunnerExecutable = path.join(cwd, 'node_modules', '.bin', 'lwc-jest');
    if (fs.existsSync(lwcTestRunnerExecutable)) {
      return lwcTestRunnerExecutable;
    } else {
      const errorMessage = nls.localize('no_lwc_jest_found_text');
      console.error(errorMessage);
      vscode.window.showErrorMessage(errorMessage);
      telemetryService.sendException('lwc_test_no_lwc_jest_found', errorMessage);
    }
  } else if (workspaceService.isCoreWorkspace(workspaceType)) {
    const lwcTestRunnerExecutable = which.sync('lwc-test', {
      nothrow: true
    });
    if (lwcTestRunnerExecutable && fs.existsSync(lwcTestRunnerExecutable)) {
      return lwcTestRunnerExecutable;
    } else {
      const errorMessage = nls.localize('no_lwc_testrunner_found_text');
      console.error(errorMessage);
      vscode.window.showErrorMessage(errorMessage);
      telemetryService.sendException('lwc_test_no_lwc_testrunner_found', errorMessage);
    }
  } else {
    // This is not expected since test support should not be activated for other workspace types
    telemetryService.sendException('lwc_test_no_lwc_testrunner_found', 'Unsupported workspace');
  }
};
