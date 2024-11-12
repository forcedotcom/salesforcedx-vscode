/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { DEV_SERVER_DEFAULT_BASE_URL } from '../../../src/commands/commandConstants';
import { DevServerService } from '../../../src/service/devServerService';

// tslint:disable:no-unused-expression
describe('DevServerService', () => {
  describe('get instance', () => {
    it('return the same instance', async () => {
      const instance = DevServerService.instance;
      const instanceAgain = DevServerService.instance;
      expect(instance).to.exist;
      expect(instance).to.equal(instanceAgain);
    });
  });

  describe('registerServerHandler', () => {
    it('registers the handler', () => {
      const instance = new DevServerService();
      const handler = {
        stop: sinon.spy()
      };
      instance.registerServerHandler(handler);
      expect(instance.isServerHandlerRegistered()).to.be.true;
    });
  });

  describe('isServerHandlerRegistered', () => {
    it('returns false if nothing is registered', () => {
      const instance = new DevServerService();
      expect(instance.isServerHandlerRegistered()).to.be.false;
    });

    it('returns true if a handler is registered', () => {
      const instance = new DevServerService();
      const handler = {
        stop: sinon.spy()
      };
      instance.registerServerHandler(handler);
      expect(instance.isServerHandlerRegistered()).to.be.true;
    });
  });

  describe('clearServerHandler', () => {
    it('clears the server handler', () => {
      const instance = new DevServerService();
      const handler = {
        stop: sinon.spy()
      };

      instance.registerServerHandler(handler);
      expect(instance.isServerHandlerRegistered(), 'expected the server handler to be registered').to.be.true;

      instance.clearServerHandler(handler);
      expect(instance.isServerHandlerRegistered(), 'expected the server handler to be cleared').to.be.false;
    });

    it('clears the specified handler', () => {
      const instance = new DevServerService();

      const handler1 = {
        stop: sinon.spy()
      };
      const handler2 = {
        stop: sinon.spy()
      };

      instance.registerServerHandler(handler1);
      instance.registerServerHandler(handler2);
      instance.clearServerHandler(handler1);

      const handlers = instance.getServerHandlers();

      expect(handlers).to.have.lengthOf(1);
      expect(handlers[0]).to.equal(handler2);
    });

    it('does not throw an error if handler is not registered', () => {
      const instance = new DevServerService();
      const handler = {
        stop: sinon.spy()
      };
      instance.clearServerHandler(handler);
      expect(instance.isServerHandlerRegistered()).to.be.false;
    });
  });

  describe('stopServer', () => {
    it('calls `stop` on the handler', async () => {
      const instance = new DevServerService();
      const stopMethod = sinon.spy();
      const handler = { stop: stopMethod };

      instance.registerServerHandler(handler);
      await instance.stopServer();

      sinon.assert.calledOnce(stopMethod);
    });

    it('clears the server handler', async () => {
      const instance = new DevServerService();
      const handler = {
        stop: sinon.spy()
      };

      instance.registerServerHandler(handler);
      await instance.stopServer();

      expect(instance.isServerHandlerRegistered()).to.be.false;
    });

    it('does not throw an error if nothing is registered', async () => {
      const instance = new DevServerService();
      await instance.stopServer();
      expect(instance.isServerHandlerRegistered()).to.be.false;
    });

    it('sets the correct url with port from server startup response', async () => {
      const instance = new DevServerService();
      instance.setBaseUrlFromDevServerUpMessage('Server up on http://localhost:1234');
      expect(instance.getBaseUrl()).to.equal('http://localhost:1234');
    });

    it('sets the correct url from server startup response containing ansi codes', async () => {
      const instance = new DevServerService();
      instance.setBaseUrlFromDevServerUpMessage('[35m[1mServer up on http://localhost:3334[22m[39m\n');
      expect(instance.getBaseUrl()).to.equal('http://localhost:3334');
    });

    it('keeps the default url with port as fall back', async () => {
      const instance = new DevServerService();
      instance.setBaseUrlFromDevServerUpMessage('Sever up with no url information \n some other info');
      expect(instance.getBaseUrl()).to.equal(DEV_SERVER_DEFAULT_BASE_URL);
    });

    it('retrieves the correct preview component path', async () => {
      const instance = new DevServerService();
      expect(instance.getComponentPreviewUrl('HelloWorld')).to.equal('http://localhost:3333/preview/HelloWorld');
    });
  });
});
