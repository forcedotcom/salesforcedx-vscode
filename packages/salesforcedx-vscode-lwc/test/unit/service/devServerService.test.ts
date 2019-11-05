import { expect } from 'chai';
import * as sinon from 'sinon';
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

    it('throws an error if a handler is already registered', () => {
      const instance = new DevServerService();
      const handler1 = {
        stop: sinon.spy()
      };
      const handler2 = {
        stop: sinon.spy()
      };
      instance.registerServerHandler(handler1);

      expect(() => {
        instance.registerServerHandler(handler2);
      }).to.throw('already running');
    });
  });

  describe('isServerHandlerRegistered', () => {
    it('returns false if nothing is registered', () => {
      const instance = new DevServerService();
      expect(instance.isServerHandlerRegistered()).to.be.false;
    });
  });

  describe('clearServerHandler', () => {
    it('clears the server handler', () => {
      const instance = new DevServerService();
      const handler = {
        stop: sinon.spy()
      };

      instance.registerServerHandler(handler);
      expect(instance.isServerHandlerRegistered()).to.be.true;
      instance.clearServerHandler();
      expect(instance.isServerHandlerRegistered()).to.be.false;
    });

    it('does not throw an error if handler is not registered', () => {
      const instance = new DevServerService();
      instance.clearServerHandler();
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
  });
});
