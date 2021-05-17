/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as path from 'path';
import { SinonSpy, SinonStub, stub } from 'sinon';
import { commands, Uri } from 'vscode';
import { channelService } from '../../../src/channels';
import {
  ForceSourceDiffExecutor,
  handleDiffResponse
} from '../../../src/commands';
import * as conflictCommands from '../../../src/commands';
import * as conflictDetectionService from '../../../src/conflict/conflictDetectionService';
import { MetadataCacheResult, MetadataContext } from '../../../src/conflict/metadataCacheService';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';
import Sinon = require('sinon');

describe('Force Source Diff', () => {

  // tslint:disable:no-unused-expression
  describe('Force Source Diff Using Plugin', () => {
    let appendLineStub: SinonStub;
    let uriFileSpy: SinonStub;
    let vscodeDiffSpy: SinonStub;
    let notificationStub: SinonStub;

    beforeEach(() => {
      appendLineStub = stub(channelService, 'appendLine');
      uriFileSpy = stub(Uri, 'file');
      vscodeDiffSpy = stub(commands, 'executeCommand');
      notificationStub = stub(notificationService, 'showErrorMessage');
    });

    afterEach(() => {
      appendLineStub.restore();
      uriFileSpy.restore();
      vscodeDiffSpy.restore();
      notificationStub.restore();
    });

    it('Should build the source diff command', () => {
      const apexTestClassPath = path.join('path', 'to', 'apex', 'testApex.cls');
      const sourceDiff = new ForceSourceDiffExecutor();
      const sourceDiffCommand = sourceDiff.build(apexTestClassPath);
      expect(sourceDiffCommand.toCommand()).to.equal(
        `sfdx force:source:diff --sourcepath ${apexTestClassPath} --json --loglevel fatal`
      );
      expect(sourceDiffCommand.description).to.equal(
        nls.localize('force_source_diff_text')
      );
    });

    it('Should handle successful diff response', async () => {
      const diffSuccessfulResponse = {
        status: 0,
        result: {
          remote:
            '/Users/testUser/testProject/.sfdx/orgs/user@example.com/diffCache/classes/testClass.cls',
          local:
            '/Users/testUser/testProject/force-app/main/default/classes/testClass.cls',
          fileName: 'testClass.cls'
        }
      };
      await handleDiffResponse(0, JSON.stringify(diffSuccessfulResponse));
      expect(uriFileSpy.calledTwice).to.be.true;
      expect(vscodeDiffSpy.calledOnce).to.be.true;
      expect(vscodeDiffSpy.getCall(0).args[0]).to.equal('vscode.diff');
    });

    it('Should handle errors from diff reponse', async () => {
      const diffErrorResponse = {
        status: 1,
        name: 'Error',
        message:
          'The path could not be found in the project. Specify a path that exists in the file system.',
        exitCode: 1,
        commandName: 'Diff',
        stack:
          'Error: The path could not be found in the project. Specify a path that exists in the file system.',
        warnings: {}
      };
      await handleDiffResponse(0, JSON.stringify(diffErrorResponse));
      expect(uriFileSpy.calledTwice).to.be.false;
      expect(vscodeDiffSpy.calledOnce).to.be.false;
      expect(appendLineStub.called).to.be.true;
    });

    it('Should display error message when diff plugin is not installed', async () => {
      await handleDiffResponse(127, '');
      expect(uriFileSpy.notCalled).to.be.true;
      expect(vscodeDiffSpy.notCalled).to.be.true;
      expect(appendLineStub.called).to.be.true;
      expect(notificationStub.calledOnce).to.be.true;
      expect(notificationStub.getCall(0).args[0]).to.equal(
        nls.localize('force_source_diff_command_not_found')
      );
    });
  });

  describe('Force Source Folder Diff', () => {
    let notificationStub: SinonStub;
    let diffOneFileStub: SinonSpy;
    let diffFolderStub: SinonSpy;

    beforeEach(() => {
      notificationStub = stub(notificationService, 'showErrorMessage');
      diffOneFileStub = stub(conflictDetectionService, 'diffOneFile');
      diffFolderStub = stub(conflictDetectionService, 'diffFolder');
    });

    afterEach(() => {
      notificationStub.restore();
      diffOneFileStub.restore();
      diffFolderStub.restore();
    });

    it('Should throw error for empty cache', async () => {
      await conflictCommands.handleCacheResults('username', undefined);
      expect(notificationStub.calledOnce).to.be.true;
      expect(notificationStub.getCall(0).args[0]).to.equal(
        nls.localize('force_source_diff_components_not_in_org')
      );
    });

    it('Should diff one file', async () => {
      const metadataCache: MetadataContext = { baseDirectory: '.', commonRoot: '.', components: [] };
      const cacheResult: MetadataCacheResult = { selectedIsDirectory: false, selectedPath: '.', cache: metadataCache, project: metadataCache };
      await conflictCommands.handleCacheResults('username', cacheResult);
      expect(diffOneFileStub.calledOnce).to.be.true;
    });

    it('Should diff folder', async () => {
      const metadataCache: MetadataContext = { baseDirectory: '.', commonRoot: '.', components: [] };
      const cacheResult: MetadataCacheResult = { selectedIsDirectory: true, selectedPath: '.', cache: metadataCache, project: metadataCache };
      await conflictCommands.handleCacheResults('username', cacheResult);
      expect(diffFolderStub.calledOnce).to.be.true;
    });
  });
});
