/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { expect } from 'chai';
import { join } from 'path';
import { PathStrategyFactory } from '../../../../src/commands/util';

describe('Source Path Strategies', () => {
  describe('DefaultPathStrategy', () => {
    it('Should build a default path', () => {
      const strategy = PathStrategyFactory.createDefaultStrategy();
      const path = strategy.getPathToSource('/folder', 'cmp', '.a');
      expect(path).to.equal(join('/folder', 'cmp.a'));
    });
  });

  describe('BundlePathStrategy', () => {
    it('Should build a bundle path', () => {
      const strategy = PathStrategyFactory.createBundleStrategy();
      const path = strategy.getPathToSource('/folder', 'cmp', '.a');
      expect(path).to.equal(join('/folder', 'cmp', 'cmp.a'));
    });
  });

  describe('WaveTemplateBundlePathStrategy', () => {
    it('Should build a wave template bundle path', () => {
      const strategy = PathStrategyFactory.createWaveTemplateBundleStrategy();
      const path = strategy.getPathToSource('/folder', 'name', '.a');
      expect(path).to.equal(join('/folder', 'name', 'template-info.a'));
    });
  });
});
