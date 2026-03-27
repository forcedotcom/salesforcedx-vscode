/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { 
  SfdxCommandlet,
  SfdxCommandletExecutor,
  SfdxWorkspaceChecker,
  ParameterGatherer,
  ContinueResponse,
  CancelResponse,
  PostconditionChecker
} from '@salesforce/salesforcedx-vscode-core/src/commands/base';
import { getRootWorkspacePath } from '@salesforce/salesforcedx-vscode-core/src/utils/rootWorkspace';
import {
  getApexTestClassDirectorySuggestions,
  selectDirectory
} from '@salesforce/salesforcedx-vscode-core/src/utils/directoryUtils';
import * as vscode from 'vscode';
import { nls } from '../messages';

// Define the interface for the command's gathered parameters
interface ApexTestClassCreateResult {
  fileName: string;
  outputdir: string;
}

// Gatherer for both class name and output directory
class ApexTestClassNameAndDirectoryGatherer implements ParameterGatherer<ApexTestClassCreateResult> {
  public async gather(): Promise<ContinueResponse<ApexTestClassCreateResult> | CancelResponse> {
    // 1. Prompt for Apex Test Class Name
    const classNameInput = await vscode.window.showInputBox({
      prompt: nls.localize('force_apex_test_class_create_enter_name'),
      placeHolder: nls.localize('force_apex_test_class_create_name_placeholder')
    });

    if (classNameInput === undefined) {
      return { type: 'CANCEL' };
    }
    const fileName = classNameInput.trim();
    if (fileName.length === 0) {
      return { type: 'CANCEL' };
    }

    // 2. Prompt for Output Directory
    const rootWorkspacePath = getRootWorkspacePath();
    // Common default directory for Apex classes
    const APEX_CLASS_DEFAULT_DIRECTORY = 'force-app/main/default/classes';

    const suggestions = await getApexTestClassDirectorySuggestions(rootWorkspacePath);

    const outputdir = await selectDirectory(
      suggestions,
      APEX_CLASS_DEFAULT_DIRECTORY,
      nls.localize('force_apex_test_class_create_enter_dir')
    );

    if (outputdir === undefined) {
      return { type: 'CANCEL' };
    }

    return {
      type: 'CONTINUE',
      data: {
        fileName,
        outputdir
      }
    };
  }
}

// Executor for the Apex Test Class creation command
class ForceApexTestClassCreateExecutor extends SfdxCommandletExecutor<ApexTestClassCreateResult> {
  public build(data: ApexTestClassCreateResult): string {
    // Construct the Salesforce CLI command string
    // The 'template ApexUnitTest' is crucial for creating a test class.
    return `sfdx force:apex:class:create --classname ${data.fileName} --outputdir ${data.outputdir} --template ApexUnitTest`;
  }
}

// Postcondition checker (optional, but good practice for validation)
class ApexTestClassPostconditionChecker extends PostconditionChecker<ApexTestClassCreateResult> {
  public async check(
    inputs: ContinueResponse<ApexTestClassCreateResult> | CancelResponse
  ): Promise<ContinueResponse<ApexTestClassCreateResult> | CancelResponse> {
    if (inputs.type === 'CONTINUE') {
      // Add any specific post-gathering checks here, e.g., if a file with the same name already exists
      return inputs;
    }
    return inputs;
  }
}

// Entry point for the 'Create Apex Unit Test Class' command
export async function forceApexTestClassCreate() {
  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(), // Checks if a workspace is open
    new ApexTestClassNameAndDirectoryGatherer(), // Gathers class name and directory
    new ForceApexTestClassCreateExecutor(), // Executes the CLI command
    new ApexTestClassPostconditionChecker() // Performs post-gathering checks
  );
  await commandlet.run();
}
