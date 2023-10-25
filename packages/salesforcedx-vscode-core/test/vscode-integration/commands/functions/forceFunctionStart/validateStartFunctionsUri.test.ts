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

describe('validateStartFunctionUri unit tests', () => {
  let sandbox: SinonSandbox;

  before(() => {
    sandbox = createSandbox();
  });

  let validateStartFunctionsUri: any;
  let WARNING_MSG_KEY: string;
  let NO_FUNCTION_FOLDER_KEY: string;
  let localizeStub: SinonStub;
  let showWarningMessageStub: SinonStub;
  let sendExceptionStub: SinonStub;

  beforeEach(() => {
    localizeStub = stub();
    showWarningMessageStub = stub();
    sendExceptionStub = stub();
    ({
      validateStartFunctionsUri,
      WARNING_MSG_KEY,
      NO_FUNCTION_FOLDER_KEY
    } = proxyquireStrict(
      '../../../../../src/commands/functions/forceFunctionStart/validateStartFunctionsUri',
      {
        vscode: vscodeStub,
        '../../../messages': {
          nls: {
            localize: localizeStub
          }
        },
        '../../../notifications': {
          notificationService: {
            showWarningMessage: showWarningMessageStub
          }
        },
        '../../../telemetry': {
          telemetryService: {
            sendException: sendExceptionStub
          }
        }
      }
    ));
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('Should return valid sourceUri.', () => {
    const testUri = 'aabbccdd';
    const uri = validateStartFunctionsUri(testUri);
    expect(uri).to.equal(testUri);
    assert.notCalled(localizeStub);
    assert.notCalled(showWarningMessageStub);
    assert.notCalled(sendExceptionStub);
  });

  it('Should return undefined and notify on invalid Uri.', () => {
    const warningMessage = 'No URI found here.';
    localizeStub.returns(warningMessage);
    const notAUri = undefined;
    const uri = validateStartFunctionsUri(notAUri);
    expect(uri).to.equal(undefined);
    assert.calledWith(localizeStub, WARNING_MSG_KEY);
    assert.calledWith(showWarningMessageStub, warningMessage);
    assert.calledWith(
      sendExceptionStub,
      NO_FUNCTION_FOLDER_KEY,
      warningMessage
    );
  });

  describe('Use current window uri.', () => {
    const windowUri = 'currentWindowUri';

    beforeEach(() => {
      (vscodeStub.window as any).activeTextEditor = {
        document: {
          uri: windowUri
        }
      };
    });

    afterEach(() => {
      delete (vscodeStub.window as any).activeTextEditor;
    });

    it('Should use current window uri when none is passed.', () => {
      const uri = validateStartFunctionsUri();
      expect(uri).to.equal(windowUri);
    });
  });
});
