/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { OrgInfo } from '../../../src/commands/forceOrgDisplay';
import {
  StreamingClient,
  StreamingClientInfoBuilder,
  StreamingService
} from '../../../src/core';
import childProcess = require('child_process');

describe('Debugger streaming service', () => {
  const mockSpawn = require('mock-spawn');

  describe('Subscribe', () => {
    let service: StreamingService;
    let origSpawn: any, mySpawn: any;
    let clientIsConnectedSpy: sinon.SinonStub;
    let clientSubscribeSpy: sinon.SinonStub;
    const orgInfo: OrgInfo = {
      username: 'name',
      devHubId: 'devHubId',
      id: 'id',
      createdBy: 'someone',
      createdDate: new Date().toDateString(),
      expirationDate: new Date().toDateString(),
      status: 'active',
      edition: 'Enterprise',
      orgName: 'My org',
      accessToken: '123',
      instanceUrl: 'https://wwww.salesforce.com',
      clientId: 'foo'
    };

    beforeEach(() => {
      service = new StreamingService();
      origSpawn = childProcess.spawn;
      mySpawn = mockSpawn();
      childProcess.spawn = mySpawn;
      mySpawn.setDefault(
        mySpawn.simple(
          0,
          `{ "status": 0, "result": ${JSON.stringify(orgInfo)}}`
        )
      );
      clientSubscribeSpy = sinon
        .stub(StreamingClient.prototype, 'subscribe')
        .returns(Promise.resolve());
    });

    afterEach(() => {
      childProcess.spawn = origSpawn;
      clientIsConnectedSpy.restore();
      clientSubscribeSpy.restore();
    });

    it('Should return ready if client is connected', async () => {
      clientIsConnectedSpy = sinon
        .stub(StreamingClient.prototype, 'isConnected')
        .returns(true);

      const isStreamingConnected = await service.subscribe(
        'foo',
        'https://www.salesforce.com',
        '123',
        [new StreamingClientInfoBuilder().build()]
      );
      expect(isStreamingConnected).to.equal(true);
    });

    it('Should not return ready if client is not connected', async () => {
      clientIsConnectedSpy = sinon
        .stub(StreamingClient.prototype, 'isConnected')
        .returns(false);

      const isStreamingConnected = await service.subscribe(
        'foo',
        'https://www.salesforce.com',
        '123',
        [new StreamingClientInfoBuilder().build()]
      );
      expect(isStreamingConnected).to.equal(false);
    });
  });

  describe('Disconnect', () => {
    let service: StreamingService;
    let clientDisconnectSpy: sinon.SinonStub;

    beforeEach(() => {
      service = new StreamingService();
      clientDisconnectSpy = sinon.stub(StreamingClient.prototype, 'disconnect');
    });

    afterEach(() => {
      clientDisconnectSpy.restore();
    });

    it('Should not error out without any clients', () => {
      service.disconnect();

      expect(service.getClients().length).to.equal(0);
    });

    it('Should call streaming client disconnect', () => {
      const client = new StreamingClient(
        'https://www.salesforce.com',
        '',
        new StreamingClientInfoBuilder().build()
      );
      service.getClients().push(client);

      service.disconnect();

      expect(clientDisconnectSpy.calledOnce).to.equal(true);
      expect(service.getClients().length).to.equal(0);
    });
  });

  describe('Is ready', () => {
    let service: StreamingService;
    let clientIsConnectedSpy: sinon.SinonStub;

    beforeEach(() => {
      service = new StreamingService();
    });

    afterEach(() => {
      if (clientIsConnectedSpy) {
        clientIsConnectedSpy.restore();
      }
    });

    it('Should not be ready without any clients', () => {
      expect(service.isReady()).to.equal(false);
    });

    it('Should not be ready if client is not ready', () => {
      clientIsConnectedSpy = sinon
        .stub(StreamingClient.prototype, 'isConnected')
        .returns(false);
      const client = new StreamingClient(
        'https://www.salesforce.com',
        '',
        new StreamingClientInfoBuilder().build()
      );
      service.getClients().push(client);

      expect(service.isReady()).to.equal(false);
    });

    it('Should be ready if client is ready', () => {
      clientIsConnectedSpy = sinon
        .stub(StreamingClient.prototype, 'isConnected')
        .returns(true);
      const client = new StreamingClient(
        'https://www.salesforce.com',
        '',
        new StreamingClientInfoBuilder().build()
      );
      service.getClients().push(client);

      expect(service.isReady()).to.equal(true);
    });
  });
});
