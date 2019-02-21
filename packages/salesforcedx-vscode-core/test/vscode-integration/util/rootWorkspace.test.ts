/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { match, SinonStub, stub } from 'sinon';
import { hasRootWorkspace, getRootWorkspace, getRootWorkspaceFsPath, getRootWorkspacePath } from '../../../src/util';
import { workspace, WorkspaceFolder } from 'vscode';

describe('RootWorkspace utils should', () => {
  const myFolder: WorkspaceFolder = {
      name: 'test',
      uri: {
        path: 'test/test',
        fsPath: '/test/test'
      }
    } as unknown as WorkspaceFolder;
  const myWorkspaces: WorkspaceFolder[] = [
      myFolder
    ] as unknown as WorkspaceFolder[];
  const WORKSPACE_NAME = 'sfdx-simple';
  let workspaceStub: SinonStub | undefined;

  function stubWorkspace(stubObj: WorkspaceFolder[]) {
    console.log('setting up stubWorkspace: ', JSON.stringify(stubObj));
    return workspaceStub = stub(workspace, 'workspaceFolders').get(function getWorkspaceFolders() {
      return stubObj;
    });
  }

  afterEach(() => {
    if (workspaceStub) {
      workspaceStub!.restore();
      workspaceStub = undefined;
    };
  });

  it('correctly determine if there is a workspace', () => {
    expect(hasRootWorkspace()).to.be.true;
    stubWorkspace([]);
    expect(hasRootWorkspace()).to.be.false;
  });

  it('get workspace information', () => {
    expect(getRootWorkspace()).to.be.an.instanceOf(Object);
    expect(getRootWorkspace().name).to.contain(WORKSPACE_NAME);
    expect(getRootWorkspacePath()).to.contain(WORKSPACE_NAME);
    expect(getRootWorkspaceFsPath()).to.contain(WORKSPACE_NAME);
  });

  it('return empty things ( not undefined ) if no root workspace', () => {
    stubWorkspace([]);
    expect(getRootWorkspace()).to.be.empty;
    expect(getRootWorkspacePath()).to.be.empty;
    expect(getRootWorkspaceFsPath()).to.be.empty;
  });

  it('return correct parts of the root workspace', () => {
    stubWorkspace(myWorkspaces);
    expect(getRootWorkspace().name).to.equal(myFolder.name);
    expect(getRootWorkspacePath()).to.equal(myFolder.uri.path);
    expect(getRootWorkspaceFsPath()).to.equal(myFolder.uri.fsPath)
  });
});
