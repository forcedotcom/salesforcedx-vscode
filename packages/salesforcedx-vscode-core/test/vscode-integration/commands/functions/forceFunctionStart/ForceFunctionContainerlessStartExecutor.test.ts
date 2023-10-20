/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as proxyquire from 'proxyquire';
import { assert, createSandbox, SinonSandbox, SinonStub, stub } from 'sinon';
import { vscodeStub } from '../../../mocks';

const proxyquireStrict = proxyquire.noCallThru();

describe('ForceFunctionContainerlessStartExecutor unit tests', () => {
  let sandbox: SinonSandbox;

  before(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  const FUNCTION_DEFAULT_DEBUG_PORT = 1111;
  const FUNCTION_DEFAULT_PORT = 2222;
  const OUTPUT_CHANNEL = 'afakechannel';
  const START_KEY = 'startKey';
  const LOG_NAME = 'logName';

  // mapping to class names here so need to have vars that start with a capital letter
  // tslint:disable-next-line:variable-name
  let ForceFunctionStartExecutor: any;
  // tslint:disable-next-line:variable-name
  let ForceFunctionContainerlessStartExecutor: any;
  // tslint:disable-next-line:variable-name
  let ContinueResponse: any;
  let appendLineStub: SinonStub;
  let showChannelOutputStub: SinonStub;
  let localizeStub: SinonStub;
  let showErrorMessageStub: SinonStub;
  let sendExceptionStub: SinonStub;
  let updateFunctionStub: SinonStub;
  let showInformationMessageStub: SinonStub;
  let showWarningMessageStub: SinonStub;
  let getProjectDescriptorStub: SinonStub;
  let joinStub: SinonStub;
  let getDefaultUsernameOrAliasStub: SinonStub;
  let getFunctionDirStub: SinonStub;
  let registerStartedFunctionStub: SinonStub;
  let getFunctionTypeStub: SinonStub;
  let getFunctionLanguageStub: SinonStub;
  let addPropertyStub: SinonStub;
  let localRunConstructorStub: SinonStub;
  let channelServiceStubs: any;
  let nlsStubs: any;
  let notificationServiceStubs: any;
  let telemetryServiceStubs: any;
  let constantsStubs: Record<string, any>;

  beforeEach(() => {
    appendLineStub = stub();
    showChannelOutputStub = stub();
    localizeStub = stub();
    showErrorMessageStub = stub();
    sendExceptionStub = stub();
    updateFunctionStub = stub();
    showInformationMessageStub = stub();
    showWarningMessageStub = stub();
    getProjectDescriptorStub = stub();
    joinStub = stub();
    getDefaultUsernameOrAliasStub = stub();
    getFunctionDirStub = stub();
    registerStartedFunctionStub = stub();
    getFunctionTypeStub = stub();
    getFunctionLanguageStub = stub();
    addPropertyStub = stub();
    localRunConstructorStub = stub();

    class FunctionService {
      public static instance = {
        updateFunction: updateFunctionStub,
        registerStartedFunction: registerStartedFunctionStub,
        getFunctionLanguage: getFunctionLanguageStub,
        getFunctionType: getFunctionTypeStub
      };

      public static getFunctionDir(...args: any) {
        return getFunctionDirStub(...args);
      }
    }

    enum functionType {
      JAVA = 'java'
    }

    class LibraryCommandletExecutor {
      public telemetry = {
        addProperty: addPropertyStub
      };
    }

    class LocalRun {
      constructor(...args: any) {
        return localRunConstructorStub(...args);
      }
    }

    channelServiceStubs = {
      channelService: {
        appendLine: appendLineStub,
        showChannelOutput: showChannelOutputStub,
        OUTPUT_CHANNEL
      }
    };

    nlsStubs = {
      nls: {
        localize: localizeStub
      }
    };

    notificationServiceStubs = {
      notificationService: {
        showErrorMessage: showErrorMessageStub,
        showInformationMessage: showInformationMessageStub,
        showWarningMessage: showWarningMessageStub
      }
    };

    telemetryServiceStubs = {
      telemetryService: {
        sendException: sendExceptionStub
      }
    };

    constantsStubs = {
      FUNCTION_DEFAULT_DEBUG_PORT,
      FUNCTION_DEFAULT_PORT
    };

    ({ ContinueResponse } = proxyquireStrict(
      '@salesforce/salesforcedx-utils-vscode',
      {
        vscode: vscodeStub
      }
    ));

    ({ ForceFunctionStartExecutor } = proxyquireStrict(
      '../../../../../src/commands/functions/forceFunctionStart/ForceFunctionStartExecutor',
      {
        '@heroku/functions-core': {
          getProjectDescriptor: getProjectDescriptorStub
        },
        '@salesforce/salesforcedx-utils-vscode': {
          LibraryCommandletExecutor,
          ContinueResponse: {
            ContinueResponse
          }
        },
        vscode: vscodeStub,
        path: {
          join: joinStub
        },
        '../../../channels': channelServiceStubs,
        '../../../messages': nlsStubs,
        '../../../notifications': notificationServiceStubs,
        '../../../telemetry': telemetryServiceStubs,
        '../../../util': {
          OrgAuthInfo: {
            getDefaultUsernameOrAlias: getDefaultUsernameOrAliasStub
          }
        },
        '../functionService': {
          FunctionService,
          functionType
        },
        '../types/constants': constantsStubs
      }
    ));

    ({ ForceFunctionContainerlessStartExecutor } = proxyquireStrict(
      '../../../../../src/commands/functions/forceFunctionStart/ForceFunctionContainerlessStartExecutor',
      {
        '@heroku/functions-core': {
          LocalRun
        },
        vscode: vscodeStub,
        '../../../channels': channelServiceStubs,
        '../../../messages': nlsStubs,
        '../../../notifications': notificationServiceStubs,
        '../../../telemetry': telemetryServiceStubs,
        '../functionService': {
          FunctionService,
          functionType
        },
        '../types/constants': constantsStubs,
        './ForceFunctionStartExecutor': { ForceFunctionStartExecutor }
      }
    ));
  });

  it('Should be able to create an instance.', () => {
    const executor = new ForceFunctionContainerlessStartExecutor(
      START_KEY,
      LOG_NAME
    );
    expect(executor).to.not.equal(undefined);
  });

  it('Should be able to start a local function.', async () => {
    const fakeType = 'typescript';
    getFunctionTypeStub.returns(fakeType);
    const fakeLocalRunInst = {
      exec: stub().resolves()
    };
    localRunConstructorStub.returns(fakeLocalRunInst);
    const executor = new ForceFunctionContainerlessStartExecutor(
      START_KEY,
      LOG_NAME
    );

    const functionName = 'funName';
    const functionDirPath = 'funDirPath';
    const result = await executor.startFunction(functionName, functionDirPath);
    expect(result).to.equal(undefined);
    assert.calledOnce(getFunctionTypeStub);
    assert.calledOnce(appendLineStub);
    assert.calledWith(localRunConstructorStub, fakeType, {
      path: functionDirPath,
      port: FUNCTION_DEFAULT_PORT,
      debugPort: FUNCTION_DEFAULT_DEBUG_PORT
    });
    assert.calledWith(updateFunctionStub, functionDirPath, 'node');
    assert.calledOnce(fakeLocalRunInst.exec);
  });

  it('Should be able to cancel running function.', async () => {
    const fakeProcess = { cancel: stub().resolves() };
    const fakeLocalRunInst = {
      exec: stub().resolves(fakeProcess)
    };
    const disposable = {
      dispose: stub()
    };
    const executor = new ForceFunctionContainerlessStartExecutor(
      START_KEY,
      LOG_NAME
    );
    localRunConstructorStub.returns(fakeLocalRunInst);

    // Sets the local process
    await executor.startFunction('foo', 'bar');

    // have to wait for the unawaited promise in exec().then() to resolve
    await Promise.resolve();

    await executor.cancelFunction(disposable);
    assert.calledOnce(fakeProcess.cancel);
    assert.calledOnce(disposable.dispose);
  });

  it('Should call telemetry when localRun fails.', async () => {
    const fakeType = 'typescript';
    getFunctionTypeStub.returns(fakeType);
    const errMessage = 'oh noes. FAIL';
    const runError = new Error(errMessage);
    const fakeLocalRunInst = {
      exec: stub().rejects(runError)
    };
    localRunConstructorStub.returns(fakeLocalRunInst);
    const localizedMsg = 'better message';
    localizeStub.returns(localizedMsg);

    const executor = new ForceFunctionContainerlessStartExecutor(
      START_KEY,
      LOG_NAME
    );

    const functionName = 'funName';
    const functionDirPath = 'funDirPath';
    const result = await executor.startFunction(functionName, functionDirPath);
    expect(result).to.equal(undefined);
    // have to wait for the unawaited promise to resolve
    await Promise.resolve();
    assert.calledOnce(fakeLocalRunInst.exec);
    assert.calledWith(localizeStub, 'force_function_start_unexpected_error');
    assert.calledWith(showErrorMessageStub, localizedMsg);
    assert.calledThrice(appendLineStub);
    assert.calledWith(appendLineStub, localizedMsg);
    assert.calledWith(appendLineStub, errMessage);
    assert.calledOnce(showChannelOutputStub);
  });
});
