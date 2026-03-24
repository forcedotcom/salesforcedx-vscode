/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import * as fs from 'node:fs';

import { vscodeignoreRequiredPatterns } from '../src/vscodeignoreRequiredPatterns';
import { filterByRule } from './jsonLintHelper';
import { createVscodeignoreLinter } from './vscodeignoreLintHelper';

const RULE_NAME = 'vscodeignore-required-patterns';
const FIXTURES = path.resolve(__dirname, 'fixtures');
const readFixtureFile = (relativePath: string) => fs.readFileSync(path.join(FIXTURES, relativePath), 'utf-8');

describe('vscodeignore-required-patterns', () => {
  it('should be exported', () => {
    expect(vscodeignoreRequiredPatterns).toBeDefined();
    expect(vscodeignoreRequiredPatterns.meta).toBeDefined();
    expect(vscodeignoreRequiredPatterns.meta?.type).toBe('problem');
  });

  describe('with Linter', () => {
    const lintVscodeignore = createVscodeignoreLinter(RULE_NAME, vscodeignoreRequiredPatterns);

    it('should pass when sibling package has no browser field', () => {
      const fixturePath = path.join(FIXTURES, 'no-unused-i18n/.vscodeignore');
      const errors = filterByRule(lintVscodeignore('node_modules', fixturePath), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should error when .vscodeignore is missing required patterns', () => {
      // fixture/.vscodeignore omits **/*.node — all other required entries present
      const fixturePath = path.join(FIXTURES, 'missing-node-pattern/.vscodeignore');
      const errors = filterByRule(
        lintVscodeignore(readFixtureFile('missing-node-pattern/.vscodeignore'), fixturePath),
        RULE_NAME
      );
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('missingRequiredPattern');
      expect(errors[0].message).toContain('**/*.node');
    });

    it('should pass when .vscodeignore is valid', () => {
      const fixturePath = path.resolve(__dirname, '../../salesforcedx-vscode-org-browser/.vscodeignore');
      const errors = filterByRule(
        lintVscodeignore(fs.readFileSync(fixturePath, 'utf-8'), fixturePath),
        RULE_NAME
      );
      expect(errors).toHaveLength(0);
    });

    it('should error when existing directory is not in .vscodeignore', () => {
      // fixture has a scripts/ directory but .vscodeignore omits scripts/**
      const fixturePath = path.join(FIXTURES, 'missing-dir-pattern/.vscodeignore');
      const errors = filterByRule(
        lintVscodeignore(readFixtureFile('missing-dir-pattern/.vscodeignore'), fixturePath),
        RULE_NAME
      );
      const scriptError = errors.find(
        e => e.messageId === 'missingExistingDirPattern' && e.message.includes('scripts/**')
      );
      expect(scriptError).toBeDefined();
    });
  });
});
