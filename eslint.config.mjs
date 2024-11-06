/**
 * * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/

import typescriptEslint from '@typescript-eslint/eslint-plugin';
import eslintPluginHeader from 'eslint-plugin-header';
import eslintPluginImport from 'eslint-plugin-import';
import eslintPluginJsdoc from 'eslint-plugin-jsdoc';
import eslintPluginJestFormatting from 'eslint-plugin-jest-formatting';
import eslintPluginPreferArrow from 'eslint-plugin-prefer-arrow';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import eslintPluginJest from 'eslint-plugin-jest';

export default [
  {
    files: ['packages/**/*'],
    ignores: ['out', 'dist', '**/packages/**/coverage', '**/*.d.ts', '**/jest.config.js', 'jest.integration.config.js'],
    languageOptions: {
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
        ecmaVersion: 2020,
        globals: {
          // For Browser environment
          window: 'readonly',
          document: 'readonly',
          fetch: 'readonly'
        }
      }
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      header: eslintPluginHeader,
      import: eslintPluginImport,
      jsdoc: eslintPluginJsdoc,
      'jest-formatting': eslintPluginJestFormatting,
      'prefer-arrow': eslintPluginPreferArrow
    },
    rules: {
      'header/header': [
        'error',
        'block',
        [
          '',
          {
            pattern: ' \\* Copyright \\(c\\) \\d{4}, salesforce\\.com, inc\\.',
            template: ' * Copyright (c) 2024, salesforce.com, inc.'
          },
          ' * All rights reserved.',
          ' * Licensed under the BSD 3-Clause license.',
          ' * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause',
          ' '
        ]
      ],
      '@typescript-eslint/adjacent-overload-signatures': 'error',
      '@typescript-eslint/array-type': ['error', { default: 'array' }],
      '@typescript-eslint/await-thenable': 'warn',
      '@typescript-eslint/ban-types': [
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
      '@typescript-eslint/no-unsafe-argument': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/require-await': 'warn',
      '@typescript-eslint/prefer-for-of': 'warn',
      '@typescript-eslint/unbound-method': 'warn',
      'prefer-arrow/prefer-arrow-functions': ['error', {}],
      '@typescript-eslint/consistent-type-assertions': 'error',
      '@typescript-eslint/consistent-type-definitions': 'off',
      '@typescript-eslint/dot-notation': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/member-delimiter-style': [
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
      '@typescript-eslint/no-unused-expressions': 'error',
      '@typescript-eslint/no-use-before-define': 'off',
      '@typescript-eslint/no-var-requires': 'error',
      '@typescript-eslint/prefer-function-type': 'error',
      '@typescript-eslint/prefer-namespace-keyword': 'error',
      '@typescript-eslint/quotes': [
        'error',
        'single',
        {
          avoidEscape: true
        }
      ],
      '@typescript-eslint/semi': ['error', 'always'],
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
      'no-empty': 'off',
      'no-empty-function': 'off',
      'no-eval': 'error',
      'no-fallthrough': 'off',
      'no-invalid-this': 'off',
      'no-new-wrappers': 'error',
      'no-shadow': 'off',
      'no-throw-literal': 'error',
      'no-trailing-spaces': 'error',
      'no-undef-init': 'error',
      'no-underscore-dangle': 'off',
      'no-unsafe-finally': 'error',
      'no-unused-expressions': 'off',
      'no-unused-labels': 'error',
      'no-use-before-define': 'off',
      'no-var': 'error',
      'object-shorthand': 'error',
      'one-var': ['error', 'never'],
      'prefer-arrow/prefer-arrow-functions': ['warn', {}],
      'prefer-const': 'error',
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
      // '@typescript-eslint/no-duplicate-type-constituents': 'warn',
      // '@typescript-eslint/no-unsafe-enum-comparison': 'warn',
      'guard-for-in': 'warn',
      'no-prototype-builtins': 'warn',
      'no-useless-escape': 'warn'
    }
  },
  eslintPluginPrettierRecommended,
  {
    root: true,
    languageOptions: {
      globals: {
        // For Node environment
        process: 'readonly',
        __dirname: 'readonly',
        module: 'readonly',

        // For Browser environment
        window: 'readonly',
        document: 'readonly',
        fetch: 'readonly'
      }
    },
    files: ['packages/salesforcedx-vscode-**/src/**/*.ts', 'packages/salesforcedx-vscode-**/test/**/*.ts']
  },
  {
    root: true,
    files: ['packages/salesforcedx-(?!vscode)**/*']
  },
  {
    files: ['packages/salesforcedx**/test/jest/**/*'],
    plugins: {
      '@typescript-eslint': typescriptEslint,
      jest: eslintPluginJest
    },
    rules: {
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unused-expressions': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',
      '@typescript-eslint/restrict-template-expressions': 'warn',
      '@typescript-eslint/unbound-method': 'off',
      'jest/unbound-method': 'error'
    }
  },
  {
    files: ['packages/salesforcedx-vscode-soql/', 'packages/salesforcedx-vscode-lwc/'],
    ignores: ['test/vscode-integration']
  },
  {
    files: ['packages/salesforcedx-apex-replay-debugger/', 'packages/salesforcedx-visualforce-markup-language-server/'],
    ignores: ['src/**']
  },
  {
    files: ['packages/system-tests/'],
    ignores: ['assets', 'scenarios', 'src']
  },
  {
    files: ['packages/salesforcedx-sobjects-faux-generator/'],
    ignores: ['scripts/**', 'coverage/**']
  }
];
