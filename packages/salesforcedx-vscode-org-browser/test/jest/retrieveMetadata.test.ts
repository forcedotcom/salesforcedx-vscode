/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

jest.mock('vscode', () => ({
  TreeItem: class TreeItem {},
  TreeItemCollapsibleState: { None: 0, Collapsed: 1, Expanded: 2 },
  ThemeIcon: class ThemeIcon {
    constructor(public id: string) {}
  },
  env: { language: 'en' }
}));

const mockRetrieve = jest.fn(() => Effect.succeed('ok'));
jest.mock('../../src/services/orgBrowserMetadataRetrieveService', () => ({
  OrgBrowserRetrieveService: { retrieve: mockRetrieve }
}));

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as SubscriptionRef from 'effect/SubscriptionRef';
import { hasRetrieveTreeItem, retrieveEffect } from '../../src/commands/retrieveMetadata';
import { OrgBrowserTreeItem } from '../../src/tree/orgBrowserNode';

describe('hasRetrieveTreeItem', () => {
  it('rejects a missing inline-action argument', () => {
    expect(hasRetrieveTreeItem(undefined)).toBe(false);
  });
});

describe('retrieveEffect', () => {
  const node = new OrgBrowserTreeItem({
    kind: 'component',
    xmlName: 'ApexClass',
    componentName: 'FileUtilities',
    label: 'FileUtilities'
  });

  const projectComponentSet = {
    has: jest.fn(),
    getComponentFilenamesByNameAndType: jest.fn()
  };

  const treeProvider = { getChildren: jest.fn(), refreshType: jest.fn(), fireChangeEvent: jest.fn() };

  beforeEach(() => {
    projectComponentSet.has.mockReturnValue(true);
    projectComponentSet.getComponentFilenamesByNameAndType.mockReturnValue([]);
    mockRetrieve.mockReturnValue(Effect.succeed('ok'));
  });

  it('captures the org active when overwrite is confirmed and forwards it to the retrieve call', async () => {
    const mockServicesApi = {
      services: {
        ComponentSetService: { getComponentSetFromProjectDirectories: () => Effect.succeed(projectComponentSet) },
        TargetOrgRef: () => SubscriptionRef.make({ orgId: 'org-one' }),
        PromptService: Effect.succeed({ confirmOrThrow: () => Effect.void })
      }
    };
    const mockExtensionProvider = {
      getServicesApi: Effect.succeed(mockServicesApi)
    } as unknown as ExtensionProviderService;

    await Effect.runPromise(
      retrieveEffect(node, treeProvider as never).pipe(
        Effect.provideService(ExtensionProviderService, mockExtensionProvider)
      ) as Effect.Effect<unknown, never, never>
    );

    expect(mockRetrieve).toHaveBeenCalledWith([{ type: 'ApexClass', fullName: 'FileUtilities' }], true, 'org-one');
  });
});
