/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode';
import { expect } from 'chai';
import { normalize } from 'path';
import { createSandbox, SinonSandbox, SinonStub } from 'sinon';
import { RetrieveDescriberFactory } from '../../../../src/commands/retrieveMetadata';
import { BrowserNode, NodeType, orgBrowser } from '../../../../src/orgBrowser';
import { SalesforcePackageDirectories } from '../../../../src/salesforceProject';

describe('Retrieve Metadata Describers', () => {
  let packageStub: SinonStub;
  let refreshStub: SinonStub;
  let env: SinonSandbox;

  const node = new BrowserNode('Test', NodeType.MetadataType, 'TestType', {
    suffix: '.t',
    directoryName: 'tests',
    inFolder: false,
    metaFile: false,
    xmlName: 'TestType',
    label: 'TestType'
  });
  node.setComponents(['Test1', 'Test2', 'Test3'], NodeType.MetadataComponent);

  beforeEach(() => {
    env = createSandbox();
    packageStub = env
      .stub(SalesforcePackageDirectories, 'getPackageDirectoryPaths')
      .returns(['p1', 'p2']);
    refreshStub = env.stub(orgBrowser, 'refreshAndExpand').callsFake(() => '');
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

    it('Should refresh the available components before gathering', async () => {
      refreshStub.callsFake(() => {
        node.setComponents(['Test1'], NodeType.MetadataComponent);
      });
      expect(await describer.gatherOutputLocations()).to.eql(
        generateComponents(1)
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

  const generateComponents = (count: number): LocalComponent[] => {
    return Array.from({ length: count }, (_, i) => i + 1).flatMap(i =>
      Array.from({ length: 2 }, (_, j) => j + 1).map(j => ({
        fileName: `Test${i}`,
        outputdir: normalize(`p${j}/main/default/tests`),
        type: 'TestType',
        suffix: '.t'
      }))
    );
  };
});
