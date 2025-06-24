/**
 * * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/

import typescriptEslint from '@typescript-eslint/eslint-plugin';
import stylistic from '@stylistic/eslint-plugin-ts';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';
import header from '@tony.ganchev/eslint-plugin-header';
import eslintPluginImport, { __esModule } from 'eslint-plugin-import';
import eslintPluginJsdoc from 'eslint-plugin-jsdoc';
import eslintPluginJestFormatting from 'eslint-plugin-jest-formatting';
import eslintPluginPreferArrow from 'eslint-plugin-prefer-arrow';
import eslintConfigPrettier from 'eslint-config-prettier/flat';
import eslintPluginJest from 'eslint-plugin-jest';
import eslintPluginUnicorn from 'eslint-plugin-unicorn';

import noDuplicateI18nValues from './eslint-local-rules/no-duplicate-i18n-values.js';

const localRules = {
  'no-duplicate-i18n-values': noDuplicateI18nValues
};

export default [
  {
    ignores: [
      '**/out/**',
      '**/dist/**',
      '**/packages/**/coverage',
      '**/*.d.ts',
      '**/jest.config.js',
      '**/jest.integration.config.js',
      'packages/salesforcedx-visualforce-markup-language-server/src/**',
      'packages/salesforcedx-apex-replay-debugger/src/**',
      'test-assets/**',
      'packages/salesforcedx-sobjects-faux-generator/scripts/**',
      'packages/salesforcedx-sobjects-faux-generator/coverage/**',
      'packages/salesforcedx-vscode-soql/test/vscode-integration',
      'packages/salesforcedx-vscode-soql/test/ui-test/resources/.mocharc-debug.ts',
      'packages/salesforcedx-vscode-lwc/test/vscode-integration',
      'packages/salesforcedx-vscode-core/test/vscode-integration/**',
      'scripts/installVSIXFromBranch.ts',
      'scripts/vsce-bundled-extension.ts',
      'scripts/reportInstalls.ts'
    ]
  },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        projectService: true,
        sourceType: 'module',
        ecmaVersion: 2020,
        globals: {
          ...globals.browser
        }
      }
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      header: header,
      import: eslintPluginImport,
      jsdoc: eslintPluginJsdoc,
      'jest-formatting': eslintPluginJestFormatting,
      'prefer-arrow': eslintPluginPreferArrow,
      '@stylistic/eslint-plugin-ts': stylistic,
      unicorn: eslintPluginUnicorn,
      local: { rules: localRules }
    },
    rules: {
      'local/no-duplicate-i18n-values': 'error',
      'unicorn/consistent-empty-array-spread': 'error',
      'unicorn/consistent-function-scoping': 'error',
      'unicorn/explicit-length-check': 'error',
      'unicorn/no-instanceof-builtins': 'error',
      'unicorn/no-useless-fallback-in-spread': 'error',
      'unicorn/no-useless-length-check': 'error',
      'unicorn/no-useless-promise-resolve-reject': 'error',
      'unicorn/no-useless-spread': 'error',
      'unicorn/prefer-at': 'error',
      'unicorn/prefer-array-find': 'error',
      'unicorn/prefer-includes': 'error',

      'unicorn/prefer-node-protocol': 'error',
      'unicorn/prefer-object-from-entries': 'error',
      'unicorn/prefer-optional-catch-binding': 'error',
      'unicorn/filename-case': [
        'error',
        {
          case: 'camelCase'
        }
      ],
      'header/header': [
        'error',
        'block',
        [
          '',
          {
            pattern: ' \\* Copyright \\(c\\) \\d{4}, salesforce\\.com, inc\\.',
            template: ' * Copyright (c) 2025, salesforce.com, inc.'
          },
          ' * All rights reserved.',
          ' * Licensed under the BSD 3-Clause license.',
          ' * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause',
          ' '
        ]
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          args: 'none',
          ignoreRestSiblings: true
        }
      ],
      '@typescript-eslint/adjacent-overload-signatures': 'error',
      '@typescript-eslint/class-literal-property-style': 'error',
      '@typescript-eslint/consistent-type-assertions': ['error', { assertionStyle: 'never' }],
      '@typescript-eslint/array-type': ['error', { default: 'array' }],
      '@typescript-eslint/no-restricted-types': [
        'warn',
        {
          types: {
            Object: { message: 'Avoid using the `Object` type. Did you mean `object`?' },
            Function: {
              message: 'Avoid using the `Function` type. Prefer a specific function type, like `() => void`.'
            },
            Boolean: { message: 'Avoid using the `Boolean` type. Did you mean `boolean`?' },
            Number: { message: 'Avoid using the `Number` type. Did you mean `number`?' },
            String: { message: 'Avoid using the `String` type. Did you mean `string`?' },
            Symbol: { message: 'Avoid using the `Symbol` type. Did you mean `symbol`?' }
          }
        }
      ],
      '@typescript-eslint/no-floating-promises': 'warn',
      '@typescript-eslint/no-misused-promises': 'warn',
      '@typescript-eslint/no-misused-spread': 'error',
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-enum-comparison': 'error',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/unbound-method': 'warn',
      'prefer-arrow/prefer-arrow-functions': ['error', {}],
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-member-accessibility': [
        'error',
        { accessibility: 'explicit', overrides: { constructors: 'no-public' } }
      ],
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@stylistic/eslint-plugin-ts/member-delimiter-style': [
        'error',
        {
          multiline: {
            delimiter: 'semi',
            requireLast: true
          },
          singleline: {
            delimiter: 'semi',
            requireLast: false
          }
        }
      ],
      '@typescript-eslint/member-ordering': 'off',
      '@typescript-eslint/naming-convention': [
        'off',
        {
          selector: 'variable',
          format: ['camelCase', 'UPPER_CASE'],
          leadingUnderscore: 'forbid',
          trailingUnderscore: 'forbid'
        }
      ],
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-empty-interface': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-misused-new': 'error',
      '@typescript-eslint/no-namespace': 'off',
      '@typescript-eslint/no-parameter-properties': 'off',
      '@typescript-eslint/no-shadow': [
        'error',
        {
          hoist: 'all'
        }
      ],
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/prefer-function-type': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@stylistic/eslint-plugin-ts/quotes': [
        'error',
        'single',
        {
          avoidEscape: true
        }
      ],
      '@stylistic/eslint-plugin-ts/semi': ['error', 'always'],
      '@typescript-eslint/triple-slash-reference': [
        'error',
        {
          path: 'always',
          types: 'prefer-import',
          lib: 'always'
        }
      ],
      '@typescript-eslint/typedef': 'off',
      '@typescript-eslint/no-redundant-type-constituents': 'warn',
      '@typescript-eslint/unified-signatures': 'error',
      '@typescript-eslint/restrict-template-expressions': [
        'warn',
        {
          allowNumber: true,
          allowBoolean: true,
          allowAny: false,
          allowNullish: true
        }
      ],
      'arrow-body-style': ['error', 'as-needed'],
      'arrow-parens': ['error', 'as-needed'],
      'comma-dangle': 'error',
      complexity: 'off',
      'constructor-super': 'error',
      curly: ['error', 'multi-line'],
      'dot-notation': 'off',
      eqeqeq: ['error', 'smart'],
      'guard-for-in': 'error',
      'id-denylist': 'error',
      'id-match': 'error',
      'import/no-empty-named-blocks': 'error',
      'import/newline-after-import': 'error',
      'import/no-cycle': 'error',
      'import/no-extraneous-dependencies': ['error', { devDependencies: ['**/test/**', '**/scripts/**'] }],
      'import/order': [
        'error',
        {
          alphabetize: {
            caseInsensitive: true,
            order: 'asc'
          },
          'newlines-between': 'ignore',
          groups: [['builtin', 'external', 'internal', 'unknown', 'object', 'type'], 'parent', ['sibling', 'index']],
          distinctGroup: false,
          pathGroupsExcludedImportTypes: [],
          pathGroups: [
            {
              pattern: './',
              patternOptions: {
                nocomment: true,
                dot: true
              },
              group: 'sibling',
              position: 'before'
            },
            {
              pattern: '.',
              patternOptions: {
                nocomment: true,
                dot: true
              },
              group: 'sibling',
              position: 'before'
            },
            {
              pattern: '..',
              patternOptions: {
                nocomment: true,
                dot: true
              },
              group: 'parent',
              position: 'before'
            },
            {
              pattern: '../',
              patternOptions: {
                nocomment: true,
                dot: true
              },
              group: 'parent',
              position: 'before'
            }
          ]
        }
      ],
      'import/no-self-import': 'error',
      'jsdoc/check-alignment': 'error',
      'jsdoc/check-indentation': 'error',
      'jsdoc/newline-after-description': 'off',
      'max-classes-per-file': 'off',
      'max-len': 'off',
      'new-parens': 'error',
      'no-bitwise': 'off',
      'no-caller': 'error',
      'no-cond-assign': 'error',
      'no-console': 'off',
      'no-debugger': 'error',
      'no-duplicate-imports': 'error',
      'no-empty': 'off',
      'no-empty-function': 'off',
      'no-eval': 'error',
      'no-fallthrough': 'off',
      'no-invalid-this': 'off',
      'no-new-wrappers': 'error',
      'no-param-reassign': 'error',
      'no-shadow': 'off',
      'no-self-assign': 'error',
      'no-self-compare': 'error',
      'no-throw-literal': 'error',
      'no-trailing-spaces': 'error',
      'no-undef-init': 'error',
      'no-underscore-dangle': 'off',
      'no-unsafe-finally': 'error',
      'no-unused-expressions': 'off',
      'no-unused-labels': 'error',
      'no-use-before-define': 'off',
      'no-useless-catch': 'error',
      'no-useless-computed-key': 'error',
      'no-useless-constructor': 'off',
      'no-useless-return': 'error',
      '@typescript-eslint/no-useless-constructor': 'error',
      'no-var': 'error',
      'object-shorthand': 'error',
      'one-var': ['error', 'never'],
      'prefer-arrow/prefer-arrow-functions': ['warn', {}],
      'prefer-const': 'error',
      'prefer-object-spread': 'error',
      'prefer-template': 'error',
      'quote-props': ['error', 'as-needed'],
      quotes: 'off',
      radix: 'error',
      semi: 'off',
      'spaced-comment': [
        'off',
        'always',
        {
          markers: ['/']
        }
      ],
      'use-isnan': 'error',
      'valid-typeof': 'off'
    }
  },
  {
    rules: {
      'guard-for-in': 'warn',
      'no-prototype-builtins': 'warn',
      'no-useless-escape': 'warn'
    }
  },
  {
    files: ['packages/salesforcedx**/test/jest/**/*', 'packages/salesforcedx**/test/unit/**/*'],
    plugins: {
      '@typescript-eslint': typescriptEslint,
      jest: eslintPluginJest
    },
    rules: {
      'unicorn/filename-case': 'off',
      'unicorn/consistent-function-scoping': 'off',

      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '.*Mock$|.*Stub$|.*Spy$',
          args: 'none',
          argsIgnorePattern: '.*',
          ignoreRestSiblings: true
        }
      ],
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/unbound-method': 'off',
      'jest/unbound-method': 'error',
      'no-useless-constructor': 'off',
      'no-param-reassign': 'off'
    }
  },
  {
    // Override header rules
    files: [
      'packages/salesforcedx-visualforce-markup-language-server/**/*.ts',
      'packages/salesforcedx-visualforce-language-server/**/*.ts'
    ],
    rules: {
      'header/header': 'off'
    }
  },
  eslintConfigPrettier
];
