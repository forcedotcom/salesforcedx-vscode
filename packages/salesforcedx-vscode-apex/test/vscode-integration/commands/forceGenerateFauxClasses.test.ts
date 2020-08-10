/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/* tslint:disable:no-unused-expression */
import {
  SFDX_DIR,
  SOBJECTS_DIR,
  TOOLS_DIR
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src';
import { SObjectCategory } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/describe';
import {
  FauxClassGenerator,
  SObjectRefreshSource
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/generator';
import { ContinueResponse } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { ProgressLocation } from 'vscode';
import {
  checkSObjectsAndRefresh,
  ForceGenerateFauxClassesExecutor,
  RefreshSelection,
  SObjectRefreshGatherer,
  verifyUsernameAndInitSObjectDefinitions
} from '../../../src/commands/forceGenerateFauxClasses';
import * as forceGenerateFauxClasses from '../../../src/commands/forceGenerateFauxClasses';
import { nls } from '../../../src/messages';
import { telemetryService } from '../../../src/telemetry';

const sfdxCoreExports = vscode.extensions.getExtension(
  'salesforce.salesforcedx-vscode-core'
)!.exports;
const { OrgAuthInfo, ProgressNotification, SfdxCommandlet, notificationService } = sfdxCoreExports;

describe('ForceGenerateFauxClasses', () => {
  describe('initSObjectDefinitions', () => {
    let existsSyncStub: sinon.SinonStub;
    let getUsernameStub: sinon.SinonStub;
    let commandletSpy: sinon.SinonSpy;
    let notificationStub: sinon.SinonStub;

    const projectPath = path.join('sample', 'path');
    const sobjectsPath = path.join(
      projectPath,
      SFDX_DIR,
      TOOLS_DIR,
      SOBJECTS_DIR
    );

    beforeEach(() => {
      existsSyncStub = sinon.stub(fs, 'existsSync');
      getUsernameStub = sinon.stub(OrgAuthInfo, 'getDefaultUsernameOrAlias');
      commandletSpy = sinon.stub(SfdxCommandlet.prototype, 'run');
      notificationStub = sinon.stub(notificationService, 'showInformationMessage');
    });

    afterEach(() => {
      existsSyncStub.restore();
      getUsernameStub.restore();
      commandletSpy.restore();
      notificationStub.restore();
    });

    it('Should execute sobject refresh if no sobjects folder is present', async () => {
      existsSyncStub.returns(false);
      getUsernameStub.returns(new Map([['defaultusername', 'Sample']]));

      await verifyUsernameAndInitSObjectDefinitions(projectPath);

      expect(existsSyncStub.calledWith(sobjectsPath)).to.be.true;
      expect(commandletSpy.calledOnce).to.be.true;

      // validates the commandlet ran with the correct source
      expect(commandletSpy.thisValues[0].gatherer).to.eqls({
        source: SObjectRefreshSource.Startup
      });
    });

    it('Should not execute sobject refresh if sobjects folder is present', async () => {
      existsSyncStub.returns(true);
      getUsernameStub.returns('Sample');

      await verifyUsernameAndInitSObjectDefinitions(projectPath);

      expect(existsSyncStub.calledWith(sobjectsPath)).to.be.true;
      expect(commandletSpy.notCalled).to.be.true;
    });

    it('Should not execute sobject refresh if no default username set', async () => {
      existsSyncStub.returns(false);
      getUsernameStub.returns(undefined);

      await verifyUsernameAndInitSObjectDefinitions(projectPath);

      expect(commandletSpy.notCalled).to.be.true;
    });
  });

  describe('checkSObjectsAndRefresh', () => {
    let existsSyncStub: sinon.SinonStub;
    let notificationStub: sinon.SinonStub;
    let getUsernameStub: sinon.SinonStub;

    const projectPath = path.join('sample', 'path');
    const sobjectsPath = path.join(
      projectPath,
      SFDX_DIR,
      TOOLS_DIR,
      SOBJECTS_DIR
    );

    beforeEach(() => {
      existsSyncStub = sinon.stub(fs, 'existsSync');
      notificationStub = sinon.stub(notificationService, 'showInformationMessage');
      getUsernameStub = sinon.stub(OrgAuthInfo, 'getDefaultUsernameOrAlias');
    });

    afterEach(() => {
      existsSyncStub.restore();
      notificationStub.restore();
      getUsernameStub.restore();
    });

    it('Should call notification service when sobjects already exist', async () => {
      existsSyncStub.returns(false);
      notificationStub.returns('Run SFDX: Refresh SObject Definitions now');
      getUsernameStub.returns(new Map([['defaultusername', 'Sample']]));

      await checkSObjectsAndRefresh(projectPath);

      expect(existsSyncStub.calledWith(sobjectsPath)).to.be.true;
      expect(notificationStub.calledOnce).to.be.true;
    });

    it('Should not call notification service when sobjects already exist', async () => {
      existsSyncStub.returns(true);
      notificationStub.returns('Run SFDX: Refresh SObject Definitions now');
      getUsernameStub.returns(new Map([['defaultusername', 'Sample']]));

      await checkSObjectsAndRefresh(projectPath);

      expect(existsSyncStub.calledWith(sobjectsPath)).to.be.true;
      expect(notificationStub.notCalled).to.be.true;
    });

    it('Should not call notification service when username not set', async () => {
      notificationStub.returns('Run SFDX: Refresh SObject Definitions now');
      getUsernameStub.returns(undefined);

      await checkSObjectsAndRefresh(projectPath);

      expect(notificationStub.notCalled).to.be.true;
    });
  });

  describe('ForceGenerateFauxClassesExecutor', () => {
    let progressStub: sinon.SinonStub;
    let generatorStub: sinon.SinonStub;
    let logStub: sinon.SinonStub;
    let errorStub: sinon.SinonStub;

    const expectedData: any = {
      cancelled: false,
      standardObjects: 1,
      customObjects: 2
    };

    beforeEach(() => {
      progressStub = sinon.stub(ProgressNotification, 'show');
      generatorStub = sinon
        .stub(FauxClassGenerator.prototype, 'generate')
        .returns({ data: expectedData });
      logStub = sinon.stub(
        ForceGenerateFauxClassesExecutor.prototype,
        'logMetric'
      );
      errorStub = sinon.stub(telemetryService, 'sendErrorEvent');
    });

    afterEach(() => {
      progressStub.restore();
      generatorStub.restore();
      logStub.restore();
      errorStub.restore();
    });

    it('Should pass response data to generator', async () => {
      await doExecute(SObjectRefreshSource.Startup, SObjectCategory.CUSTOM);
      expect(generatorStub.firstCall.args.slice(1)).to.eql([
        SObjectCategory.CUSTOM,
        SObjectRefreshSource.Startup
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

    it('Should log correct information to telemetry', async () => {
      // Success
      await doExecute(SObjectRefreshSource.Startup);
      expect(logStub.getCall(0).args[2]).to.eqls(expectedData);

      // Error
      const error = { message: 'sample error', stack: 'sample stack' };
      generatorStub.throws({ data: expectedData, error });
      await doExecute(SObjectRefreshSource.Startup);
      expect(errorStub.calledWith(error, expectedData));
    });

    async function doExecute(
      source: SObjectRefreshSource,
      category?: SObjectCategory
    ) {
      const executor = new ForceGenerateFauxClassesExecutor();
      await executor.execute({
        type: 'CONTINUE',
        data: { category: category || SObjectCategory.ALL, source }
      });
    }
  });

  describe('SObjectRefreshGatherer', () => {
    let gatherer: SObjectRefreshGatherer;
    let quickPickStub: sinon.SinonStub;

    beforeEach(() => {
      gatherer = new SObjectRefreshGatherer();
      quickPickStub = sinon.stub(vscode.window, 'showQuickPick');
      quickPickStub.returns(nls.localize('sobject_refresh_all'));
    });

    afterEach(() => quickPickStub.restore());

    it('Should return All sObjects', async () => {
      quickPickStub.returns(nls.localize('sobject_refresh_all'));
      const response = (await gatherer.gather()) as ContinueResponse<
        RefreshSelection
      >;
      expect(response.data.category).to.equal(SObjectCategory.ALL);
    });

    it('Should return Custom sObjects', async () => {
      quickPickStub.returns(nls.localize('sobject_refresh_custom'));
      const response = (await gatherer.gather()) as ContinueResponse<
        RefreshSelection
      >;
      expect(response.data.category).to.equal(SObjectCategory.CUSTOM);
    });

    it('Should return Standard sObjects', async () => {
      quickPickStub.returns(nls.localize('sobject_refresh_standard'));
      const response = (await gatherer.gather()) as ContinueResponse<
        RefreshSelection
      >;
      expect(response.data.category).to.equal(SObjectCategory.STANDARD);
    });

    it('Should return given source', async () => {
      gatherer = new SObjectRefreshGatherer(SObjectRefreshSource.Startup);
      const response = (await gatherer.gather()) as ContinueResponse<
        RefreshSelection
      >;
      expect(response.data.source).to.equal(SObjectRefreshSource.Startup);
    });

    it('Should return Manual source if none given', async () => {
      const response = (await gatherer.gather()) as ContinueResponse<
        RefreshSelection
      >;
      expect(response.data.source).to.equal(SObjectRefreshSource.Manual);
    });
  });
});
