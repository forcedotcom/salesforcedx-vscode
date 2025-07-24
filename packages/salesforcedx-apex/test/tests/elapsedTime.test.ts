/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import * as sinon from 'sinon';
import { Logger, LoggerLevel } from '@salesforce/core';
import { elapsedTime } from '../../src/utils/elapsedTime';

class TestClass {
  @elapsedTime('testLogger', LoggerLevel.DEBUG)
  testMethod() {
    return 'test';
  }
}
class TestClassWithPromise {
  @elapsedTime('testLogger', LoggerLevel.DEBUG)
  testMethod(): Promise<string> {
    return Promise.resolve('test');
  }
}
class ThrowsTestClass {
  @elapsedTime('testLogger', LoggerLevel.DEBUG)
  testMethod() {
    throw new Error('Test error');
  }
}
class ThrowsTestClassWithPromise {
  @elapsedTime('testLogger', LoggerLevel.DEBUG)
  testMethod(): Promise<string> {
    throw new Error('Test error');
  }
}
class RejectingTestClassWithPromise {
  @elapsedTime('testLogger', LoggerLevel.DEBUG)
  testMethod(): Promise<string> {
    return Promise.reject(new Error('Test error'));
  }
}

describe('elapsedTime', () => {
  let performanceNowStub: sinon.SinonStub;
  let loggerStub: sinon.SinonStubbedInstance<Logger>;

  beforeEach(() => {
    performanceNowStub = sinon.stub(globalThis.performance, 'now');
    performanceNowStub.onCall(0).returns(0);
    performanceNowStub.onCall(1).returns(1000);
    loggerStub = sinon.createStubInstance(Logger);
    sinon
      .stub(Logger, 'childFromRoot')
      .returns(loggerStub as unknown as Logger);
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should log the elapsed time of a method', () => {
    loggerStub.shouldLog.returns(true);
    const instance = new TestClass();
    const result = instance.testMethod();

    expect(result).to.equal('test');
    expect(loggerStub.debug.calledTwice).to.be.true;
    expect(
      loggerStub.debug.firstCall.calledWith({
        msg: 'TestClass.testMethod - enter'
      })
    ).to.be.true;
    expect(
      loggerStub.debug.secondCall.calledWith({
        msg: 'TestClass.testMethod - exit',
        elapsedTime: 1000
      })
    ).to.be.true;
  });

  it('should log the elapsed time of a method that returns a promise', async () => {
    loggerStub.shouldLog.returns(true);
    const instance = new TestClassWithPromise();
    const result = await instance.testMethod();

    expect(result).to.equal('test');
    expect(loggerStub.debug.calledTwice).to.be.true;
    expect(
      loggerStub.debug.firstCall.calledWith({
        msg: 'TestClassWithPromise.testMethod - enter'
      })
    ).to.be.true;
    expect(
      loggerStub.debug.secondCall.calledWith({
        msg: 'TestClassWithPromise.testMethod - exit',
        elapsedTime: 1000
      })
    ).to.be.true;
  });

  it('should log elapsed time of a method when it throws an error', () => {
    loggerStub.shouldLog.returns(true);
    const instance = new ThrowsTestClass();

    expect(() => instance.testMethod()).to.throw('Test error');
    expect(loggerStub.debug.calledTwice).to.be.true;
    expect(
      loggerStub.debug.firstCall.calledWith({
        msg: 'ThrowsTestClass.testMethod - enter'
      })
    ).to.be.true;
  });

  it('should log elapsed time of a method when a promise throws an error', () => {
    loggerStub.shouldLog.returns(true);
    const instance = new ThrowsTestClassWithPromise();

    expect(() => instance.testMethod()).to.throw('Test error');
    expect(loggerStub.debug.calledTwice).to.be.true;
    expect(
      loggerStub.debug.firstCall.calledWith({
        msg: 'ThrowsTestClassWithPromise.testMethod - enter'
      })
    ).to.be.true;
  });

  it('should log elapsed time of a method when a promise is rejected', async () => {
    loggerStub.shouldLog.returns(true);
    const instance = new RejectingTestClassWithPromise();

    try {
      await instance.testMethod();
    } catch (error) {
      expect(error.message).to.equal('Test error');
    }

    expect(loggerStub.debug.calledTwice).to.be.true;
    expect(
      loggerStub.debug.firstCall.calledWith({
        msg: 'RejectingTestClassWithPromise.testMethod - enter'
      })
    ).to.be.true;
    expect(
      loggerStub.debug.secondCall.calledWithMatch({
        msg: 'RejectingTestClassWithPromise.testMethod - exit'
      })
    ).to.be.true;
  });

  it('should suppress logging if not the same logger level returns false', () => {
    loggerStub.shouldLog.returns(false);
    const instance = new TestClass();
    const result = instance.testMethod();

    expect(result).to.equal('test');
    expect(loggerStub.debug.called).to.be.false;
  });
});
