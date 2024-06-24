/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { Connection } from '@salesforce/core-bundle';
import * as sinon from 'sinon';
import { QueryRunner } from '../../../src/editor/queryRunner';
import { getMockConnection, mockQueryText } from '../testUtilities';

describe('Query Runner Should', () => {
  let mockConnection: Connection;
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

  it('strip comments before passing query to connection', async () => {
    const querySpy = sandbox.spy(mockConnection, 'query');
    const soqlNoComments = 'SELECT Id\nFROM Account\n';
    const soqlWithComments =
      '// Comment line 1\n//Comment line2\n' + soqlNoComments;

    const queryRunner = new QueryRunner(mockConnection);
    const queryData = await queryRunner.runQuery(soqlWithComments);
    queryData.records.forEach((result: {}) => {
      expect(result).to.not.have.key('attributes');
    });

    expect(querySpy.calledOnce).to.be.true;
    expect(querySpy.firstCall.args[0]).to.equal(soqlNoComments);
  });

});
