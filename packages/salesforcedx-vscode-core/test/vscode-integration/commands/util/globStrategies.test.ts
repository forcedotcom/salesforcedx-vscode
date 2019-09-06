/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { join } from 'path';
import { stub } from 'sinon';
import { GlobStrategyFactory } from '../../../../src/commands/util';
import { SfdxPackageDirectories } from '../../../../src/sfdxProject';

const testInput = { outputdir: '/test/folder', fileName: 'test' };

describe('Glob Strategies', () => {
  describe('CheckGivenPath', () => {
    it('Should create one glob pattern for given path', async () => {
      const strategy = GlobStrategyFactory.createCheckFileInGivenPath('.a');
      const globs = await strategy.globs(testInput);
      expect(globs.length).to.equal(1);
      expect(globs[0]).to.equal(`{${join('/test', 'folder', 'test.a')}}`);
    });
  });

  describe('CheckAllPackages', () => {
    it('Should create a glob pattern for each package directory', async () => {
      const packageDirStub = stub(
        SfdxPackageDirectories,
        'getPackageDirectoryPaths'
      );
      packageDirStub.returns(['/p1', '/p2']);
      const strategy = GlobStrategyFactory.createCheckFileInAllPackages(
        '.a',
        '.b'
      );
      const globs = await strategy.globs(testInput);
      expect(globs.length).to.equal(2);
      const p1Base = join('/p1', 'test', 'folder');
      const p2Base = join('/p2', 'test', 'folder');
      expect(globs).to.eql([
        `{${join(p1Base, 'test.a')},${join(p1Base, 'test.b')}}`,
        `{${join(p2Base, 'test.a')},${join(p2Base, 'test.b')}}`
      ]);
      packageDirStub.restore();
    });
  });
});
