/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Client as FayeClient } from 'faye';
import { StreamingClient, StreamingClientInfoBuilder } from '../../../src/core';
import { RequestService } from '../../../src/requestService/requestService';

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

      expect(client.getReplayId()).toBe(2);
    });
  });

  describe('Faye', () => {
    let fayeHeaderSpy: jest.SpyInstance;

    beforeEach(() => {
      fayeHeaderSpy = jest.spyOn(FayeClient.prototype, 'setHeader').mockImplementation(() => {});
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

      expect(fayeHeaderSpy).toHaveBeenCalledTimes(2);
      expect(fayeHeaderSpy).toHaveBeenNthCalledWith(1, 'Authorization', 'OAuth 123');
      expect(fayeHeaderSpy).toHaveBeenNthCalledWith(2, 'Content-Type', 'application/json');
      expect(client.getReplayId()).toBe(-1);
    });
  });
});
