/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect, test } from '@salesforce/command/lib/test';
import { LogService } from '@salesforce/apex-node';
import { createSandbox, SinonSandbox } from 'sinon';
import { Connection, Org } from '@salesforce/core';

const logString = {
  log:
    '52.0 APEX_CODE,FINEST;APEX_PROFILING,INFO;CALLOUT,INFO;DB,INFO;NBA,INFO;SYSTEM,DEBUG'
};
const streamingClient = {
  handshake: async (): Promise<void> => Promise.resolve(),
  subscribe: async (): Promise<void> => Promise.resolve()
};
const TEST_USERNAME = 'test@username.com';

describe('force:apex:log:tail', () => {
  let sandboxStub: SinonSandbox;

  beforeEach(() => {
    sandboxStub = createSandbox();

    sandboxStub.stub(Org, 'create').resolves(Org.prototype);
    sandboxStub
      .stub(Org.prototype, 'getConnection')
      .returns(Connection.prototype);
    sandboxStub.stub(Org.prototype, 'getUsername').returns(TEST_USERNAME);
    sandboxStub.stub(Org.prototype, 'getOrgId').returns('abc123');
  });

  afterEach(() => {
    sandboxStub.restore();
  });
  test
    .withOrg({ username: 'test@username.com' }, true)
    .stub(LogService.prototype, 'prepareTraceFlag', () => undefined)
    .stub(LogService.prototype, 'getLogById', async () => logString)
    .stub(LogService.prototype, 'createStreamingClient', async function(
      this: LogService
    ) {
      await this.logCallback({ sobject: { Id: 'xxxxxx' } });
      return streamingClient;
    })
    .stdout()
    .command(['force:apex:log:tail'])
    .it('should print the log with the default command', ctx => {
      expect(ctx.stdout).to.contain(logString.log);
    });
  test
    .withOrg({ username: 'test@username.com' }, true)
    .stub(LogService.prototype, 'prepareTraceFlag', () => undefined)
    .stub(LogService.prototype, 'getLogById', async () => logString)
    .stub(LogService.prototype, 'createStreamingClient', async function() {
      return streamingClient;
    })
    .stdout()
    .command(['force:apex:log:tail'])
    .it('should print nothing if no log is returned', ctx => {
      expect(ctx.stdout).to.contain('');
    });
  test
    .withOrg({ username: 'test@username.com' }, true)
    .stub(LogService.prototype, 'prepareTraceFlag', () => undefined)
    .stub(LogService.prototype, 'getLogById', async () => logString)
    .stub(LogService.prototype, 'createStreamingClient', async function(
      this: LogService
    ) {
      await this.logCallback({ sobject: { Id: 'xxxxxx' } });
      return streamingClient;
    })
    .stdout()
    .command([
      'force:apex:log:tail',
      '--targetusername',
      'test@username.com',
      '--json'
    ])
    .it('should print the log in json', ctx => {
      const logResult = JSON.stringify(
        { status: 0, result: logString.log },
        null,
        2
      );
      expect(ctx.stdout).to.contain(logResult);
    });
  test
    .withOrg({ username: 'test@username.com' }, true)
    .stub(LogService.prototype, 'prepareTraceFlag', () => undefined)
    .stub(LogService.prototype, 'getLogById', async () => logString)
    .stub(LogService.prototype, 'createStreamingClient', async function() {
      return streamingClient;
    })
    .stdout()
    .command([
      'force:apex:log:tail',
      '--targetusername',
      'test@username.com',
      '--json'
    ])
    .it('should return json output if no logs were found', ctx => {
      const emptyResult = JSON.stringify({ status: 0 }, null, 2);
      expect(ctx.stdout).to.equal(`${emptyResult}\n`);
    });
  test
    .withOrg({ username: 'test@username.com' }, true)
    .stub(LogService.prototype, 'prepareTraceFlag', () => undefined)
    .stub(LogService.prototype, 'getLogById', async () => logString)
    .stub(LogService.prototype, 'createStreamingClient', async function(
      this: LogService
    ) {
      await this.logCallback({ sobject: { Id: 'xxxxxx' } });
      return streamingClient;
    })
    .stdout()
    .command(['force:apex:log:tail', '-c'])
    .it('should pass through colorization of the logs', ctx => {
      expect(ctx.stdout).to.contain(logString.log);
    });
  test
    .withOrg({ username: 'test@username.com' }, true)
    .stub(LogService.prototype, 'getLogById', async () => logString)
    .stub(LogService.prototype, 'createStreamingClient', async function(
      this: LogService
    ) {
      await this.logCallback({ sobject: { Id: 'xxxxxx' } });
      return streamingClient;
    })
    .stdout()
    .command(['force:apex:log:tail', '-s'])
    .it('should skip the trace flag creation', ctx => {
      expect(ctx.stdout).to.contain(logString.log);
    });
  test
    .withOrg({ username: 'test@username.com' }, true)
    .stub(LogService.prototype, 'prepareTraceFlag', () => undefined)
    .stub(LogService.prototype, 'getLogById', async () => logString)
    .stub(LogService.prototype, 'createStreamingClient', async function(
      this: LogService
    ) {
      await this.logCallback({ sobject: { Id: 'xxxxxx' } });
      return streamingClient;
    })
    .stdout()
    .command(['force:apex:log:tail', '-d', ''])
    .it('should accept a debug level parameter', ctx => {
      expect(ctx.stdout).to.contain(logString.log);
    });
});
