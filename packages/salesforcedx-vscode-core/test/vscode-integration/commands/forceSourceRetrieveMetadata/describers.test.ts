/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { expect } from 'chai';
import { stub } from 'sinon';
import { RetrieveDescriberFactory } from '../../../../src/commands/forceSourceRetrieveMetadata';
import { BrowserNode, NodeType } from '../../../../src/orgBrowser';
import { SfdxPackageDirectories } from '../../../../src/sfdxProject';

describe('Retrieve Metadata Describers', () => {
  const node = new BrowserNode('Test', NodeType.MetadataType, 'TestType', {
    suffix: '.t',
    directoryName: 'tests',
    inFolder: false,
    metaFile: false,
    xmlName: 'TestType',
    label: 'TestType'
  });
  node.setComponents(['Test1', 'Test2', 'Test3'], NodeType.MetadataCmp);
  describe('TypeNodeDescriber', () => {
    const describer = RetrieveDescriberFactory.createTypeNodeDescriber(node);
    it('Should correctly build metadata argument for all child nodes', () => {
      expect(describer.buildMetadataArg()).to.equal('TestType');
    });

    it('Should correctly build metadata argument for subset of child nodes', () => {
      const components: LocalComponent[] = [
        { fileName: 'Test1', outputdir: '', type: 'TestType' },
        { fileName: 'Test2', outputdir: '', type: 'TestType' }
      ];
      expect(describer.buildMetadataArg(components)).to.equal(
        'TestType:Test1,TestType:Test2'
      );
    });

    it('Should gather LocalComponents for each child node', async () => {
      const packageStub = stub(
        SfdxPackageDirectories,
        'getPackageDirectoryPaths'
      );
      packageStub.returns(['p1', 'p2']);
      expect(await describer.gatherOutputLocations()).to.eql([
        {
          fileName: 'Test1',
          outputdir: 'p1/main/default/tests',
          type: 'TestType',
          suffix: '.t'
        },
        {
          fileName: 'Test1',
          outputdir: 'p2/main/default/tests',
          type: 'TestType',
          suffix: '.t'
        },
        {
          fileName: 'Test2',
          outputdir: 'p1/main/default/tests',
          type: 'TestType',
          suffix: '.t'
        },
        {
          fileName: 'Test2',
          outputdir: 'p2/main/default/tests',
          type: 'TestType',
          suffix: '.t'
        },
        {
          fileName: 'Test3',
          outputdir: 'p1/main/default/tests',
          type: 'TestType',
          suffix: '.t'
        },
        {
          fileName: 'Test3',
          outputdir: 'p2/main/default/tests',
          type: 'TestType',
          suffix: '.t'
        }
      ]);
      packageStub.restore();
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
      const packageStub = stub(
        SfdxPackageDirectories,
        'getPackageDirectoryPaths'
      );
      packageStub.returns(['p1', 'p2']);
      expect(await describer.gatherOutputLocations()).to.eql([
        {
          fileName: 'Test1',
          outputdir: 'p1/main/default/tests',
          type: 'TestType',
          suffix: '.t'
        },
        {
          fileName: 'Test1',
          outputdir: 'p2/main/default/tests',
          type: 'TestType',
          suffix: '.t'
        }
      ]);
      packageStub.restore();
    });
  });
});
