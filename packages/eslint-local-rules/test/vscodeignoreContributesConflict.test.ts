/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import * as fs from 'node:fs';

import { vscodeignoreContributesConflict } from '../src/vscodeignoreContributesConflict';
import { filterByRule } from './jsonLintHelper';
import { createVscodeignoreLinter } from './vscodeignoreLintHelper';

const RULE_NAME = 'vscodeignore-contributes-conflict';
const FIXTURES = path.resolve(__dirname, 'fixtures');
const fixtureFile = (relativePath: string) => fs.readFileSync(path.join(FIXTURES, relativePath), 'utf-8');
const fixturePath = (relativePath: string) => path.join(FIXTURES, relativePath);

describe('vscodeignore-contributes-conflict', () => {
  it('should be exported', () => {
    expect(vscodeignoreContributesConflict).toBeDefined();
    expect(vscodeignoreContributesConflict.meta?.type).toBe('problem');
  });

  describe('with Linter', () => {
    const lint = createVscodeignoreLinter(RULE_NAME, vscodeignoreContributesConflict);

    it('should pass when package.json has no contributes', () => {
      // no-unused-i18n fixture has no contributes paths — should produce no errors
      const errors = filterByRule(
        lint('node_modules\nout/**\n', fixturePath('no-unused-i18n/.vscodeignore')),
        RULE_NAME
      );
      expect(errors).toHaveLength(0);
    });

    it('should pass when vscodeignore does not exclude any contribute paths', () => {
      const content = 'node_modules\nout/**\nsrc/**\n';
      const errors = filterByRule(lint(content, fixturePath('contributes-conflict/.vscodeignore')), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should error when a pattern exactly matches a contribute directory', () => {
      // "syntaxes" would exclude "syntaxes/myLang.configuration.json"
      const content = 'node_modules\nsyntaxes\n';
      const errors = filterByRule(lint(content, fixturePath('contributes-conflict/.vscodeignore')), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('conflictsWithContributes');
      expect(errors[0].message).toContain('syntaxes');
    });

    it('should error when a glob pattern matches a contribute path', () => {
      // "syntaxes/**" would exclude "syntaxes/myLang.configuration.json"
      const content = 'node_modules\nsyntaxes/**\n';
      const errors = filterByRule(lint(content, fixturePath('contributes-conflict/.vscodeignore')), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('conflictsWithContributes');
    });

    it('should error when a pattern matches a contribute path directly', () => {
      // exact match for the grammar path
      const content = 'node_modules\ngrammars/myLang.tmLanguage\n';
      const errors = filterByRule(lint(content, fixturePath('contributes-conflict/.vscodeignore')), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('grammars/myLang.tmLanguage');
    });

    it('should skip comment lines', () => {
      const content = '# syntaxes\nnode_modules\n';
      const errors = filterByRule(lint(content, fixturePath('contributes-conflict/.vscodeignore')), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should skip negation patterns', () => {
      const content = '!syntaxes\nnode_modules\n';
      const errors = filterByRule(lint(content, fixturePath('contributes-conflict/.vscodeignore')), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should report the correct line number', () => {
      const content = 'node_modules\nout/**\nsyntaxes\n';
      const errors = filterByRule(lint(content, fixturePath('contributes-conflict/.vscodeignore')), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].line).toBe(3);
    });

    it('should detect conflict with bare image path (no ./ prefix)', () => {
      // "images" would exclude "images/icon.png" (top-level icon) and "images/light/my-icon.svg" etc.
      const content = 'node_modules\nimages\n';
      const errors = filterByRule(lint(content, fixturePath('contributes-conflict/.vscodeignore')), RULE_NAME);
      expect(errors).toHaveLength(1);
      expect(errors[0].messageId).toBe('conflictsWithContributes');
      expect(errors[0].message).toContain('images');
    });

    it('should pass on a real package .vscodeignore without contributes conflicts', () => {
      const realPath = path.resolve(__dirname, '../../salesforcedx-vscode-org-browser/.vscodeignore');
      const content = fs.readFileSync(realPath, 'utf-8');
      const errors = filterByRule(lint(content, realPath), RULE_NAME);
      expect(errors).toHaveLength(0);
    });

    it('should pass when the fixture vscodeignore file itself is used', () => {
      const content = fixtureFile('contributes-conflict/.vscodeignore');
      // fixture has "syntaxes" which conflicts — should error
      const errors = filterByRule(lint(content, fixturePath('contributes-conflict/.vscodeignore')), RULE_NAME);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0].messageId).toBe('conflictsWithContributes');
    });
  });
});
