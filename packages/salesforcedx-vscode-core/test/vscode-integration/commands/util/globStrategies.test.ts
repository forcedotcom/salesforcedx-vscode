import { expect } from 'chai';
import { stub } from 'sinon';
import { GlobStrategyFactory } from '../../../../src/commands/util';
import { SfdxPackageDirectories } from '../../../../src/sfdxProject';

const testInput = { outputdir: '/test/folder', fileName: 'test' };

describe('Glob Strategies', () => {
  it('Should create correct glob pattern for CheckGivenPath strategy', async () => {
    const strategy = GlobStrategyFactory.createCheckFileInGivenPath('.a');
    const globs = await strategy.globs(testInput);
    expect(globs.length).to.equal(1);
    expect(globs[0]).to.equal('{/test/folder/test.a}');
  });

  it('Should create correct glob patterns for CheckAllPackages strategy', async () => {
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
    expect(globs).to.eql([
      '{/p1/test/folder/test.a,/p1/test/folder/test.b}',
      '{/p2/test/folder/test.a,/p2/test/folder/test.b}'
    ]);
    packageDirStub.restore();
  });
});
