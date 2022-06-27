/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as helpers from '@salesforce/salesforcedx-utils-vscode/out/src/helpers';
import { SourceComponent } from '@salesforce/source-deploy-retrieve';
import { expect } from 'chai';
import * as path from 'path';
import { assert, createSandbox, match, SinonSpy, SinonStub, stub } from 'sinon';
import * as vscode from 'vscode';
import { commands, Uri } from 'vscode';
import { channelService } from '../../../src/channels';
import { forceSourceDiff } from '../../../src/commands';
import * as conflictCommands from '../../../src/commands';
import {
  FilePathGatherer,
  SfdxWorkspaceChecker
} from '../../../src/commands/util';
import * as differ from '../../../src/conflict/directoryDiffer';
import {
  MetadataCacheResult,
  MetadataCacheService,
  MetadataContext,
  PathType
} from '../../../src/conflict/metadataCacheService';
import { workspaceContext } from '../../../src/context';
import { nls } from '../../../src/messages';
import { notificationService } from '../../../src/notifications';
import { telemetryService } from '../../../src/telemetry';

const sb = createSandbox();

describe('Force Source Diff', () => {
  describe('Force Source File Diff', () => {
    const mockAlias = 'vscodeOrg';
    const mockUsername = 'admin@ut-sandbox.org';
    const mockFilePath = path.join(
      '/projects/trailheadapps/lwc-recipes/force-app/main/default/classes/mockFile.cls'
    );
    let vscodeExecuteCommandStub: SinonStub;
    let workspaceContextAliasStub: SinonStub;
    let workspaceContextUsernameStub: SinonStub;
    let workspaceCheckerStub: SinonStub;
    let filePathGathererStub: SinonStub;
    let componentStub: sinon.SinonStub;
    let operationStub: sinon.SinonStub;
    let processStub: sinon.SinonStub;
    let notificationStub: SinonStub;
    let channelAppendLineStub: SinonStub;
    let channelShowChannelOutputStub: SinonStub;
    let mockComponentWalkContentStub: SinonStub;
    let telemetryServiceSendExceptionStub: SinonStub;

    beforeEach(() => {
      workspaceContextUsernameStub = sb
        .stub(workspaceContext, 'username')
        .get(() => {
          return mockUsername;
        });
      workspaceContextAliasStub = sb
        .stub(workspaceContext, 'alias')
        .get(() => {
          return mockAlias;
        });
      workspaceCheckerStub = sb.stub(
        SfdxWorkspaceChecker.prototype,
        'check'
      );
      workspaceCheckerStub.returns(true);
      filePathGathererStub = sb.stub(FilePathGatherer.prototype, 'gather');
      filePathGathererStub.returns({ type: 'CONTINUE', data: mockFilePath });
      operationStub = sb.stub(
        MetadataCacheService.prototype,
        'createRetrieveOperation'
      );
      componentStub = sb.stub(
        MetadataCacheService.prototype,
        'getSourceComponents'
      );
      processStub = sb.stub(
        MetadataCacheService.prototype,
        'processResults'
      );
      mockComponentWalkContentStub = sb.stub(
        SourceComponent.prototype,
        'walkContent'
      );
      notificationStub = sb.stub(notificationService, 'showErrorMessage');
      channelAppendLineStub = sb.stub(channelService, 'appendLine');
      channelShowChannelOutputStub = sb.stub(
        channelService,
        'showChannelOutput'
      );
      telemetryServiceSendExceptionStub = sb.stub(
        telemetryService,
        'sendException'
      );
      vscodeExecuteCommandStub = sb.stub(commands, 'executeCommand');
    });

    afterEach(() => {
      sb.restore();
    });

    it('Should execute VS Code diff command', async () => {
      const mockSourceComponent = new SourceComponent({
        name: 'mockFile',
        type: {
          id: 'ApexClass',
          name: 'ApexClass'
        }
      });
      const mockResult: MetadataCacheResult = {
        selectedType: PathType.Individual,
        selectedPath: mockFilePath,
        cache: {
          baseDirectory: path.join(`/tmp/.sfdx/diff/${mockUsername}/`),
          commonRoot: path.join('metadataPackage_100/main/default/classes'),
          components: [mockSourceComponent]
        },
        project: {
          baseDirectory: path.join('/projects/trailheadapps/lwc-recipes'),
          commonRoot: path.join('force-app/main/default/classes'),
          components: []
        },
        properties: []
      };
      const remoteFsPath = path.join(
        mockResult.cache.baseDirectory,
        mockResult.cache.commonRoot,
        'mockFile.cls'
      );
      const localFsPath = mockFilePath;
      mockComponentWalkContentStub.returns([remoteFsPath]);
      processStub.returns(mockResult);

      sb.stub(helpers, 'flushFilePath')
        .returns(mockFilePath);

      await forceSourceDiff(Uri.file(mockFilePath));

      assert.calledOnce(vscodeExecuteCommandStub);
      assert.calledWith(
        vscodeExecuteCommandStub,
        'vscode.diff',
        match.has('fsPath', remoteFsPath),
        match.has('fsPath', localFsPath),
        nls.localize(
          'force_source_diff_title',
          mockUsername,
          'mockFile.cls',
          'mockFile.cls'
        )
      );
    });

    it('Should show message when diffing on unsupported file type', async () => {
      const mockActiveTextEditor = {
        document: {
          uri: Uri.file(mockFilePath),
          languageId: 'forcesourcemanifest'
        }
      };
      sb.stub(vscode.window, 'activeTextEditor').get(() => {
        return mockActiveTextEditor;
      });

      await forceSourceDiff();

      assert.calledOnce(telemetryServiceSendExceptionStub);
      assert.calledWith(
        telemetryServiceSendExceptionStub,
        'unsupported_type_on_diff',
        nls.localize('force_source_diff_unsupported_type')
      );
      assert.calledOnce(notificationStub);
      assert.calledWith(
        notificationStub,
        nls.localize('force_source_diff_unsupported_type')
      );
      assert.calledOnce(channelAppendLineStub);
      assert.calledWith(
        channelAppendLineStub,
        nls.localize('force_source_diff_unsupported_type')
      );
      assert.calledOnce(channelShowChannelOutputStub);
    });
  });

  describe('Force Source Folder Diff', () => {
    let notificationStub: SinonStub;
    let diffOneFileStub: SinonSpy;
    let diffFolderStub: SinonSpy;

    beforeEach(() => {
      notificationStub = stub(notificationService, 'showErrorMessage');
      diffOneFileStub = stub(differ, 'diffOneFile');
      diffFolderStub = stub(differ, 'diffFolder');
    });

    afterEach(() => {
      notificationStub.restore();
      diffOneFileStub.restore();
      diffFolderStub.restore();
    });

    it('Should throw error for empty cache', async () => {
      let expectedError = null;
      try {
        await conflictCommands.handleCacheResults('username', undefined);
      } catch (error) {
        expectedError = error;
      }
      expect(expectedError.message).to.equal(
        nls.localize('force_source_diff_components_not_in_org')
      );
      assert.calledOnce(notificationStub);
      assert.calledWith(
        notificationStub,
        nls.localize('force_source_diff_components_not_in_org')
      );
    });

    it('Should diff one file', async () => {
      const metadataCache: MetadataContext = {
        baseDirectory: '.',
        commonRoot: '.',
        components: []
      };
      const cacheResult: MetadataCacheResult = {
        selectedType: PathType.Individual,
        selectedPath: '.',
        cache: metadataCache,
        project: metadataCache,
        properties: []
      };
      await conflictCommands.handleCacheResults('username', cacheResult);
      assert.calledOnce(diffOneFileStub);
    });

    it('Should diff folder', async () => {
      const metadataCache: MetadataContext = {
        baseDirectory: '.',
        commonRoot: '.',
        components: []
      };
      const cacheResult: MetadataCacheResult = {
        selectedType: PathType.Folder,
        selectedPath: '.',
        cache: metadataCache,
        project: metadataCache,
        properties: []
      };
      await conflictCommands.handleCacheResults('username', cacheResult);
      assert.calledOnce(diffFolderStub);
    });
  });
});
