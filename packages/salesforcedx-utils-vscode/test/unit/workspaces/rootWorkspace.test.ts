/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { SinonStub } from 'sinon';
import { WorkspaceFolder } from 'vscode';
import { workspaceUtils } from '../../../src/workspaces';
import { stubWorkspace } from './rootWorkspace.test-util';

// tslint:disable:no-unused-expression
describe('RootWorkspace utils should', () => {
  const myFolder: WorkspaceFolder = ({
    name: 'test',
    uri: {
      fsPath: '/test/test'
    }
  } as unknown) as WorkspaceFolder;
  const myWorkspaces: WorkspaceFolder[] = ([
    myFolder
  ] as unknown) as WorkspaceFolder[];
  let workspaceStub: SinonStub | undefined;

  afterEach(() => {
    if (workspaceStub) {
      workspaceStub.restore();
      workspaceStub = undefined;
    }
  });

  it('correctly determine if there is a workspace', () => {
    workspaceStub = stubWorkspace(myWorkspaces);
    expect(workspaceUtils.hasRootWorkspace()).to.be.true;
    workspaceStub = stubWorkspace([]);
    expect(workspaceUtils.hasRootWorkspace()).to.be.false;
  });

  it('get workspace information', () => {
    workspaceStub = stubWorkspace(myWorkspaces);
    expect(workspaceUtils.getRootWorkspace()).to.be.an.instanceOf(Object);
    expect(workspaceUtils.getRootWorkspace().name).to.contain('test');
    expect(workspaceUtils.getRootWorkspacePath()).to.contain('test');
  });

  it('return empty things ( not undefined ) if no root workspace', () => {
    workspaceStub = stubWorkspace([]);
    expect(workspaceUtils.getRootWorkspace()).to.be.empty;
    expect(workspaceUtils.getRootWorkspacePath()).to.be.empty;
  });
});
