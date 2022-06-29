
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
  extractJsonObject,
  flushFilePath,
  flushFilePaths
} from '../../../src/helpers';

describe('extractJsonObject', () => {
  it('should extract a JSON string from larger string and then return as an object', async () => {
    const exampleJsonString = JSON.stringify({ name: 'exampleName', error: 'exampleError' });
    const exampleString = `junk text <junk +text junk text ${exampleJsonString} junk text junk text junk text`;

    const testParse = extractJsonObject(exampleString);

    expect(testParse.name).to.equal('exampleName');
    expect(testParse.error).to.equal('exampleError');
  });
});

describe('flushFilePath', () => {
  it('should call fs.realpathSync.native() to resolve a path', async () => {
    const filePath = 'C:\\Users\\temp\\exampleFile.js';
    const realpathSyncNativeStub = sinon.stub(
      fs.realpathSync,
      'native'
    ).returns(filePath);

    const result = flushFilePath(filePath);

    expect(realpathSyncNativeStub.called).to.equal(true);
    expect(realpathSyncNativeStub.calledOnce).to.equal(true);
    expect(realpathSyncNativeStub.args[0][0]).to.equal(filePath);

    realpathSyncNativeStub.restore();
  });

  it('should return a path when a path is passed in', async () => {
    const filePath = 'C:\\Users\\temp\\exampleFile.js';
    const realpathSyncNativeStub = sinon.stub(
      fs.realpathSync,
      'native'
    ).returns(filePath);

    const result = flushFilePath(filePath);

    expect(result).to.equal(filePath);

    realpathSyncNativeStub.restore();
  });

  it('should return an empty string when an empty sting is passed in', async () => {
    const filePath = 'C:\\Users\\temp\\exampleFile.js';
    const realpathSyncNativeStub = sinon.stub(
      fs.realpathSync,
      'native'
    ).returns('');

    const result = flushFilePath(filePath);

    expect(result).to.equal('');

    realpathSyncNativeStub.restore();
  });
});

describe('flushFilePaths', () => {
  it('should return the same paths that are passed in', async () => {
    const filePaths = [
      'file.js',
      'file.js',
      'file.js',
    ];
    const realpathSyncNativeStub = sinon.stub(
      fs.realpathSync,
      'native'
    ).returns(filePaths[0]);

    const result = flushFilePaths(filePaths);

    expect(result).to.equal(filePaths);

    realpathSyncNativeStub.restore();
  });
});
