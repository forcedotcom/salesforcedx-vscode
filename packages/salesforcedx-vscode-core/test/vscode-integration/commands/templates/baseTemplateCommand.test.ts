import { expect } from 'chai';
import * as path from 'path';
import {
  BundlePathStrategy,
  DefaultPathStrategy
} from '../../../../src/commands/templates/baseTemplateCommand';

it.only('successfully creates the bundle path', () => {
  const bundlePathStrategy = new BundlePathStrategy();
  const expectedPath = path.join('test-dir', 'TestClass', '.cls');
  expect(
    bundlePathStrategy.getPathToSource('test-dir', 'TestClass', '.cls')
  ).to.equal(expectedPath);
});

it('successfully creates a default source path', () => {
  const defaultPathStrategy = new DefaultPathStrategy();
  const expectedPath = path.join('test-dir', 'TestCmp', 'TestCmp.cmp');
  expect(
    defaultPathStrategy.getPathToSource('test-dir', 'TestCmp', '.cmp')
  ).to.equal(expectedPath);
});
