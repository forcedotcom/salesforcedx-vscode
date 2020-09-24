/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, ConfigAggregator, Connection } from '@salesforce/core';
import { MockTestOrgData, testSetup } from '@salesforce/core/lib/testSetup';
import { expect } from 'chai';
import * as sinon from 'sinon';
import { QueryRunner } from '../../../src/editor/queryRunner';
import { mockQueryData, mockQueryText } from '../testUtilities';

describe('Query Runner Should', () => {
  const $$ = testSetup();
  const testData = new MockTestOrgData();
  let mockConnection: Connection;
  let sandbox: sinon.SinonSandbox;

  beforeEach(async () => {
    sandbox = sinon.createSandbox();
    $$.setConfigStubContents('AuthInfoConfig', {
      contents: await testData.getConfig()
    });
    mockConnection = await Connection.create({
      authInfo: await AuthInfo.create({
        username: testData.username
      })
    });
    sandbox
      .stub(ConfigAggregator.prototype, 'getPropertyValue')
      .withArgs('defaultusername')
      .returns(testData.username);
  });

  afterEach(() => {
    $$.SANDBOX.restore();
    sandbox.restore();
  });

  it('returns query data without attribute properties', async () => {
    sandbox.stub(mockConnection, 'query').returns(mockQueryData);
    const queryRunner = new QueryRunner(mockConnection);
    const queryData = await queryRunner.runQuery(mockQueryText);
    queryData.records.forEach(result => {
      expect(result).to.not.have.key('attributes');
    });
  });

  it('throws error with conection.query() exception', async () => {
    const errorName = 'Bad Query';
    sandbox.stub(mockConnection, 'query').throws(errorName);
    const queryRunner = new QueryRunner(mockConnection);
    try {
      await queryRunner.runQuery(mockQueryText);
    } catch (error) {
      expect(error.name).equal(errorName);
    }
  });
});
