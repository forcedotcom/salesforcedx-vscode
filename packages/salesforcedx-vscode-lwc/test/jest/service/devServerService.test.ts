/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DEV_SERVER_DEFAULT_BASE_URL } from '../../../src/commands/commandConstants';
import { DevServerService } from '../../../src/service/devServerService';

describe('DevServerService', () => {
  describe('get instance', () => {
    it('return the same instance', () => {
      const instance = DevServerService.instance;
      const instanceAgain = DevServerService.instance;
      expect(instance).toBeDefined();
      expect(instance).toBe(instanceAgain);
    });
  });

  describe('registerServerHandler', () => {
    it('registers the handler', () => {
      const instance = new DevServerService();
      const handler = {
        stop: jest.fn()
      };
      instance.registerServerHandler(handler);
      expect(instance.isServerHandlerRegistered()).toBe(true);
    });
  });

  describe('isServerHandlerRegistered', () => {
    it('returns false if nothing is registered', () => {
      const instance = new DevServerService();
      expect(instance.isServerHandlerRegistered()).toBe(false);
    });

    it('returns true if a handler is registered', () => {
      const instance = new DevServerService();
      const handler = {
        stop: jest.fn()
      };
      instance.registerServerHandler(handler);
      expect(instance.isServerHandlerRegistered()).toBe(true);
    });
  });

  describe('clearServerHandler', () => {
    it('clears the server handler', () => {
      const instance = new DevServerService();
      const handler = {
        stop: jest.fn()
      };

      instance.registerServerHandler(handler);
      expect(instance.isServerHandlerRegistered()).toBe(true);

      instance.clearServerHandler(handler);
      expect(instance.isServerHandlerRegistered()).toBe(false);
    });

    it('clears the specified handler', () => {
      const instance = new DevServerService();

      const handler1 = {
        stop: jest.fn()
      };
      const handler2 = {
        stop: jest.fn()
      };

      instance.registerServerHandler(handler1);
      instance.registerServerHandler(handler2);
      instance.clearServerHandler(handler1);

      const handlers = instance.getServerHandlers();

      expect(handlers).toHaveLength(1);
      expect(handlers[0]).toBe(handler2);
    });

    it('does not throw an error if handler is not registered', () => {
      const instance = new DevServerService();
      const handler = {
        stop: jest.fn()
      };
      instance.clearServerHandler(handler);
      expect(instance.isServerHandlerRegistered()).toBe(false);
    });
  });

  describe('stopServer', () => {
    it('calls `stop` on the handler', async () => {
      const instance = new DevServerService();
      const stopMethod = jest.fn();
      const handler = { stop: stopMethod };

      instance.registerServerHandler(handler);
      await instance.stopServer();

      expect(stopMethod).toHaveBeenCalledTimes(1);
    });

    it('clears the server handler', async () => {
      const instance = new DevServerService();
      const handler = {
        stop: jest.fn()
      };

      instance.registerServerHandler(handler);
      await instance.stopServer();

      expect(instance.isServerHandlerRegistered()).toBe(false);
    });

    it('does not throw an error if nothing is registered', async () => {
      const instance = new DevServerService();
      await instance.stopServer();
      expect(instance.isServerHandlerRegistered()).toBe(false);
    });

    it('sets the correct url with port from server startup response', () => {
      const instance = new DevServerService();
      instance.setBaseUrlFromDevServerUpMessage('Server up on http://localhost:1234');
      expect(instance.getBaseUrl()).toBe('http://localhost:1234');
    });

    it('sets the correct url from server startup response containing ansi codes', () => {
      const instance = new DevServerService();
      instance.setBaseUrlFromDevServerUpMessage('Server up on http://localhost:3334');
      expect(instance.getBaseUrl()).toBe('http://localhost:3334');
    });

    it('keeps the default url with port as fall back', () => {
      const instance = new DevServerService();
      instance.setBaseUrlFromDevServerUpMessage('Server up with no url information \n some other info');
      expect(instance.getBaseUrl()).toBe(DEV_SERVER_DEFAULT_BASE_URL);
    });

    it('retrieves the correct preview component path', () => {
      const instance = new DevServerService();
      expect(instance.getComponentPreviewUrl('HelloWorld')).toBe('http://localhost:3333/preview/HelloWorld');
    });

    it('extracts the correct port number from the url', () => {
      const instance = new DevServerService();
      instance.setBaseUrlFromDevServerUpMessage('Server started: http://localhost:1234');
      expect(instance.getBaseUrl()).toBe('http://localhost:1234');
    });
  });
});
