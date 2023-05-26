/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const year = new Date().getFullYear();

module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 6,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'jsdoc', 'eslint-plugin-header'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended'
  ],
  rules: {
    'ban-ts-ignore': 'off',
    '@typescript-eslint/ban-ts-ignore': 'off',
    '@typescript-eslint/no-unused-vars': 'off',
    camelcase: 'off',
    '@typescript-eslint/camelcase': 'off',
    'constructor-super': 'warn',
    curly: 'error',
    eqeqeq: 'error',
    'no-buffer-constructor': 'error',
    'no-caller': 'error',
    'no-debugger': 'warn',
    'no-duplicate-case': 'error',
    'no-duplicate-imports': 'error',
    'no-eval': 'error',
    'no-extra-semi': 'warn',
    'no-redeclare': 'error',
    'no-sparse-arrays': 'error',
    'no-throw-literal': 'error',
    'no-unsafe-finally': 'warn',
    'no-unused-labels': 'warn',
    'no-restricted-globals': [
      'warn',
      'name',
      'length',
      'event',
      'closed',
      'external',
      'status',
      'origin',
      'context'
    ], // non-complete list of globals that are easy to access unintentionally
    'no-var': 'error',
    'jsdoc/no-types': 'warn',
    '@typescript-eslint/semi': 'warn',
    'header/header': [
      2,
      'block',
      [
        '',
        {
          pattern: ' \\* Copyright \\(c\\) \\d{4}, salesforce\\.com, inc\\.',
          template: ` * Copyright (c) ${year}, salesforce.com, inc.`
        },
        ' * All rights reserved.',
        ' * Licensed under the BSD 3-Clause license.',
        ' * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause',
        ' '
      ]
    ]
  }
};
