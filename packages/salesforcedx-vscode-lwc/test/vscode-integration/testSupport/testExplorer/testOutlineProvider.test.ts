/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { SinonStub, stub } from 'sinon';
import Uri from 'vscode-uri';
import { SfdxTestOutlineProvider } from '../../../../src/testSupport/testExplorer/testOutlineProvider';
import { lwcTestIndexer } from '../../../../src/testSupport/testIndexer';
import { TestInfoKind, TestType } from '../../../../src/testSupport/types';

describe('LWC Test Outline Provider', () => {
  const outlineProvder = new SfdxTestOutlineProvider();
  let findAllTestFileInfoStub: SinonStub;

  beforeEach(() => {
    findAllTestFileInfoStub = stub(lwcTestIndexer, 'findAllTestFileInfo');
  });
  afterEach(() => {
    findAllTestFileInfoStub.restore();
  });

  const mockFilePaths = Array.from({ length: 3 }, (array, i) => {
    return /^win32/.test(process.platform)
      ? `C:\\Users\\tester\\mockTest${i + 1}.test.js`
      : `/Users/tester/mockTest${i + 1}.test.js`;
  });

  describe('Should load exiting test files into test explorer view', () => {
    it('Should provide test group nodes', async () => {
      const mockAllTestFileInfo = mockFilePaths.map(mockFilePath => ({
        kind: TestInfoKind.TEST_FILE,
        testType: TestType.LWC,
        testUri: Uri.file(mockFilePath)
      }));
      findAllTestFileInfoStub.returns(mockAllTestFileInfo);
      const nodes = await outlineProvder.getChildren();
      expect(nodes.length).to.equal(3);
      expect(nodes.map(node => node.label)).to.eql([
        'mockTest1',
        'mockTest2',
        'mockTest3'
      ]);
    });

    it('Should sort test group nodes by label', async () => {
      const mockAllTestFileInfo = [...mockFilePaths]
        .reverse()
        .map(mockFilePath => ({
          kind: TestInfoKind.TEST_FILE,
          testType: TestType.LWC,
          testUri: Uri.file(mockFilePath)
        }));
      findAllTestFileInfoStub.returns(mockAllTestFileInfo);
      const nodes = await outlineProvder.getChildren();
      expect(nodes.length).to.equal(3);
      expect(nodes.map(node => node.label)).to.eql([
        'mockTest1',
        'mockTest2',
        'mockTest3'
      ]);
    });

    it('Should provide no nodes if no tests found', async () => {
      findAllTestFileInfoStub.returns([]);
      const nodes = await outlineProvder.getChildren();
      expect(nodes).to.eql([]);
    });
  });
});
