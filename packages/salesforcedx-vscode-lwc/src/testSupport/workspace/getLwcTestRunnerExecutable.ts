/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { stat } from '@salesforce/salesforcedx-utils-vscode';
import * as path from 'node:path';
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
export const getLwcTestRunnerExecutable = async (cwd: string) => {
  const workspaceType = workspaceService.getCurrentWorkspaceType();

  if (!workspaceService.isSFDXWorkspace(workspaceType) && !workspaceService.isCoreWorkspace(workspaceType)) {
    telemetryService.sendException('lwc_test_no_lwc_testrunner_found', 'Unsupported workspace');
    return;
  }

  const getExecutablePath = () => {
    if (workspaceService.isSFDXWorkspace(workspaceType)) {
      return path.join(cwd, 'node_modules', '.bin', 'lwc-jest');
    }
    return which.sync('lwc-test');
  };

  try {
    const executablePath = getExecutablePath();
    await stat(executablePath);
    return executablePath;
  } catch {
    const isSFDX = workspaceService.isSFDXWorkspace(workspaceType);
    const errorKey = isSFDX ? 'lwc_test_no_lwc_jest_found' : 'lwc_test_no_lwc_testrunner_found';
    const errorMessage = nls.localize(isSFDX ? 'no_lwc_jest_found_text' : 'no_lwc_testrunner_found_text');
    console.error(errorMessage);
    vscode.window.showErrorMessage(errorMessage);
    telemetryService.sendException(errorKey, errorMessage);
  }
};
