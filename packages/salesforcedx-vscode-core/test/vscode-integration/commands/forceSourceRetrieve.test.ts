/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as sinon from 'sinon';
import {
  forceSourceRetrieve,
  ForceSourceRetrieveExecutor
} from '../../../src/commands';

describe('Force Source Retrieve', () => {
  it('should build source retrieve command', async () => {
    const metadataArg = 'ApexClass:testComponent';
    const forceSourceRetrieveExec = new ForceSourceRetrieveExecutor(
      metadataArg
    );
    const forceSourceRetrieveCmd = forceSourceRetrieveExec.build();
    expect(forceSourceRetrieveCmd.toCommand()).to.equal(
      `sfdx force:source:retrieve -m ${metadataArg}`
    );
  });
});
