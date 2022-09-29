/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as sinon from 'sinon';
import { extractJsonObject, fileUtils } from '../../../src/helpers';

describe('utils.test.ts', () => {
  let realpathSyncNativeStub: sinon.SinonStub;

  beforeEach(() => {
    realpathSyncNativeStub = sinon.stub(fs.realpathSync, 'native');
  });

  afterEach(() => {
    realpathSyncNativeStub.restore();
  });

  describe('getConfigSource', () => {
    it('should extract a JSON string from larger string and then return as an object', async () => {
      const exampleJsonString = JSON.stringify({
        name: 'exampleName',
        error: 'exampleError'
      });
      const exampleString = `junk text <junk +text junk text ${exampleJsonString} junk text junk text junk text`;

      const testParse = extractJsonObject(exampleString);

      expect(testParse.name).to.equal('exampleName');
      expect(testParse.error).to.equal('exampleError');
    });
  });

  describe('flushFilePath', () => {
    it('should call fs.realpathSync.native() to resolve a path', async () => {
      const filePath = 'c:\\Users\\temp\\exampleFile.js';
      realpathSyncNativeStub.returns(filePath);

      const result = fileUtils.flushFilePath(filePath);

      expect(realpathSyncNativeStub.calledOnce).to.equal(true);
      expect(realpathSyncNativeStub.args[0][0]).to.equal(filePath);

      realpathSyncNativeStub.restore();
    });

    it('should return a path when a path is passed in', async () => {
      const filePath = 'c:\\Users\\temp\\exampleFile.js';
      realpathSyncNativeStub.returns(filePath);

      const result = fileUtils.flushFilePath(filePath);

      expect(result).to.equal(filePath);

      realpathSyncNativeStub.restore();
    });

    it('should return an empty string when an empty sting is passed in', async () => {
      const filePath = 'c:\\Users\\temp\\exampleFile.js';
      realpathSyncNativeStub.returns('');

      const result = fileUtils.flushFilePath(filePath);

      expect(result).to.equal('');

      realpathSyncNativeStub.restore();
    });

    it('should validate the correct path is returned when running on Windows', async () => {
      const filePath = 'c:\\Users\\User Name\\foo.cls';
      const realpathSyncFilePath = 'C:\\Users\\User Name\\foo.cls';
      realpathSyncNativeStub.returns(realpathSyncFilePath);
      const processPlatformStub = sinon
        .stub(process, 'platform')
        .value('win32');

      const result = fileUtils.flushFilePath(filePath);

      expect(result).to.equal(filePath);

      processPlatformStub.restore();
      realpathSyncNativeStub.restore();
    });
  });

  describe('flushFilePaths', () => {
    it('should return the same paths that are passed in', async () => {
      const filePaths = ['file1.js', 'file2.js', 'file3.js'];
      realpathSyncNativeStub.returns(filePaths[0]);

      const result = fileUtils.flushFilePaths(filePaths);

      expect(result).to.equal(filePaths);

      realpathSyncNativeStub.restore();
    });
  });
});
