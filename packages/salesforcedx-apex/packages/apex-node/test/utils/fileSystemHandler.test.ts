/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fsUtil from '../../src/common/fileSystemHandler';
import { createSandbox, SinonStub } from 'sinon';
import { expect } from 'chai';
import { join } from 'path';
import * as fs from 'fs';

const sb = createSandbox();

describe('File System Utils', () => {
  describe('ensureDirectoryExists', () => {
    let mkdirStub: SinonStub;
    let existsStub: SinonStub;

    beforeEach(() => {
      mkdirStub = sb.stub(fs, 'mkdirSync');
      existsStub = sb.stub(fs, 'existsSync');
    });

    afterEach(() => {
      sb.restore();
    });

    it('should return immediately if file or directory already exists', () => {
      const path = join('path', 'to', 'dir');
      existsStub.withArgs(path).returns(true);

      fsUtil.ensureDirectoryExists(path);

      expect(mkdirStub.notCalled).to.be.true;
    });

    it('should create nested directories as needed', () => {
      const path = join('path', 'to');
      const path2 = join(path, 'dir');
      const path3 = join(path2, 'dir2');
      existsStub.returns(false);
      existsStub.withArgs(path).returns(true);

      fsUtil.ensureDirectoryExists(path3);

      expect(mkdirStub.firstCall.args[0]).to.equal(path2);
      expect(mkdirStub.secondCall.args[0]).to.equal(path3);
    });
  });

  describe('ensureFileExists', () => {
    afterEach(() => {
      sb.restore();
    });

    it('should ensure file exists', () => {
      const path = join('path', 'to', 'a', 'file.x');
      const closeStub = sb.stub(fs, 'closeSync');
      const openStub = sb.stub(fs, 'openSync');
      openStub.returns(123);
      const existsSyncStub = sb.stub(fs, 'existsSync').returns(true);

      fsUtil.ensureFileExists(path);

      expect(existsSyncStub.calledBefore(openStub)).to.be.true;
      expect(closeStub.firstCall.args[0]).to.equal(123);
    });
  });
});
