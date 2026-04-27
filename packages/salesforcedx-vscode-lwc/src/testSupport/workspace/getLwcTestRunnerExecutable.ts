/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
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
export const getLwcTestRunnerExecutable = Effect.fn('getLwcTestRunnerExecutable')(function* (cwd: string) {
  const workspaceType = workspaceService.getCurrentWorkspaceType();
  const isSFDX = workspaceService.isSFDXWorkspace(workspaceType);

  if (!isSFDX && !workspaceService.isCoreWorkspace(workspaceType)) {
    telemetryService.sendException('lwc_test_no_lwc_testrunner_found', 'Unsupported workspace');
    return Option.none<string>();
  }

  const executablePath = isSFDX ? path.join(cwd, 'node_modules', '.bin', 'lwc-jest') : which.sync('lwc-test');
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const exists = yield* api.services.FsService.fileOrFolderExists(executablePath);

  if (exists) {
    return Option.some(executablePath);
  }

  const errorKey = isSFDX ? 'lwc_test_no_lwc_jest_found' : 'lwc_test_no_lwc_testrunner_found';
  const errorMessage = nls.localize(isSFDX ? 'no_lwc_jest_found_text' : 'no_lwc_testrunner_found_text');
  void vscode.window.showErrorMessage(errorMessage);
  telemetryService.sendException(errorKey, errorMessage);
  return Option.none<string>();
});
