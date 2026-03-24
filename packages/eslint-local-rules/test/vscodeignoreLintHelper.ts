/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Rule, Linter as LinterType } from 'eslint';
import { Linter } from 'eslint';

import { vscodeignoreTextProcessor } from '../src/vscodeignoreTextProcessor';

/** Creates a linter helper for testing .vscodeignore ESLint rules */
export const createVscodeignoreLinter = (ruleName: string, ruleModule: Rule.RuleModule) => {
  const linter = new Linter({ configType: 'flat' });

  return (code: string, filename = 'packages/test/.vscodeignore'): LinterType.LintMessage[] => {
    const config = [
      {
        files: ['**/.vscodeignore'],
        plugins: {
          local: {
            processors: {
              vscodeignoreText: vscodeignoreTextProcessor
            },
            rules: {
              [ruleName]: ruleModule
            }
          }
        },
        processor: 'local/vscodeignoreText',
        rules: {
          [`local/${ruleName}`]: 'error'
        }
      }
    ] as LinterType.Config[];
    return linter.verify(code, config, { filename });
  };
};
