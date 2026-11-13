/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { preferEffectArrayEnsure } from '../src/preferEffectArrayEnsure';

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'prefer-effect-array-ensure-'));
const filename = (section: string): string => path.join(directory, section, 'src', 'nested', 'subject.ts');

beforeAll(() => {
  for (const section of ['dependencies', 'devDependencies', 'peerDependencies']) {
    fs.mkdirSync(path.dirname(filename(section)), { recursive: true });
    fs.writeFileSync(path.join(directory, section, 'package.json'), JSON.stringify({ [section]: { effect: '*' } }));
  }
  // The nearest package wins even when its parent consumes Effect.
  fs.mkdirSync(path.join(directory, 'dependencies', 'no-effect'), { recursive: true });
  fs.writeFileSync(path.join(directory, 'dependencies', 'no-effect', 'package.json'), '{}');
  fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify({ optionalDependencies: { effect: '*' } }));
});

afterAll(() => fs.rmSync(directory, { recursive: true, force: true }));

const ruleTester = new RuleTester({
  defaultFilenames: { ts: filename('dependencies'), tsx: filename('dependencies') }
});

ruleTester.run('prefer-effect-array-ensure', preferEffectArrayEnsure, {
  valid: [
    // Non-Effect packages, including a nested package inside an Effect consumer.
    { code: 'Array.isArray(value) ? value : [value]', filename: path.join(directory, 'subject.ts') },
    {
      code: 'Array.isArray(value) ? value : [value]',
      filename: path.join(directory, 'dependencies', 'no-effect', 'subject.ts')
    },
    {
      code: '!Array.isArray(value) ? [value] : value',
      filename: path.join(directory, 'dependencies', 'no-effect', 'subject.ts')
    },
    // Calls and expressions that can change between evaluations.
    'Array.isArray(getValue()) ? getValue() : [getValue()]',
    '!Array.isArray(getValue()) ? [getValue()] : getValue()',
    'Array.isArray(getValue().items) ? getValue().items : [getValue().items]',
    'Array.isArray(values[getKey()]) ? values[getKey()] : [values[getKey()]]',
    'Array.isArray(values[index++]) ? values[index++] : [values[index++]]',
    'Array.isArray(value = next) ? (value = next) : [value = next]',
    'Array.isArray(values[a + b]) ? values[a + b] : [values[a + b]]',
    'Array.isArray(getValue()?.items) ? getValue()?.items : [getValue()?.items]',
    'Array.isArray(values?.[getKey()]) ? values?.[getKey()] : [values?.[getKey()]]',
    // Shape checks, payload discrimination, transformations, and element selection.
    'Array.isArray(value)',
    'Array.isArray(value) ? value : value.items',
    'Array.isArray(value) ? value.map(transform) : [value]',
    'Array.isArray(value) ? value[0] : value',
    'if (Array.isArray(value)) throw new Error("multiple inputs");',
    // Preserve undefined fallbacks, nested arrays, and conditional fallback logic.
    'Array.isArray(value) ? value : value === undefined ? [] : [value]',
    'Array.isArray(value) ? value : [value ?? fallback]',
    'Array.isArray(value) ? value : []',
    'Array.isArray(value) ? [value] : [[value]]',
    'Array.isArray(value) ? value : [[value]]',
    'if (args !== undefined && Array.isArray(args)) { args = Array.isArray(args[0]) ? args[0] : args; }',
    // Different values, extra elements, holes, spreads, and reversed branches.
    'Array.isArray(value) ? other : [value]',
    'Array.isArray(value) ? value : [other]',
    'Array.isArray(value.items) ? value.items : [value.other]',
    'Array.isArray(values[key]) ? values[key] : [values[other]]',
    'Array.isArray(values[key]) ? values.key : [values[key]]',
    'Array.isArray(value?.items) ? value.items : [value?.items]',
    'Array.isArray(value?.items) ? value?.items : [value.items]',
    'Array.isArray(value?.items.other) ? value.items?.other : [value?.items.other]',
    'Array.isArray(value?.items.other) ? (value?.items).other : [value?.items.other]',
    'Array.isArray(value) ? value : [value, other]',
    'Array.isArray(value) ? value : [value, ,]',
    'Array.isArray(value) ? value : [...value]',
    'Array.isArray(value) ? [value] : value',
    '!Array.isArray(value) ? value : [value]',
    'other.isArray(value) ? value : [value]',
    'function normalize(Array, value) { return Array.isArray(value) ? value : [value]; }',
    'Arr.ensure(value)'
  ],
  invalid: [
    ...['dependencies', 'devDependencies', 'peerDependencies'].flatMap(section =>
      ['Array.isArray(value) ? value : [value]', '!Array.isArray(value) ? [value] : value'].map(code => ({
        code,
        filename: filename(section),
        errors: [{ messageId: 'useEnsure' as const, data: { value: 'value' } }],
        output: null
      }))
    ),
    ...[
      [
        'Array.isArray(result.response.items) ? result.response.items : [result.response.items]',
        'result.response.items'
      ],
      ['!Array.isArray(result.items) ? [result.items] : result.items', 'result.items'],
      ['Array.isArray(result?.items) ? result?.items : [result?.items]', 'result?.items'],
      ['!Array.isArray(result?.items) ? [result?.items] : result?.items', 'result?.items'],
      [
        'Array.isArray(result?.response.items) ? result?.response.items : [result?.response.items]',
        'result?.response.items'
      ],
      [
        'Array.isArray(result.response?.items) ? result.response?.items : [result.response?.items]',
        'result.response?.items'
      ],
      [
        'Array.isArray((result?.response).items) ? (result?.response).items : [(result?.response).items]',
        '(result?.response).items'
      ],
      [
        "Array.isArray(schema['xsd:element']) ? schema[\"xsd:element\"] : [schema['xsd:element']]",
        "schema['xsd:element']"
      ],
      ['Array.isArray(values[0]) ? values[0] : [values[0]]', 'values[0]'],
      [
        "Array.isArray(schema?.['xsd:element']) ? schema?.[\"xsd:element\"] : [schema?.['xsd:element']]",
        "schema?.['xsd:element']"
      ],
      ['Array.isArray(values?.[0]) ? values?.[0] : [values?.[0]]', 'values?.[0]'],
      ['Array.isArray(values?.[key]) ? values?.[key] : [values?.[key]]', 'values?.[key]'],
      ['Array.isArray(values[key].items) ? values[key].items : [values[key].items]', 'values[key].items'],
      ['Array.isArray(result . items) ? result.items : [result /* comment */ .items]', 'result . items'],
      ['Array.isArray((value)) ? (value) : [(value)]', 'value'],
      [
        'function normalize(value) { if (value === undefined) return []; return Array.isArray(value) ? value : [value]; }',
        'value'
      ]
    ].map(([code, value]) => ({
      code,
      errors: [{ messageId: 'useEnsure' as const, data: { value } }],
      output: null
    }))
  ]
});
