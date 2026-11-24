/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { ESLint } from 'eslint';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { noDuplicateErrorMessageConversion } from '../src/noDuplicateErrorMessageConversion';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'no-duplicate-error-message-conversion-'));
const filename = (section: string): string => path.join(directory, section, 'src', 'nested', 'subject.ts');
const canonicalHelper = path.resolve(__dirname, '../../salesforcedx-utils/src/helpers/getErrorMessage.ts');

beforeAll(() => {
  ['dependencies', 'devDependencies', 'peerDependencies'].forEach(section => {
    fs.mkdirSync(path.dirname(filename(section)), { recursive: true });
    fs.writeFileSync(
      path.join(directory, section, 'package.json'),
      JSON.stringify({ [section]: { '@salesforce/effect-ext-utils': '*' } })
    );
  });
  fs.writeFileSync(
    path.join(directory, 'package.json'),
    JSON.stringify({ dependencies: { '@salesforce/effect-ext-utils': '*' } })
  );
  fs.mkdirSync(path.join(directory, 'no-effect'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'no-effect', 'package.json'), '{}');
});

afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));

const ruleTester = new RuleTester({
  defaultFilenames: { ts: filename('dependencies'), tsx: filename('dependencies') }
});

ruleTester.run('no-duplicate-error-message-conversion', noDuplicateErrorMessageConversion, {
  valid: [
    { code: fs.readFileSync(canonicalHelper, 'utf8'), filename: canonicalHelper },
    { code: fs.readFileSync(canonicalHelper, 'utf8'), filename: canonicalHelper.replaceAll('/', '\\') },
    'getMessageFromError(error)',
    'getErrorMessage(error)',
    // Intentionally different formatting must not be replaced.
    'isError(error) ? error.stack : String(error)',
    'isError(error) ? error.message : JSON.stringify(error, null, 2)',
    'error instanceof Error ? error.message : "Unknown error"',
    'isError(error) ? `Error: ${error.message}` : String(error)',
    'isError(error) ? error.message.trim() : String(error)',
    'isError(error) ? error : new Error(String(error))',
    'isError(error) ? error.message : error.toString()',
    // Each expression must refer to the same value.
    'isError(error) ? other.message : String(error)',
    'isError(error) ? error.message : String(other)',
    'error instanceof OtherError ? error.message : String(error)',
    'isError(error.cause) ? error.other.message : String(error.cause)',
    'isError(getError()) ? getError().message : String(getError())',
    'isError(errors[index++]) ? errors[index++].message : String(errors[index++])',
    // Repeated property reads can invoke getters or proxy traps.
    'isError(error.cause) ? error.cause.message : String(error.cause)',
    'error.cause instanceof Error ? error.cause.message : String(error.cause)',
    'isError(errors[0]) ? errors[0].message : String(errors[0])',
    `let reads = 0;
     const subject = { get value() { return reads++ === 0 ? new Error('first') : 'second'; } };
     isError(subject.value) ? subject.value.message : String(subject.value);`,
    // Optional calls and shadowed built-ins are not equivalent.
    'isError?.(error) ? error.message : String(error)',
    'isError(error) ? error?.message : String(error)',
    'isError(error) ? error.message : String?.(error)',
    'isError(error, other) ? error.message : String(error)',
    'isError(error) ? error.message : String(error, other)',
    'function format(String, error) { return isError(error) ? error.message : String(error); }',
    'function format(Error, error) { return error instanceof Error ? error.message : String(error); }'
  ],
  invalid: [
    ...['dependencies', 'devDependencies', 'peerDependencies', 'no-effect'].flatMap(section =>
      ['isError(value) ? value.message : String(value)', 'value instanceof Error ? value.message : String(value)'].map(
        code => ({
          code,
          filename: filename(section),
          errors: [
            {
              messageId: 'useErrorMessageHelper' as const,
              data: {
                helper: section === 'no-effect' ? 'getErrorMessage' : 'getMessageFromError',
                packageName: section === 'no-effect' ? '@salesforce/salesforcedx-utils' : '@salesforce/effect-ext-utils'
              }
            }
          ],
          output: null
        })
      )
    ),
    ...[
      // Representative snippets removed by PR #8587.
      'const getErrorMessage = (error: unknown): string => (isError(error) ? error.message : String(error));',
      'Effect.try({ try: parse, catch: cause => new XsdParseError({ message: isError(cause) ? cause.message : String(cause) }) })',
      'const message = nls.localize("error_run_soql_query", isError(err) ? err.message : String(err));',
      'const detail = err instanceof Error ? err.message : String(err);',
      'const isWindowClosedError = (error: unknown): boolean => { const message = error instanceof Error ? error.message : String(error); return message.includes("has been closed") || message.includes("Target page"); };',
      'isError((error)) ? error /* comment */ .message : String(error)'
    ].map(code => ({
      code,
      errors: [
        {
          messageId: 'useErrorMessageHelper' as const,
          data: { helper: 'getMessageFromError', packageName: '@salesforce/effect-ext-utils' }
        }
      ],
      output: null
    })),
    // The canonical filename or function name alone must not exempt a duplicate.
    {
      code: fs.readFileSync(canonicalHelper, 'utf8'),
      filename: path.join(directory, 'no-effect', 'src', 'helpers', 'getErrorMessage.ts'),
      errors: [
        {
          messageId: 'useErrorMessageHelper',
          data: { helper: 'getErrorMessage', packageName: '@salesforce/salesforcedx-utils' }
        }
      ],
      output: null
    }
  ]
});

it.each([
  'packages/salesforcedx-vscode-apex-testing/src/services/fsServiceFileOutput.ts',
  'packages/salesforcedx-lwc-language-server/test/lwcServerNode.test.ts'
])('enables duplicate-conversion checks for %s', async filePath => {
  const eslint = new ESLint({ cwd: path.resolve(__dirname, '../../..') });
  const config = await eslint.calculateConfigForFile(filePath);
  expect(config.rules['local/no-duplicate-error-message-conversion']).toEqual([2]);
});
