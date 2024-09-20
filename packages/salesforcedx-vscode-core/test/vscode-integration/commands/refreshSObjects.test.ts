/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* tslint:disable:no-unused-expression */
import {
  SOBJECTS_DIR,
  SObjectTransformer,
  SObjectTransformerFactory,
  STANDARDOBJECTS_DIR
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src';
import {
  SObjectCategory,
  SObjectRefreshSource
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/types';
import {
  ContinueResponse,
  notificationService,
  ProgressNotification,
  projectPaths,
  SfCommandlet
} from '@salesforce/salesforcedx-utils-vscode';
import { fail } from 'assert';
import { expect } from 'chai';
import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { ProgressLocation, window } from 'vscode';
import {
  RefreshSObjectsExecutor,
  RefreshSelection,
  SObjectRefreshGatherer,
  initSObjectDefinitions
} from '../../../src/commands/refreshSObjects';
import { nls } from '../../../src/messages';
import { telemetryService } from '../../../src/telemetry';

describe('GenerateFauxClasses', () => {
  const sobjectsPath = path.join(projectPaths.toolsFolder(), SOBJECTS_DIR);
  const standardSobjectsPath = path.join(sobjectsPath, STANDARDOBJECTS_DIR);
  describe('initSObjectDefinitions', () => {
    let sandboxStub: SinonSandbox;
    let existsSyncStub: SinonStub;
    let commandletSpy: SinonStub;
    let notificationStub: SinonStub;
    let telemetryEventStub: SinonStub;

    const projectPath = path.join('sample', 'path');

    beforeEach(() => {
      sandboxStub = createSandbox();
      existsSyncStub = sandboxStub.stub(fs, 'existsSync');
      commandletSpy = sandboxStub.stub(SfCommandlet.prototype, 'run');
      telemetryEventStub = sandboxStub.stub(telemetryService, 'sendEventData');
      notificationStub = sandboxStub.stub(
        notificationService,
        'showInformationMessage'
      );
    });

    afterEach(() => {
      sandboxStub.restore();
    });

    it('Should execute sobject refresh if no sobjects folder is present', async () => {
      existsSyncStub.returns(false);

      await initSObjectDefinitions(projectPath, true);

      expect(existsSyncStub.calledWith(sobjectsPath)).to.be.true;
      expect(commandletSpy.calledOnce).to.be.true;

      // validates the commandlet ran with the correct source
      expect(commandletSpy.thisValues[0].gatherer).to.eqls({
        source: SObjectRefreshSource.Startup
      });
    });

    it('Should not execute sobject refresh if sobjects folder is present', async () => {
      existsSyncStub.returns(true);

      await initSObjectDefinitions(projectPath, true);

      expect(existsSyncStub.calledWith(sobjectsPath)).to.be.true;
      expect(commandletSpy.notCalled).to.be.true;
    });
    it('Should call refreshSObjects service when sobjects do not exist', async () => {
      existsSyncStub.returns(false);

      await initSObjectDefinitions(projectPath, false);

      expect(existsSyncStub.calledWith(standardSobjectsPath)).to.be.true;
      expect(telemetryEventStub.callCount).to.equal(1);
      const telemetryCallArgs = telemetryEventStub.getCall(0).args;
      expect(telemetryCallArgs[0]).to.equal('sObjectRefreshNotification');
      expect(telemetryCallArgs[1]).to.deep.equal({
        type: SObjectRefreshSource.StartupMin
      });
      expect(telemetryCallArgs[2]).to.equal(undefined);
    });
    it('Should not call refreshSObjects service when sobjects already exist', async () => {
      existsSyncStub.returns(true);

      await initSObjectDefinitions(projectPath, false);

      expect(existsSyncStub.calledWith(standardSobjectsPath)).to.be.true;
      expect(telemetryEventStub.notCalled).to.be.true;
    });
  });

  describe('GenerateFauxClassesExecutor', () => {
    let sandboxStub: SinonSandbox;
    let progressStub: SinonStub;
    let factoryStub: SinonStub;
    let transformerStub: SinonStub;
    let logStub: SinonStub;
    let errorStub: SinonStub;
    let transformer: SObjectTransformer;
    let notificationStub: SinonStub;

    const expectedData = {
      cancelled: false,
      standardObjects: 1,
      customObjects: 2
    };

    beforeEach(() => {
      sandboxStub = createSandbox();
      progressStub = sandboxStub.stub(ProgressNotification, 'show');
      transformer = new SObjectTransformer(new EventEmitter(), [], []);
      transformerStub = sandboxStub
        .stub(transformer, 'transform')
        .callsFake(() => {
          return Promise.resolve({ data: expectedData });
        });
      factoryStub = sandboxStub
        .stub(SObjectTransformerFactory, 'create')
        .callsFake(() => {
          return Promise.resolve(transformer);
        });
      logStub = sandboxStub.stub(
        RefreshSObjectsExecutor.prototype,
        'logMetric'
      );
      errorStub = sandboxStub.stub(telemetryService, 'sendException');
      notificationStub = sandboxStub.stub(
        notificationService,
        'reportCommandExecutionStatus'
      );
    });

    afterEach(() => {
      sandboxStub.restore();
      notificationStub.restore();
    });

    it('Should pass response data to transformer', async () => {
      await doExecute(SObjectRefreshSource.Startup, SObjectCategory.CUSTOM);
      expect(factoryStub.firstCall.args.slice(2)).to.eql([
        SObjectCategory.CUSTOM,
        SObjectRefreshSource.Startup
      ]);
    });

    it('Should pass minimal response data to transformer', async () => {
      await doExecute(SObjectRefreshSource.StartupMin, SObjectCategory.CUSTOM);
      expect(factoryStub.firstCall.args.slice(2)).to.eql([
        SObjectCategory.STANDARD,
        SObjectRefreshSource.StartupMin
      ]);
    });

    it('Should show progress on the status bar for non-manual refresh source', async () => {
      await doExecute(SObjectRefreshSource.Startup);
      expect(progressStub.getCall(0).args[2]).to.eq(ProgressLocation.Window);
    });

    it('Should show progress as notification for manual refresh source', async () => {
      await doExecute(SObjectRefreshSource.Manual);
      expect(progressStub.getCall(0).args[2]).to.eq(
        ProgressLocation.Notification
      );
    });

    it('Should report command execution status for Startup Refresh', async () => {
      await doExecute(SObjectRefreshSource.Startup, SObjectCategory.STANDARD);
      expect(notificationStub.calledOnce).to.be.true;
    });

    it('Should report command execution status for Manual Refresh', async () => {
      await doExecute(SObjectRefreshSource.Manual, SObjectCategory.STANDARD);
      expect(notificationStub.calledOnce).to.be.true;
    });

    it('Should not report command execution status for Startup Min Refresh', async () => {
      await doExecute(
        SObjectRefreshSource.StartupMin,
        SObjectCategory.STANDARD
      );
      expect(notificationStub.notCalled).to.be.true;
    });

    it('Should log correct information to telemetry on success.', async () => {
      // Success
      transformerStub.returns({ data: expectedData });
      await doExecute(SObjectRefreshSource.Startup);
      expect(logStub.getCall(0).args[2]).to.deep.contain({
        cancelled: 'false'
      });
      expect(logStub.getCall(0).args[3]).to.deep.contain({
        standardObjects: expectedData.standardObjects,
        customObjects: expectedData.customObjects
      });
    });

    it('Should log correct information to telemetry on error.', async () => {
      // Error
      const error = new Error('sample error');
      error.name = 'aFakeError';
      transformerStub.throws({ data: expectedData, error });
      try {
        await doExecute(SObjectRefreshSource.Startup);
        fail('should have thown an error.');
      } catch (e) {
        expect(errorStub.calledWith(error.name, error.message));
        expect(e.error).to.equal(error);
      }
    });

    const doExecute = async (
      source: SObjectRefreshSource,
      category?: SObjectCategory
    ) => {
      const executor = new RefreshSObjectsExecutor();
      await executor.execute({
        type: 'CONTINUE',
        data: { category: category || SObjectCategory.ALL, source }
      });
    };
  });

  describe('SObjectRefreshGatherer', () => {
    let gatherer: SObjectRefreshGatherer;
    let sandboxStub: SinonSandbox;
    let quickPickStub: SinonStub;

    beforeEach(() => {
      sandboxStub = createSandbox();
      gatherer = new SObjectRefreshGatherer();
      quickPickStub = sandboxStub.stub(window, 'showQuickPick');
      quickPickStub.returns(nls.localize('sobject_refresh_all'));
    });

    afterEach(() => sandboxStub.restore());

    it('Should return All sObjects', async () => {
      quickPickStub.returns(nls.localize('sobject_refresh_all'));
      const response =
        (await gatherer.gather()) as ContinueResponse<RefreshSelection>;
      expect(response.data.category).to.equal(SObjectCategory.ALL);
    });

    it('Should return Custom sObjects', async () => {
      quickPickStub.returns(nls.localize('sobject_refresh_custom'));
      const response =
        (await gatherer.gather()) as ContinueResponse<RefreshSelection>;
      expect(response.data.category).to.equal(SObjectCategory.CUSTOM);
    });

    it('Should return Standard sObjects', async () => {
      quickPickStub.returns(nls.localize('sobject_refresh_standard'));
      const response =
        (await gatherer.gather()) as ContinueResponse<RefreshSelection>;
      expect(response.data.category).to.equal(SObjectCategory.STANDARD);
    });

    it('Should return given source', async () => {
      gatherer = new SObjectRefreshGatherer(SObjectRefreshSource.Startup);
      const response =
        (await gatherer.gather()) as ContinueResponse<RefreshSelection>;
      expect(response.data.source).to.equal(SObjectRefreshSource.Startup);
    });

    it('Should return Manual source if none given', async () => {
      const response =
        (await gatherer.gather()) as ContinueResponse<RefreshSelection>;
      expect(response.data.source).to.equal(SObjectRefreshSource.Manual);
    });
  });
});
