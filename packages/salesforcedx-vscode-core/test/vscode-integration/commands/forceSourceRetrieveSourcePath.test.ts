/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import {
  CancelResponse,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types/index';
import { RegistryAccess } from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { channelService } from '../../../src/channels';
import {
  ForceSourceRetrieveSourcePathExecutor,
  LibraryRetrieveSourcePathExecutor,
  SourcePathChecker
} from '../../../src/commands';
import { WorkspaceContext } from '../../../src/context';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';
import {
  SfdxPackageDirectories,
  SfdxProjectConfig
} from '../../../src/sfdxProject';
import { getRootWorkspacePath, OrgAuthInfo } from '../../../src/util';

describe('Force Source Retrieve with Sourcepath Option', () => {
  it('Should build the source retrieve command', () => {
    const sourcePath = path.join('path', 'to', 'sourceFile');
    const sourceRetrieve = new ForceSourceRetrieveSourcePathExecutor();
    const sourceRetrieveCommand = sourceRetrieve.build(sourcePath);
    expect(sourceRetrieveCommand.toCommand()).to.equal(
      `sfdx force:source:retrieve --sourcepath ${sourcePath}`
    );
    expect(sourceRetrieveCommand.description).to.equal(
      nls.localize('force_source_retrieve_text')
    );
  });
});

describe('SourcePathChecker', () => {
  let workspacePath: string;
  let sandboxStub: SinonSandbox;
  let appendLineSpy: SinonStub;
  let showErrorMessageSpy: SinonStub;
  beforeEach(() => {
    sandboxStub = createSandbox();
    workspacePath = getRootWorkspacePath();
    appendLineSpy = sandboxStub.stub(channelService, 'appendLine');
    showErrorMessageSpy = sandboxStub.stub(
      notificationService,
      'showErrorMessage'
    );
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('Should continue when source path is in a package directory', async () => {
    const isInPackageDirectoryStub = sandboxStub
      .stub(SfdxPackageDirectories, 'isInPackageDirectory')
      .returns(true);
    const pathChecker = new SourcePathChecker();
    const sourcePath = path.join(workspacePath, 'package');
    const continueResponse = (await pathChecker.check({
      type: 'CONTINUE',
      data: sourcePath
    })) as ContinueResponse<string>;

    expect(isInPackageDirectoryStub.getCall(0).args[0]).to.equal(sourcePath);
    expect(continueResponse.type).to.equal('CONTINUE');
    expect(continueResponse.data).to.equal(sourcePath);

    isInPackageDirectoryStub.restore();
  });

  it('Should notify user and cancel when source path is not inside of a package directory', async () => {
    const isInPackageDirectoryStub = sandboxStub
      .stub(SfdxPackageDirectories, 'isInPackageDirectory')
      .returns(false);
    const pathChecker = new SourcePathChecker();
    const cancelResponse = (await pathChecker.check({
      type: 'CONTINUE',
      data: path.join('not', 'in', 'package', 'directory')
    })) as CancelResponse;

    const errorMessage = nls.localize(
      'error_source_path_not_in_package_directory_text'
    );
    expect(appendLineSpy.getCall(0).args[0]).to.equal(errorMessage);
    expect(showErrorMessageSpy.getCall(0).args[0]).to.equal(errorMessage);
    expect(cancelResponse.type).to.equal('CANCEL');
    isInPackageDirectoryStub.restore();
  });

  it('Should cancel and notify user if an error occurs when fetching the package directories', async () => {
    const isInPackageDirectoryStub = sandboxStub
      .stub(SfdxPackageDirectories, 'isInPackageDirectory')
      .throws(new Error());
    const pathChecker = new SourcePathChecker();
    const cancelResponse = (await pathChecker.check({
      type: 'CONTINUE',
      data: 'test/path'
    })) as CancelResponse;

    const errorMessage = nls.localize(
      'error_source_path_not_in_package_directory_text'
    );
    expect(appendLineSpy.getCall(0).args[0]).to.equal(errorMessage);
    expect(showErrorMessageSpy.getCall(0).args[0]).to.equal(errorMessage);
    expect(cancelResponse.type).to.equal('CANCEL');
    isInPackageDirectoryStub.restore();
  });
});

describe('Source Retrieve Beta', () => {
  // Setup the test environment.
  const $$ = testSetup();
  const testData = new MockTestOrgData();

  let mockConnection: Connection;
  let sb: SinonSandbox;

  beforeEach(async () => {
    sb = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    sb.stub(ConfigAggregator.prototype, 'getPropertyValue')
      .withArgs('defaultusername')
      .returns(testData.username);
  });

  afterEach(() => {
    $$.SANDBOX.restore();
    sb.restore();
  });

  it('should get the namespace value from sfdx-project.json', async () => {
    sb.stub(OrgAuthInfo, 'getDefaultUsernameOrAlias').returns(
      testData.username
    );
    sb.stub(WorkspaceContext.get(), 'getConnection').returns(mockConnection);
    const getNamespace = sb.stub(SfdxProjectConfig, 'getValue').returns('diFf');
    const getComponentsStub = sb.stub(
      RegistryAccess.prototype,
      'getComponentsFromPath'
    );
    const executor = new LibraryRetrieveSourcePathExecutor();
    const filePath = path.join(
      'test',
      'file',
      'path',
      'classes',
      'apexTest.cls'
    );
    await executor.execute({ type: 'CONTINUE', data: filePath });
    // tslint:disable-next-line:no-unused-expression
    expect(getComponentsStub.calledWith(filePath)).to.be.true;
    expect(getNamespace.calledOnce).to.equal(true);
    // NOTE: There's currently a limitation on source deploy retrieve that prevents
    // us mocking SourceClinet.tooling.deploy. We'll look into updating the library and this test.
  });
});
