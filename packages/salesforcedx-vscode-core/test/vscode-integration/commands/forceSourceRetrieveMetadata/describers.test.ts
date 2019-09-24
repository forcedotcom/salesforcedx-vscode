/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import { normalize } from 'path';
import { sandbox, SinonStub } from 'sinon';
import { RetrieveDescriberFactory } from '../../../../src/commands/forceSourceRetrieveMetadata';
import { BrowserNode, NodeType } from '../../../../src/orgBrowser';
import { SfdxPackageDirectories } from '../../../../src/sfdxProject';

const env = sandbox.create();

describe('Retrieve Metadata Describers', () => {
  let packageStub: SinonStub;

  const node = new BrowserNode('Test', NodeType.MetadataType, 'TestType', {
    suffix: '.t',
    directoryName: 'tests',
    inFolder: false,
    metaFile: false,
    xmlName: 'TestType',
    label: 'TestType'
  });
  node.setComponents(['Test1', 'Test2', 'Test3'], NodeType.MetadataCmp);

  beforeEach(() => {
    packageStub = env.stub(SfdxPackageDirectories, 'getPackageDirectoryPaths');
    packageStub.returns(['p1', 'p2']);
  });

  afterEach(() => env.restore());

  describe('TypeNodeDescriber', () => {
    const describer = RetrieveDescriberFactory.createTypeNodeDescriber(node);

    it('Should correctly build metadata argument for all child nodes', () => {
      expect(describer.buildMetadataArg()).to.equal('TestType');
    });

    it('Should correctly build metadata argument for subset of child nodes', () => {
      expect(describer.buildMetadataArg(generateComponents(2))).to.equal(
        'TestType:Test1,TestType:Test2'
      );
    });

    it('Should gather LocalComponents for each child node', async () => {
      expect(await describer.gatherOutputLocations()).to.eql(
        generateComponents(3)
      );
    });
  });

  describe('ComponentNodeDescriber', () => {
    const describer = RetrieveDescriberFactory.createComponentNodeDescriber(
      node.children![0]
    );
    it('Should correctly build metadata argument', () => {
      expect(describer.buildMetadataArg()).to.equal('TestType:Test1');
    });

    it('Should correctly gather a LocalComponent', async () => {
      expect(await describer.gatherOutputLocations()).to.eql(
        generateComponents(1)
      );
    });
  });

  function generateComponents(count: number): LocalComponent[] {
    const components = [];
    for (let i = 1; i <= count; i++) {
      for (let j = 1; j <= 2; j++) {
        components.push({
          fileName: `Test${i}`,
          outputdir: normalize(`p${j}/main/default/tests`),
          type: 'TestType',
          suffix: '.t'
        });
      }
    }
    return components;
  }
});
