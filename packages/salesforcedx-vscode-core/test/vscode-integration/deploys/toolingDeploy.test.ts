/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import { SinonStub, stub } from 'sinon';
import { ToolingCreateResult, ToolingDeploy } from '../../../src/deploys';

describe('create metadata container', () => {
  const connectionStub = stub(Connection, 'create').returns({});
  const username = 'username1@gmail.com';
  const deployLibrary = new ToolingDeploy(username);
  it('should create a metadata container given the connection', async () => {
    const container = { success: true, id: '123456xxx' } as ToolingCreateResult;
  });
});
