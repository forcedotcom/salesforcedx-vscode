/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noSchemaIsWrapper } from '../src/noSchemaIsWrapper';

const ruleTester = new RuleTester();

ruleTester.run('no-schema-is-wrapper', noSchemaIsWrapper, {
  valid: [
    'const valid = Schema.is(CoverageItem)(value);',
    'values.filter(Schema.is(CoverageItem));',
    'values.filter(value => Schema.is(CoverageItem)(value));',
    'values.filter(function(value) { return Schema.is(CoverageItem)(value); });',
    'const predicates = { isValid(value) { return Schema.is(getSchema(value))(value); } };',
    'const predicates = { isValid: value => Schema.is(CoverageItem, getOptions(value))(value) };',
    'class Predicates { isValid(value) { return Schema.is(getSchema(value))(value); } }',
    'class Predicates { isValid = value => Schema.is(CoverageItem, getOptions(value))(value); }',
    'const predicates = { [() => Schema.is(CoverageItem)]: true };',
    'class Predicates { [() => Schema.is(CoverageItem)] = true; }',
    'const isValid = value => Schema.is(First)(value) || Schema.is(Second)(value);',
    'function isValid(value) { log(value); return Schema.is(CoverageItem)(value); }',
    'const isValid = value => Schema.is(CoverageItem)(value.item);',
    'const isValid = value => !Schema.is(CoverageItem)(value);',
    'const makePredicate = schema => Schema.is(schema);',
    'function makePredicate(schema) { return Schema.is(schema); }',
    'const isValid = schema => Schema.is(schema)(schema);',
    'const isValid = value => Schema.is(getSchema(value))(value);',
    'function isValid(value) { return Schema.is(getSchema(value))(value); }',
    'const isValid = value => Schema.is(CoverageItem, getOptions(value))(value);',
    'const isValid = async value => Schema.is(CoverageItem)(value);',
    'function* isValid(value) { return Schema.is(CoverageItem)(value); }',
    'const isValid = (value, schema) => Schema.is(schema)(value);',
    'const isValid = (value = defaultValue) => Schema.is(CoverageItem)(value);',
    'const isValid = Other.is(CoverageItem);',
    'const decode = Schema.decodeUnknownSync(CoverageItem);',
    'const isValid = Schema.is(...schemas);'
  ],
  invalid: [
    'const isCodeCoverageItem = Schema.is(CoverageItem);',
    'export const isCodeCoverageItem = Schema.is(CoverageItem);',
    'const isCodeCoverageItem: (value: unknown) => boolean = Schema.is(CoverageItem);',
    'const isValid = Schema.is(Schema.Struct({ name: Schema.String }));',
    'const isValid = Schema.is(CoverageItem, { exact: true });',
    'const isValid = value => Schema.is(CoverageItem)(value);',
    'const isValid = (value: unknown): value is CoverageItem => Schema.is(CoverageItem)(value);',
    'const isValid = value => { return Schema.is(CoverageItem)(value); };',
    'function isValid(value: unknown): value is CoverageItem { return Schema.is(CoverageItem)(value); }',
    'export function isValid(value) { return Schema.is(CoverageItem)(value); }',
    'const isValid = function(value) { return Schema.is(CoverageItem)(value); };',
    'const predicates = { isValid(value) { return Schema.is(CoverageItem)(value); } };',
    'const predicates = { isValid: value => Schema.is(CoverageItem)(value) };',
    'const predicates = { isValid: function(value) { return Schema.is(CoverageItem)(value); } };',
    'const predicates = { isValid() { return Schema.is(CoverageItem); } };',
    'class Predicates { isValid(value) { return Schema.is(CoverageItem)(value); } }',
    'class Predicates { static isValid(value) { return Schema.is(CoverageItem)(value); } }',
    'class Predicates { isValid = value => Schema.is(CoverageItem)(value); }',
    'class Predicates { isValid = function(value) { return Schema.is(CoverageItem)(value); }; }',
    'class Predicates { isValid() { return Schema.is(CoverageItem); } }',
    'function isValid() { return Schema.is(CoverageItem); }',
    'const isValid = () => Schema.is(CoverageItem);',
    'const isValid = function() { return Schema.is(CoverageItem); };',
    'const isValid = value => Schema.is(CoverageItem, { exact: true })(value);',
    'const isValid = value => Schema.is(Schema.Number.pipe(Schema.filter(value => value > 0)))(value);'
  ].map(code => ({ code, errors: [{ messageId: 'useSchemaIs' as const }], output: null }))
});
