/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { SObject } from 'salesforcedx-vscode-services';
import { MetadataDescribeService } from 'salesforcedx-vscode-services/src/core/metadataDescribeService';
import { TransmogrifierService } from 'salesforcedx-vscode-services/src/core/transmogrifierService';
import type { CancellationToken, CompletionContext, Position, TextDocument } from 'vscode';
import { middleware } from '../../../src/lspClient/codeCompletion';

type SObjectSummary = { readonly name: string; readonly custom: boolean; readonly queryable: boolean };

const mockListSObjects = vi.fn<() => Effect.Effect<readonly SObjectSummary[]>>();
const mockDescribeSObject = vi.fn<(_name: string) => Effect.Effect<SObject>>();
const mockMetadataDescribe = {
  listSObjects: () => mockListSObjects(),
  describeCustomObject: (apiName: string) => mockDescribeSObject(apiName)
} as unknown as InstanceType<typeof MetadataDescribeService>;
const mockTransmogrifier = {
  toMinimalSObject: (value: SObject) => Effect.succeed(value)
} as unknown as InstanceType<typeof TransmogrifierService>;
const mockExtensionProvider = {
  getServicesApi: Effect.succeed({
    services: {
      MetadataDescribeService,
      TransmogrifierService
    }
  })
} as unknown as ExtensionProviderService;
const mockRunPromise = <A, E, R>(effect: Effect.Effect<A, E, R>): Promise<A> =>
  Effect.runPromise(
    effect.pipe(
      Effect.provideService(ExtensionProviderService, mockExtensionProvider),
      Effect.provideService(MetadataDescribeService, mockMetadataDescribe),
      Effect.provideService(TransmogrifierService, mockTransmogrifier)
    ) as Effect.Effect<A, E, never>
  );

vi.mock('../../../src/services/extensionProvider', () => ({
  getSoqlRuntime: () => ({ runPromise: mockRunPromise })
}));

const invokeCompletion = (label: string, soqlContext: Record<string, unknown> = {}) =>
  middleware.provideCompletionItem!(
    {} as TextDocument,
    {} as Position,
    {} as CompletionContext,
    {} as CancellationToken,
    vi.fn().mockResolvedValue([{ label, data: { soqlContext } }])
  );

const accountDescription: SObject = {
  name: 'Account',
  label: 'Account',
  custom: false,
  queryable: true,
  fields: [
    {
      aggregatable: false,
      custom: false,
      defaultValue: null,
      extraTypeInfo: null,
      filterable: true,
      groupable: true,
      inlineHelpText: null,
      label: 'Name',
      name: 'Name',
      nillable: false,
      picklistValues: [],
      referenceTo: [],
      relationshipName: null,
      sortable: true,
      type: 'string'
    }
  ],
  childRelationships: []
};

describe('SOQL completion metadata describe integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('expands the SObject placeholder from queryable catalog summaries', async () => {
    mockListSObjects.mockReturnValue(
      Effect.succeed([
        { name: 'Account', custom: false, queryable: true },
        { name: 'AsyncApexJob', custom: false, queryable: false },
        { name: 'Property__c', custom: true, queryable: true }
      ])
    );

    const result = await invokeCompletion('__SOBJECTS_PLACEHOLDER');

    expect(
      Array.isArray(result) ? result.map(item => (typeof item.label === 'string' ? item.label : item.label.label)) : []
    ).toEqual(['Account', 'Property__c']);
    expect(mockListSObjects).toHaveBeenCalledTimes(1);
  });

  it('expands the field placeholder from a catalog SObject description', async () => {
    mockDescribeSObject.mockReturnValue(Effect.succeed(accountDescription));

    const result = await invokeCompletion('__SOBJECT_FIELDS_PLACEHOLDER', { sobjectName: 'Account' });

    expect(
      Array.isArray(result) ? result.map(item => (typeof item.label === 'string' ? item.label : item.label.label)) : []
    ).toEqual(['Name']);
    expect(mockDescribeSObject).toHaveBeenCalledWith('Account');
  });
});
