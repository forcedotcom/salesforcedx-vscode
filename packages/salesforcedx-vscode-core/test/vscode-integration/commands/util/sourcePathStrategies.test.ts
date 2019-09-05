import { expect } from 'chai';
import { join } from 'path';
import { PathStrategyFactory } from '../../../../src/commands/util';

describe('Source Path Strategies', () => {
  it('Should correctly build path for DefaultPathStrategy', () => {
    const strategy = PathStrategyFactory.createDefaultStrategy();
    const path = strategy.getPathToSource('/folder', 'cmp', '.a');
    expect(path).to.equal(join('/folder', 'cmp.a'));
  });

  it('Should correctly build path for BundlePathStrategy', () => {
    const strategy = PathStrategyFactory.createBundleStrategy();
    const path = strategy.getPathToSource('/folder', 'cmp', '.a');
    expect(path).to.equal(join('/folder', 'cmp', 'cmp.a'));
  });
});
