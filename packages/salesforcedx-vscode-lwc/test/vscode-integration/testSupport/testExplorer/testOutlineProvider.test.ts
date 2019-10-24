import { expect } from 'chai';
import * as path from 'path';
import { assert, SinonStub, stub } from 'sinon';
import Uri from 'vscode-uri';
import { SfdxTestOutlineProvider } from '../../../../src/testSupport/testExplorer/testOutlineProvider';
import { lwcTestIndexer } from '../../../../src/testSupport/testIndexer';
import {
  TestCaseInfo,
  TestFileInfo,
  TestInfoKind,
  TestResultStatus,
  TestType
} from '../../../../src/testSupport/types';

describe('LWC Test Outline Provider', () => {
  const outlineProvder = new SfdxTestOutlineProvider();
  let findAllTestFileInfoStub: SinonStub;

  beforeEach(() => {
    findAllTestFileInfoStub = stub(lwcTestIndexer, 'findAllTestFileInfo');
  });
  afterEach(() => {
    findAllTestFileInfoStub.restore();
  });

  describe('Should load exiting test files into test explorer view', () => {
    it('Should provide test group nodes', async () => {
      const mockFilePaths = [
        '/var/mockTest1.test.js',
        '/var/mockTest2.test.js',
        '/var/mockTest3.test.js'
      ];
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
      const mockFilePaths = [
        '/var/mockTest3.test.js',
        '/var/mockTest2.test.js',
        '/var/mockTest1.test.js'
      ];
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

    it('Should provide no nodes if no tests found', async () => {
      findAllTestFileInfoStub.returns([]);
      const nodes = await outlineProvder.getChildren();
      expect(nodes).to.eql([]);
    });
  });
});
