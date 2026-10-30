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

// W-24615048 is a runtime migration, not a JSON contract revision. Baseline: bb6b6458fa.
assert.equal(
  publicApiSchemaHash(JSON.parse(readFileSync(new URL('../schemas/public-api.schema.json', import.meta.url), 'utf8'))),
  '9f2619054426b7cf824185855af06081a5532e990fbfb47f3de5cd252550725d',
  'Apex public JSON validation changed from the pre-V4 contract'
);
