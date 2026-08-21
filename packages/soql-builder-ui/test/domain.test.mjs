import assert from 'node:assert/strict';
import test from 'node:test';
import * as Effect from 'effect/Effect';
import {
  InvalidSoqlBuilderMetadataError,
  createInitialSoqlBuilderState,
  decodeSoqlBuilderMetadata
} from '../out/src/domain.js';

test('decodes the browser-safe metadata DTO', async () => {
  const metadata = await Effect.runPromise(
    decodeSoqlBuilderMetadata({
      objects: [{ name: 'Account', label: 'Account', queryable: true }],
      fields: [
        {
          name: 'Id',
          label: 'Account ID',
          type: 'id',
          filterable: true,
          groupable: true,
          sortable: true
        }
      ]
    })
  );

  assert.equal(metadata.objects[0]?.name, 'Account');
  assert.equal(metadata.fields[0]?.name, 'Id');
});

test('rejects invalid metadata with the typed boundary error', async () => {
  const error = await Effect.runPromise(
    Effect.flip(
      decodeSoqlBuilderMetadata({
        objects: [{ name: '', label: 'Account', queryable: true }],
        fields: []
      })
    )
  );

  assert.ok(error instanceof InvalidSoqlBuilderMetadataError);
});

test('creates independent initial states', () => {
  const first = createInitialSoqlBuilderState();
  const second = createInitialSoqlBuilderState();

  assert.notEqual(first, second);
  assert.notEqual(first.metadata, second.metadata);
  assert.notEqual(first.query, second.query);
});
