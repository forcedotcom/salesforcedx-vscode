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
import { SinonStub, stub } from 'sinon';
import {
  ForceSourceRetrieveSourcePathExecutor,
  SourcePathChecker
} from '../../../src/commands/forceSourceRetrieveSourcePath';

import { channelService } from '../../../src/channels';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';
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
  let appendLineSpy: SinonStub;
  let showErrorMessageSpy: SinonStub;
  beforeEach(() => {
    workspacePath = getRootWorkspacePath();
    appendLineSpy = stub(channelService, 'appendLine');
    showErrorMessageSpy = stub(notificationService, 'showErrorMessage');
  });

  afterEach(() => {
    appendLineSpy.restore();
    showErrorMessageSpy.restore();
  });

  it('Should continue when source path is in a package directory', async () => {
    const isInPackageDirectoryStub = stub(
      SfdxPackageDirectories,
      'isInPackageDirectory'
    ).returns(true);
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
    const isInPackageDirectoryStub = stub(
      SfdxPackageDirectories,
      'isInPackageDirectory'
    ).returns(false);
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
    const isInPackageDirectoryStub = stub(
      SfdxPackageDirectories,
      'isInPackageDirectory'
    ).throws(new Error());
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
