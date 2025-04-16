/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SinonStub, stub } from 'sinon';
import { workspace, WorkspaceFolder } from 'vscode';

/**
 * These test utilities will mock vscode.workspace so that
 * getRootWorkspace, hasRootWorkspace, and getRootWorkspacePath all
 * work from the mock information you pass in.
 */

export const stubRootWorkspace = (path: string): SinonStub => {
  return stubWorkspace(generateMockRootWorkspace(path));
};

export const stubWorkspace = (stubObj: WorkspaceFolder[]): SinonStub => {
  return stub(workspace, 'workspaceFolders').get(() => stubObj);
};

const generateMockRootWorkspace = (path: string): WorkspaceFolder[] => {
  return [
    {
      name: 'test',
      uri: {
        fsPath: path
      }
    }
  ] as unknown as WorkspaceFolder[];
};
