/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as proxyquire from 'proxyquire';
import { assert, createSandbox, SinonSandbox, SinonStub, stub } from 'sinon';
import { vscodeStub } from '../../mocks';

const proxyquireStrict = proxyquire.noCallThru();

describe('Force Function Start Containerless Command Unit Tests.', () => {
  let sandbox: SinonSandbox;

  before(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  describe('Verify container start command.', () => {
    const fakeUri: any = 'what';
    let validateStartFunctionsUriStub: SinonStub;
    let commandletRunStub: SinonStub;
    let forceFunctionContainerlessStartCommand: any;
    let FUNCTION_CONTAINERLESS_LOG_NAME: string;
    let CONTAINERLESS_START_TEXT_KEY: string;
    let filePathGathererConstructorStub: SinonStub;
    let sfdxWorkspaceCheckerConstructorStub: SinonStub;
    let forceFunctionContainerlessStartExecutorConstructorStub: SinonStub;

    beforeEach(() => {
      validateStartFunctionsUriStub = stub();
      const constructorStub = stub();
      class SfdxCommandlet {
        constructor(...args: any) {
          return constructorStub(...args);
        }
        public run() {}
      }

      filePathGathererConstructorStub = stub();
      class FilePathGatherer {
        constructor(...args: any) {
          return filePathGathererConstructorStub(...args);
        }
      }

      sfdxWorkspaceCheckerConstructorStub = stub();
      class SfdxWorkspaceChecker {
        constructor(...args: any) {
          return sfdxWorkspaceCheckerConstructorStub(...args);
        }
      }

      forceFunctionContainerlessStartExecutorConstructorStub = stub();
      class ForceFunctionContainerlessStartExecutor {
        constructor(...args: any) {
          return forceFunctionContainerlessStartExecutorConstructorStub(
            ...args
          );
        }
      }

      commandletRunStub = sandbox.stub(SfdxCommandlet.prototype, 'run');
      ({
        forceFunctionContainerlessStartCommand,
        CONTAINERLESS_START_TEXT_KEY,
        FUNCTION_CONTAINERLESS_LOG_NAME
      } = proxyquireStrict(
        '../../../../src/commands/functions/forceFunctionContainerlessStartCommand',
        {
          vscode: vscodeStub,
          '../util': {
            FilePathGatherer,
            SfdxCommandlet,
            SfdxWorkspaceChecker
          },
          './forceFunctionStart': {
            ForceFunctionContainerlessStartExecutor,
            validateStartFunctionsUri: validateStartFunctionsUriStub
          }
        }
      ));
    });

    it('Should be able to successful call the containerless start command.', async () => {
      validateStartFunctionsUriStub.returns(fakeUri);
      commandletRunStub.resolves();
      await forceFunctionContainerlessStartCommand(fakeUri);
      assert.calledOnce(sfdxWorkspaceCheckerConstructorStub);
      assert.calledWith(filePathGathererConstructorStub, fakeUri);
      assert.calledWith(
        forceFunctionContainerlessStartExecutorConstructorStub,
        CONTAINERLESS_START_TEXT_KEY,
        FUNCTION_CONTAINERLESS_LOG_NAME
      );
      assert.calledOnce(commandletRunStub);
    });

    it('Should exit early for invalid uri.', async () => {
      validateStartFunctionsUriStub.returns(undefined);
      await forceFunctionContainerlessStartCommand(fakeUri);
      assert.notCalled(commandletRunStub);
    });
  });
});
