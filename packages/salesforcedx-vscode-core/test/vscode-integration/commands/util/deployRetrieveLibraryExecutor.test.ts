/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import {
  CancelResponse,
  ContinueResponse,
  ParametersGatherer
} from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { fail } from 'assert';
import { expect } from 'chai';
import { createSandbox, SinonSandbox } from 'sinon';
import {
  CompositeParametersGatherer,
  SfdxCommandlet
} from '../../../../src/commands/util';
import { DeployRetrieveLibraryExecutor } from '../../../../src/commands/util/deployRetrieveLibraryExecutor';
import { workspaceContext } from '../../../../src/context';
import { nls } from '../../../../src/messages';
import { OrgAuthInfo } from '../../../../src/util';

// tslint:disable:no-unused-expression
describe('DeployRetrieveLibraryExecutor', () => {
  // Setup the test environment.
  const $$ = testSetup();
  const testData = new MockTestOrgData();

  let mockConnection: Connection;
  let sb: SinonSandbox;

  beforeEach(async () => {
    sb = createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    sb.stub(ConfigAggregator.prototype, 'getPropertyValue')
      .withArgs('defaultusername')
      .returns(testData.username);
  });

  afterEach(() => {
    $$.SANDBOX.restore();
    sb.restore();
  });

  it('Should call executor', async () => {
    let executed = false;
    const commandlet = new SfdxCommandlet(
      new class {
        public check(): boolean {
          return true;
        }
      }(),
      new CompositeParametersGatherer(
        new class implements ParametersGatherer<{}> {
          public async gather(): Promise<
            CancelResponse | ContinueResponse<{}>
          > {
            return { type: 'CONTINUE', data: {} };
          }
        }()
      ),
      new class extends DeployRetrieveLibraryExecutor {
        public async execute(response: ContinueResponse<{}>): Promise<void> {
          executed = true;
        }
      }()
    );

    await commandlet.run();
    expect(executed).to.be.true;
  });

  it('Should create connection on build phase', async () => {
    const getConnectionStub = sb
      .stub(workspaceContext, 'getConnection')
      .returns(mockConnection);
    const commandlet = new class extends DeployRetrieveLibraryExecutor {
      public async execute(response: ContinueResponse<{}>): Promise<void> {}
    }();

    await commandlet.build('Test name', 'telemetry_test');
    expect(getConnectionStub.calledOnce).to.equal(true);
  });

  it('Should fail build phase if username cannot be found', async () => {
    const orgAuthMock = sb
      .stub(OrgAuthInfo, 'getDefaultUsernameOrAlias')
      .returns(undefined);
    // @ts-ignore just need subscriptions in extension context
    workspaceContext.initialize({ subscriptions: [] });
    const commandlet = new class extends DeployRetrieveLibraryExecutor {
      public async execute(response: ContinueResponse<{}>): Promise<void> {}
    }();
    try {
      await commandlet.build('Test name', 'telemetry_test');
      fail('build phase should throw an error');
    } catch (e) {
      expect(e.message).to.equal(nls.localize('error_no_default_username'));
      expect(orgAuthMock.calledOnce).to.equal(true);
    }
  });
});
