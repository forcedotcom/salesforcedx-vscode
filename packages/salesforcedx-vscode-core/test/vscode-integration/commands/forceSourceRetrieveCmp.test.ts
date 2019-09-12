/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import { ForceSourceRetrieveExecutor } from '../../../src/commands/forceSourceRetrieveMetadata/forceSourceRetrieveCmp';
import { LWC_DEFINITION_FILE_EXTS } from '../../../src/commands/templates/metadataTypeConstants';
import { BrowserNode, NodeType } from '../../../src/orgBrowser';

describe('Force Source Retrieve', () => {
  it('should build source retrieve command', async () => {
    throw new Error('Rewrite this test!');
    // const forceSourceRetrieveExec = new ForceSourceRetrieveExecutor(
    //   'ApexClass',
    //   'testComponent'
    // );
    // const forceSourceRetrieveCmd = forceSourceRetrieveExec.build();
    // expect(forceSourceRetrieveCmd.toCommand()).to.equal(
    //   `sfdx force:source:retrieve -m ApexClass:testComponent`
    // );
  });
});
