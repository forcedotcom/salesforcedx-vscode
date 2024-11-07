/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as requestLight from 'request-light';
import { XHROptions, XHRResponse } from 'request-light';
import {
  DEFAULT_CONNECTION_TIMEOUT_MS,
  ENV_HTTPS_PROXY,
  ENV_HTTP_PROXY,
  ENV_SF_TARGET_ORG,
  ENV_SF_ORG_INSTANCE_URL
} from '../../../src/constants';
import { BaseCommand, RequestService, RestHttpMethodEnum } from '../../../src/requestService';
jest.mock('request-light');

// This ensures that typscript understands the mocked module
const mockedRequestLight = jest.mocked(requestLight);

const testCommandUrl = 'this.is.a.test/location';
const testRequestBody = 'this-is-a-test-request-body';
class TestCommand extends BaseCommand {
  public getCommandUrl(): string {
    return testCommandUrl;
  }
  public getRequest(): string | undefined {
    return testRequestBody;
  }
}

describe('RequestService unit tests.', () => {
  const testProxyUrl = 'https://imma.proxy.url.com';
  const testInstanceUrl = 'https://where.is/the/instance';
  const testAccessToken = 'totallyfake-access-token-not-real-1234';

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be able to create an instance.', () => {
    const requestService = new RequestService();
    requestService.connectionTimeoutMs = 1000;
    expect(requestService.connectionTimeoutMs).toEqual(1000);
    requestService.proxyStrictSSL = true;
    expect(requestService.proxyStrictSSL).toEqual(true);
    expect(requestService).not.toBeUndefined();
  });

  it('Should have default timeout.', () => {
    const requestService = new RequestService();
    expect(requestService.connectionTimeoutMs).toEqual(DEFAULT_CONNECTION_TIMEOUT_MS);
  });

  describe('getEnvVars()', () => {
    it('should not include request specific properties if not set.', () => {
      const requestService = new RequestService();
      // No properties set
      const envVars = requestService.getEnvVars();
      expect(envVars[ENV_HTTP_PROXY]).toBeUndefined();
      expect(envVars[ENV_HTTPS_PROXY]).toBeUndefined();
      expect(envVars[ENV_SF_ORG_INSTANCE_URL]).toBeUndefined();
      expect(envVars[ENV_SF_TARGET_ORG]).toBeUndefined();
    });

    it('Should include request specific properties if defined.', () => {
      const requestService = new RequestService();
      requestService.proxyUrl = testProxyUrl;
      requestService.instanceUrl = testInstanceUrl;
      requestService.accessToken = testAccessToken;

      const envVars = requestService.getEnvVars();

      expect(envVars[ENV_HTTP_PROXY]).toEqual(testProxyUrl);
      expect(envVars[ENV_HTTPS_PROXY]).toEqual(testProxyUrl);
      expect(envVars[ENV_SF_ORG_INSTANCE_URL]).toEqual(testInstanceUrl);
      expect(envVars[ENV_SF_TARGET_ORG]).toEqual(testAccessToken);
    });
  });

  describe('execute()', () => {
    const testCommand = new TestCommand();
    const fakeResponse = {
      responseText: 'hooray'
    };

    let requestServiceInst: RequestService;
    let sendRequestMock: jest.SpyInstance;

    beforeEach(() => {
      sendRequestMock = jest.spyOn(RequestService.prototype, 'sendRequest').mockName('sendRequestMock');
      requestServiceInst = new RequestService();
      requestServiceInst.proxyUrl = testProxyUrl;
      requestServiceInst.instanceUrl = testInstanceUrl;
      requestServiceInst.accessToken = testAccessToken;
    });

    afterEach(() => {
      sendRequestMock.mockRestore();
    });

    it('Should include proxy info if defined.', async () => {
      requestServiceInst.proxyStrictSSL = true;
      sendRequestMock.mockResolvedValue(fakeResponse);
      const result = await requestServiceInst.execute(testCommand);
      expect(result).toEqual(fakeResponse.responseText);
      expect(sendRequestMock).toHaveBeenCalled();
      expect(sendRequestMock.mock.calls[0]).toMatchSnapshot();
      expect(mockedRequestLight.configure).toHaveBeenCalledWith(testProxyUrl, true);
    });

    it('Should include proxy authorization info if defined.', async () => {
      requestServiceInst.proxyAuthorization = 'this-is-fake-proxy-auth';
      requestServiceInst.proxyUrl = '';
      sendRequestMock.mockResolvedValue(fakeResponse);

      const result = await requestServiceInst.execute(testCommand);
      expect(result).toEqual(fakeResponse.responseText);
      expect(sendRequestMock.mock.calls[0]).toMatchSnapshot();
      expect(mockedRequestLight.configure).not.toHaveBeenCalled();
    });

    it('Should include query string if defined.', async () => {
      sendRequestMock.mockResolvedValue(fakeResponse);
      const queryCommand = new TestCommand('hereIsAQuery');
      // have getRequest return nothing to exercise that path.
      jest.spyOn(queryCommand, 'getRequest').mockReturnValue(undefined);

      const result = await requestServiceInst.execute(queryCommand, RestHttpMethodEnum.Get);
      expect(result).toEqual(fakeResponse.responseText);
      expect(sendRequestMock.mock.calls[0]).toMatchSnapshot();
    });

    it('Should reject on error.', async () => {
      sendRequestMock.mockRejectedValue(fakeResponse);
      expect(requestServiceInst.execute(testCommand)).rejects.toMatch(fakeResponse.responseText);
    });
  });

  describe('sendRequest()', () => {
    it('Should make the xhr call on sendRequest.', async () => {
      const fakeOptions: XHROptions = {
        type: 'json/and/stuff',
        url: 'https://www.nothing-here.com'
      };
      const fakeXhrResponse: XHRResponse = {
        responseText: 'fakeResponse',
        status: 0,
        body: new Uint8Array(),
        headers: {}
      };

      mockedRequestLight.xhr.mockResolvedValue(fakeXhrResponse);

      const requestService = new RequestService();
      const response = await requestService.sendRequest(fakeOptions);
      expect(response).toEqual(fakeXhrResponse);
      expect(mockedRequestLight.xhr).toHaveBeenCalledWith(fakeOptions);
    });
  });
});
