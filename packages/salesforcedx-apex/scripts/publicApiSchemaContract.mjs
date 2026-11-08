/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const compare = (left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right));
const sortedEntries = object => Object.entries(object).sort(([left], [right]) => left.localeCompare(right));

// Compare validation keywords, not definition allocation, metadata, or key/union ordering.
const normalizeSchema = (schema, root) => {
  if (Array.isArray(schema)) return schema.map(value => normalizeSchema(value, root));
  if (typeof schema !== 'object' || schema === null) return schema;
  if (schema.$ref) {
    return normalizeSchema(
      schema.$ref
        .split('/')
        .slice(1)
        .reduce((value, key) => value[key], root),
      root
    );
  }
  return Object.fromEntries(
    sortedEntries(schema).flatMap(([key, value]) => {
      if (['$schema', '$defs', '$id', 'title', 'description'].includes(key)) return [];
      if (key === 'required') return value.length === 0 ? [] : [[key, value.toSorted()]];
      if (key === 'enum') return [[key, value.toSorted(compare)]];
      if (key === 'properties') {
        return Object.keys(value).length === 0
          ? []
          : [
              [
                key,
                Object.fromEntries(sortedEntries(value).map(([name, field]) => [name, normalizeSchema(field, root)]))
              ]
            ];
      }
      if (key === 'anyOf') {
        return [
          [
            key,
            value
              .map(member => normalizeSchema(member, root))
              .flatMap(member => member.anyOf ?? [member])
              .toSorted(compare)
          ]
        ];
      }
      const normalized = normalizeSchema(value, root);
      if (
        key === 'additionalProperties' &&
        (normalized === true || (typeof normalized === 'object' && Object.keys(normalized).length === 0))
      )
        return [];
      return [[key, normalized]];
    })
  );
};

export const publicApiSchemaHash = schema =>
  createHash('sha256')
    .update(JSON.stringify(normalizeSchema(schema, schema)))
    .digest('hex');

// Effect V4 validation tightens Salesforce IDs and coverage counts from the develop contract.
assert.equal(
  publicApiSchemaHash(JSON.parse(readFileSync(new URL('../schemas/public-api.schema.json', import.meta.url), 'utf8'))),
  '939315e0b44a219b73ccf40b37cd563a46b339a9aed478965047940c1089d34e',
  'Apex public JSON validation changed from the reviewed Effect V4 contract'
);
