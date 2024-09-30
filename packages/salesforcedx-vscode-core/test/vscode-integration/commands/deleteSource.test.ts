/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  ContinueResponse,
  fileUtils
} from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  ConfirmationAndSourcePathGatherer,
  ManifestChecker
} from '../../../src/commands';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression
describe('ManifestChecker', () => {
  let workspaceStub: sinon.SinonStub;
  const workspaceFolderPath = path.join('path', 'to', 'workspace', 'folder');

  beforeEach(() => {
    const workspaceFolders = [{ uri: { fsPath: workspaceFolderPath } }];
    workspaceStub = sinon
      .stub(vscode.workspace, 'workspaceFolders')
      .value(workspaceFolders);
  });

  beforeEach(() => {
    workspaceStub.restore();
  });

  it('fails the check if the selected resource is in the manifest directory', () => {
    const manifestFilePath = path.join(
      workspaceFolderPath,
      'manifest',
      'package.xml'
    );
    const manifestUri = { fsPath: manifestFilePath } as vscode.Uri;
    const flushFilePathStub = sinon
      .stub(fileUtils, 'flushFilePath')
      .returns(manifestFilePath);
    const checker = new ManifestChecker(manifestUri);
    const response = checker.check();
    expect(response).to.be.false;

    flushFilePathStub.restore();
  });

  it('passes the check if the selected resource is not in the manifest directory', () => {
    const sourcePath = path.join(workspaceFolderPath, 'src', 'exampleFile.js');
    const sourceUri = { fsPath: sourcePath } as vscode.Uri;
    const flushFilePathStub = sinon
      .stub(fileUtils, 'flushFilePath')
      .returns(sourcePath);
    const checker = new ManifestChecker(sourceUri);
    const response = checker.check();
    expect(response).to.be.true;

    flushFilePathStub.restore();
  });
});

describe('ConfirmationAndSourcePathGatherer', () => {
  const examplePath = path.join('example', 'path');
  const explorerPathUri = { fsPath: examplePath } as vscode.Uri;

  let informationMessageStub: sinon.SinonStub;
  let flushFilePathStub: sinon.SinonStub;

  beforeEach(() => {
    informationMessageStub = sinon.stub(
      vscode.window,
      'showInformationMessage'
    );

    flushFilePathStub = sinon.stub(fileUtils, 'flushFilePath');

    flushFilePathStub.returns(examplePath);
  });

  afterEach(() => {
    informationMessageStub.restore();
    flushFilePathStub.restore();
  });

  it('Should return cancel if the user cancels the command', async () => {
    informationMessageStub.returns(
      nls.localize('cancel_delete_source_button_text')
    );

    const gatherer = new ConfirmationAndSourcePathGatherer(explorerPathUri);
    const response = await gatherer.gather();
    expect(informationMessageStub.calledOnce).to.be.true;
    expect(response.type).to.equal('CANCEL');
  });

  it('Should return Continue if the user chooses to proceed', async () => {
    informationMessageStub.returns(
      nls.localize('confirm_delete_source_button_text')
    );

    const gatherer = new ConfirmationAndSourcePathGatherer(explorerPathUri);
    const response = (await gatherer.gather()) as ContinueResponse<{
      filePath: string;
    }>;
    expect(informationMessageStub.calledOnce).to.be.true;
    expect(response.type).to.equal('CONTINUE');
    expect(response.data).to.eql({ filePath: examplePath });
  });
});
