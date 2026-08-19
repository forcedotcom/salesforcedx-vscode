/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import {
  MetadataTypeTreeProvider,
  passesTypeFilter,
  applyViewModeChildFilter,
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

  it('exact-matches (case-insensitive) without wildcards', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('ApexClass', undefined);
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
      suppressInactiveOrgOperation(
        Effect.fail({
          _tag: 'InactiveOrgOperationError' as const,
          message: 'org changed',
          expectedOrgId: 'org-one',
          observedOrgId: 'org-two'
        })
      )
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

  it('exact-matches componentName case-insensitively when componentFilter is set without wildcards', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('ApexClass', 'FooBar');
    const foo = componentNode('ApexClass', 'FooBar');
    const baz = componentNode('ApexClass', 'Baz');
    expect(applyViewModeChildFilter([foo, baz], provider)).toEqual([foo]);
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
