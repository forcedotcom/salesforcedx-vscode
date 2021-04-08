/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as fs from 'fs';
import * as path from 'path';
import { createSandbox, SinonStub } from 'sinon';
import {
  ensureDirectoryExists,
  getRelativeProjectPath,
  getTestResultsFolder
} from '../../../src/helpers';

const sb = createSandbox();
describe('paths utils', () => {
  let mkdirStub: SinonStub;
  let existsStub: SinonStub;

  beforeEach(() => {
    mkdirStub = sb.stub(fs, 'mkdirSync');
    existsStub = sb.stub(fs, 'existsSync');
  });

  afterEach(() => sb.restore());

  describe('ensureDirectoryExists', () => {
    it('should return immediately if directory already exists', () => {
      const dirPath = path.join('path', 'to', 'dir');
      existsStub.withArgs(dirPath).returns(true);

      ensureDirectoryExists(dirPath);

      expect(mkdirStub.notCalled).to.equal(true);
    });

    it('should create nested directories', () => {
      const dirPath = path.join('path', 'to');
      const path2 = path.join(dirPath, 'dir');
      const path3 = path.join(path2, 'dir2');
      existsStub.returns(false);
      existsStub.withArgs(dirPath).returns(true);

      ensureDirectoryExists(path3);

      expect(mkdirStub.firstCall.args[0]).to.equal(path2);
      expect(mkdirStub.secondCall.args[0]).to.equal(path3);
    });
  });

  describe('getTestResultsFolder', () => {
    it('should return a path to test result folder', () => {
      const dirPath = path.join('path', 'to', 'testresults');
      existsStub.returns(true);

      const result = getTestResultsFolder(dirPath, 'apex');

      expect(existsStub.called).to.equal(true);
      expect(result).to.equal(
        path.join(dirPath, '.sfdx', 'tools', 'testresults', 'apex')
      );
    });
  });

  describe('getRelativeProjectPath', () => {
    it('should return a relative project path version of an absolute path', () => {
      const relative = path.join('force-app', 'something', 'test');
      const absolute = path.join(path.sep, 'path', 'to', relative);

      const result = getRelativeProjectPath(absolute, [
        'force-app',
        'force-app-2'
      ]);

      expect(result).to.equal(relative);
    });

    it('should return the absolute path if path is not in a given package directory', () => {
      const relative = path.join('force-app', 'something', 'test');
      const absolute = path.join(path.sep, 'path', 'to', relative);

      const result = getRelativeProjectPath(absolute, [
        'test-app',
        'test-app-2'
      ]);

      expect(result).to.equal(absolute);
    });
  });
});
