/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { vscodeStub } from '@salesforce/salesforcedx-utils-vscode/out/test/unit/commands/mocks';
import * as proxyquire from 'proxyquire';
import { assert, createSandbox, SinonSandbox, SinonStub, stub } from 'sinon';

const proxyquireStrict = proxyquire.noCallThru();

describe('Force Function Start Container Command Unit Tests.', () => {
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
    let forceFunctionContainerStartCommand: any;
    let FUNCTION_CONTAINER_LOG_NAME: string;
    let CONTAINER_START_TEXT_KEY: string;
    let filePathGathererConstructorStub: SinonStub;
    let sfdxWorkspaceCheckerConstructorStub: SinonStub;
    let forceFunctionContainerStartExecutorConstructorStub: SinonStub;

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

      forceFunctionContainerStartExecutorConstructorStub = stub();
      class ForceFunctionContainerStartExecutor {
        constructor(...args: any) {
          return forceFunctionContainerStartExecutorConstructorStub(...args);
        }
      }

      commandletRunStub = sandbox.stub(SfdxCommandlet.prototype, 'run');
      ({
        forceFunctionContainerStartCommand,
        CONTAINER_START_TEXT_KEY,
        FUNCTION_CONTAINER_LOG_NAME
      } = proxyquireStrict(
        '../../../../src/commands/functions/forceFunctionContainerStartCommand',
        {
          vscode: vscodeStub,
          '../util': {
            FilePathGatherer,
            SfdxCommandlet,
            SfdxWorkspaceChecker
          },
          './forceFunctionStart': {
            ForceFunctionContainerStartExecutor,
            validateStartFunctionsUri: validateStartFunctionsUriStub
          }
        }
      ));
    });

    it('Should be able to successful call the container start command.', async () => {
      validateStartFunctionsUriStub.returns(fakeUri);
      commandletRunStub.resolves();
      await forceFunctionContainerStartCommand(fakeUri);
      assert.calledOnce(sfdxWorkspaceCheckerConstructorStub);
      assert.calledWith(filePathGathererConstructorStub, fakeUri);
      assert.calledWith(
        forceFunctionContainerStartExecutorConstructorStub,
        CONTAINER_START_TEXT_KEY,
        FUNCTION_CONTAINER_LOG_NAME
      );
      assert.calledOnce(commandletRunStub);
    });

    it('Should exit early for invalid uri.', async () => {
      validateStartFunctionsUriStub.returns(undefined);
      await forceFunctionContainerStartCommand(fakeUri);
      assert.notCalled(commandletRunStub);
    });
  });
});
