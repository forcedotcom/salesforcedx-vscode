/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { QueryRunner } from '../../../src/editor/queryRunner';
import {
  getMockConnection,
  MockConnection,
  mockQueryText
} from '../testUtilities';

describe('Query Runner Should', () => {
  let mockConnection: MockConnection;
  let sandbox: sinon.SinonSandbox;

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    mockConnection = getMockConnection(sandbox);
  });

  afterEach(() => {
    sandbox.restore();
  });

  it('returns query data without attribute properties', async () => {
    // @ts-ignore
    const queryRunner = new QueryRunner(mockConnection);
    const queryData = await queryRunner.runQuery(mockQueryText);
    queryData.records.forEach((result: {}) => {
      expect(result).to.not.have.key('attributes');
    });
  });

  it('throws error with conection.query() exception', async () => {
    const errorName = 'Bad Query';
    sandbox.stub(mockConnection, 'query').throws(errorName);
    // @ts-ignore
    const queryRunner = new QueryRunner(mockConnection);
    try {
      await queryRunner.runQuery(mockQueryText);
    } catch (error) {
      expect(error.name).equal(errorName);
    }
  });
});
