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
import * as vscode from 'vscode';
import {
  ForceSourceRetrieveSourcePathExecutor,
  SourcePathChecker
} from '../../../src/commands/forceSourceRetrieveSourcePath';

import { channelService } from '../../../src/channels';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';
import { SfdxProjectJsonParser } from '../../../src/util';

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
    workspacePath = vscode.workspace!.workspaceFolders![0].uri.fsPath;
    appendLineSpy = stub(channelService, 'appendLine');
    showErrorMessageSpy = stub(notificationService, 'showErrorMessage');
  });

  afterEach(() => {
    appendLineSpy.restore();
    showErrorMessageSpy.restore();
  });

  it('Should continue when source path is a package directory', async () => {
    const getProjectDirectoriesStub = stub(
      SfdxProjectJsonParser.prototype,
      'getPackageDirectoryPaths'
    ).returns(['package1', 'package2']);
    const pathChecker = new SourcePathChecker();
    const sourcePath = path.join(workspacePath, 'package1');
    const continueResponse = (await pathChecker.check({
      type: 'CONTINUE',
      data: sourcePath
    })) as ContinueResponse<string>;

    expect(continueResponse.type).to.equal('CONTINUE');
    expect(continueResponse.data).to.equal(sourcePath);

    getProjectDirectoriesStub.restore();
  });

  it('Should continue when source path is inside one of a few package directories', async () => {
    const packagePath = 'package1';
    const getProjectDirectoriesStub = stub(
      SfdxProjectJsonParser.prototype,
      'getPackageDirectoryPaths'
    ).returns([packagePath, 'package2']);
    const pathChecker = new SourcePathChecker();
    const sourcePath = path.join(workspacePath, packagePath, 'source', 'path');
    const continueResponse = (await pathChecker.check({
      type: 'CONTINUE',
      data: sourcePath
    })) as ContinueResponse<string>;

    expect(continueResponse.type).to.equal('CONTINUE');
    expect(continueResponse.data).to.equal(sourcePath);

    getProjectDirectoriesStub.restore();
  });

  it('Should continue when source path is inside of the only package directory', async () => {
    const packagePath = 'package1';
    const getProjectDirectoriesStub = stub(
      SfdxProjectJsonParser.prototype,
      'getPackageDirectoryPaths'
    ).returns([packagePath]);
    const pathChecker = new SourcePathChecker();
    const sourcePath = path.join(workspacePath, packagePath, 'source', 'path');
    const continueResponse = (await pathChecker.check({
      type: 'CONTINUE',
      data: sourcePath
    })) as ContinueResponse<string>;

    expect(continueResponse.type).to.equal('CONTINUE');
    expect(continueResponse.data).to.equal(sourcePath);

    getProjectDirectoriesStub.restore();
  });

  it('Should notify user and cancel when source path is not inside of a package directory', async () => {
    const getProjectDirectoriesStub = stub(
      SfdxProjectJsonParser.prototype,
      'getPackageDirectoryPaths'
    ).returns(['package1', 'package2']);
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
    getProjectDirectoriesStub.restore();
  });

  it('Should cancel and notify user if an error occurs when fetching the package directories', async () => {
    const getProjectDirectoriesStub = stub(
      SfdxProjectJsonParser.prototype,
      'getPackageDirectoryPaths'
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
    getProjectDirectoriesStub.restore();
  });
});
