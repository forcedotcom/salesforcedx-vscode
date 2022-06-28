/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as helpers from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  ConfirmationAndSourcePathGatherer,
  ForceSourceDeleteExecutor,
  ManifestChecker
} from '../../../src/commands';
import { nls } from '../../../src/messages';

// tslint:disable:no-unused-expression

describe('Force Source Delete', () => {
  it('Should build the source delete command', () => {
    const executor = new ForceSourceDeleteExecutor();
    const sourcePath = path.join('example', 'path');
    const sourceDeleteCommand = executor.build({ filePath: sourcePath });
    expect(sourceDeleteCommand.toCommand()).to.equal(
      `sfdx force:source:delete --sourcepath ${sourcePath} --noprompt`
    );
  });
});

describe('ManifestChecker', () => {
  let workspaceStub: sinon.SinonStub;
  const workspaceFolderPath = path.join('path', 'to', 'workspace', 'folder');

  before(() => {
    const workspaceFolders = [{ uri: { fsPath: workspaceFolderPath } }];
    workspaceStub = sinon
      .stub(vscode.workspace, 'workspaceFolders')
      .value(workspaceFolders);
  });

  after(() => {
    workspaceStub.restore();
  });

  it('fails the check if the selected resource is in the manifest directory', () => {
    const manifestFilePath = path.join(
      workspaceFolderPath,
      'manifest',
      'package.xml'
    );
    const manifestUri = { fsPath: manifestFilePath } as vscode.Uri;

    const flushFilePathStub = sinon.stub(helpers, 'flushFilePath')
      .returns(manifestFilePath);

    const checker = new ManifestChecker(manifestUri);
    const response = checker.check();
    expect(response).to.be.false;

    flushFilePathStub.restore();
  });

  it('passes the check if the selected resource is not in the manifest directory', () => {
    const sourcePath = path.join(workspaceFolderPath, 'src', 'exampleFile.js');
    const sourceUri = { fsPath: sourcePath } as vscode.Uri;

    const flushFilePathStub = sinon.stub(helpers, 'flushFilePath')
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

    flushFilePathStub = sinon.stub(
      helpers,
      'flushFilePath'
    );

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

  it('jab test1', async () => {
    const originalPath = 'C:\\Users';
    expect('C:\\Users', 'jab-first-test-on windows, and this XXX').to.equal(originalPath);
  });

  // it('jab test2', async () => {
  //   const originalPath = 'C:\\Users';
  //   expect('C:/Users', 'jab-second-test-on windows, and this XXX').to.equal(originalPath);
  // });

  it('jab test3', async () => {
    const originalPath = 'C:\\Users';
    const newPath = fs.realpathSync.native(originalPath);
    expect(newPath, 'jab-third-test-on windows, and this XXX').to.equal('C:\\Users');
  });

  // it('jab test4', async () => {
  //   const originalPath = 'C:\\Users';
  //   const newPath = fs.realpathSync.native(originalPath);
  //   expect(newPath, 'jab-fourth-test-on windows, and this XXX').to.equal('C:/Users');
  // });

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
