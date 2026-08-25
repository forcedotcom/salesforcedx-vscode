import assert from 'node:assert/strict';
import test from 'node:test';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import {
  InvalidSoqlBuilderMetadataError,
  SoqlBuilderActionSchema,
  SoqlLimitSchema,
  createInitialSoqlBuilderState,
  decodeSoqlBuilderMetadata,
  soqlLimitFromInput
} from '../out/src/domain.js';

const accountField = {
  aggregatable: false,
  custom: false,
  defaultValue: null,
  extraTypeInfo: null,
  filterable: true,
  groupable: true,
  inlineHelpText: null,
  label: 'Account ID',
  name: 'Id',
  nillable: false,
  picklistValues: [],
  referenceTo: [],
  relationshipName: null,
  sortable: true,
  type: 'id'
};

test('decodes the browser-safe metadata DTO', async () => {
  const metadata = await Effect.runPromise(
    decodeSoqlBuilderMetadata({
      objects: [{ name: 'Account', label: 'Account', queryable: true }],
      fields: [accountField],
      childRelationships: [],
      selectedObjectName: 'Account'
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
        fields: [],
        childRelationships: []
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
  assert.deepEqual(first.query.where.conditions, []);
  assert.deepEqual(first.query.limit, { _tag: 'Empty' });
  assert.equal(first.isQueryRunning, false);
  assert.equal(first.isQueryPlanRunning, false);
});

test('the public action Schema covers all builder operations', () => {
  const actions = [
    { _tag: 'ObjectSelected', objectName: 'Account' },
    { _tag: 'FieldsSelected', fieldNames: ['Id'] },
    { _tag: 'AllFieldsSelected' },
    { _tag: 'AllFieldsCleared' },
    {
      _tag: 'WhereConditionUpserted',
      condition: {
        index: 0,
        condition: {
          field: { fieldName: 'Name' },
          operator: '=',
          compareValue: { type: 'STRING', value: "'Acme'" }
        }
      },
      andOr: 'AND'
    },
    { _tag: 'WhereConditionRemoved', index: 0 },
    { _tag: 'WhereConjunctionChanged', andOr: 'OR' },
    { _tag: 'OrderByUpserted', orderBy: { field: 'Name', order: 'ASC', nulls: 'NULLS LAST' } },
    { _tag: 'OrderByRemoved', fieldName: 'Name' },
    { _tag: 'LimitChanged', limit: { _tag: 'Valid', value: 25 } },
    { _tag: 'AllRowsChanged', allRows: true },
    { _tag: 'NotificationsDismissed' },
    { _tag: 'SetDefaultOrgRequested' },
    { _tag: 'RunQueryRequested' },
    { _tag: 'QueryPlanRequested' }
  ];

  for (const action of actions) {
    assert.equal(Schema.is(SoqlBuilderActionSchema)(action), true, action._tag);
  }
});

test('represents empty, valid, and invalid limit input explicitly', () => {
  assert.deepEqual(soqlLimitFromInput(''), { _tag: 'Empty' });
  assert.deepEqual(soqlLimitFromInput('0'), { _tag: 'Valid', value: 0 });
  assert.deepEqual(soqlLimitFromInput('25'), { _tag: 'Valid', value: 25 });
  assert.deepEqual(soqlLimitFromInput('-1'), { _tag: 'Invalid', input: '-1' });
  assert.deepEqual(soqlLimitFromInput('1.5'), { _tag: 'Invalid', input: '1.5' });
  assert.deepEqual(soqlLimitFromInput('9007199254740992'), {
    _tag: 'Invalid',
    input: '9007199254740992'
  });

  assert.equal(Schema.is(SoqlLimitSchema)({ _tag: 'Valid', value: -1 }), false);
  assert.equal(Schema.is(SoqlLimitSchema)({ _tag: 'Valid', value: Number.MAX_SAFE_INTEGER + 1 }), false);
  assert.equal(Schema.is(SoqlLimitSchema)({ _tag: 'Invalid', input: '' }), false);
});
