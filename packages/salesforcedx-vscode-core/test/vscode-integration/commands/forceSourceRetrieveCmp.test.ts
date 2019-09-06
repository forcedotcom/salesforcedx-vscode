/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import {
  ForceSourceRetrieveExecutor,
  generateSuffix
} from '../../../src/commands';
import { LWC_DEFINITION_FILE_EXTS } from '../../../src/commands/templates/metadataTypeConstants';
import { BrowserNode, NodeType } from '../../../src/orgBrowser';

describe('Force Source Retrieve', () => {
  it('should build source retrieve command', async () => {
    const forceSourceRetrieveExec = new ForceSourceRetrieveExecutor(
      'ApexClass',
      'testComponent'
    );
    const forceSourceRetrieveCmd = forceSourceRetrieveExec.build();
    expect(forceSourceRetrieveCmd.toCommand()).to.equal(
      `sfdx force:source:retrieve -m ApexClass:testComponent`
    );
  });
});

describe('Generate Appropriate Suffix', () => {
  it('should generate suffix based on metadata object info', async () => {
    const metadataObject = {
      xmlName: 'typeNode1',
      directoryName: 'testDirectory',
      suffix: 'cls',
      inFolder: false,
      metaFile: false,
      label: 'Type Node 1'
    };
    const typeNode = new BrowserNode(
      'ApexClass',
      NodeType.MetadataType,
      undefined,
      metadataObject
    );
    const suffixes = generateSuffix(typeNode, 'ApexClass');
    expect(suffixes).to.eql([`.${typeNode.metadataObject!.suffix}-meta.xml`]);
  });

  it('should generate appropriate suffix if lightning type', async () => {
    const metadataObject = {
      xmlName: 'typeNode2',
      directoryName: 'testDirectory',
      inFolder: false,
      metaFile: false,
      label: 'Type Node 2'
    };
    const typeNode = new BrowserNode(
      'LightningComponentBundle',
      NodeType.MetadataType,
      undefined,
      metadataObject
    );
    const expected = LWC_DEFINITION_FILE_EXTS.map(ext => `${ext!}-meta.xml`);
    const suffixes = generateSuffix(typeNode, 'LightningComponentBundle');
    expect(suffixes).to.eql(expected);
  });
});
