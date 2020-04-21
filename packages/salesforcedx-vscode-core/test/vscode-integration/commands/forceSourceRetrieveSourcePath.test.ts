/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CancelResponse,
  ContinueResponse
} from '@salesforce/salesforcedx-utils-vscode/out/src/types/index';
import { expect } from 'chai';
import * as path from 'path';
import { createSandbox, SinonSandbox, SinonStub, stub } from 'sinon';
import { Uri } from 'vscode';
import { channelService } from '../../../src/channels';
import {
  ForceSourceRetrieveSourcePathExecutor,
  SourcePathChecker,
  useBetaRetrieve
} from '../../../src/commands/forceSourceRetrieveSourcePath';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';
import { SfdxCoreSettings } from '../../../src/settings/sfdxCoreSettings';
import { SfdxPackageDirectories } from '../../../src/sfdxProject';
import { getRootWorkspacePath } from '../../../src/util';

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

describe('Force Source Retrieve with Sourcepath Beta', () => {
  let sandboxStub: SinonSandbox;

  beforeEach(() => {
    sandboxStub = createSandbox();
  });

  afterEach(() => {
    sandboxStub.restore();
  });

  it('Should return false for URI not part of the beta when the beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    const uriOne = Uri.parse('file:///bar.html');
    const fileProcessing = useBetaRetrieve(uriOne);
    expect(fileProcessing).to.equal(false);
  });

  it('Should return true for ApexClass URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    const uriOne = Uri.parse('file:///bar.cls');
    const apexClassProcessing = useBetaRetrieve(uriOne);
    expect(apexClassProcessing).to.equal(true);
  });

  it('Should return false for ApexClass URI when beta configuration is disabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(false);
    const uriOne = Uri.parse('file:///bar.cls');
    const apexClassProcessing = useBetaRetrieve(uriOne);
    expect(apexClassProcessing).to.equal(false);
  });

  it('Should return true for ApexTrigger URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    const uriOne = Uri.parse('file:///bar.trigger');
    const triggerProcessing = useBetaRetrieve(uriOne);
    expect(triggerProcessing).to.equal(true);
  });

  it('Should return false for ApexTrigger URI when beta configuration is disabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(false);
    const uriOne = Uri.parse('file:///bar.trigger');
    const triggerProcessing = useBetaRetrieve(uriOne);
    expect(triggerProcessing).to.equal(false);
  });

  it('Should return true for VF Page URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    const uriOne = Uri.parse('file:///bar.page');
    const pageProcessing = useBetaRetrieve(uriOne);
    expect(pageProcessing).to.equal(true);
  });

  it('Should return false for VF Page URI when beta configuration is disabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(false);
    const uriOne = Uri.parse('file:///bar.page');
    const pageProcessing = useBetaRetrieve(uriOne);
    expect(pageProcessing).to.equal(false);
  });

  it('Should return true for VF Component URI when beta configuration is enabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(true);
    const uriOne = Uri.parse('file:///bar.component');
    const cmpProcessing = useBetaRetrieve(uriOne);
    expect(cmpProcessing).to.equal(true);
  });

  it('Should return false for VF Component URI when beta configuration is disabled', () => {
    sandboxStub
      .stub(SfdxCoreSettings.prototype, 'getBetaDeployRetrieve')
      .returns(false);
    const uriOne = Uri.parse('file:///bar.component');
    const cmpProcessing = useBetaRetrieve(uriOne);
    expect(cmpProcessing).to.equal(false);
  });
});
