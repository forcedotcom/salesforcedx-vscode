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
  ApexDebuggerEventType,
  StreamingClient,
  StreamingClientInfoBuilder,
  StreamingService
} from '../../../src/core';
import childProcess = require('child_process');
import { RequestService } from '../../../src/commands';

describe('Debugger streaming service', () => {
  const mockSpawn = require('mock-spawn');
  const requestService = new RequestService();
  requestService.instanceUrl = 'https://www.salesforce.com';
  requestService.accessToken = '123';

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
        requestService,
        new StreamingClientInfoBuilder().build(),
        new StreamingClientInfoBuilder().build()
      );
      expect(isStreamingConnected).to.equal(true);
    });

    it('Should not return ready if client is not connected', async () => {
      clientIsConnectedSpy = sinon
        .stub(StreamingClient.prototype, 'isConnected')
        .returns(false);

      const isStreamingConnected = await service.subscribe(
        'foo',
        requestService,
        new StreamingClientInfoBuilder().build(),
        new StreamingClientInfoBuilder().build()
      );
      expect(isStreamingConnected).to.equal(false);
    });
  });

  describe('Disconnect', () => {
    let service: StreamingService;
    let clientDisconnectSpy: sinon.SinonStub;
    let clientIsConnectedSpy: sinon.SinonStub;
    let clientSubscribeSpy: sinon.SinonStub;

    beforeEach(() => {
      service = new StreamingService();
      clientDisconnectSpy = sinon.stub(StreamingClient.prototype, 'disconnect');
      clientIsConnectedSpy = sinon
        .stub(StreamingClient.prototype, 'isConnected')
        .returns(true);
      clientSubscribeSpy = sinon
        .stub(StreamingClient.prototype, 'subscribe')
        .returns(Promise.resolve());
    });

    afterEach(() => {
      clientDisconnectSpy.restore();
      clientIsConnectedSpy.restore();
      clientSubscribeSpy.restore();
    });

    it('Should not error out without any clients', () => {
      try {
        service.disconnect();
      } catch (error) {
        expect.fail('Should not have thrown an exception');
      }
    });

    it('Should call streaming client disconnect', async () => {
      await service.subscribe(
        'foo',
        requestService,
        new StreamingClientInfoBuilder().build(),
        new StreamingClientInfoBuilder().build()
      );

      service.disconnect();

      expect(clientDisconnectSpy.calledTwice).to.equal(true);
    });
  });

  describe('Is ready', () => {
    let service: StreamingService;
    let clientIsConnectedSpy: sinon.SinonStub;
    let clientSubscribeSpy: sinon.SinonStub;

    beforeEach(() => {
      service = new StreamingService();
      clientSubscribeSpy = sinon
        .stub(StreamingClient.prototype, 'subscribe')
        .returns(Promise.resolve());
    });

    afterEach(() => {
      if (clientIsConnectedSpy) {
        clientIsConnectedSpy.restore();
      }
      clientSubscribeSpy.restore();
    });

    it('Should not be ready without any clients', () => {
      expect(service.isReady()).to.equal(false);
    });

    it('Should not be ready if client is not ready', async () => {
      clientIsConnectedSpy = sinon
        .stub(StreamingClient.prototype, 'isConnected')
        .returns(false);
      await service.subscribe(
        'foo',
        requestService,
        new StreamingClientInfoBuilder().build(),
        new StreamingClientInfoBuilder().build()
      );

      expect(service.isReady()).to.equal(false);
    });

    it('Should be ready if client is ready', async () => {
      clientIsConnectedSpy = sinon
        .stub(StreamingClient.prototype, 'isConnected')
        .returns(true);
      await service.subscribe(
        'foo',
        requestService,
        new StreamingClientInfoBuilder().build(),
        new StreamingClientInfoBuilder().build()
      );

      expect(service.isReady()).to.equal(true);
    });
  });

  describe('Get client based on event type', () => {
    let service: StreamingService;
    let clientSubscribeSpy: sinon.SinonStub;
    let clientIsConnectedSpy: sinon.SinonStub;
    const systemEventClient = new StreamingClientInfoBuilder()
      .forChannel(StreamingService.SYSTEM_EVENT_CHANNEL)
      .build();
    const userEventClient = new StreamingClientInfoBuilder()
      .forChannel(StreamingService.USER_EVENT_CHANNEL)
      .build();

    before(async () => {
      service = new StreamingService();
      clientSubscribeSpy = sinon
        .stub(StreamingClient.prototype, 'subscribe')
        .returns(Promise.resolve());
      clientIsConnectedSpy = sinon
        .stub(StreamingClient.prototype, 'isConnected')
        .returns(true);
      await service.subscribe(
        'foo',
        requestService,
        systemEventClient,
        userEventClient
      );
    });

    after(() => {
      clientSubscribeSpy.restore();
      clientIsConnectedSpy.restore();
    });

    it('Should handle ApexException', () => {
      const client = service.getClient(ApexDebuggerEventType.ApexException)!;

      expect(client.getClientInfo().channel).to.equal(
        StreamingService.USER_EVENT_CHANNEL
      );
    });

    it('Should handle Debug', () => {
      const client = service.getClient(ApexDebuggerEventType.Debug)!;

      expect(client.getClientInfo().channel).to.equal(
        StreamingService.USER_EVENT_CHANNEL
      );
    });

    it('Should handle LogLine', () => {
      const client = service.getClient(ApexDebuggerEventType.ApexException)!;

      expect(client.getClientInfo().channel).to.equal(
        StreamingService.USER_EVENT_CHANNEL
      );
    });

    it('Should handle OrgChange', () => {
      const client = service.getClient(ApexDebuggerEventType.OrgChange)!;

      expect(client.getClientInfo().channel).to.equal(
        StreamingService.SYSTEM_EVENT_CHANNEL
      );
    });

    it('Should handle Ready', () => {
      const client = service.getClient(ApexDebuggerEventType.Ready)!;

      expect(client.getClientInfo().channel).to.equal(
        StreamingService.SYSTEM_EVENT_CHANNEL
      );
    });

    it('Should handle RequestFinished', () => {
      const client = service.getClient(ApexDebuggerEventType.RequestFinished)!;

      expect(client.getClientInfo().channel).to.equal(
        StreamingService.SYSTEM_EVENT_CHANNEL
      );
    });

    it('Should handle RequestStarted', () => {
      const client = service.getClient(ApexDebuggerEventType.RequestStarted)!;

      expect(client.getClientInfo().channel).to.equal(
        StreamingService.SYSTEM_EVENT_CHANNEL
      );
    });

    it('Should handle Resumed', () => {
      const client = service.getClient(ApexDebuggerEventType.Resumed)!;

      expect(client.getClientInfo().channel).to.equal(
        StreamingService.SYSTEM_EVENT_CHANNEL
      );
    });

    it('Should handle SessionTerminated', () => {
      const client = service.getClient(
        ApexDebuggerEventType.SessionTerminated
      )!;

      expect(client.getClientInfo().channel).to.equal(
        StreamingService.SYSTEM_EVENT_CHANNEL
      );
    });

    it('Should handle Stopped', () => {
      const client = service.getClient(ApexDebuggerEventType.Stopped)!;

      expect(client.getClientInfo().channel).to.equal(
        StreamingService.SYSTEM_EVENT_CHANNEL
      );
    });

    it('Should handle SystemGack', () => {
      const client = service.getClient(ApexDebuggerEventType.SystemGack)!;

      expect(client.getClientInfo().channel).to.equal(
        StreamingService.SYSTEM_EVENT_CHANNEL
      );
    });

    it('Should handle SystemInfo', () => {
      const client = service.getClient(ApexDebuggerEventType.SystemInfo)!;

      expect(client.getClientInfo().channel).to.equal(
        StreamingService.SYSTEM_EVENT_CHANNEL
      );
    });

    it('Should handle SystemWarning', () => {
      const client = service.getClient(ApexDebuggerEventType.SystemWarning)!;

      expect(client.getClientInfo().channel).to.equal(
        StreamingService.SYSTEM_EVENT_CHANNEL
      );
    });

    it('Should not handle Heartbeat', () => {
      const client = service.getClient(ApexDebuggerEventType.HeartBeat)!;

      expect(client).to.equal(undefined);
    });
  });

  describe('Replay ID', () => {
    let service: StreamingService;
    let clientSubscribeSpy: sinon.SinonStub;
    let clientIsConnectedSpy: sinon.SinonStub;
    let clientSetReplayIdSpy: sinon.SinonSpy;
    const systemEventClient = new StreamingClientInfoBuilder()
      .forChannel(StreamingService.SYSTEM_EVENT_CHANNEL)
      .build();
    const userEventClient = new StreamingClientInfoBuilder()
      .forChannel(StreamingService.USER_EVENT_CHANNEL)
      .build();

    beforeEach(async () => {
      service = new StreamingService();
      clientSubscribeSpy = sinon
        .stub(StreamingClient.prototype, 'subscribe')
        .returns(Promise.resolve());
      clientIsConnectedSpy = sinon
        .stub(StreamingClient.prototype, 'isConnected')
        .returns(true);
      clientSetReplayIdSpy = sinon.spy(
        StreamingClient.prototype,
        'setReplayId'
      );
      await service.subscribe(
        'foo',
        requestService,
        systemEventClient,
        userEventClient
      );
    });

    afterEach(() => {
      clientSubscribeSpy.restore();
      clientIsConnectedSpy.restore();
      clientSetReplayIdSpy.restore();
    });

    it('Should not have processed event', () => {
      expect(
        service.hasProcessedEvent(ApexDebuggerEventType.Stopped, 2)
      ).to.equal(false);
    });

    it('Should have processed event', () => {
      service.markEventProcessed(ApexDebuggerEventType.Stopped, 2);

      expect(
        service.hasProcessedEvent(ApexDebuggerEventType.Stopped, 2)
      ).to.equal(true);
    });

    it('Should have processed event if client cannot be determined', () => {
      expect(
        service.hasProcessedEvent(ApexDebuggerEventType.HeartBeat, 2)
      ).to.equal(true);
    });

    it('Should not mark event processed if client cannot be determined', () => {
      service.markEventProcessed(ApexDebuggerEventType.HeartBeat, 2);

      expect(clientSetReplayIdSpy.called).to.equal(false);
    });
  });
});
