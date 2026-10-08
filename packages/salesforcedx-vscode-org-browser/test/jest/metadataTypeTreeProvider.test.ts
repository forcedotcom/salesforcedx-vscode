/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService, type SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Fiber from 'effect/Fiber';
import type { OrgMetadataCatalogEntry } from 'salesforcedx-vscode-services';
import { OrgMetadataCatalog } from 'salesforcedx-vscode-services/src/orgCatalog/orgMetadataCatalog';
import * as vscode from 'vscode';
import {
  MetadataTypeTreeProvider,
  passesTypeFilter,
  applyViewModeChildFilter,
  filterTypesWithMatchingComponents,
  matchesGlobalSearch,
  suppressInactiveOrgOperation
} from '../../src/tree/metadataTypeTreeProvider';
import { OrgBrowserTreeItem } from '../../src/tree/orgBrowserNode';

const typeNode = (xmlName: string): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({ kind: 'type', xmlName, label: xmlName });

const componentNode = (xmlName: string, componentName: string): OrgBrowserTreeItem =>
  new OrgBrowserTreeItem({ kind: 'component', xmlName, componentName, label: componentName });

describe('passesTypeFilter', () => {
  it('passes everything when no type filter is set', () => {
    const provider = new MetadataTypeTreeProvider();
    expect(passesTypeFilter(typeNode('ApexClass'), provider)).toBe(true);
    expect(passesTypeFilter(typeNode('ApexTrigger'), provider)).toBe(true);
  });

  it('matches type names by case-insensitive substring without wildcards', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('apexc', undefined);
    expect(passesTypeFilter(typeNode('ApexClass'), provider)).toBe(true);
    expect(passesTypeFilter(typeNode('ApexTrigger'), provider)).toBe(false);
    expect(passesTypeFilter(typeNode('CustomObject'), provider)).toBe(false);
  });

  it('wildcard-matches when * is present', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('Apex*', undefined);
    expect(passesTypeFilter(typeNode('ApexClass'), provider)).toBe(true);
    expect(passesTypeFilter(typeNode('ApexTrigger'), provider)).toBe(true);
    expect(passesTypeFilter(typeNode('CustomObject'), provider)).toBe(false);
  });

  it('regex-matches when isRegex flag is true', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('Apex.*', undefined, true, false);
    expect(passesTypeFilter(typeNode('ApexClass'), provider)).toBe(true);
    expect(passesTypeFilter(typeNode('ApexTrigger'), provider)).toBe(true);
    expect(passesTypeFilter(typeNode('CustomObject'), provider)).toBe(false);
  });

  it('regex alternation works', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('(Apex|Custom).*', undefined, true, false);
    expect(passesTypeFilter(typeNode('ApexClass'), provider)).toBe(true);
    expect(passesTypeFilter(typeNode('CustomObject'), provider)).toBe(true);
    expect(passesTypeFilter(typeNode('Layout'), provider)).toBe(false);
  });

  it('invalid regex returns no match', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('Apex(', undefined, true, false);
    expect(passesTypeFilter(typeNode('ApexClass'), provider)).toBe(false);
  });
});

describe('org request status', () => {
  const statusItem = {
    text: '',
    show: jest.fn(),
    dispose: jest.fn()
  } as unknown as vscode.StatusBarItem;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(vscode.window, 'createStatusBarItem').mockReturnValue(statusItem);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    jest.mocked(statusItem.show).mockClear();
    jest.mocked(statusItem.dispose).mockClear();
  });

  it('does not show a status item for a request that resolves before the delay', async () => {
    const provider = new MetadataTypeTreeProvider();

    await Effect.runPromise(provider.trackOrgRequest('Discovering org metadata', Effect.void));
    jest.advanceTimersByTime(300);

    expect(vscode.window.createStatusBarItem).not.toHaveBeenCalled();
  });

  it('shows and disposes one aggregate status item for overlapping org requests', async () => {
    const provider = new MetadataTypeTreeProvider();
    const first = await Effect.runPromise(
      provider.trackOrgRequest('Discovering org metadata', Effect.never).pipe(Effect.forkDaemon)
    );
    const second = await Effect.runPromise(
      provider.trackOrgRequest('Discovering org metadata', Effect.never).pipe(Effect.forkDaemon)
    );

    await Promise.resolve();
    jest.advanceTimersByTime(300);

    expect(vscode.window.createStatusBarItem).toHaveBeenCalledWith(vscode.StatusBarAlignment.Left, 99);
    expect(statusItem.text).toBe('$(sync~spin) Discovering org metadata (2 requests)');
    expect(statusItem.show).toHaveBeenCalledTimes(1);

    await Effect.runPromise(first.pipe(Fiber.interrupt));
    expect(statusItem.text).toBe('$(sync~spin) Discovering org metadata');
    await Effect.runPromise(second.pipe(Fiber.interrupt));

    expect(statusItem.dispose).toHaveBeenCalledTimes(1);
  });
});

describe('MetadataTypeTreeProvider text filter state', () => {
  it('defaults to no text filter', () => {
    const provider = new MetadataTypeTreeProvider();
    expect(provider.typeFilter).toBeUndefined();
    expect(provider.componentFilter).toBeUndefined();
  });

  it('setTextFilter stores both values and fires a change event', () => {
    const provider = new MetadataTypeTreeProvider();
    const listener = jest.fn();
    provider.onDidChangeTreeData(listener);

    provider.setTextFilter('ApexClass', 'Foo');

    expect(provider.typeFilter).toBe('ApexClass');
    expect(provider.componentFilter).toBe('Foo');
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('can restore a filter without immediately refreshing the tree', () => {
    const provider = new MetadataTypeTreeProvider();
    const listener = jest.fn();
    provider.onDidChangeTreeData(listener);

    provider.setTextFilter(undefined, 'Broker', false, false, false, false);

    expect(listener).not.toHaveBeenCalled();
  });

  it('clearTextFilter resets both values and fires a change event', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('ApexClass', 'Foo');
    const listener = jest.fn();
    provider.onDidChangeTreeData(listener);

    provider.clearTextFilter();

    expect(provider.typeFilter).toBeUndefined();
    expect(provider.componentFilter).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('records that results should be hidden for an incomplete structured search', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter(undefined, '/Apex', false, false, true);

    expect(provider.hideResults).toBe(true);
  });

  it('leaves root refresh ownership to the coordinator during full-org discovery', () => {
    const provider = new MetadataTypeTreeProvider();
    const listener = jest.fn();
    provider.onDidChangeTreeData(listener);

    provider.markFullDiscoveryStarted('org-one');

    expect(listener).not.toHaveBeenCalled();
  });
});

describe('full discovery org scope', () => {
  it('resets the discovery allowance on a top-level refresh', async () => {
    const provider = new MetadataTypeTreeProvider();
    provider.markFullDiscoveryStarted('org-one');

    // The catalog call is exercised by integration tests; this unit test verifies session state.
    await expect(provider.refreshType()).rejects.toThrow();

    expect(provider.hasStartedFullDiscovery('org-one')).toBe(false);
  });
});

describe('MetadataTypeTreeProvider root node identity', () => {
  it('reuses the same root element for a metadata type across refresh projections', () => {
    const provider = new MetadataTypeTreeProvider();

    const firstAuraNode = provider.getTypeNode('AuraDefinitionBundle');
    const secondAuraNode = provider.getTypeNode('AuraDefinitionBundle');
    const actionLinkNode = provider.getTypeNode('ActionLinkGroupTemplate');

    expect(secondAuraNode).toBe(firstAuraNode);
    expect(firstAuraNode.id).toBe('AuraDefinitionBundle');
    expect(firstAuraNode.xmlName).toBe('AuraDefinitionBundle');
    expect(actionLinkNode).not.toBe(firstAuraNode);
  });
});

describe('MetadataTypeTreeProvider empty-tree context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('updates the context only when the empty state changes', async () => {
    const provider = new MetadataTypeTreeProvider();

    await provider.updateTreeEmptyContext(false);
    await provider.updateTreeEmptyContext(true);
    await provider.updateTreeEmptyContext(true);
    await provider.updateTreeEmptyContext(false);

    expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(1, 'setContext', 'sf:orgBrowser.treeEmpty', true);
    expect(vscode.commands.executeCommand).toHaveBeenNthCalledWith(2, 'setContext', 'sf:orgBrowser.treeEmpty', false);
    expect(vscode.commands.executeCommand).toHaveBeenCalledTimes(2);
  });
});

describe('superseded org requests', () => {
  it('discards children from an acquisition tied to the former org', async () => {
    const children = await Effect.runPromise(
      Effect.fail({
        _tag: 'InactiveOrgOperationError' as const,
        message: 'org changed',
        expectedOrgId: 'org-one',
        observedOrgId: 'org-two'
      }).pipe(suppressInactiveOrgOperation)
    );

    expect(children).toEqual([]);
  });
});

describe('applyViewModeChildFilter with component filter', () => {
  it('passes all nodes when componentFilter is undefined', () => {
    const provider = new MetadataTypeTreeProvider();
    const nodes = [componentNode('ApexClass', 'FooBar'), componentNode('ApexClass', 'Baz')];
    expect(applyViewModeChildFilter(nodes, provider)).toEqual(nodes);
  });

  it('matches componentName by case-insensitive substring without wildcards', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('ApexClass', 'oObA');
    const foo = componentNode('ApexClass', 'FooBar');
    const baz = componentNode('ApexClass', 'Baz');
    expect(applyViewModeChildFilter([foo, baz], provider)).toEqual([foo]);
  });

  it.each([
    ['apexc', false],
    ['Apex*', false],
    ['^apexc', true]
  ])('keeps all components when global pattern %s matches the metadata type name', (pattern, isRegex) => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter(undefined, pattern, false, isRegex);
    const nodes = [componentNode('ApexClass', 'FooBar'), componentNode('ApexClass', 'Baz')];
    expect(applyViewModeChildFilter(nodes, provider)).toEqual(nodes);
  });

  it('wildcard-matches componentName when componentFilter contains *', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('ApexClass', '*Bar');
    const foo = componentNode('ApexClass', 'FooBar');
    const baz = componentNode('ApexClass', 'Baz');
    expect(applyViewModeChildFilter([foo, baz], provider)).toEqual([foo]);
  });

  it('treats an empty componentFilter as a no-op (colon typed, nothing after it yet)', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('ApexClass', '');
    const nodes = [componentNode('ApexClass', 'FooBar'), componentNode('ApexClass', 'Baz')];
    expect(applyViewModeChildFilter(nodes, provider)).toEqual(nodes);
  });
});

describe('matchesGlobalSearch', () => {
  it('matches a custom field by its field name rather than its parent object name', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter(undefined, 'AccountNumber');

    expect(matchesGlobalSearch(componentNode('CustomField', 'Account.AccountNumber'), provider)).toBe(true);
    expect(matchesGlobalSearch(componentNode('CustomField', 'Account.Industry'), provider)).toBe(false);
  });
});

describe('full discovery state', () => {
  it('tracks one discovery per org', () => {
    const provider = new MetadataTypeTreeProvider();

    provider.markFullDiscoveryStarted('org-one');

    expect(provider.hasStartedFullDiscovery('org-one')).toBe(true);
    expect(provider.hasStartedFullDiscovery('org-two')).toBe(false);
  });
});

describe('component filtering failures', () => {
  it('keeps successful types when another metadata type cannot be listed', async () => {
    const provider = new MetadataTypeTreeProvider();
    const apexClass = typeNode('ApexClass');
    const contentWorkspace = typeNode('ContentWorkspace');
    provider.setTextFilter('*', 'Broker');
    const getChildren = jest.fn((reference: { type?: string }) =>
      reference.type === 'ContentWorkspace'
        ? Effect.fail(new Error('Metadata API list is unsupported'))
        : Effect.succeed([
            {
              kind: 'component',
              reference: { type: 'ApexClass', fullName: 'BrokerService' }
            } as OrgMetadataCatalogEntry
          ])
    );
    const api = { services: { OrgMetadataCatalog } } as unknown as SalesforceVSCodeServicesApi;
    const service = { getServicesApi: Effect.succeed(api) };

    const result = await Effect.runPromise(
      filterTypesWithMatchingComponents([apexClass, contentWorkspace], provider).pipe(
        Effect.provideService(ExtensionProviderService, service),
        Effect.provideService(OrgMetadataCatalog, { getChildren } as unknown as OrgMetadataCatalog)
      )
    );

    expect(result).toEqual([apexClass]);
  });
});
