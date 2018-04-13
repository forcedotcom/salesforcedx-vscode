/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { Client as FayeClient } from 'faye';
import * as sinon from 'sinon';
import { RequestService } from '../../../src/commands';
import { StreamingClient, StreamingClientInfoBuilder } from '../../../src/core';

describe('Debugger streaming client', () => {
  describe('Helpers', () => {
    it('Should set & get replay ID', () => {
      const requestService = new RequestService();
      requestService.instanceUrl = 'https://www.salesforce.com';
      requestService.accessToken = '123';
      const client = new StreamingClient(
        'https://www.salesforce.com',
        requestService,
        new StreamingClientInfoBuilder().build()
      );
      client.setReplayId(2);

      expect(client.getReplayId()).to.equal(2);
    });
  });

  describe('Faye', () => {
    let fayeHeaderSpy: sinon.SinonSpy;

    beforeEach(() => {
      fayeHeaderSpy = sinon.stub(FayeClient.prototype, 'setHeader');
    });

    afterEach(() => {
      fayeHeaderSpy.restore();
    });

    it('Should set headers', () => {
      const requestService = new RequestService();
      requestService.instanceUrl = 'https://www.salesforce.com';
      requestService.accessToken = '123';
      const client = new StreamingClient(
        'https://www.salesforce.com',
        requestService,
        new StreamingClientInfoBuilder().build()
      );

      expect(fayeHeaderSpy.calledTwice).to.equal(true);
      expect(fayeHeaderSpy.getCall(0).args).to.have.same.members([
        'Authorization',
        'OAuth 123'
      ]);
      expect(fayeHeaderSpy.getCall(1).args).to.have.same.members([
        'Content-Type',
        'application/json'
      ]);
      expect(client.getReplayId()).to.equal(-1);
    });
  });
});
