/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { PreconditionChecker } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { nls } from '../../messages';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const notificationService = sfdxCoreExports.notificationService;

/**
 * Get the absolute path to LWC Test runner executable, installed in an SFDX project.
 * @param sfdxProjectPath path to the root directory of an SFDX Project
 * @returns path to lwc test runner
 */
export function getLwcTestRunnerExecutable(sfdxProjectPath: string) {
  const lwcTestRunnerExecutable = path.join(
    sfdxProjectPath,
    'node_modules',
    '.bin',
    'lwc-jest'
  );
  if (fs.existsSync(lwcTestRunnerExecutable)) {
    return lwcTestRunnerExecutable;
  } else {
    notificationService.showErrorMessage(
      nls.localize('no_lwc_test_runner_found_text')
    );
  }
}

export class SfdxWorkspaceLwcTestRunnerInstallationChecker
  implements PreconditionChecker {
  public check(): boolean {
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      const sfdxProjectPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      const lwcTestRunnerExecutable = getLwcTestRunnerExecutable(
        sfdxProjectPath
      );
      return !!lwcTestRunnerExecutable;
    }
    return false;
  }
}

/**
 * Returns relative path for Jest runTestsByPath on Windows
 * or absolute path on other systems
 * @param cwd
 * @param testFsPath
 */
export function normalizeRunTestsByPath(cwd: string, testFsPath: string) {
  if (/^win32/.test(process.platform)) {
    return path.relative(cwd, testFsPath);
  }
  return testFsPath;
}
