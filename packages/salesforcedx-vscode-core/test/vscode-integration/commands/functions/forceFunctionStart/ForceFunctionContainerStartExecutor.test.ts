/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Benny } from '@heroku/functions-core';
import { vscodeStub } from '@salesforce/salesforcedx-utils-vscode/out/test/unit/commands/mocks';
import { fail } from 'assert';
import { expect } from 'chai';
import * as proxyquire from 'proxyquire';
import { assert, createSandbox, SinonSandbox, SinonStub, stub } from 'sinon';

const proxyquireStrict = proxyquire.noCallThru();

describe('ForceFunctionContainerStartExecutor unit tests', () => {
  let sandbox: SinonSandbox;

  before(() => {
    sandbox = createSandbox();
  });

  afterEach(() => {
    sandbox.restore();
  });

  const FUNCTION_RUNTIME_DETECTION_PATTERN = new RegExp(
    '.*heroku/(.*)-function-invoker.*'
  );
  const FUNCTION_DEFAULT_DEBUG_PORT = 1111;
  const FUNCTION_DEFAULT_PORT = 2222;
  const OUTPUT_CHANNEL = 'afakechannel';
  const START_KEY = 'startKey';
  const LOG_NAME = 'logName';

  // mapping to class names here so need to have vars that start with a capital letter
  // tslint:disable-next-line:variable-name
  let ForceFunctionStartExecutor: any;
  // tslint:disable-next-line:variable-name
  let ForceFunctionContainerStartExecutor: any;
  let BINARY_EVENT_ENUM: any;
  // tslint:disable-next-line:variable-name
  let ContinueResponse: any;
  let getFunctionsBinaryStub: SinonStub;
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
  let getFunctionLanguageStub: SinonStub;
  let addPropertyStub: SinonStub;
  let channelServiceStubs: any;
  let nlsStubs: any;
  let notificationServiceStubs: any;
  let telemetryServiceStubs: any;
  let constantsStubs: Record<string, any>;

  beforeEach(() => {
    getFunctionsBinaryStub = stub();
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
    getFunctionLanguageStub = stub();
    addPropertyStub = stub();

    class FunctionService {
      public static instance = {
        updateFunction: updateFunctionStub,
        registerStartedFunction: registerStartedFunctionStub,
        getFunctionLanguage: getFunctionLanguageStub
      };

      public static getFunctionDir(...args: any) {
        return getFunctionDirStub(...args);
      }
    }

    class LibraryCommandletExecutor {
      public telemetry = {
        addProperty: addPropertyStub
      };
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
      FUNCTION_RUNTIME_DETECTION_PATTERN,
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
          FunctionService
        },
        '../types/constants': constantsStubs
      }
    ));

    ({
      ForceFunctionContainerStartExecutor,
      BINARY_EVENT_ENUM
    } = proxyquireStrict(
      '../../../../../src/commands/functions/forceFunctionStart/ForceFunctionContainerStartExecutor',
      {
        '@heroku/functions-core': {
          Benny,
          getFunctionsBinary: getFunctionsBinaryStub
        },
        vscode: vscodeStub,
        '../../../channels': channelServiceStubs,
        '../../../messages': nlsStubs,
        '../../../notifications': notificationServiceStubs,
        '../../../telemetry': telemetryServiceStubs,
        '../functionService': {
          FunctionService
        },
        '../types/constants': constantsStubs,
        './ForceFunctionStartExecutor': { ForceFunctionStartExecutor }
      }
    ));
  });

  it('Should be able to create an instance.', () => {
    const executor = new ForceFunctionContainerStartExecutor(
      START_KEY,
      LOG_NAME
    );
    expect(executor).to.not.equal(undefined);
  });

  describe('setupFunctionListeners', () => {
    const fakeDirPath = '/a/b/c/d';
    let executor: any;
    let fakeBinary: { on: SinonStub };
    let fakeDisposible: { dispose: SinonStub };
    beforeEach(() => {
      fakeBinary = { on: stub() };
      getFunctionsBinaryStub.resolves(fakeBinary);
      fakeDisposible = { dispose: stub() };

      executor = new ForceFunctionContainerStartExecutor(START_KEY, LOG_NAME);
    });
    it('Should correctly attach listeners.', async () => {
      await executor.setupFunctionListeners(fakeDirPath, fakeDisposible);
      assert.callCount(fakeBinary.on, 4);
    });

    it('Should write message on pack event.', async () => {
      const testMessage = 'thisisatest';
      await executor.setupFunctionListeners(fakeDirPath, fakeDisposible);
      expect(fakeBinary.on.getCalls()[0].args[0]).to.equal(
        BINARY_EVENT_ENUM.PACK
      );
      fakeBinary.on
        .getCalls()[0]
        .args[1]({ text: testMessage, timestamp: '54321' });
      assert.calledWith(appendLineStub, testMessage);
      assert.notCalled(updateFunctionStub);
    });

    it('Should update function on matching message.', async () => {
      const testMessage = 'www.heroku/.yo-function-invoker.test';
      expect(
        testMessage.match(FUNCTION_RUNTIME_DETECTION_PATTERN)
      ).to.not.equal(undefined);
      await executor.setupFunctionListeners(fakeDirPath, fakeDisposible);
      expect(fakeBinary.on.getCalls()[0].args[0]).to.equal(
        BINARY_EVENT_ENUM.PACK
      );
      fakeBinary.on
        .getCalls()[0]
        .args[1]({ text: testMessage, timestamp: '54321' });
      assert.calledWith(appendLineStub, testMessage);
      assert.calledWith(updateFunctionStub, fakeDirPath, '.yo');
    });

    it('Should write message on container event.', async () => {
      const testMessage = 'thisisatest';
      await executor.setupFunctionListeners(fakeDirPath, fakeDisposible);
      expect(fakeBinary.on.getCalls()[1].args[0]).to.equal(
        BINARY_EVENT_ENUM.CONTAINER
      );
      fakeBinary.on
        .getCalls()[1]
        .args[1]({ text: testMessage, timestamp: '54321' });
      assert.calledWith(appendLineStub, testMessage);
      assert.notCalled(updateFunctionStub);
    });

    it('Should ignore log debug events.', async () => {
      const testMessage = 'thisisatest';
      await executor.setupFunctionListeners(fakeDirPath, fakeDisposible);
      expect(fakeBinary.on.getCalls()[2].args[0]).to.equal(
        BINARY_EVENT_ENUM.LOG
      );
      fakeBinary.on.getCalls()[2].args[1]({ level: 'debug' });
      // Error handler flow
      assert.notCalled(fakeDisposible.dispose);
      // write flow
      assert.notCalled(appendLineStub);
    });

    it('Should handle an error log event with unexpected message.', async () => {
      const testMessage = 'thisisatest';
      const fakeMessage = 'l0caliz3d';
      const exceptionKey = 'force_function_start_unexpected_error';
      localizeStub.returns(fakeMessage);
      await executor.setupFunctionListeners(fakeDirPath, fakeDisposible);
      expect(fakeBinary.on.getCalls()[2].args[0]).to.equal(
        BINARY_EVENT_ENUM.LOG
      );
      fakeBinary.on
        .getCalls()[2]
        .args[1]({ level: 'error', text: testMessage });

      assert.calledOnce(fakeDisposible.dispose);
      assert.calledWith(localizeStub, exceptionKey);
      assert.calledWith(sendExceptionStub, exceptionKey, fakeMessage);
      assert.calledWith(showErrorMessageStub, fakeMessage);
      assert.calledWith(appendLineStub, fakeMessage);
      assert.called(showChannelOutputStub);
    });

    it('Should handle an error log event with an expected message.', async () => {
      const testMessage = 'Cannot connect to the Docker daemon';
      const fakeMessage = 'l0caliz3d';
      localizeStub.returns(fakeMessage);
      await executor.setupFunctionListeners(fakeDirPath, fakeDisposible);
      expect(fakeBinary.on.getCalls()[2].args[0]).to.equal(
        BINARY_EVENT_ENUM.LOG
      );
      fakeBinary.on
        .getCalls()[2]
        .args[1]({ level: 'error', text: testMessage });

      assert.calledOnce(fakeDisposible.dispose);
      assert.calledTwice(localizeStub);
      assert.calledWith(
        sendExceptionStub,
        'force_function_start_docker_plugin_not_installed_or_started',
        fakeMessage
      );
      assert.calledWith(showErrorMessageStub, fakeMessage);
      assert.calledWith(appendLineStub, fakeMessage);
      assert.called(showChannelOutputStub);
    });

    it('Should handle an error event with an unexpected message.', async () => {
      const testMessage = 'system is busy';
      const fakeMessage = 'l0caliz3d';
      const exceptionKey = 'force_function_start_unexpected_error';
      localizeStub.returns(fakeMessage);
      await executor.setupFunctionListeners(fakeDirPath, fakeDisposible);
      expect(fakeBinary.on.getCalls()[3].args[0]).to.equal(
        BINARY_EVENT_ENUM.ERROR
      );
      fakeBinary.on
        .getCalls()[3]
        .args[1]({ level: 'error', text: testMessage });

      assert.calledOnce(fakeDisposible.dispose);
      assert.calledWith(localizeStub, exceptionKey);
      assert.calledWith(sendExceptionStub, exceptionKey, fakeMessage);
      assert.calledWith(showErrorMessageStub, fakeMessage);
      assert.calledWith(appendLineStub, fakeMessage);
      assert.called(showChannelOutputStub);
    });
  });

  describe('cancelFunction', () => {
    it('Should be able to cancel running function with no binary.', async () => {
      const disposable = {
        dispose: stub()
      };
      const fakeBinary = { cancel: stub() };
      getFunctionsBinaryStub.resolves(fakeBinary);

      const executor = new ForceFunctionContainerStartExecutor(
        START_KEY,
        LOG_NAME
      );
      await executor.cancelFunction(disposable);
      assert.notCalled(fakeBinary.cancel);
      assert.calledOnce(disposable.dispose);
    });
  });

  it('Should be able to cancel running function with a binary.', async () => {
    const disposable = {
      dispose: stub()
    };
    const fakeBinary = { cancel: stub(), on: stub() };
    getFunctionsBinaryStub.resolves(fakeBinary);

    const executor = new ForceFunctionContainerStartExecutor(
      START_KEY,
      LOG_NAME
    );
    // sets the functionsBinary
    await executor.setupFunctionListeners('/does/not/matter', {
      dispose: stub()
    });
    await executor.cancelFunction(disposable);
    assert.calledOnce(fakeBinary.cancel);
    assert.calledOnce(disposable.dispose);
  });

  describe('buildFunction', () => {
    const functionName = 'imaFunction';
    const functionDirPath = '/some/where/out/there';
    it('Should throw an error if no binary is found.', async () => {
      const executor = new ForceFunctionContainerStartExecutor(
        START_KEY,
        LOG_NAME
      );

      try {
        await executor.buildFunction(functionName, functionDirPath);
        fail('test should have failed due to no binary');
      } catch (e) {
        expect(e.message).contains(
          'Unable to find binary for building function.'
        );
      }
    });

    it('Should be able to build the function.', async () => {
      const fakeBinary = { build: stub(), on: stub() };
      getFunctionsBinaryStub.resolves(fakeBinary);

      const executor = new ForceFunctionContainerStartExecutor(
        START_KEY,
        LOG_NAME
      );
      // sets the functionsBinary
      await executor.setupFunctionListeners('/does/not/matter', {
        dispose: stub()
      });
      await executor.buildFunction(functionName, functionDirPath);
      assert.calledOnce(appendLineStub);
      assert.calledWith(fakeBinary.build, functionName, {
        verbose: true,
        path: functionDirPath
      });
    });
  });

  describe('startFunction', () => {
    const functionName = 'imaFunctionToo';
    const functionDirPath = '/neither/here/nor/there';
    it('Should throw an error if not binary is found.', async () => {
      const executor = new ForceFunctionContainerStartExecutor(
        START_KEY,
        LOG_NAME
      );

      try {
        await executor.startFunction(functionName, functionDirPath);
        fail('test should have failed to start due to no binary');
      } catch (e) {
        expect(e.message).contains('Unable to start function with no binary.');
      }
    });

    it('Should be able to start a function.', async () => {
      const fakeBinary = { run: stub(), on: stub() };
      fakeBinary.run.resolves();
      getFunctionsBinaryStub.resolves(fakeBinary);

      const executor = new ForceFunctionContainerStartExecutor(
        START_KEY,
        LOG_NAME
      );
      // sets the functionsBinary
      await executor.setupFunctionListeners('/does/not/matter', {
        dispose: stub()
      });
      await executor.startFunction(functionName, functionDirPath);
      assert.calledOnce(appendLineStub);
      assert.calledWith(fakeBinary.run, functionName, {});
    });
  });

  describe('ForceFunctionStartExecutor run.', () => {
    const fakeResponse = {
      data: '/ima/fake/path/for/real'
    };

    const runExecutor = async (getUsernameStub: SinonStub) => {
      const fakeDisposable = { dispose: stub() };
      const fakeLanguage = 'javascript';
      const fakeId = 'ImAFunctionNameAndId';
      getFunctionDirStub.returns(fakeResponse.data);
      registerStartedFunctionStub.returns(fakeDisposable);
      addPropertyStub.returns(undefined);
      getFunctionLanguageStub.returns(fakeLanguage);
      joinStub.returns('does.not.matter');
      getProjectDescriptorStub.resolves({
        com: { salesforce: { id: fakeId } }
      });

      const executor = new ForceFunctionContainerStartExecutor(
        START_KEY,
        LOG_NAME
      );
      const setupFunctionListenersStub = stub(
        executor,
        'setupFunctionListeners'
      );
      const buildFunctionStub = stub(executor, 'buildFunction');
      const startFunctionStub = stub(executor, 'startFunction');
      startFunctionStub.resolves();

      const result = await executor.run(fakeResponse);
      expect(result).to.equal(true);
      assert.calledWith(getUsernameStub, false);
      assert.called(registerStartedFunctionStub);
      const registerArg = registerStartedFunctionStub.getCall(0).args[0];
      expect(registerArg.rootDir).to.equal(fakeResponse.data);
      expect(registerArg.port).to.equal(FUNCTION_DEFAULT_PORT);
      expect(registerArg.debugPort).to.equal(FUNCTION_DEFAULT_DEBUG_PORT);
      expect(registerArg.debugType).to.equal('node');
      expect(registerArg.terminate).to.not.equal(undefined);
      expect(registerArg.isContainerLess).to.equal(false);

      assert.calledWith(addPropertyStub, 'language', fakeLanguage);
      assert.calledWith(setupFunctionListenersStub, fakeResponse.data);
      assert.called(getProjectDescriptorStub);
      assert.calledWith(joinStub, fakeResponse.data, 'project.toml');
      assert.calledWith(buildFunctionStub, fakeId, fakeResponse.data);
      assert.calledWith(startFunctionStub, fakeId, fakeResponse.data);
    };

    it('Should be able to run a container executor.', async () => {
      getDefaultUsernameOrAliasStub.resolves('defaultUserName');
      await runExecutor(getDefaultUsernameOrAliasStub);
      assert.callCount(appendLineStub, 2);
      assert.callCount(showChannelOutputStub, 1);
      assert.callCount(localizeStub, 1);
    });

    it('Should be able to have the OrgAuthInfo call fail.', async () => {
      getDefaultUsernameOrAliasStub.resolves();
      await runExecutor(getDefaultUsernameOrAliasStub);
      assert.callCount(appendLineStub, 3);
      assert.callCount(showChannelOutputStub, 2);
      assert.callCount(localizeStub, 2);
      assert.callCount(showInformationMessageStub, 1);
    });

    it('Should exit early for no function directory path.', async () => {
      const fakeMessage = 'soSad';
      getFunctionDirStub.returns(null);
      localizeStub.returns(fakeMessage);
      const executor = new ForceFunctionContainerStartExecutor(
        START_KEY,
        LOG_NAME
      );
      const result = await executor.run(fakeResponse);
      expect(result).to.equal(false);
      assert.calledWith(localizeStub, 'force_function_start_warning_no_toml');
      assert.calledWith(showWarningMessageStub, fakeMessage);
      assert.calledWith(
        sendExceptionStub,
        'force_function_start_no_toml',
        fakeMessage
      );
    });
  });
});
