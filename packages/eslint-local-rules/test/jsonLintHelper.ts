/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { Rule, Linter as LinterType } from 'eslint';
import { Linter } from 'eslint';

// CJS require needed: Jest/ts-jest runs in CJS mode. ESM `import` would resolve to
// `{ default: plugin }` but CJS require gives us `plugin` directly. With esModuleInterop: false,
// `import json from '@eslint/json'` yields undefined at runtime.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const json = require('@eslint/json') as (typeof import('@eslint/json'))['default'];

/** Creates a lintJson helper for testing a specific package.json ESLint rule */
export const createJsonLinter = (ruleName: string, ruleModule: Rule.RuleModule) => {
  const linter = new Linter({ configType: 'flat' });

  return (code: string, filename = 'packages/test/package.json'): LinterType.LintMessage[] => {
    const config = [
      {
        files: ['**/*.json'],
        plugins: {
          json: { rules: json.rules, languages: json.languages },
          local: { rules: { [ruleName]: ruleModule } }
        },
        language: 'json/json',
        rules: {
          [`local/${ruleName}`]: 'error'
        }
      }
      // Type assertion needed: @eslint/json's .d.ts emits `meta.type: string` instead of
      // the literal union `"problem" | "suggestion" | "layout"` that ESLint's Plugin type expects.
      // Runtime types are correct; only the upstream type declarations are imprecise.
    ] as LinterType.Config[];
    return linter.verify(code, config, { filename });
  };
};

/** Filter lint messages by rule ID */
export const filterByRule = (messages: LinterType.LintMessage[], ruleName: string): LinterType.LintMessage[] =>
  messages.filter(m => m.ruleId === `local/${ruleName}`);
