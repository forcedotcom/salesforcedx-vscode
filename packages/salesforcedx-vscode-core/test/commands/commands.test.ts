/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  CancelResponse,
  ContinueResponse,
  DirFileNameSelection,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import {
  CommandletExecutor,
  CompositeParametersGatherer,
  DemoModePromptGatherer,
  EmptyParametersGatherer,
  EmptyPostChecker,
  FilePathExistsChecker,
  LightningFilePathExistsChecker,
  SelectPrioritizedDirPath,
  SelectStrictDirPath,
  SfdxCommandlet
} from '../../src/commands/commands';
import { nls } from '../../src/messages';
import { notificationService } from '../../src/notifications';

// tslint:disable:no-unused-expression
describe('Command Utilities', () => {
  const WORKSPACE_NAME = 'sfdx-simple';
  const SFDX_SIMPLE_NUM_OF_DIRS = 15;
  describe('EmptyParametersGatherer', () => {
    it('Should always return continue with empty object as data', async () => {
      const gatherer = new EmptyParametersGatherer();
      const response = await gatherer.gather();
      expect(response.type).to.be.eql('CONTINUE');

      const continueResponse = response as ContinueResponse<{}>;
      expect(continueResponse.data).to.be.eql({});
    });
  });

  describe('SfdxCommandlet', () => {
    it('Should not proceed if checker fails', async () => {
      const commandlet = new SfdxCommandlet(
        new class {
          public check(): boolean {
            return false;
          }
        }(),
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            throw new Error('This should not be called');
          }
        }(),
        new class implements CommandletExecutor<{}> {
          public execute(response: ContinueResponse<{}>): void {
            throw new Error('This should not be called');
          }
        }()
      );

      await commandlet.run();
    });

    it('Should not call executor if gatherer is CANCEL', async () => {
      const commandlet = new SfdxCommandlet(
        new class {
          public check(): boolean {
            return true;
          }
        }(),
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            return { type: 'CANCEL' };
          }
        }(),
        new class implements CommandletExecutor<{}> {
          public execute(response: ContinueResponse<{}>): void {
            throw new Error('This should not be called');
          }
        }()
      );

      await commandlet.run();
    });

    it('Should call executor if gatherer is CONTINUE', async () => {
      let executed = false;
      const commandlet = new SfdxCommandlet(
        new class {
          public check(): boolean {
            return true;
          }
        }(),
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            return { type: 'CONTINUE', data: {} };
          }
        }(),
        new class implements CommandletExecutor<{}> {
          public execute(response: ContinueResponse<{}>): void {
            executed = true;
          }
        }()
      );

      await commandlet.run();

      expect(executed).to.be.true;
    });
  });

  describe('CompositeParametersGatherer', () => {
    it('Should proceed to next gatherer if previous gatherer in composite gatherer is CONTINUE', async () => {
      const compositeParameterGatherer = new CompositeParametersGatherer(
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            return { type: 'CONTINUE', data: {} };
          }
        }(),
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            return { type: 'CONTINUE', data: {} };
          }
        }()
      );

      const response = await compositeParameterGatherer.gather();
      expect(response.type).to.equal('CONTINUE');
    });

    it('Should not proceed to next gatherer if previous gatherer in composite gatherer is CANCEL', async () => {
      const compositeParameterGatherer = new CompositeParametersGatherer(
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            return { type: 'CANCEL' };
          }
        }(),
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            throw new Error('This should not be called');
          }
        }()
      );

      await compositeParameterGatherer.gather();
    });

    it('Should call executor if composite gatherer is CONTINUE', async () => {
      let executed = false;
      const commandlet = new SfdxCommandlet(
        new class {
          public check(): boolean {
            return true;
          }
        }(),
        new CompositeParametersGatherer(
          new class implements ParametersGatherer<{}> {
            public async gather(): Promise<
              CancelResponse | ContinueResponse<{}>
            > {
              return { type: 'CONTINUE', data: {} };
            }
          }()
        ),
        new class implements CommandletExecutor<{}> {
          public execute(response: ContinueResponse<{}>): void {
            executed = true;
          }
        }()
      );

      await commandlet.run();

      expect(executed).to.be.true;
    });

    it('Should not call executor if composite gatherer is CANCEL', async () => {
      const commandlet = new SfdxCommandlet(
        new class {
          public check(): boolean {
            return true;
          }
        }(),
        new CompositeParametersGatherer(
          new class implements ParametersGatherer<{}> {
            public async gather(): Promise<
              CancelResponse | ContinueResponse<{}>
            > {
              return { type: 'CANCEL' };
            }
          }()
        ),
        new class implements CommandletExecutor<{}> {
          public execute(response: ContinueResponse<{}>): void {
            throw new Error('This should not be called');
          }
        }()
      );

      await commandlet.run();
    });
  });

  describe('Glob Directories', () => {
    describe('SelectPrioritizedDirPath', () => {
      it('Should glob and return correct number of directories', async () => {
        const dirPathGatherer = new SelectPrioritizedDirPath();
        if (!vscode.workspace.rootPath) {
          throw new Error('Test workspace should be opened');
        }
        const dirList: string[] = dirPathGatherer.globDirs(
          vscode.workspace.rootPath
        );
        expect(dirList[0]).to.not.contain(WORKSPACE_NAME);
        expect(dirList.length).to.equal(SFDX_SIMPLE_NUM_OF_DIRS);
      });

      it('Should return list of relative paths with paths containing keyword prioritized to the top of list', async () => {
        const dirPathGatherer = new SelectPrioritizedDirPath();
        if (!vscode.workspace.rootPath) {
          throw new Error('Test workspace should be opened');
        }
        const dirList: string[] = dirPathGatherer.globDirs(
          vscode.workspace.rootPath,
          'classes'
        );
        expect(dirList[0]).to.equal(
          path.join('force-app', 'main', 'default', 'classes')
        );
        expect(dirList[1]).to.equal(
          path.join('force-app', 'test', 'default', 'classes')
        );
      });
    });

    describe('SelectStrictDirPath', () => {
      it('Should glob and return a list of dirs containing only the keyword', async () => {
        const strictDirPathGatherer = new SelectStrictDirPath();
        if (!vscode.workspace.rootPath) {
          throw new Error('Test workspace should be opened');
        }
        const dirList: string[] = strictDirPathGatherer.globDirs(
          vscode.workspace.rootPath,
          'aura'
        );
        dirList.forEach(value => {
          expect(value).to.contain('aura');
        });
      });
    });
  });

  describe('EmptyPostconditionChecker', () => {
    it('Should return CancelResponse if input passed in is CancelResponse', async () => {
      const postChecker = new EmptyPostChecker();
      const input: CancelResponse = { type: 'CANCEL' };
      const response = await postChecker.check(input);
      expect(response.type).to.equal('CANCEL');
    });

    it('Should return ContinueResponse unchanged if input passed in is ContinueResponse', async () => {
      const postChecker = new EmptyPostChecker();
      const input: ContinueResponse<string> = {
        type: 'CONTINUE',
        data: 'test'
      };
      const response = await postChecker.check(input);
      expect(response.type).to.equal('CONTINUE');
      if (response.type === 'CONTINUE') {
        expect(response.data).to.equal('test');
      } else {
        expect.fail('Response should be of type ContinueResponse');
      }
    });
  });

  describe('LightningFilePathExistsChecker', () => {
    let findFilesSpy: sinon.SinonSpy;
    let warningSpy: sinon.SinonSpy;

    afterEach(() => {
      findFilesSpy.reset();
      warningSpy.reset();
    });

    describe('Without notification warning', () => {
      before(() => {
        findFilesSpy = sinon.spy(vscode.workspace, 'findFiles');
        warningSpy = sinon.stub(notificationService, 'showWarningMessage');
      });

      after(() => {
        sinon.restore(vscode.workspace);
        sinon.restore(notificationService);
      });

      it('Should return CancelResponse if input passed in is CancelResponse', async () => {
        const postChecker = new LightningFilePathExistsChecker();
        const input: CancelResponse = { type: 'CANCEL' };
        const response = await postChecker.check(input);
        sinon.assert.notCalled(findFilesSpy);
        sinon.assert.notCalled(warningSpy);
        expect(response.type).to.equal('CANCEL');
      });

      it('Should return ContinueResponse if path specified does not have existing lightning files', async () => {
        const postChecker = new LightningFilePathExistsChecker();
        if (!vscode.workspace.rootPath) {
          throw new Error('Test workspace should be opened');
        }
        const input: ContinueResponse<DirFileNameSelection> = {
          type: 'CONTINUE',
          data: {
            fileName: 'test',
            outputdir: path.join('force-app', 'main', 'default', 'aura')
          }
        };
        const response = await postChecker.check(input);
        sinon.assert.calledOnce(findFilesSpy);
        sinon.assert.notCalled(warningSpy);
        expect(response.type).to.equal('CONTINUE');
        if (response.type === 'CONTINUE') {
          expect(response).to.equal(input);
        } else {
          throw new Error('Response should be of type ContinueResponse');
        }
      });
    });

    describe('With notification warning', () => {
      before(() => {
        findFilesSpy = sinon.spy(vscode.workspace, 'findFiles');
        warningSpy = sinon
          .stub(notificationService, 'showWarningMessage')
          .onFirstCall()
          .returns(nls.localize('warning_prompt_overwrite_confirm'))
          .onSecondCall()
          .returns(nls.localize('warning_prompt_overwrite_cancel'));
      });

      after(() => {
        sinon.restore(vscode.workspace);
        sinon.restore(notificationService);
      });

      it('Should return ContinueResponse if lightning files exist in specified path and user selects continue', async () => {
        const postChecker = new LightningFilePathExistsChecker();
        const input: ContinueResponse<DirFileNameSelection> = {
          type: 'CONTINUE',
          data: {
            fileName: 'DemoApp',
            outputdir: path.join('force-app', 'main', 'default', 'aura')
          }
        };
        const response = await postChecker.check(input);
        sinon.assert.calledOnce(findFilesSpy);
        sinon.assert.called(warningSpy);
        expect(response.type).to.equal('CONTINUE');
        if (response.type === 'CONTINUE') {
          expect(response).to.equal(input);
        } else {
          throw new Error('Response should be of type ContinueResponse');
        }
      });

      it('Should return CancelResponse if lightning files exist in specified path and user selects No/Cancel', async () => {
        const postChecker = new LightningFilePathExistsChecker();
        const input: ContinueResponse<DirFileNameSelection> = {
          type: 'CONTINUE',
          data: {
            fileName: 'DemoApp',
            outputdir: path.join('force-app', 'main', 'default', 'aura')
          }
        };
        const response = await postChecker.check(input);
        sinon.assert.calledOnce(findFilesSpy);
        sinon.assert.called(warningSpy);
        expect(response.type).to.equal('CANCEL');
      });
    });
  });

  describe('FilePathExistsChecker', () => {
    let findFilesSpy: sinon.SinonSpy;
    let warningSpy: sinon.SinonSpy;
    afterEach(() => {
      findFilesSpy.reset();
      warningSpy.reset();
    });

    describe('Without notification warning', () => {
      before(() => {
        findFilesSpy = sinon.spy(vscode.workspace, 'findFiles');
        warningSpy = sinon.stub(notificationService, 'showWarningMessage');
      });

      after(() => {
        sinon.restore(vscode.workspace);
        sinon.restore(notificationService);
      });

      it('Should return CancelResponse if input passed in is CancelResponse', async () => {
        const postChecker = new FilePathExistsChecker('.cls');
        const input: CancelResponse = { type: 'CANCEL' };
        const response = await postChecker.check(input);
        sinon.assert.notCalled(findFilesSpy);
        sinon.assert.notCalled(warningSpy);
        expect(response.type).to.equal('CANCEL');
      });

      it('Should return ContinueResponse if path specified does not have existing file with specified name', async () => {
        const postChecker = new FilePathExistsChecker('.cls');
        if (!vscode.workspace.rootPath) {
          throw new Error('Test workspace should be opened');
        }
        const input: ContinueResponse<DirFileNameSelection> = {
          type: 'CONTINUE',
          data: {
            fileName: 'test',
            outputdir: path.join('force-app', 'main', 'default', 'classes')
          }
        };
        const response = await postChecker.check(input);
        sinon.assert.calledOnce(findFilesSpy);
        sinon.assert.notCalled(warningSpy);
        expect(response.type).to.equal('CONTINUE');
        if (response.type === 'CONTINUE') {
          expect(response).to.equal(input);
        } else {
          throw new Error('Response should be of type ContinueResponse');
        }
      });
    });

    describe('With notification warning', () => {
      before(() => {
        findFilesSpy = sinon.spy(vscode.workspace, 'findFiles');
        warningSpy = sinon
          .stub(notificationService, 'showWarningMessage')
          .onFirstCall()
          .returns(nls.localize('warning_prompt_overwrite_confirm'))
          .onSecondCall()
          .returns(nls.localize('warning_prompt_overwrite_cancel'));
      });

      after(() => {
        sinon.restore(vscode.workspace);
        sinon.restore(notificationService);
      });

      it('Should return ContinueResponse if files exist in specified path and user selects continue', async () => {
        const postChecker = new FilePathExistsChecker('.cls');
        const input: ContinueResponse<DirFileNameSelection> = {
          type: 'CONTINUE',
          data: {
            fileName: 'DemoController',
            outputdir: path.join('force-app', 'main', 'default', 'classes')
          }
        };
        const response = await postChecker.check(input);
        sinon.assert.calledOnce(findFilesSpy);
        sinon.assert.called(warningSpy);
        expect(response.type).to.equal('CONTINUE');
        if (response.type === 'CONTINUE') {
          expect(response).to.equal(input);
        } else {
          throw new Error('Response should be of type ContinueResponse');
        }
      });

      it('Should return CancelResponse if files exist in specified path and user selects No/Cancel', async () => {
        const postChecker = new FilePathExistsChecker('.cls');
        const input: ContinueResponse<DirFileNameSelection> = {
          type: 'CONTINUE',
          data: {
            fileName: 'DemoController',
            outputdir: path.join('force-app', 'main', 'default', 'classes')
          }
        };
        const response = await postChecker.check(input);
        sinon.assert.calledOnce(findFilesSpy);
        sinon.assert.called(warningSpy);
        expect(response.type).to.equal('CANCEL');
      });
    });
  });

  // Due to the way the prompt is phrased
  // CONTINUE means that we will execute the forceLogoutAll command
  // CANCEL means that we will not execute the forceLogoutAll command
  describe('DemoModePrompGatherer', () => {
    let showInformationMessageStub: sinon.SinonStub;

    before(() => {
      showInformationMessageStub = sinon.stub(
        vscode.window,
        'showInformationMessage'
      );
    });

    after(() => {
      showInformationMessageStub.restore();
    });

    it('Should return CONTINUE if message is Cancel', async () => {
      showInformationMessageStub.onFirstCall().returns('Cancel');
      const gatherer = new DemoModePromptGatherer();
      const result = await gatherer.gather();
      expect(result.type).to.equal('CONTINUE');
      expect((result as ContinueResponse<{}>).data!).to.eql({});
    });
    it('Should return CANCEL if message is Authorize Org', async () => {
      showInformationMessageStub.onFirstCall().returns('Cancel');
      const gatherer = new DemoModePromptGatherer();
      const result = await gatherer.gather();
      expect(result.type).to.equal('CANCEL');
    });
  });
});
