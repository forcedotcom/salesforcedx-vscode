/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  MetadataTypeTreeProvider,
  passesTypeFilter,
  applyViewModeChildFilter
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

  it('substring-matches (case-insensitive) when no colon has been typed', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('apex', undefined);
    expect(passesTypeFilter(typeNode('ApexClass'), provider)).toBe(true);
    expect(passesTypeFilter(typeNode('ApexTrigger'), provider)).toBe(true);
    expect(passesTypeFilter(typeNode('CustomObject'), provider)).toBe(false);
  });

  it('exact-matches (case-insensitive) once a colon has been typed, even with an empty component filter', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('apexclass', '');
    expect(passesTypeFilter(typeNode('ApexClass'), provider)).toBe(true);
    expect(passesTypeFilter(typeNode('ApexTrigger'), provider)).toBe(false);
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

describe('applyViewModeChildFilter with component filter', () => {
  it('passes all nodes when componentFilter is undefined', () => {
    const provider = new MetadataTypeTreeProvider();
    const nodes = [componentNode('ApexClass', 'FooBar'), componentNode('ApexClass', 'Baz')];
    expect(applyViewModeChildFilter(nodes, provider)).toEqual(nodes);
  });

  it('substring-matches componentName case-insensitively when componentFilter is set', () => {
    const provider = new MetadataTypeTreeProvider();
    provider.setTextFilter('ApexClass', 'foo');
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
